import assert from 'node:assert/strict'
import { test } from 'node:test'
import { allowedRequest } from '../server/bridge-policy.ts'
import { normalizeEvent } from '../src/protocol.ts'

test('only bounded chat operations reach the native gateway', () => {
  const prompt = {session_id:'s', prompt_id:'p', execution_generation:3, choice:'deny'}
  assert.ok(allowedRequest('approval.respond', prompt))
  assert.ok(allowedRequest('approval.respond', {...prompt,choice:'once'}))
  assert.equal(allowedRequest('approval.respond', {...prompt,choice:'always'}), false)
  assert.equal(allowedRequest('session.create', {source:'gui',request_id:'one',yolo:true}),false)
  assert.equal(allowedRequest('config.set', {}),false)
  assert.equal(allowedRequest('prompt.submit', {text:'test',session_id:'s',submission_id:'one',profile:'other'}),false)
})
test('native streamed payload retains the routing envelope', () => {
  const event=normalizeEvent({method:'event',params:{type:'message.delta',session_id:'correct',payload:{session_id:'wrong',text:'hi'}}})
  assert.equal(event?.session_id,'correct')
  assert.equal(event?.text,'hi')
})
