type Params = Record<string, unknown>

const shortString = (v: unknown) => typeof v === 'string' && v.length > 0 && v.length <= 512
const literal = (p: Params, allowed: string[]) => Object.keys(p).every(k => allowed.includes(k))

// Every browser request goes through this boundary. The native owner still authenticates
// the profile and enforces ownership, generation checks and tool approval policy.
export function allowedRequest(method: string, p: Params): boolean {
  switch (method) {
    case 'client.capabilities':
      return literal(p, ['server_requests']) && p.server_requests === true
    case 'session.list':
      return literal(p, ['title', 'include_hidden']) && p.title === 'Bot Chat' && p.include_hidden === true ||
        literal(p, ['scope']) && p.scope === 'stored'
    case 'session.resume':
      return literal(p, ['session_id']) && shortString(p.session_id)
    case 'session.create':
      return literal(p, ['source', 'request_id', 'title', 'hidden']) && p.source === 'gui' && shortString(p.request_id) &&
        ((p.title === undefined && p.hidden === undefined) || (p.title === 'Bot Chat' && p.hidden === true))
    case 'prompt.submit':
      return literal(p, ['session_id', 'submission_id', 'text']) && shortString(p.session_id) &&
        shortString(p.submission_id) && typeof p.text === 'string' && !!p.text.trim() && p.text.length <= 64000
    case 'approval.respond':
      return literal(p, ['session_id', 'prompt_id', 'execution_generation', 'choice']) &&
        shortString(p.session_id) && shortString(p.prompt_id) && Number.isSafeInteger(p.execution_generation) &&
        (p.choice === 'once' || p.choice === 'deny')
    default:
      return false
  }
}
