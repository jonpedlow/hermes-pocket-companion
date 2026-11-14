import { api, tokenKey } from './auth.ts'
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  ArrowRight, Check, CircleHelp, Clock3, ImagePlus, Settings2,
  History, LockKeyhole, Menu, Mic, Moon, Plus,
  Search, Send, ShieldCheck, Sparkles, Sun, X
} from 'lucide-react'
import { CopyButton, ImageCard, imageAttachment, RichMessage, type ImageAttachment } from './RichMessage.tsx'
import { ChatMessage, extractText, GatewayEvent, HermesGateway, HermesProfile, normalizeMessages, PendingQuestion } from './protocol.ts'

import { accentInk, avatarAccent, fallbackAccent, fontSizes, savedFontSize, type FontSize } from './appearance.ts'

type Identity = { authenticated: boolean; preferredProfile?: string; connectionId: string; connectionName: string }
type SessionChoice = { session_id: string; title: string; last_active_at?: string }
type DisplayMessage = ChatMessage & { image?: ImageAttachment }

// Keep the last three submitted previews in memory. Older cards keep only metadata.
function attachPreview(messages: DisplayMessage[], messageId: string, file: File): DisplayMessage[] {
  if (!messages.some(message => message.id === messageId)) return messages
  const older = messages.filter(message => message.image?.file).slice(0, -2)
  return messages.map(message => {
    if (message.id === messageId) return { ...message, image: imageAttachment(file) }
    if (older.includes(message)) return { ...message, image: { ...message.image!, file: undefined } }
    return message
  })
}
const formatTime = (date: number) => new Date(date).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
const id = () => crypto.randomUUID()

function ProfileAvatar({ profile, onAccent }: {profile: HermesProfile; onAccent?: (colour: string)=>void}) {
  const [src,setSrc] = useState('')
  useEffect(() => {
    let active=true
    if (!profile.avatarUrl) setSrc('')
    else void api(profile.avatarUrl).then(r=>r.ok ? r.blob() : null).then(blob=>{
      if (active && blob) setSrc(URL.createObjectURL(blob))
    }).catch(()=>{})
    return ()=>{active=false}
  }, [profile])
  useEffect(()=>()=>{if(src) URL.revokeObjectURL(src)},[src])
  return <div className="avatar" aria-hidden="true">
    {src ? <img src={src} alt="" onLoad={e=>{ if (onAccent) {const colour=avatarAccent(e.currentTarget); if (colour) onAccent(colour)} }} onError={()=>setSrc('')}/> : <span>{profile.initials}</span>}
  </div>
}

function LockScreen({ onLogin, error, busy }: { onLogin: (password: string) => void; error: string; busy: boolean }) {
  const [password, setPassword] = useState('')
  return <main className="lock-screen">
    <div className="lock-card">

      <img className="pocket-icon sign-in-icon" src="/pocket-companion.svg" alt="" />
      <h1>Pocket Companion</h1>
      <p>Sign in to talk with your Hermes bots.</p>
      <form onSubmit={e => { e.preventDefault(); if (password.trim()) onLogin(password) }}>
        <label htmlFor="password">Companion password</label>
        <div className="password-wrap"><LockKeyhole size={17}/><input name="password" autoCapitalize="none" spellCheck={false} id="password" type="password" autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" required /></div>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="primary-button full" disabled={busy} type="submit">{busy ? 'Signing in…' : 'Sign in'} <ArrowRight size={17}/></button>
      </form>
      <span className="lock-foot"><ShieldCheck size={14}/> Independent Hermes client · Local-first</span>
    </div>
  </main>
}

function firstSession(result: unknown): SessionChoice[] {
  const source = result && typeof result === 'object' ? result as Record<string, unknown> : {}
  const items = Array.isArray(result) ? result : (Array.isArray(source.sessions) ? source.sessions : [])
  return items.flatMap((item: unknown) => {
    if (!item || typeof item !== 'object') return []
    const row = item as Record<string, unknown>
    const sid = row.session_id || row.id || row.stored_session_id
    if (typeof sid !== 'string') return []
    return [{ session_id: sid, title: String(row.title || row.preview || 'Conversation').slice(0, 75), last_active_at: typeof row.last_active_at === 'string' ? row.last_active_at : undefined }]
  }).slice(0, 24)
}

export default function App() {
  const [identity, setIdentity] = useState<Identity | null>(null)
  const [authBusy, setAuthBusy] = useState(false)
  const [authError, setAuthError] = useState('')
  const [profiles, setProfiles] = useState<HermesProfile[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [status, setStatus] = useState<'connecting' | 'connected' | 'offline'>('connecting')
  const [notice, setNotice] = useState('')
  const [activity, setActivity] = useState('')
  const [composer, setComposer] = useState('')
  const [sending, setSending] = useState(false)
  const [sideOpen, setSideOpen] = useState(false)
  const [search, setSearch] = useState('')
  const menuTrigger = useRef<HTMLButtonElement>(null)
  const closePicker = useRef<HTMLButtonElement>(null)
  const mobileQuery = '(max-width:700px)'
  const [mobile, setMobile] = useState(()=>matchMedia(mobileQuery).matches)
  useEffect(()=>{
    const query=matchMedia(mobileQuery)
    const resize=()=>{setMobile(query.matches); if(!query.matches)setSideOpen(false)}
    query.addEventListener('change',resize)
    return ()=>query.removeEventListener('change',resize)
  },[])
  useEffect(()=>{
    if (!mobile || !sideOpen) return
    closePicker.current?.focus({preventScroll:true})
    const closeOnEscape=(event:KeyboardEvent)=>{if(event.key==='Escape')setSideOpen(false)}
    window.addEventListener('keydown',closeOnEscape)
    return ()=>{window.removeEventListener('keydown',closeOnEscape);menuTrigger.current?.focus({preventScroll:true})}
  },[mobile,sideOpen])
  const [historyOpen, setHistoryOpen] = useState(false)
  const [recent, setRecent] = useState<SessionChoice[]>([])
  const [approval, setApproval] = useState<PendingQuestion | null>(null)
  const [dark,setDark] = useState(()=>localStorage.getItem('pocket-appearance-v2') !== 'light')
  const [fontSize,setFontSize] = useState<FontSize>(savedFontSize)
  const [settingsOpen,setSettingsOpen] = useState(false)
  const [sampled,setSampled] = useState<{profile:HermesProfile;colour:string} | null>(null)
  const [overrideRevision,refreshOverride] = useState(0)
  const [photo,setPhoto] = useState<File | null>(null)
  const photoInput=useRef<HTMLInputElement>(null)
  const editor=useRef<HTMLTextAreaElement>(null)
  const settingsButton=useRef<HTMLButtonElement>(null)
  const [micActive, setMicActive] = useState(false)
  const clientRef = useRef<HermesGateway | null>(null)
  const followLatest = useRef(true)
  const transcriptEnd = useRef<HTMLDivElement>(null)
  const sessionRef = useRef<string | null>(null)
  const streamingId = useRef<string | null>(null)

  const [activityRows,setActivityRows] = useState<string[]>([])
  const [windowSize,setWindowSize] = useState(36)
  const [attempt,setAttempt] = useState(0)
  const activeProfile = profiles.find(p => p.id === selected)
  const accentKey = `pocket-accent:${identity?.connectionId}:${selected}`
  const customColour = localStorage.getItem(accentKey)
  const accent = customColour && /^#[0-9a-f]{6}$/i.test(customColour) ? customColour :
    (sampled && sampled.profile === activeProfile ? sampled.colour : fallbackAccent(selected || ''))
  function chooseAccent(colour?:string) {
    if (colour) localStorage.setItem(accentKey,colour)
    else localStorage.removeItem(accentKey)
    refreshOverride(overrideRevision+1)
  }
  useLayoutEffect(()=>{
    const el=editor.current
    if (el) {el.style.height='0px'; el.style.height=el.scrollHeight+'px'}
  },[composer,fontSize,status])
  useEffect(()=>{localStorage.setItem('pocket-font-size',fontSize)},[fontSize])
  useEffect(()=>{
    if (!settingsOpen) return
    const close=(event:KeyboardEvent)=>{if(event.key==='Escape')setSettingsOpen(false)}
    window.addEventListener('keydown',close)
    return ()=>{window.removeEventListener('keydown',close);settingsButton.current?.focus()}
  },[settingsOpen])
  const storageKey = identity && selected ? `pocket-session:${identity.connectionId}:${selected}` : ''

  useEffect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light'; document.querySelector('meta[name="theme-color"]')?.setAttribute('content',dark?'#101012':'#fafafa'); localStorage.setItem('pocket-appearance-v2', dark ? 'dark' : 'light') }, [dark])
  useEffect(() => {
    const signedOut = {authenticated:false, connectionId:'local', connectionName:'Hermes'}
    async function check() {
      try {
        const response = await api('/api/me')
        if (!response.ok) throw Error()
        const me = await response.json() as Identity
        if (!me.authenticated && localStorage.getItem(tokenKey)) {
          localStorage.removeItem(tokenKey)
          setAuthError('Your session ended. Sign in again.')
        }
        setIdentity(previous => previous?.authenticated && me.authenticated ? previous : me)
      } catch {
        setIdentity(previous => previous || signedOut)
        setAuthError('Could not reach Pocket. Check your connection and try again.')
      }
    }
    const visible = () => { if (!document.hidden) void check() }
    void check()
    document.addEventListener('visibilitychange', visible)
    window.addEventListener('pocket-check-session', visible)
    return () => {document.removeEventListener('visibilitychange', visible);window.removeEventListener('pocket-check-session', visible)}
  }, [])
  useEffect(() => { if (followLatest.current) transcriptEnd.current?.scrollIntoView({ block: 'end' }) }, [messages, activity])

  const reloadProfiles = useCallback(async () => {
    const response = await api('/api/profiles')
    if (!response.ok) throw new Error('Could not load profiles')
    const result = await response.json() as { profiles: HermesProfile[] }
    setProfiles(result.profiles)
    setSelected(previous => previous && result.profiles.some(p => p.id === previous) ? previous : (result.profiles.find(p => p.id === localStorage.getItem('pocket-last-profile')) || result.profiles.find(p => p.id === identity?.preferredProfile) || result.profiles.find(p => p.id !== 'default') || result.profiles[0])?.id || null)
  }, [identity?.preferredProfile])

  useEffect(() => {
    if (!identity?.authenticated) return
    const refresh=()=>void reloadProfiles().catch(e=>setNotice(e.message))
    refresh()
    const refreshDesktop=()=>{if (!matchMedia(mobileQuery).matches) refresh()}
    window.addEventListener('focus',refreshDesktop)
    return ()=>window.removeEventListener('focus',refreshDesktop)
  }, [identity,reloadProfiles])

  useEffect(() => {
    if (!identity?.authenticated || !selected) return
    let cancelled = false
    const gateway = new HermesGateway(selected)
    clientRef.current = gateway
    localStorage.setItem('pocket-last-profile', selected)
    setMessages([])
    setSessionId(null)
    followLatest.current = true
    setWindowSize(36)
    setActivityRows([])
    setPhoto(null)
    setComposer('')
    setRecent([])
    setHistoryOpen(false)
    setApproval(null)
    setActivity('')
    setStatus('connecting')
    setNotice('')
    setSending(false)
    sessionRef.current = null
    streamingId.current = null

    gateway.onClose = text => { if (!cancelled) { setStatus('offline'); setNotice(text); setSending(false); window.dispatchEvent(new Event('pocket-check-session')) } }
    gateway.onQuestion = question => { if (!cancelled && question.params.session_id === sessionRef.current) setApproval(question) }
    gateway.onEvent = (event: GatewayEvent) => {
      if (cancelled) return
      if (event.session_id && event.session_id !== sessionRef.current) return
      if (event.type === 'message.delta') {
        const piece = extractText(event.delta ?? event.text ?? event.message)
        if (!piece) return
        const currentId = streamingId.current || (streamingId.current = id())
        setMessages(old => {
          const index = old.findIndex(message => message.id === currentId)
          if (index === -1) return [...old, { id: currentId, role: 'assistant', content: piece, time: Date.now() }]
          return old.map(message => message.id === currentId ? { ...message, content: message.content + piece } : message)
        })
        setActivity('Writing a response…')
      }
      if (event.type === 'message.complete') {
        const finished = extractText(event.message ?? event.text)
        const currentId = streamingId.current
        if (finished && currentId) setMessages(old => old.map(x => x.id === currentId ? { ...x, content: finished } : x))
        if (finished && !currentId) setMessages(old => [...old, { id: id(), role: 'assistant', content: finished, time: Date.now() }])
        streamingId.current = null
        setSending(false)
        setActivity('')
      }
      if (event.type.startsWith('tool.')) {
        const tool = String(event.tool_name || event.name || event.tool || 'tool')
        if (event.type === 'tool.start' || event.type === 'tool.complete') {
          setActivityRows(rows => [...rows.slice(-59), tool + (event.type === 'tool.start' ? ' · started' : event.is_error ? ' · failed' : ' · completed')])
        }
        setActivity(event.type === 'tool.complete' ? 'Checking results…' : `Working with ${tool}…`)
      }
      if (event.type === 'approval.request' && typeof event.prompt_id === 'string') {
        setApproval({ id: event.prompt_id, method: 'approval.respond', params: event })
      }
      if (event.type === 'request.cancel' || event.type === 'approval.settled')
        setApproval(q => q?.id === (event.prompt_id ?? event.id) ? null : q)
      if (event.type === 'session.error' || event.type === 'message.error') {
        setNotice(extractText(event.message) || 'The agent could not finish this turn')
        setSending(false)
        setActivity('')
      }
    }

    void (async () => {
      try {
        await gateway.ready
        if (cancelled) return
        const key = `pocket-session:${identity.connectionId}:${selected}`
        let remembered = localStorage.getItem(key)
        if (!remembered) {
          const result = await gateway.request('session.list',{title:'Bot Chat',include_hidden:true}) as {sessions: {session_id:string}[]}
          remembered = result.sessions[0]?.session_id || null
        }
        if (remembered) {
          const result = await gateway.request('session.resume', { session_id: remembered })
          if (cancelled) return
          localStorage.setItem(key, remembered)
          sessionRef.current = remembered
          setSessionId(remembered)
          setMessages(normalizeMessages(result))
          const data = result && typeof result === 'object' ? result as Record<string, unknown> : {}
          const prompt = Array.isArray(data.prompts) && data.prompts.find(p=>p.kind==='approval')
          if (prompt) setApproval({id:prompt.prompt_id,method:'approval.respond',params:prompt})
          setSending(data.running === true)
          if (data.running) setActivity('Agent is working…')
          if (Array.isArray(data.open_requests)) {
            const waiting = data.open_requests.find(x => x && typeof x === 'object' && (x as {method?: string}).method === 'approval') as PendingQuestion | undefined
            if (waiting) setApproval(waiting)
          }
        } else {
          // No session is created until the user actually sends a message.
          sessionRef.current = null
          setSessionId(null)
        }
        if (!cancelled) setStatus('connected')
      } catch (error) {
        if (!cancelled) { setStatus('offline'); setNotice((error as Error).message) }
      }
    })()

    return () => { cancelled = true; gateway.close(); if (clientRef.current === gateway) clientRef.current = null }
  }, [identity, selected, attempt])

  const doLogin = async (password: string) => {
    setAuthBusy(true)
    setAuthError('')
    try {
      const res = await api('/api/login', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password }) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not sign in')
      localStorage.setItem(tokenKey, data.token)
      const me = await api('/api/me').then(r => r.json())
      setIdentity(me)
    } catch (e) { setAuthError(e instanceof TypeError || e instanceof SyntaxError ? 'Could not reach Pocket. Check your connection and try again.' : (e as Error).message) }
    finally { setAuthBusy(false) }
  }

  const newSession = async (preserveCurrentMessage = false) => {
    const gateway = clientRef.current
    if (!gateway || status !== 'connected') throw new Error('Not connected')
    const result = await gateway.request('session.create', { source: 'gui', request_id: id(), ...(preserveCurrentMessage ? {title:'Bot Chat',hidden:true} : {}) }) as Record<string, unknown>
    const identifier = result.session_id || result.stored_session_id
    if (typeof identifier !== 'string') throw new Error('Hermes did not return a session ID')
    if (gateway !== clientRef.current) throw new Error('Agent changed')
    sessionRef.current = identifier
    setSessionId(identifier)
    if (storageKey) localStorage.setItem(storageKey, identifier)
    if (!preserveCurrentMessage) {setPhoto(null);setMessages(normalizeMessages(result))}
    streamingId.current = null
    return identifier
  }

  const send = async () => {
    const text=composer.trim() || (photo ? 'Describe this image.' : '')
    const gateway=clientRef.current
    if (!text || !gateway || sending || status !== 'connected') return
    followLatest.current=true
    setNotice('')
    setSending(true)
    setActivity(photo ? 'Sending image…' : 'Sending…')
    const messageId=id()
    setMessages(old=>[...old,{id:messageId,role:'user',content:text,time:Date.now()}])
    try {
      const currentSession=sessionRef.current || await newSession(true)
      const params={session_id:currentSession,submission_id:id(),text}
      if (photo) {
        const image=await new Promise<string>((resolve,reject)=>{
          const reader=new FileReader()
          reader.onload=()=>resolve(String(reader.result).split(',')[1])
          reader.onerror=()=>reject(Error('Could not read this image.'))
          reader.readAsDataURL(photo)
        })
        if (clientRef.current!==gateway) return
        await gateway.request('pocket.sendImage',{...params,image},100000)
      } else await gateway.request('prompt.submit',params,60000)
      if (clientRef.current!==gateway) return
      if (photo) setMessages(old => attachPreview(old, messageId, photo))
      setComposer('');setPhoto(null)
      setActivity(previous=>previous ? 'Agent is working…' : '')
    } catch (error) {
      if (clientRef.current!==gateway) return
      setMessages(old=>old.filter(m=>m.id!==messageId))
      setNotice((error as Error).message);setSending(false);setActivity('')
    }
  }

  const pickPhoto=(file?:File)=>{
    if (!file) return
    if (!['image/jpeg','image/png'].includes(file.type)) {setNotice('Unsupported file type. Choose a still PNG or JPEG image.'); return}
    if (file.size>4*1024*1024 || !file.size) {
      setNotice('Choose a nonempty PNG or JPEG up to 4 MiB.');return
    }
    setNotice('');setPhoto(file)
  }

  const selectSession = async (choice: SessionChoice) => {
    setHistoryOpen(false)
    setNotice('')
    try {
      const gateway = clientRef.current
      const result = await gateway?.request('session.resume', { session_id: choice.session_id })
      if (gateway !== clientRef.current) return
      setApproval(null)
      setActivityRows([])
      setWindowSize(36)
      sessionRef.current = choice.session_id
      setPhoto(null)
      setSessionId(choice.session_id)
      setMessages(normalizeMessages(result))
      if (storageKey) localStorage.setItem(storageKey, choice.session_id)
    } catch (error) { setNotice((error as Error).message) }
  }

  const openHistory = async () => {
    setHistoryOpen(true)
    try {
      const gateway = clientRef.current
      const result = await gateway?.request('session.list', { scope: 'stored' })
      if (gateway !== clientRef.current) return
      setRecent(firstSession(result))
    } catch { setRecent([]) }
  }

  const resolveApproval = (choice: 'once' | 'deny') => {
    if (!approval) return
    if (approval.method === 'approval.respond') {
      void clientRef.current?.request('approval.respond', {session_id:sessionRef.current,
        execution_generation:approval.params.execution_generation, prompt_id:approval.id, choice
      }).then(()=>setApproval(q=>q?.id===approval.id ? null : q)).catch(e=>setNotice(e.message))
    } else {
      clientRef.current?.answer(approval.id, {choice})
      setApproval(null)
    }
  }

  const useMic = () => {
    type SpeechWindow = Window & { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike }
    type SpeechRecognitionLike = { lang: string; start: () => void; onresult: ((event: { results: ArrayLike<ArrayLike<{transcript: string}>> }) => void) | null; onend: (() => void) | null; onerror: (() => void) | null }
    const win = window as SpeechWindow
    const Speech = win.SpeechRecognition || win.webkitSpeechRecognition
    if (!Speech) { setNotice('Voice dictation is not supported by this browser yet.'); return }
    const recorder = new Speech()
    recorder.lang = navigator.language || 'en-GB'
    recorder.onresult = event => setComposer(old => `${old}${old ? ' ' : ''}${event.results[0]?.[0]?.transcript || ''}`)
    recorder.onend = () => setMicActive(false)
    recorder.onerror = () => { setMicActive(false); setNotice('Microphone could not be started. Check browser permissions.') }
    setMicActive(true)
    recorder.start()
  }

  const query=search.trim().toLowerCase()
  const visibleProfiles=profiles.filter(p=>`${p.name} ${p.title} ${p.description}`.toLowerCase().includes(query))
  const openPicker=()=>{
    setSearch('')
    setSideOpen(true)
    void reloadProfiles().catch(e=>setNotice(e.message))
  }

  if (!identity) return <div className="loading-screen"><span className="spinner"/> Opening Pocket…</div>
  if (!identity.authenticated) return <LockScreen onLogin={doLogin} error={authError} busy={authBusy}/>

  return <div className="app-shell" style={{'--chat-size':fontSizes[fontSize]+'px','--accent':accent,'--accent-ink':accentInk(accent)} as React.CSSProperties}>
    <aside id="bot-picker" aria-label="Your bots" inert={mobile && !sideOpen} className={`sidebar ${sideOpen ? 'sidebar--open' : ''}`}>
      <div className="sidebar-top">
        <div className="brand"><img className="pocket-icon" src="/pocket-companion.svg" alt=""/><strong className="desktop-brand">Pocket</strong><h2 className="picker-title">Your bots</h2></div>
        <button ref={closePicker} className="icon-button side-close" title="Close menu" onClick={()=>setSideOpen(false)}><X size={22}/></button>
      </div>
      <div className="side-heading">Your team</div>
      <div className="search-box"><Search size={16}/><input aria-label="Search agents" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search bots"/></div>
      <nav className="agent-list" aria-label="Agent roster">
        {visibleProfiles.map(p => <button key={p.id} aria-current={p.id===selected ? "true" : undefined} className={`agent-row ${p.id === selected ? 'agent-row--active' : ''}`} onClick={() => { setSelected(p.id); setSideOpen(false) }}>
          <ProfileAvatar profile={p}/><span className="agent-row-text"><strong>{p.title}</strong><small>{p.description}</small></span>{p.id === selected && <Check className="selected-bot" size={18} aria-hidden="true"/>}
        </button>)}
        {!!profiles.length && !visibleProfiles.length && <p className="empty-sidebar" role="status">No bots match your search.</p>}
        {!profiles.length && <p className="empty-sidebar">No Hermes profiles found. Check HERMES_HOME on this computer.</p>}
      </nav>
      <div className="sidebar-bottom"><button className="sidebar-theme" onClick={async()=>{await api('/api/logout',{method:'POST'});localStorage.removeItem(tokenKey);location.reload()}}>Sign out</button><span className="status-indicator"><span className={`status-dot ${status === 'connected' ? 'status-dot--on' : ''}`}/>{status === 'connected' ? 'Gateway connected' : status === 'connecting' ? 'Connecting to Hermes' : 'Gateway offline'}</span></div>
    </aside>

    <main className="conversation" inert={mobile && sideOpen}>
      <header className="conversation-topbar">
        <button ref={menuTrigger} className="icon-button mobile-menu" title="Open agents" aria-controls="bot-picker" aria-expanded={sideOpen} onClick={openPicker}><Menu size={21}/></button>
        {activeProfile && <ProfileAvatar key={activeProfile.id} profile={activeProfile} onAccent={colour=>setSampled({profile:activeProfile,colour})}/>}
        <div className="header-identity"><h1>{activeProfile?.title || 'Pocket'} <span role="img" aria-label={'Gateway '+status} title={'Gateway '+status} className={'gateway-dot '+status}/></h1>
          {activeProfile && <small>{activeProfile.description.split(/[.;\n]/)[0]}</small>}
        </div>
        <div className="topbar-actions">
          <button className="icon-button" onClick={()=>void openHistory()} title="Recent sessions" disabled={status!=='connected'||sending}><History size={19}/></button>
          <button className="icon-button" onClick={()=>void newSession().catch(e=>setNotice(e.message))} disabled={status!=='connected'||sending} title="New conversation"><Plus size={21}/></button>
          <button ref={settingsButton} className="icon-button" title="Chat settings" onClick={()=>setSettingsOpen(true)}><Settings2 size={19}/></button>
        </div>
      </header>
      <div className="chat-region">
        <div className="chat-content" aria-live="polite" onScroll={e=>{const el=e.currentTarget; followLatest.current=el.scrollHeight-el.scrollTop-el.clientHeight<90}}>
          {messages.length === 0 && <section className="welcome"><div className="welcome-star"><Sparkles size={21}/></div><h1>Message <em>{activeProfile?.title || 'your team'}.</em></h1><p>{activeProfile ? `You're speaking with ${activeProfile.title}. Ask a question, plan something together, or pick up where you left off.` : 'Choose one of your Hermes agents to begin.'}</p><div className="suggestions"><button onClick={() => setComposer('What are your top priorities today?')}>Today's priorities <ArrowRight size={15}/></button><button onClick={() => setComposer('Can you give me a brief status update?')}>Get a quick update <ArrowRight size={15}/></button></div></section>}
          {messages.length > windowSize && <button className="outline-button" onClick={()=>setWindowSize(n=>n+50)}>Load earlier messages</button>}
          {messages.slice(-windowSize).map(message => <article key={message.id} className={`message message--${message.role}`}>
            <div className="message-meta"><span>{message.role === 'user' ? 'You' : activeProfile?.title || 'Hermes'}</span>
              <time>{formatTime(message.time)}</time><CopyButton label="Copy message" read={() => message.content}/></div>
            <div className="message-body">{message.role === 'user' ? <p>{message.content}</p> : <RichMessage text={message.content}/>}</div>
            {message.image && <ImageCard image={message.image}/>}
          </article>)}
          {!!activityRows.length && <details className="tool-log"><summary>Tool activity ({activityRows.length})</summary>{activityRows.map((row,i)=><div key={i}>{row}</div>)}</details>}
          {status==='offline' && <button className="outline-button" onClick={()=>setAttempt(n=>n+1)}>Reconnect to agent</button>}
          {activity && <div className="activity"><span className="activity-dots"><i/><i/><i/></span>{activity}</div>}
          <div ref={transcriptEnd}/>
        </div>
      </div>

      <div className="composer-area">{notice && <div className="notice" role="alert"><CircleHelp size={16}/><span>{notice}</span><button className="icon-button icon-button--small" title="Dismiss" onClick={() => setNotice('')}><X size={16}/></button></div>}{photo && <ImageCard image={imageAttachment(photo)}><button className="icon-button" disabled={sending} title="Remove image" onClick={()=>setPhoto(null)}><X size={16}/></button></ImageCard>}
        <div className="composer-frame">
          <input type="file" ref={photoInput} hidden accept="image/png,image/jpeg" onChange={e=>{pickPhoto(e.target.files?.[0]);e.target.value=''}}/>
          <button className="icon-button" title="Attach image" disabled={status!=='connected'||sending} onClick={()=>photoInput.current?.click()}><ImagePlus size={20}/></button>
          <textarea ref={editor} aria-label="Message agent" placeholder={status==='connected'?`Message ${activeProfile?.title || 'agent'}…`:'Waiting for Hermes…'}
            value={composer} onChange={e=>setComposer(e.target.value)} rows={1} readOnly={sending} disabled={status!=='connected'}
            onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing&&!matchMedia('(pointer:coarse)').matches){e.preventDefault();void send()}}}/>
          <button className={'icon-button '+(micActive?'mic-active':'')} title="Voice dictation" disabled={sending} onClick={useMic}><Mic size={20}/></button>
          <button className="send-button" title="Send message" onClick={()=>void send()} disabled={(!composer.trim()&&!photo)||sending||status!=='connected'}>{sending?<span className="spinner spinner--small"/>:<Send size={18}/>}</button>
        </div>
      </div>
    </main>
    {settingsOpen && <div className="modal-backdrop" onClick={()=>setSettingsOpen(false)}><section className="modal appearance" role="dialog" aria-modal="true" aria-label="Chat settings" onClick={e=>e.stopPropagation()}>
      <div className="modal-head"><h3>Chat settings</h3><button autoFocus className="icon-button" title="Close settings" onClick={()=>setSettingsOpen(false)}><X size={19}/></button></div>
      <fieldset><legend>Text size</legend><div className="size-options">{(Object.keys(fontSizes) as FontSize[]).map(size=><button key={size} aria-pressed={size===fontSize} onClick={()=>setFontSize(size)}>{size}</button>)}</div></fieldset>
      <label className="settings-row">Appearance<button className="outline-button" onClick={()=>setDark(!dark)}>{dark?<Moon size={16}/>:<Sun size={16}/>} {dark?'Black':'Light'}</button></label>
      {activeProfile && <div className="settings-row"><label htmlFor="bot-accent">{activeProfile.title}’s accent</label><div><button className="reset-accent" disabled={!customColour} onClick={()=>chooseAccent()}>Auto</button><input id="bot-accent" type="color" value={accent} onChange={e=>chooseAccent(e.target.value)}/></div></div>}
    </section></div>}

    {historyOpen && <div className="modal-backdrop" onClick={() => setHistoryOpen(false)}><div className="modal history-modal" role="dialog" aria-modal="true" aria-label="Recent sessions" onClick={e => e.stopPropagation()}><div className="modal-head"><h3>Recent conversations</h3><button className="icon-button" onClick={() => setHistoryOpen(false)}><X size={19}/></button></div><p>Stored sessions from the selected Hermes profile.</p>{recent.length ? <div className="history-list">{recent.map(row => <button key={row.session_id} className={`history-item ${row.session_id === sessionId ? 'history-item--selected' : ''}`} onClick={() => void selectSession(row)}><Clock3 size={17}/><span>{row.title}</span>{row.session_id === sessionId && <Check size={15}/>}</button>)}</div> : <div className="empty-history"><History size={23}/><span>No sessions returned by this gateway.</span></div>}</div></div>}

    {approval && <div className="modal-backdrop"><div className="modal approval-modal" role="dialog" aria-modal="true" aria-label="Approve Hermes action"><div className="approval-icon"><ShieldCheck size={22}/></div><span className="eyebrow">YOUR PERMISSION IS NEEDED</span><h3>Hermes is requesting approval</h3><p>{String(approval.params.description || 'Review the requested command before proceeding.')}</p><pre>{String(approval.params.command || 'Command details unavailable')}</pre>{approval.params.edit != null && <pre>{JSON.stringify(approval.params.edit,null,2)}</pre>}<div className="approval-actions"><button className="outline-button" onClick={() => resolveApproval('deny')}>Deny</button><button className="primary-button" disabled={typeof approval.params.command!=='string' || !approval.params.command.trim()} onClick={() => resolveApproval('once')}>Approve once <Check size={16}/></button></div><span className="approval-tip">This decision applies only to this request. Permanent approvals are not supported here.</span></div></div>}
  </div>
}
