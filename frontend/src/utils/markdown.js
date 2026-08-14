/**
 * Markdown 渲染：基于项目已依赖的 marked，自定义 renderer 防 XSS。
 * AiTutorPanel 与 DecisionTracePanel 共用同一套配置，避免重复且保持行为一致。
 */
import { marked } from 'marked'

marked.use({
  renderer: {
    // 丢弃原始 HTML，防脚本注入
    html() { return '' },
    // 链接仅允许 http/https，其余协议按纯文本输出
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
