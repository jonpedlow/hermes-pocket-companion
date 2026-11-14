import { test } from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { makeVerifier, verifyPassword } from '../server/password.ts'

test('installation passwords produce different salted verifiers and reject incorrect input', async () => {
  const pass = randomUUID()
  const first = makeVerifier(pass)
  assert.notEqual(first, makeVerifier(pass))
  assert.throws(() => makeVerifier('short'))
  const [,salt,key] = first.split(':')
  const verifier = {salt:Buffer.from(salt,'hex'),key:Buffer.from(key,'hex')}
  assert.equal(await verifyPassword(pass,verifier),true)
  assert.equal(await verifyPassword(pass.toUpperCase(),verifier),false)
})
