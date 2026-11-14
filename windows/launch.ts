import { readFileSync } from 'node:fs'
import path from 'node:path'
const file = path.resolve(process.argv[2])
const settings = JSON.parse(readFileSync(file,'utf8').replace(/^\uFEFF/, ''))
process.env.COMPANION_VERIFIER_FILE = path.join(path.dirname(file),'password.verifier')
process.env.HERMES_HOME = settings.hermesHome
process.env.HERMES_PYTHON = settings.python
process.env.HERMES_BOOTSTRAP = settings.bootstrap
process.env.COMPANION_PORT = String(settings.port)
process.env.COMPANION_HOST = '127.0.0.1'
process.env.COMPANION_PREFERRED_PROFILE = settings.profile
if (settings.origin) process.env.COMPANION_ORIGIN = settings.origin
else delete process.env.COMPANION_ORIGIN
await import('../server/host.ts')
