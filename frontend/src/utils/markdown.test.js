import { describe, expect, it } from 'vitest'

import { renderMarkdown } from './markdown.js'

describe('renderMarkdown XSS 防护', () => {
  it('原始 HTML 被丢弃', () => {
    const html = renderMarkdown('正文 <script>alert(1)</script> 结尾')
    expect(html).not.toContain('<script')
    expect(html).toContain('正文')
    expect(html).toContain('结尾')
  })

  it('http 链接允许，且链接文本中的 HTML 被转义', () => {
    const html = renderMarkdown('[<img src=x onerror=alert(1)>](https://example.com)')
    expect(html).toContain('href="https://example.com"')
    expect(html).not.toContain('<img')
    expect(html).toContain('&lt;img')
  })

  it('javascript: 链接按纯文本输出（不带 href，文本转义）', () => {
    const html = renderMarkdown('[点击](javascript:alert(1))')
    expect(html).not.toContain('href="javascript:')
    expect(html).toContain('点击')
  })

  it('其他非 http(s) 协议按纯文本输出', () => {
    const html = renderMarkdown('[data](data:text/html;base64,PGI+)')
    expect(html).not.toContain('href=')
    expect(html).toContain('data')
  })

  it('空文本返回空串', () => {
    expect(renderMarkdown('')).toBe('')
    expect(renderMarkdown(null)).toBe('')
  })

  it('常规 markdown 仍正常渲染', () => {
    const html = renderMarkdown('**加粗** [链接](https://ok.com)')
    expect(html).toContain('<strong>加粗</strong>')
    expect(html).toContain('href="https://ok.com"')
  })
})
