// Agent 编辑建议 + 视角导航：解析 assistant 消息中的结构化块，并把编辑定位到源码
// 协议见 javatutor-coze docs/spec/2026-08-10-coze-agent-interface.md 与 2026-09-07-coze-agent-view-navigation.md

const TRACE_MARK = '\n【决策痕迹】'
const EDIT_MARK = '\n【编辑建议】'
const NAV_MARK = '\n【视角导航】'
const STRUCT_MARKS = [EDIT_MARK, NAV_MARK]

// 剥掉 body（已去掉【决策痕迹】）末尾的结构化指令块。为兼容既有语义：
// 从「最后一块」开始：只剥「解析成功且产出 ≥1 个可用项」的块；可用项为空的块按正文保留并停止。
// 这样「编辑建议 JSON 合法但 edits 空」与「导航 views 空」都回退为正文，不静默丢弃。
function extractStructBlocks(body) {
  let text = body
  const edits = []
  const nav = { views: [] }
  let guard = 0
  while (guard++ < 20) {
    let bestMark = null
    let bestIdx = -1
    for (const m of STRUCT_MARKS) {
      const idx = text.lastIndexOf(m)
      if (idx !== -1 && idx > bestIdx) { bestMark = m; bestIdx = idx }
    }
    if (!bestMark) break
    const jsonText = text.slice(bestIdx + bestMark.length).trim()
    let usable = false
    try {
      const parsed = JSON.parse(jsonText)
      if (bestMark === NAV_MARK) {
        const views = (Array.isArray(parsed?.views) ? parsed.views : [])
          .filter((v) => v && typeof v.panel === 'string')
          .slice(0, 3)
          .map((v) => ({
            panel: v.panel,
            sub: typeof v.sub === 'string' ? v.sub : undefined,
            label: typeof v.label === 'string' && v.label ? v.label : '',
          }))
        if (views.length) { nav.views = views; usable = true }
      } else {
        const list = (Array.isArray(parsed?.edits) ? parsed.edits : [])
          .filter((e) => e && typeof e.old_string === 'string' && e.old_string.length > 0 && typeof e.new_string === 'string')
          .map((e) => ({
            title: typeof e.title === 'string' && e.title ? e.title : '代码修改',
            explanation: typeof e.explanation === 'string' ? e.explanation : '',
            old_string: e.old_string,
            new_string: e.new_string,
          }))
        if (list.length) { edits.push(...list); usable = true }
      }
    } catch { /* JSON 解析失败 → 整块按正文展示 */ }
    if (!usable) break
    text = text.slice(0, bestIdx).trimEnd()
  }
  return { body: text.trimEnd(), edits, nav }
}

/**
 * 剥离【决策痕迹】/【编辑建议】/【视角导航】块。
 * @returns {{ body: string, edits: Array<{title: string, explanation: string, old_string: string, new_string: string}>, nav: {views: Array<{panel: string, sub?: string, label?: string}>} }}
 * 任何解析失败都不抛出：块按正文展示，edits/nav 为空。
 */
export function parseAssistantMessage(raw) {
  const text = String(raw || '')
  const traceIdx = text.lastIndexOf(TRACE_MARK)
  const body = traceIdx === -1 ? text : text.slice(0, traceIdx)
  return extractStructBlocks(body)
}

/**
 * 把编辑建议定位到源码（应用时刻的文本）。
 * status: 'ok'（唯一匹配，带 [start,end) 偏移）| 'not-found' | 'ambiguous' | 'conflict'（与已接受区间重叠）
 */
export function planEdits(source, edits) {
  const src = String(source || '')
  const accepted = []
  return (edits || []).map((edit) => {
    if (!edit || typeof edit.old_string !== 'string' || edit.old_string.length === 0) {
      return { ...edit, status: 'not-found' }
    }
    const positions = []
    let idx = src.indexOf(edit.old_string)
    while (idx !== -1) {
      positions.push(idx)
      idx = src.indexOf(edit.old_string, idx + 1)
    }
    if (positions.length === 0) return { ...edit, status: 'not-found' }
    if (positions.length > 1) return { ...edit, status: 'ambiguous' }
    const start = positions[0]
    const end = start + edit.old_string.length
    if (accepted.some((r) => start < r.end && end > r.start)) {
      return { ...edit, status: 'conflict', start, end }
    }
    accepted.push({ start, end })
    return { ...edit, status: 'ok', start, end }
  })
}
