import express from 'express'
import { readVerifier, verifyPassword } from './password.ts'
import { createServer } from 'node:http'
import { randomBytes, createHash } from 'node:crypto'
import path from 'node:path'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { WebSocket, WebSocketServer } from 'ws'
import { avatarFile, discoverProfiles, getProfileDirectory, resolveHermesHome, VALID_PROFILE } from './profiles.ts'
import { nativeTarget } from './runtime.ts'
import { allowedRequest } from './bridge-policy.ts'

import { frameLimit, ImageMessages } from './image-message.ts'

const app = express()
const server = createServer(app)
const wss = new WebSocketServer({ noServer: true, maxPayload: frameLimit, handleProtocols: () => 'pocket-v1' })
const port = Number(process.env.COMPANION_PORT || 4177)
const host = process.env.COMPANION_HOST || '127.0.0.1'
if (host !== '127.0.0.1' || !Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid loopback endpoint')
const origins = new Set([`http://127.0.0.1:${port}`, `http://localhost:${port}`])
if (process.env.COMPANION_ORIGIN) {
  const origin = new URL(process.env.COMPANION_ORIGIN)
  if (origin.protocol !== 'https:') throw new Error('Private origin must use HTTPS')
  origins.add(origin.origin)
}
const allowedHosts = new Set([...origins].map(origin => new URL(origin).host))
const home = resolveHermesHome()
const identity = { connectionId: process.env.COMPANION_CONNECTION_ID || 'windows-local', connectionName: process.env.COMPANION_CONNECTION_NAME || 'Windows Hermes', preferredProfile:process.env.COMPANION_PREFERRED_PROFILE }
const digest = (value: string) => createHash('sha256').update(value).digest()
const verifier = readVerifier()
const sessions = new Map<string,number>()
const authorized = (token: string) => /^[0-9a-f]{64}$/.test(token) && (sessions.get(digest(token).toString('hex')) || 0) > Date.now()
const bearer = (req: express.Request) => req.get('authorization')?.replace(/^Bearer /, '') || ''
const requireAuth: express.RequestHandler = (req,res,next) => {
  if (authorized(bearer(req))) next()
  else res.status(401).json({error:'Sign in required'})
}
app.disable('x-powered-by')
app.use((req,res,next) => {
  if (!allowedHosts.has(req.headers.host || '') || (req.headers.origin && !origins.has(req.headers.origin))) {
    res.sendStatus(403); return
  }
  res.set({ 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff', 'Referrer-Policy':'no-referrer',
    'Content-Security-Policy': "default-src 'self'; img-src 'self' blob: data:; style-src 'self' 'unsafe-inline'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'" })
  next()
})
app.use(express.json({limit:'16kb'}))
app.get('/api/me',(req,res) => res.json(authorized(bearer(req)) ? {...identity,authenticated:true} : {authenticated:false}))
let failures = 0, resetAt = 0
app.post('/api/login',async (req,res) => {
  if (!origins.has(req.headers.origin || '') || !req.is('application/json')) { res.sendStatus(403); return }
  if (Date.now() >= resetAt) { failures = 0; resetAt = Date.now() + 900000 }
  if (failures >= 5) { res.status(429).json({error:'Try again in 15 minutes.'}); return }
  failures++
  if (!await verifyPassword(req.body?.password, verifier)) {
    res.status(401).json({error:'Incorrect password'}); return
  }
  failures = 0
  for (const [key,expiry] of sessions) if (expiry <= Date.now()) sessions.delete(key)
  const token = randomBytes(32).toString('hex')
  sessions.set(digest(token).toString('hex'), Date.now() + 7*86400000)
  res.json({token})
})
app.post('/api/logout',requireAuth,(req,res) => { sessions.delete(digest(bearer(req)).toString('hex')); res.sendStatus(204) })
app.get('/api/profiles',requireAuth,(_req,res) => res.json({...identity,profiles:discoverProfiles(home)}))
app.get('/api/profiles/:id/avatar',requireAuth,(req,res) => {
  const id=String(req.params.id)
  if (!VALID_PROFILE.test(id) || !discoverProfiles(home).some(p=>p.id===id)) { res.sendStatus(404); return }
  const img=avatarFile(getProfileDirectory(home,id))
  if (!img) { res.sendStatus(404); return }
  res.type(img.mime).send(readFileSync(img.path))
})
server.on('upgrade',(req,socket,head) => {
  const url = new URL(req.url || '/', 'http://localhost')
  const profile = url.searchParams.get('profile') || ''
  const protocols = (req.headers['sec-websocket-protocol'] || '').split(',').map(x=>x.trim())
  const token = protocols[1]?.replace(/^pocket-auth\./,'') || ''
  const origin=req.headers.origin || ''
  if (!origins.has(origin) || !allowedHosts.has(req.headers.host || '') || url.pathname !== '/api/gateway' ||
      protocols.length!==2 || protocols[0]!=='pocket-v1' || !protocols[1]?.startsWith('pocket-auth.') || !authorized(token) || !VALID_PROFILE.test(profile) ||
      !discoverProfiles(home).some(p=>p.id===profile)) {
    socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n'); return
  }
  wss.handleUpgrade(req,socket,head,browser => {
    let owner: WebSocket | undefined
    const images = new ImageMessages(path.join(getProfileDirectory(home,profile),'cache','images'))
    const questions = new Map<string, boolean>()
    const approvals = new Map<string, { session: string; generation: number; once: boolean }>()
    function remember(session: string, prompt: Record<string, unknown>) {
      if (typeof prompt.prompt_id !== 'string' || typeof prompt.execution_generation !== 'number') return
      approvals.set(prompt.prompt_id, {session, generation:prompt.execution_generation,
        once:typeof prompt.command==='string' && !!prompt.command.trim() && Array.isArray(prompt.choices) && prompt.choices.includes('once')})
    }
    const fail = () => browser.close(1011,'Hermes connection unavailable')
    const timer = setInterval(() => { if (!authorized(token)) browser.close(1008,'Sign in required') },30000)
    browser.on('close',()=>{clearInterval(timer); images.close(); owner?.close()})
    browser.on('error',()=>browser.terminate())
    browser.on('message',data=>{
      if (!authorized(token)) { browser.close(1008); return }
      if (owner?.readyState!==WebSocket.OPEN) return
      try {
        const frame=JSON.parse(data.toString())
        if (frame.jsonrpc !== '2.0') return
        if (typeof frame.method === 'string' && Number.isSafeInteger(frame.id) && frame.id > 0) {
          if (frame.method === 'pocket.sendImage') {
            const reply=(body: object) => { if (browser.readyState===WebSocket.OPEN) browser.send(JSON.stringify({jsonrpc:'2.0',id:frame.id,...body})) }
            void images.send(owner,frame.params || {}).then(result=>reply({result})).catch(e=>reply({error:{code:-32001,message:e.message}}))
            return
          }
          const approval = approvals.get(frame.params?.prompt_id)
          const matches = frame.method!=='approval.respond' || (approval && approval.session===frame.params.session_id &&
            approval.generation===frame.params.execution_generation && (frame.params.choice==='deny' || approval.once))
          if (!frame.params || !allowedRequest(frame.method,frame.params) || !matches) {
            browser.send(JSON.stringify({jsonrpc:'2.0',id:frame.id,error:{code:-32601,message:'Unsupported Pocket action'}})); return
          }
          owner.send(JSON.stringify({jsonrpc:'2.0',id:frame.id,method:frame.method,params:frame.params}))
        } else if (typeof frame.id==='string' && questions.has(frame.id)) {
          const canApprove=questions.get(frame.id)
          const choice=frame.result?.choice
          if (choice==='deny' || (choice==='once' && canApprove)) {
            owner.send(JSON.stringify({jsonrpc:'2.0',id:frame.id,result:{choice}}))
            questions.delete(frame.id)
          } else if (frame.error) {
            owner.send(JSON.stringify({jsonrpc:'2.0',id:frame.id,error:{code:-32601,message:'Interaction unsupported'}}))
            questions.delete(frame.id)
          }
        }
      } catch { browser.close(1003,'Invalid frame') }
    })
    void nativeTarget(home,profile).then(target=>{
      if (browser.readyState!==WebSocket.OPEN) return
      owner=new WebSocket(target.url,target.protocols,{handshakeTimeout:10000,maxPayload:32*1024*1024})
      owner.on('error',fail)
      owner.on('close',fail)
      owner.on('message',data=>{
        if (browser.readyState!==WebSocket.OPEN) return
        if (owner?.protocol!=='hermes-gateway-v1') { fail(); return }
        try {
          const frame=JSON.parse(data.toString())
          if (images.receive(frame)) return
          if (typeof frame.id==='string' && frame.method) {
            if (frame.method!=='approval') {
              owner?.send(JSON.stringify({jsonrpc:'2.0',id:frame.id,error:{code:-32601,message:'Interaction unsupported'}}))
              return
            }
            questions.set(frame.id, typeof frame.params?.command==='string' && !!frame.params.command.trim())
          }
          if (frame.params?.type==='approval.request') remember(frame.params.session_id,frame.params.payload)
          if (frame.params?.type==='approval.settled') approvals.delete(frame.params.payload?.prompt_id)
          for (const p of frame.result?.prompts || []) if (p.kind==='approval') remember(frame.result.session_id,p)
          if (frame.params?.type==='request.cancel') questions.delete(frame.params.payload?.id)
          for (const q of frame.result?.open_requests || []) questions.set(q.id,q.method==='approval' && !!q.params?.command)
          browser.send(data.toString())
        } catch { fail() }
      })
    }).catch(fail)
  })
})
const dist=fileURLToPath(new URL('../dist/',import.meta.url))
app.use(express.static(dist,{index:false}))
app.get('/{*any}',(_req,res)=>res.sendFile(path.join(dist,'index.html')))
server.listen(port,host)
