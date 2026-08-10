import { describe, it, expect } from 'vitest'
import { renderSimpleMarkdown, slugifyHeading } from './simpleMarkdown.js'

describe('slugifyHeading', () => {
  it('lowercases ascii and keeps chinese', () => {
    expect(slugifyHeading('广度优先搜索 BFS')).toBe('广度优先搜索-bfs')
    expect(slugifyHeading('Dijkstra 最短路')).toBe('dijkstra-最短路')
    expect(slugifyHeading('**冒泡排序**')).toBe('冒泡排序')
  })
})

describe('renderSimpleMarkdown', () => {
  it('returns empty string for falsy input', () => {
    expect(renderSimpleMarkdown('')).toBe('')
    expect(renderSimpleMarkdown(null)).toBe('')
  })

  it('renders headings with ids', () => {
    const html = renderSimpleMarkdown('## 冒泡排序\n\n段落文字。')
    expect(html).toContain('<h2 id="冒泡排序">冒泡排序</h2>')
    expect(html).toContain('<p>段落文字。</p>')
  })

  it('renders bold, lists, and code blocks', () => {
    const md = [
      '**重点**如下：',
      '',
      '- 第一项',
      '- 第二项',
      '',
      '```java',
      'int x = 1;',
      '```',
    ].join('\n')
    const html = renderSimpleMarkdown(md)
    expect(html).toContain('<strong>重点</strong>')
    expect(html).toContain('<ul>')
    expect(html).toContain('<li>第一项</li>')
    expect(html).toContain('<pre class="sm-code" data-lang="java"><code>int x = 1;</code></pre>')
    expect(html).not.toContain('```java')
  })

  it('renders fenced java blocks when source uses CRLF (Windows)', () => {
    const md = '## 冒泡\r\n\r\n```java\r\nfor (int i = 0; i < n; i++) {}\r\n```\r\n'
    const html = renderSimpleMarkdown(md)
    expect(html).toContain('<pre class="sm-code" data-lang="java">')
    expect(html).toContain('for (int i = 0; i &lt; n; i++) {}')
    expect(html).not.toContain('```java')
  })

  it('escapes html in prose and code', () => {
    const html = renderSimpleMarkdown('<script>alert(1)</script>\n\n```\n<a>\n```')
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('&lt;a&gt;')
  })

  it('renders tables and blockquotes', () => {
    const md = [
      '| A | B |',
      '|---|---|',
      '| 1 | 2 |',
      '',
      '> 引用说明',
    ].join('\n')
    const html = renderSimpleMarkdown(md)
    expect(html).toContain('<table class="sm-table">')
    expect(html).toContain('<th>A</th>')
    expect(html).toContain('<td>2</td>')
    expect(html).toContain('<blockquote class="sm-quote">引用说明</blockquote>')
  })

  it('renders horizontal rules', () => {
    const html = renderSimpleMarkdown('上文\n\n---\n\n下文')
    expect(html).toContain('<hr class="sm-hr" />')
  })
})
