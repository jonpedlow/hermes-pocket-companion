import { randomBytes, scrypt, scryptSync, timingSafeEqual } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { promisify } from 'node:util'

const derive = promisify(scrypt)
export function makeVerifier(password: string) {
  if (password.trim().length < 16 || Buffer.byteLength(password) > 1024) throw Error('Use 16 or more characters, up to 1024 UTF-8 bytes.')
  const salt = randomBytes(16)
  return 'scrypt-v1:' + salt.toString('hex') + ':' + scryptSync(password, salt, 64).toString('hex')
}

export function readVerifier() {
  const file = process.env.COMPANION_VERIFIER_FILE
  if (!file) throw Error('Run Pocket setup to configure a password verifier.')
  const value = readFileSync(file, 'utf8').trim()
  if (!/^scrypt-v1:[0-9a-f]{32}:[0-9a-f]{128}$/.test(value)) throw Error('Invalid Pocket password verifier.')
  const [,salt,key] = value.split(':')
  return {salt:Buffer.from(salt,'hex'),key:Buffer.from(key,'hex')}
}

export async function verifyPassword(input: unknown, verifier: ReturnType<typeof readVerifier>) {
  if (typeof input !== 'string' || Buffer.byteLength(input) > 1024) return false
  return timingSafeEqual(await derive(input, verifier.salt, 64) as Buffer, verifier.key)
}
