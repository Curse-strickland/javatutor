/**
 * Markdown 渲染（AiTutorPanel / DecisionTracePanel 共用）。
 * 用项目已依赖的 marked 解析，自定义 renderer 防 XSS：
 * - 丢弃原始 HTML，防脚本注入
 * - 链接仅允许 http/https，其余协议按纯文本输出
 */

import { marked } from 'marked'

marked.use({
  renderer: {
    html() { return '' },
    link(token) {
      const href = token.href || ''
      if (!/^https?:\/\//i.test(href)) return token.text || href
      return `<a href="${escapeAttr(href)}" target="_blank" rel="noopener noreferrer">${token.text || href}</a>`
    },
  },
  breaks: true,
  gfm: true,
})

function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;')
}

export function renderMarkdown(text) {
  if (!text) return ''
  return marked.parse(text)
}
