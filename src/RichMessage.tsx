import { memo, useEffect, useRef, useState } from 'react'
import type { ComponentProps, ReactNode } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export function CopyButton({ label, read }: { label: string; read: () => string }) {
  const [feedback, setFeedback] = useState('')
  useEffect(() => {
    if (!feedback) return
    const timer = setTimeout(() => setFeedback(''), 2500)
    return () => clearTimeout(timer)
  }, [feedback])

  async function copy() {
    try {
      await navigator.clipboard.writeText(read())
      setFeedback('Copied')
    } catch {
      setFeedback('Copy failed')
    }
  }

  return <button className="chat-copy" type="button" onClick={copy} aria-live="polite">{feedback || label}</button>
}

function CodeBlock({ children }: { children?: ReactNode }) {
  const pre = useRef<HTMLPreElement>(null)
  return <div className="chat-code">
    <div className="chat-code-tools"><CopyButton label="Copy code" read={() => pre.current?.textContent || ''}/></div>
    <pre ref={pre}>{children}</pre>
  </div>
}

function webLink(value?: string) {
  if (!value || !/^https?:\/\//i.test(value)) return undefined
  try {
    const url = new URL(value)
    if (url.hostname && !url.username && !url.password) return url.href
  } catch { /* Incomplete links can arrive while a response is streaming. */ }
  return undefined
}

const components: ComponentProps<typeof ReactMarkdown>['components'] = {
  pre: CodeBlock,
  a({ href, children }) {
    const target = webLink(href)
    return target ? <a href={target} target="_blank" rel="noopener noreferrer">{children}</a> : <span>{children}</span>
  },
  img({ alt, src }) {
    const target = typeof src === 'string' ? webLink(src) : undefined
    return target ? <a href={target} target="_blank" rel="noopener noreferrer">{alt || 'Open image'}</a> : <span>{alt || 'Image'}</span>
  },
}

const plugins = [remarkGfm]
export const RichMessage = memo(function RichMessage({ text }: { text: string }) {
  return <ReactMarkdown skipHtml remarkPlugins={plugins} components={components}>{text}</ReactMarkdown>
})

export type ImageAttachment = { name: string; size: number; type: string; file?: File }

export function imageAttachment(file: File): ImageAttachment {
  return { name: file.name, size: file.size, type: file.type, file }
}

export function ImageCard({ image, children }: { image: ImageAttachment; children?: ReactNode }) {
  const [source, setSource] = useState<{ file: File; url: string }>()
  useEffect(() => {
    if (!image.file) {
      setSource(undefined)
      return
    }
    const url = URL.createObjectURL(image.file)
    setSource({ file: image.file, url })
    return () => URL.revokeObjectURL(url)
  }, [image.file])
  const size = image.size < 1024 ? image.size + ' B' : Math.ceil(image.size / 1024) + ' KiB'
  return <div className="image-card">
    {image.file && source?.file === image.file && <img src={source.url} alt="Attachment preview"/>}
    <div className="image-caption"><strong dir="auto">{image.name}</strong>
      <small>{image.type.slice(6).toUpperCase()} · {size}</small></div>
    {children}
  </div>
}
