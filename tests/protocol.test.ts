import assert from 'node:assert/strict'
import { test } from 'node:test'
import { extractText, normalizeEvent, normalizeMessages } from '../src/protocol.ts'

test('parses text and rich message content safely', () => {
  assert.equal(extractText([{type:'text', text:'Hello '},{type:'text', text:'world'}]), 'Hello \nworld')
  const messages = normalizeMessages({messages:[
    { role:'user', content:'Please check the task' },
    { role:'assistant', content:[{text:'Checking now'}] },
    { role:'tool', content:'Never display as assistant' }
  ]})
  assert.equal(messages.length, 2)
  assert.equal(messages[1].content, 'Checking now')
})

test('normalizes direct and wrapped gateway notifications', () => {
  assert.deepEqual(normalizeEvent({method:'event',params:{type:'message.delta', delta:'Hello'}}), {type:'message.delta',delta:'Hello'})
  assert.deepEqual(normalizeEvent({method:'gateway.ready',params:{}}),{type:'gateway.ready'})
  assert.equal(normalizeEvent({jsonrpc:'2.0',id:3,result:{}}), null)
})
