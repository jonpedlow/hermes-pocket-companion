import { currentToken } from './auth.ts'
export interface HermesProfile {
  id: string
  name: string
  title: string
  description: string
  hasAvatar: boolean
  avatarUrl: string | null
  group: string
  initials: string
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant' | 'system'
  content: string
  time: number
}

export interface GatewayEvent {
  type: string
  session_id?: string
  text?: string
  delta?: string
  message?: unknown
  [key: string]: unknown
}

export interface PendingQuestion {
  id: string | number
  method: string
  params: Record<string, unknown>
}

export function extractText(input: unknown): string {
  if (typeof input === 'string') return input
  if (Array.isArray(input)) return input.map(extractText).filter(Boolean).join('\n')
  if (!input || typeof input !== 'object') return ''
  const data = input as Record<string, unknown>
  if (typeof data.text === 'string') return data.text
  if (typeof data.content === 'string') return data.content
  if (Array.isArray(data.content)) return extractText(data.content)
  if (typeof data.delta === 'string') return data.delta
  return ''
}

export function normalizeMessages(input: unknown): ChatMessage[] {
  const source = (input && typeof input === 'object' && !Array.isArray(input))
    ? input as Record<string, unknown> : {}
  const entries = Array.isArray(input) ? input :
    (Array.isArray(source.messages) ? source.messages :
      (Array.isArray(source.history) ? source.history : []))
  return entries.flatMap((entry: unknown, index: number) => {
    if (!entry || typeof entry !== 'object') return []
    const data = entry as Record<string, unknown>
    const role = data.role || data.sender || data.type
    if (data.display_kind === 'hidden' || (role !== 'user' && role !== 'assistant')) return []
    const content = extractText(data.content ?? data.text ?? data.message)
    if (!content.trim()) return []
    const id = String(data.id || data.message_id || `${index}-${role}`)
    return [{ id, role, content, time: typeof data.timestamp === 'number' ? data.timestamp * 1000 : Date.now() }]
  })
}

export function normalizeEvent(frame: Record<string, unknown>): GatewayEvent | null {
  if (!frame.method) return null
  if (frame.method === 'event' && frame.params && typeof frame.params === 'object') {
    const params = frame.params as Record<string, unknown>
    if (typeof params.type === 'string') {
      const { payload, ...envelope } = params
      return { ...(payload && typeof payload === 'object' ? payload : {}), ...envelope } as GatewayEvent
    }
    if (typeof params.event === 'string') return { ...params, type: params.event } as GatewayEvent
  }
  if (typeof frame.method === 'string') {
    return { ...(frame.params && typeof frame.params === 'object' ? frame.params : {}), type: frame.method } as GatewayEvent
  }
  return null
}

type RpcFrame = Record<string, unknown>
type RpcResolver = { resolve: (result: unknown) => void; reject: (error: Error) => void; timeout: ReturnType<typeof setTimeout> }

export class HermesGateway {
  private socket: WebSocket
  private seq = 0
  private pending = new Map<number, RpcResolver>()
  private readyResolve!: () => void
  private readyReject!: (error: Error) => void
  private didReady = false
  readonly ready: Promise<void>
  onEvent?: (event: GatewayEvent) => void
  onQuestion?: (request: PendingQuestion) => void
  onClose?: (message: string) => void

  constructor(profileId: string) {
    const scheme = location.protocol === 'https:' ? 'wss:' : 'ws:'
    this.socket = new WebSocket(`${scheme}//${location.host}/api/gateway?profile=${encodeURIComponent(profileId)}`, ['pocket-v1', 'pocket-auth.' + currentToken()])
    this.ready = new Promise((resolve, reject) => { this.readyResolve = resolve; this.readyReject = reject })
    this.socket.addEventListener('message', event => {
      try { this.receive(JSON.parse(String(event.data)) as RpcFrame) }
      catch { /* Ignore invalid gateway frames; never render untrusted raw HTML. */ }
    })
    this.socket.addEventListener('close', () => this.disconnected('The Hermes connection closed.'))
    this.socket.addEventListener('error', () => this.disconnected('Unable to connect to the Hermes gateway.'))
  }

  private disconnected(reason: string) {
    if (!this.didReady) this.readyReject(new Error(reason))
    for (const [id, waiter] of this.pending) {
      clearTimeout(waiter.timeout)
      waiter.reject(new Error(reason))
      this.pending.delete(id)
    }
    this.onClose?.(reason)
  }

  private receive(frame: RpcFrame) {
    if (typeof frame.id === 'number' && !frame.method) {
      const waiter = this.pending.get(frame.id)
      if (!waiter) return
      clearTimeout(waiter.timeout)
      this.pending.delete(frame.id)
      if (frame.error) waiter.reject(new Error(extractText((frame.error as Record<string, unknown>)?.message) || 'Hermes rejected the request'))
      else waiter.resolve(frame.result)
      return
    }
    if (frame.method === 'bridge.error') {
      const p = (frame.params || {}) as Record<string, unknown>
      this.onClose?.(String(p.message || 'Hermes bridge error'))
      return
    }
    // A gateway question is a server-to-client JSON-RPC request.
    if ((typeof frame.id === 'string' || typeof frame.id === 'number') && typeof frame.method === 'string') {
      const question = { id: frame.id, method: frame.method, params: (frame.params || {}) as Record<string, unknown> }
      if (question.method === 'approval' && this.onQuestion) this.onQuestion(question)
      else this.answerError(question.id, 'This client does not support this interaction. Open Hermes Desktop to continue.')
      return
    }
    const event = normalizeEvent(frame)
    if (!event) return
    if (event.type === 'gateway.ready' && !this.didReady) {
      this.didReady = true
      this.readyResolve()
      // Fail unsupported requests explicitly; we implement approval cards only.
      void this.request('client.capabilities', { server_requests: true }).catch(() => undefined)
    }
    this.onEvent?.(event)
  }

  request(method: string, params: Record<string, unknown> = {}, timeoutMs = 30_000): Promise<unknown> {
    if (this.socket.readyState !== WebSocket.OPEN) return Promise.reject(new Error('The gateway is not connected'))
    const id = ++this.seq
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => { this.pending.delete(id); reject(new Error(`${method} timed out`)) }, timeoutMs)
      this.pending.set(id, { resolve, reject, timeout })
      this.socket.send(JSON.stringify({ jsonrpc: '2.0', id, method, params }))
    })
  }

  answer(questionId: string | number, result: Record<string, unknown>) {
    if (this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ jsonrpc: '2.0', id: questionId, result }))
    }
  }

  answerError(questionId: string | number, message: string) {
    if (this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify({ jsonrpc: '2.0', id: questionId, error: { code: -32601, message } }))
    }
  }

  close() { this.socket.close() }
}
