/**
 * Coze 智能体回答中的「决策痕迹」解析工具。
 *
 * 契约见 docs/superpowers/specs/2026-08-10-coze-agent-interface.md：
 * - 痕迹块固定以单独一行「【决策痕迹】」开头，其后一行是 JSON。
 * - 按「最后一个【决策痕迹】标记之后的内容」提取 JSON，其余全部视为正文。
 * - JSON 解析失败时整段按正文展示，trace 为 null。
 */

const TRACE_MARKER = '\n【决策痕迹】\n'

/**
 * 把回答文本切分为 { body, trace }。
 * - 无痕迹标记：{ body: 原文, trace: null }
 * - 有标记且 JSON 可解析：{ body: 标记前内容(trimEnd), trace: JSON }
 * - 有标记但 JSON 解析失败：{ body: 原文, trace: null }（整段按正文兜底）
 */
export function splitDecisionTrace(text) {
  if (typeof text !== 'string') return { body: text, trace: null }
  const idx = text.lastIndexOf(TRACE_MARKER)
  if (idx < 0) return { body: text, trace: null }
  const body = text.slice(0, idx).trimEnd()
  const raw = text.slice(idx + TRACE_MARKER.length).trim()
  try {
    return { body, trace: JSON.parse(raw) }
  } catch {
    return { body: text, trace: null }
  }
}

/**
 * 从决策痕迹中提取知识来源标签数组。
 * - trace 无 sources 或非数组：返回 []
 * - 条目为 { source: string }：取 source；字符串直接取；其余过滤
 */
export function sourceLabels(trace) {
  if (!trace || !Array.isArray(trace.sources)) return []
  return trace.sources
    .map((s) => {
      if (typeof s === 'string') return s
      if (s && typeof s === 'object' && typeof s.source === 'string') return s.source
      return ''
    })
    .filter(Boolean)
}
