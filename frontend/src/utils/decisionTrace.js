/**
 * 决策痕迹解析：把 Coze 智能体回答拆成「正文 + 【决策痕迹】JSON」。
 *
 * 契约：回答末尾用单独一行 `【决策痕迹】` 分隔，下一行为 JSON。
 * 解析规则：按最后一个 `\n【决策痕迹】\n` 切分；JSON 解析失败时整段按正文展示。
 */

export function splitDecisionTrace(text) {
  if (typeof text !== 'string') return { body: text, trace: null }
  const marker = '\n【决策痕迹】\n'
  const idx = text.lastIndexOf(marker)
  if (idx < 0) return { body: text, trace: null }
  const body = text.slice(0, idx).trimEnd()
  const raw = text.slice(idx + marker.length).trim()
  try {
    return { body, trace: JSON.parse(raw) }
  } catch {
    return { body: text, trace: null }
  }
}

/** 从痕迹中提取知识库来源标签（`trace.sources[].source`），过滤空值。 */
export function sourceLabels(trace) {
  if (!trace || !Array.isArray(trace.sources)) return []
  return trace.sources.map((s) => (s && s.source) || '').filter(Boolean)
}
