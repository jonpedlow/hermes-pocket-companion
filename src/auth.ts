export const tokenKey = 'pocket-login-v1'
export const currentToken = () => localStorage.getItem(tokenKey) || ''
export function api(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers)
  const token = currentToken()
  if (token) headers.set('Authorization', 'Bearer ' + token)
  return fetch(path, { ...options, headers, credentials: 'omit' })
}
