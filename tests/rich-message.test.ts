import assert from 'node:assert/strict'
import { test } from 'node:test'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { RichMessage } from '../src/RichMessage.tsx'

const render = (text: string) => renderToStaticMarkup(createElement(RichMessage, { text }))

test('formatted replies preserve tables, fenced code and web links', () => {
  const html = render(['| A | B |','|---|---|','| a | b |','','~~~js','const x = 1 < 2','~~~',
    '', '**Bold** and [example](https://example.org)'].join('\n'))
  for (const token of ['<table>', '<strong>Bold</strong>', 'Copy code', 'const x = 1 &lt; 2',
    'href="https://example.org/"', 'rel="noopener noreferrer"']) assert.ok(html.includes(token))
})

test('message markup cannot embed HTML, fetch images or navigate to local file references', () => {
  const html = render(['<iframe src="/fixture"></iframe>', '', '![Figure](https://example.org/figure.png)',
    '', '[private file](file:///example.txt)', '', '[relative](/api/example)', '', '[invalid](javascript:void)'].join('\n'))
  assert.doesNotMatch(html, /<iframe|<img|file:\/\/|javascript:|href="\/api/)
  assert.match(html, /href="https:\/\/example.org\/figure.png"/)
  assert.match(html, /private file/)
})
