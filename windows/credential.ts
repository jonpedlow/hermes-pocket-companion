import { writeFileSync } from 'node:fs'
import { makeVerifier } from '../server/password.ts'

// PowerShell sends the password over an anonymous pipe, never a command-line argument.
const chunks = []
for await (const chunk of process.stdin) chunks.push(chunk)
const password = Buffer.concat(chunks).toString('utf8').replace(/\r?\n$/, '')
writeFileSync(process.argv[2], makeVerifier(password), {flag:'wx',mode:0o600})
