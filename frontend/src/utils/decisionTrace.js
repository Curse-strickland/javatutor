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

/** 意图 → 用户可读标签 */
const INTENT_LABELS = {
  data_query: '数据追问',
  concept: '概念讲解',
  debug: '错误诊断',
  analyze: '代码分析',
  animate: '动画解说',
  animate_guide: '动画解说',
  other: '通用助手',
}

/** 把一条工具调用记录格式化为可读行，只渲染 tool 与 args 的关键字段。 */
function formatToolCall(tc) {
  const tool = tc.tool || '工具'
  const args = tc.args && typeof tc.args === 'object' ? tc.args : {}
  if (tool === 'step_facts') {
    const bits = []
    if (typeof args.step_index === 'number') bits.push(`第 ${args.step_index + 1} 步`)
    if (typeof args.line === 'number') bits.push(`行 ${args.line}`)
    return bits.length ? `调用 ${tool}：查询${bits.join('，')}` : `调用 ${tool}`
  }
  const scalars = Object.entries(args)
    .filter(([, v]) => ['string', 'number', 'boolean'].includes(typeof v))
    .map(([k, v]) => `${k}=${v}`)
  return scalars.length ? `调用 ${tool}：${scalars.join('，')}` : `调用 ${tool}`
}

function formatLatency(ms) {
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`
  return `${Math.round(ms)}ms`
}

function formatTokens(usage) {
  if (!usage || typeof usage !== 'object') return ''
  const p = usage.prompt_tokens
  const c = usage.completion_tokens
  const est = usage.estimated === true ? '（估）' : ''
  if (typeof p === 'number' && typeof c === 'number') return `Prompt ${p} / 生成 ${c}${est}`
  if (typeof p === 'number') return `Prompt ${p}${est}`
  if (typeof c === 'number') return `生成 ${c}${est}`
  return ''
}

/**
 * 把决策痕迹转换为用户可读的执行过程摘要。
 * 只输出意图、工具调用、评审/修订状态、降级提示与耗时/Token 统计，不暴露原始 JSON。
 * 无 trace 或字段缺失时返回空值，不抛错。
 */
export function traceSummary(trace) {
  const empty = {
    intentLabel: '',
    toolLines: [],
    toolEmptyText: '',
    reviseText: '',
    qualityWarnings: [],
    latencyText: '',
    tokenText: '',
  }
  if (!trace || typeof trace !== 'object') return empty
  const intentLabel = trace.intent
    ? `意图识别：${INTENT_LABELS[trace.intent] || INTENT_LABELS.other}（${trace.intent}）`
    : ''
  const toolLines = (Array.isArray(trace.tool_calls) ? trace.tool_calls : [])
    .filter((tc) => tc && tc.tool)
    .map(formatToolCall)
  const toolEmptyText = Array.isArray(trace.tool_calls) && trace.tool_calls.length === 0
    ? '未调用工具'
    : ''
  let reviseText = ''
  if (trace.critic_passed === false) {
    reviseText = trace.revised === true ? '评审未通过，已修订' : '评审未通过（未修订）'
  }
  const qualityWarnings = []
  if (trace.rag_degraded === true) qualityWarnings.push('知识库检索不可用，已用通用知识回答')
  if (trace.critic_skipped === true) qualityWarnings.push('评审已跳过')
  if (trace.revise_skipped === true) qualityWarnings.push('修订已跳过')
  if (typeof trace.fallback_reason === 'string' && trace.fallback_reason) {
    qualityWarnings.push(`降级：${trace.fallback_reason}`)
  }
  if (trace.compaction_mode === 'windowed') qualityWarnings.push('上下文过长，已窗口化压缩')
  else if (trace.compaction_mode === 'truncated') qualityWarnings.push('上下文过长，压缩失败已截断')
  const latencyText = typeof trace.latency_ms === 'number' && trace.latency_ms > 0
    ? `耗时 ${formatLatency(trace.latency_ms)}`
    : ''
  const tokenText = formatTokens(trace.token_usage)
  return { intentLabel, toolLines, toolEmptyText, reviseText, qualityWarnings, latencyText, tokenText }
}

/** 开发者模式用的结构化观测行（run_id / 上下文拉取结果）。 */
export function traceDebugLines(trace) {
  if (!trace || typeof trace !== 'object') return []
  const lines = []
  if (typeof trace.run_id === 'string' && trace.run_id) lines.push(`run_id: ${trace.run_id}`)
  if (trace.fetch_context_failed === true) {
    lines.push(`上下文拉取失败：${trace.fetch_context_error || '未知原因'}`)
  } else if (trace.fetch_context_failed === false) {
    const latency = typeof trace.fetch_context_latency_ms === 'number'
      ? `${trace.fetch_context_latency_ms}ms`
      : 'ok'
    lines.push(`上下文拉取：${latency}`)
  }
  return lines
}
