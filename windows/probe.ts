import { WebSocket } from 'ws'
import { nativeTarget } from '../server/runtime.ts'
import { discoverProfiles } from '../server/profiles.ts'

const home = process.env.HERMES_HOME!
const profiles = discoverProfiles(home)
const requested = process.env.COMPANION_PREFERRED_PROFILE
const candidates = requested ? profiles.filter(p => p.id === requested) : profiles
let found = false
for (const profile of candidates) {
  try {
    const target = await nativeTarget(home, profile.id)
    await new Promise<void>((resolve,reject) => {
      const ws = new WebSocket(target.url,target.protocols,{handshakeTimeout:5000})
      const timer = setTimeout(() => {ws.terminate();reject(Error())},8000)
      ws.on('error',reject)
      ws.on('close',() => {clearTimeout(timer);reject(Error())})
      ws.on('message',data => {
        try {
          const frame=JSON.parse(data.toString())
          if (ws.protocol === 'hermes-gateway-v1' && (frame.params?.type === 'gateway.ready' || frame.method === 'gateway.ready')) {
            clearTimeout(timer);resolve();ws.close()
          }
        } catch { /* Ignore unrelated frames. */ }
      })
    })
    console.log(profile.id)
    found = true
    break
  } catch { /* A discovered profile may be stopped. */ }
}
if (!found) {console.error('Open a Hermes bot locally, then run setup again.');process.exitCode=1}
