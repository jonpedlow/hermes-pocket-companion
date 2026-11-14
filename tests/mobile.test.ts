import assert from 'node:assert/strict'
import { test } from 'node:test'
import sharp from 'sharp'
import { sanitizeImage } from '../server/image-message.ts'
import { accentInk } from '../src/appearance.ts'
import { allowedRequest } from '../server/bridge-policy.ts'

test('image message input is decoded, bounded and emitted as plain JPEG', async()=>{
  const png=await sharp({create:{width:2200,height:32,channels:3,background:'#cb6491'}}).png().toBuffer()
  const webp=await sharp(png).webp().toBuffer()
  await assert.rejects(sanitizeImage(webp.toString('base64')), /Unsupported file type/)
  const result=await sharp(await sanitizeImage(png.toString('base64'))).metadata()
  assert.equal(result.format,'jpeg')
  assert.equal(result.width,2048)
  await assert.rejects(sanitizeImage(Buffer.from('not an image').toString('base64')))
  await assert.rejects(sanitizeImage('A'.repeat(6*1024*1024)))
  assert.equal(allowedRequest('image.attach_bytes',{session_id:'s',path:'a.png'}),false)
  assert.equal(allowedRequest('prompt.submit',{session_id:'s',submission_id:'x',text:'test',attachments:[]}),false)
})
test('accent text adapts to dark and light bubbles',()=>{
  assert.equal(accentInk('#000000'),'#ffffff')
  assert.equal(accentInk('#ffff00'),'#000000')
})
