import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import path from 'node:path'
import { getProfileDirectory } from './profiles.ts'

const exec = promisify(execFile)

export async function nativeTarget(home: string, profile: string) {
  const directory = getProfileDirectory(home, profile)
  const script = process.env.HERMES_BOOTSTRAP || path.join(home, 'hermes-agent', 'ui-tui', 'scripts', 'gateway_bootstrap.py')
  const python = process.env.HERMES_PYTHON || 'python'
  // The installed TUI helper authenticates this OS user and binds the ticket to the
  // selected profile. Without --start or --recover it only discovers an existing owner.
  const { stdout } = await exec(python, ['-B', script], {
    windowsHide: true, timeout: 20000, maxBuffer: 65536,
    env: { ...process.env, COMPANION_PASSWORD: '', HERMES_HOME: directory }
  })
  const target = JSON.parse(stdout)
  const url = new URL(target.url)
  if (url.protocol !== 'ws:' || !['127.0.0.1','localhost','[::1]'].includes(url.hostname) ||
      url.pathname !== '/api/ws' || url.search || url.username || url.password ||
      !Array.isArray(target.protocols) || target.protocols.length !== 2 ||
      target.protocols[0] !== 'hermes-gateway-v1' || !/^hermes-gateway-ticket\.[\w.-]+$/.test(target.protocols[1]) ||
      path.resolve(target.profile_id).toLowerCase() !== path.resolve(directory).toLowerCase())
    throw new Error('Unexpected gateway binding')
  return { url: url.href, protocols: target.protocols as string[] }
}
