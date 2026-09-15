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

describe('renderMarkdown 对过程哨兵的降级安全性', () => {
  // 验收 L3「老前端 + 新 agent」：哨兵用 HTML 注释形式，渲染器丢弃原始 HTML，
  // 故哨兵在用户可见产物里**完全不出现**（比「渲染为不可见注释」更强）。
  const mark = (event) => `\n<!--jt:process ${JSON.stringify(event)}-->\n`

  it('哨兵被渲染器剥掉，正文照常渲染', () => {
    const text = mark({ kind: 'stage', text: '正在分析问题…' }) + '正文A'
    const html = renderMarkdown(text)
    expect(html).toContain('正文A')
    expect(html).not.toContain('jt:process')
    expect(html).not.toContain('正在分析问题')
  })

  it('多条哨兵 + 正文：JSON 一个字都不漏进 HTML', () => {
    const text =
      mark({ kind: 'stage', text: '正在分析问题…' }) +
      mark({ kind: 'tool', tool: 'step_facts', args: { step_index: 1 }, status: 'ok' }) +
      mark({ kind: 'stage', text: '证据已就绪，正在生成回答…' }) +
      '答案正文'
    const html = renderMarkdown(text)
    expect(html).toContain('答案正文')
    expect(html).not.toContain('jt:process')
    expect(html).not.toContain('step_facts')
  })

  it('哨兵两侧的换行是**承重**的：同行粘连会吞掉该行剩余正文', () => {
    // marked 把以 `<!--` 开头的行整行当作 HTML 块（含 `-->` 之后的同行为止），
    // 所以 agent 侧 `build_process_event` 必须在哨兵两侧各加一个 `\n`。
    // 本用例锁住这个约束：若将来改了构造格式，这里会失败并提醒。
    expect(renderMarkdown('<!--jt:process {"kind":"stage"}-->尾注')).not.toContain('尾注')
    expect(renderMarkdown('\n<!--jt:process {"kind":"stage"}-->\n尾注')).toContain('尾注')
  })
})
