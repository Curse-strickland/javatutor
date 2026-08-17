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
      // 链接文本必须转义：模型输出可能是 [<img onerror=...>](https://…)，直接内插会被 v-html 执行
      const text = escapeHtml(token.text || href)
      // 仅允许 http/https 协议；javascript: 等按纯文本输出，同时天然转义
      if (!/^https?:\/\//i.test(href)) return text
      return `<a href="${escapeAttr(href)}" target="_blank" rel="noopener noreferrer">${text}</a>`
    },
  },
  breaks: true,
  gfm: true,
})

function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;')
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function renderMarkdown(text) {
  if (!text) return ''
  return marked.parse(text)
}
