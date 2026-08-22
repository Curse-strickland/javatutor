// Agent 编辑建议：解析 assistant 消息中的结构化块，并把编辑定位到源码
// 协议见 javatutor-coze docs/spec/2026-08-10-coze-agent-interface.md

const TRACE_MARK = '\n【决策痕迹】'
const EDIT_MARK = '\n【编辑建议】'

/**
 * 剥离【决策痕迹】/【编辑建议】块。
 * @returns {{ body: string, edits: Array<{title: string, explanation: string, old_string: string, new_string: string}> }}
 * 任何解析失败都不抛出：块按正文展示，edits 为空。
 */
export function parseAssistantMessage(raw) {
  const text = String(raw || '')
  const traceIdx = text.lastIndexOf(TRACE_MARK)
  let body = traceIdx === -1 ? text : text.slice(0, traceIdx)

  const editIdx = body.lastIndexOf(EDIT_MARK)
  if (editIdx === -1) return { body: body.trimEnd(), edits: [] }

  const jsonText = body.slice(editIdx + EDIT_MARK.length).trim()
  try {
    const parsed = JSON.parse(jsonText)
    const edits = (Array.isArray(parsed?.edits) ? parsed.edits : [])
      .filter(
        (e) =>
          e &&
          typeof e.old_string === 'string' &&
          e.old_string.length > 0 &&
          typeof e.new_string === 'string',
      )
      .map((e) => ({
        title: typeof e.title === 'string' && e.title ? e.title : '代码修改',
        explanation: typeof e.explanation === 'string' ? e.explanation : '',
        old_string: e.old_string,
        new_string: e.new_string,
      }))
    // JSON 合法但无可用 edits（如 {"edits":[]}）→ 整块按正文展示，不静默丢弃
    if (edits.length === 0) return { body: body.trimEnd(), edits: [] }
    return { body: body.slice(0, editIdx).trimEnd(), edits }
  } catch {
    // JSON 解析失败 → 整块按正文展示
    return { body: body.trimEnd(), edits: [] }
  }
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
