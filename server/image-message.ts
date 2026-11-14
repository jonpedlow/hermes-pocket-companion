import sharp from 'sharp'
import path from 'node:path'
import { unlink } from 'node:fs/promises'
import { WebSocket } from 'ws'
import { allowedRequest } from './bridge-policy.ts'

export const imageLimit = 4 * 1024 * 1024
export const frameLimit = Math.ceil(imageLimit / 3) * 4 + 262144

class UnsupportedImageType extends Error {
  constructor() { super('Unsupported file type. Choose a still PNG or JPEG image.') }
}

export async function sanitizeImage(value: unknown): Promise<Buffer> {
  if (typeof value !== 'string' || !value.length || value.length > Math.ceil(imageLimit / 3) * 4 ||
      !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) throw Error('Choose a PNG or JPEG under 4 MiB.')
  const bytes = Buffer.from(value, 'base64')
  if (bytes.length > imageLimit || bytes.toString('base64') !== value) throw Error('Invalid image encoding.')
  const png=bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))
  const jpeg=bytes[0]===255 && bytes[1]===216 && bytes[2]===255

  if (!png && !jpeg) throw new UnsupportedImageType()
  const pipeline = sharp(bytes, { limitInputPixels: 32_000_000, failOn: 'warning' })
  const header = await pipeline.metadata()
  if (!['jpeg','png'].includes(header.format || '') || (header.pages || 1) !== 1 || (png && animatedPng(bytes)))
    throw Error('Choose a still PNG or JPEG.')
  return pipeline.autoOrient().resize({ width:2048, height:2048, fit:'inside', withoutEnlargement:true })
    .flatten({background:'#fff'}).jpeg({quality:88, mozjpeg:false}).toBuffer()
}

function animatedPng(bytes: Buffer) {
  for (let offset = 8; offset + 12 <= bytes.length;) {
    const name = bytes.toString('ascii', offset + 4, offset + 8)
    if (name === 'acTL') return true
    if (name === 'IDAT') return false
    offset += bytes.readUInt32BE(offset) + 12
  }
  return false
}

type Frame = { id?: unknown; result?: Record<string, unknown>; error?: unknown }
type Waiter = { resolve: (result: Record<string, unknown>) => void; reject: (error: Error) => void }

// Each upload uses the same authenticated profile socket for staging and admission.
// The browser can neither supply a local path nor reuse a receipt from another chat.
export class ImageMessages {
  private nextId = -1
  private waiting = new Map<number,Waiter>()
  private busy = false
  constructor(private directory: string) {}

  receive(frame: Frame) {
    if (typeof frame.id !== 'number' || frame.id >= 0) return false
    const waiter = this.waiting.get(frame.id)
    if (waiter) {
      if (frame.error || !frame.result) waiter.reject(Error('Hermes declined the request.'))
      else waiter.resolve(frame.result)
    }
    return true
  }

  close() {
    for (const waiter of this.waiting.values()) waiter.reject(Error('Connection closed.'))
    this.waiting.clear()
  }

  private rpc(owner: WebSocket, method: string, params: Record<string,unknown>) {
    const id = this.nextId--
    return new Promise<Record<string,unknown>>((resolve,reject) => {
      if (owner.readyState !== WebSocket.OPEN) { reject(Error('Gateway disconnected.')); return }
      const finish = () => {clearTimeout(timer); this.waiting.delete(id)}
      const timer = setTimeout(()=>{finish(); reject(Error('Gateway timed out.'))}, 45000)
      this.waiting.set(id,{resolve:r=>{finish();resolve(r)},reject:e=>{finish();reject(e)}})
      owner.send(JSON.stringify({jsonrpc:'2.0',id,method,params}),err=>{if(err){finish();reject(err)}})
    })
  }

  async send(owner: WebSocket, params: Record<string,unknown>) {
    const { image, ...prompt } = params
    if (this.busy || !allowedRequest('prompt.submit',prompt)) throw Error('Cannot send this image message.')
    this.busy=true
    let staged: string | undefined
    let admitted=false
    let submitting=false
    try {
      const jpeg=await sanitizeImage(image)
      const receipt=await this.rpc(owner,'image.attach_bytes',{session_id:prompt.session_id,content_base64:jpeg.toString('base64')})
      if (receipt.attached!==true || receipt.mime!=='image/jpeg' || typeof receipt.path!=='string' ||
          path.dirname(path.resolve(receipt.path))!==path.resolve(this.directory) ||
          !/^upload_[\w-]+\.jpe?g$/i.test(path.basename(receipt.path))) throw Error('Invalid upload receipt.')
      staged=receipt.path
      submitting=true
      const result=await this.rpc(owner,'prompt.submit',{...prompt,attachments:[{path:staged,mime:'image/jpeg'}]})
      admitted=true
      return result
    } catch (error) {
      if (error instanceof UnsupportedImageType) throw error
      throw Error(submitting ? 'Image delivery was not confirmed. Check this chat before sending again.' :
        'Image could not be attached. Use a still PNG or JPEG up to 4 MiB and 32 megapixels.')
    } finally {
      // The owner retains its own admission copy before acknowledging. Leave an
      // ambiguous admission's staging file to Hermes rather than racing its reader.
      if (staged && (admitted || !submitting)) await unlink(staged).catch(()=>{})
      this.busy=false
    }
  }
}
