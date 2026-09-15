/**
 * 决策痕迹解析：把 Coze 智能体回答拆成「正文 + 【决策痕迹】JSON」。
 *
 * 契约：回答末尾用单独一行 `【决策痕迹】` 分隔，下一行为 JSON。
 * 解析规则：按最后一个 `\n【决策痕迹】\n` 切分；JSON 解析失败时整段按正文展示。
 * 正文末尾的【编辑建议】/【视角导航】结构化块会被一并剥掉，避免裸 JSON 渲染进 markdown。
 * 过程中流出的**过程哨兵**（`<!--jt:process …-->`）也在此剥掉——它们在 agent 终态已被
 * 清除，但流式累积的文本里留着（见 `processEvents.js`）。
 * 正文**开头**的裸工具调用 JSON（`main_agent` 中间提案随 `answer` delta 流出后被纯累加，
 * 见 `editSuggestion.js::stripLeadingToolJson`）同样在此剥掉。
 */

import { parseAssistantMessage, stripLeadingToolJson } from './editSuggestion.js'
import { extractProcessEvents } from './processEvents.js'

export function splitDecisionTrace(text) {
  if (typeof text !== 'string') return { body: text, trace: null }
  // 过程哨兵是**流中**产物：agent 侧已在终态用 RemoveMessage 清除，但流式累积出来的
  // `chatMessages[i].text` 里仍然留着它们。渲染前必须剥掉，否则会以 HTML 注释形态混进正文。
  // 紧接着剥裸工具 JSON：`main_agent` 的中间提案随 `answer` delta 流到前端并被纯累加，
  // 其作用点在 `state["answer"]` 的 coze 侧剥离**够不到流**（见 review 2026-09-13 §1.2）。
  const cleaned = stripLeadingToolJson(extractProcessEvents(text).clean)
  const marker = '\n【决策痕迹】\n'
  const idx = cleaned.lastIndexOf(marker)
  if (idx < 0) return { body: parseAssistantMessage(cleaned).body, trace: null }
  const body = cleaned.slice(0, idx).trimEnd()
  const raw = cleaned.slice(idx + marker.length).trim()
  try {
    const trace = JSON.parse(raw)
    return { body: parseAssistantMessage(body).body, trace }
  } catch {
    return { body: cleaned, trace: null }
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

/** `fetch_execution_context` 的 `file_source` → 用户可读来源（口径见 coze 侧 `_resolve_code`）。 */
const FILE_SOURCE_LABELS = {
  explicit: '显式指定',
  entry_file: '主入口',
  current_step_file: '当前步所在文件',
  only_file: '项目唯一文件',
  source_code: '单文件兜底',
}

/** 只渲染标量参数：长 JSON 撑破布局，且原始参数对用户无意义。 */
function scalarBits(args) {
  return Object.entries(args)
    .filter(([, v]) => ['string', 'number', 'boolean'].includes(typeof v))
    .map(([k, v]) => `${k}=${v}`)
}

/**
 * `fetch_execution_context` 的 `result` 摘要：**取到了哪个文件**（以及走的是哪条兜底）。
 *
 * 为什么必须从 `result` 读而不是从 `args` 读：自动前置的那次 fetch（`step_facts` 之前，
 * `args` 为空）与模型不传 `file` 的调用都解析不出文件名，只看 `args` 时执行过程区只会显示
 * 「调用 fetch_execution_context」——用户无从判断它到底读到了 Main.java 还是别的文件。
 */
function fetchStatus(result) {
  if (!result) return ''
  let r
  try {
    r = JSON.parse(result)
  } catch {
    return ''
  }
  if (!r || typeof r !== 'object') return ''
  if (r.error && String(r.error).trim()) {
    const one = String(r.error).split('\n')[0].trim()
    return ` → 失败：${one.length > 60 ? `${one.slice(0, 60)}…` : one}`
  }
  const file = typeof r.file === 'string' ? r.file : ''
  const src = FILE_SOURCE_LABELS[r.file_source] || (r.file_source ? String(r.file_source) : '')
  // `file` 为空串 = 取到的是单文件代码/激活文件，此时只报来源（否则会渲染成「（单文件/激活文件）」）。
  const head = file || src || '取到源码'
  const tail = file && src ? `（${src}）` : ''
  const chars = typeof r.code_chars === 'number' ? `，${r.code_chars} 字` : ''
  return ` → ${head}${tail}${chars}`
}

/** 工具名 → 卡片标题。未知工具直接用原名（将来加工具不必改前端也有可读标题）。 */
const TOOL_LABELS = {
  fetch_execution_context: '获取执行上下文',
  step_facts: '查询单步证据',
}

/**
 * 把一条工具调用记录拆成卡片字段（执行过程区渲染成卡片，不再是裸文本行）。
 *
 * - `label`：用户可读工具名
 * - `argsText`：只渲染标量参数（`fetch_execution_context` 的 `file=Util.java`、
 *   `step_facts` 的 `查询第 2 步，行 5`）——长 JSON 撑破布局，且原始参数对用户无意义
 * - `resultText`：`result` 摘要（取到哪个文件 / 越界 / 失败原因），无 `result` 时为空串
 * - `status`：`ok` | `error`，卡片据此标色
 *
 * 口径与拆分前逐字一致（`file`/`file_source`/`code_chars` 仍从 `result` 读——自动前置那
 * 次 fetch 的 `args` 是空的，只看 `args` 读不出文件名）；只是把「一行纯文本」换成三段字段。
 */
function toolCard(tc) {
  const tool = tc.tool || '工具'
  const args = tc.args && typeof tc.args === 'object' ? tc.args : {}
  let argsText = ''
  let resultText = ''
  let status = 'ok'
  if (tool === 'fetch_execution_context') {
    argsText = scalarBits(args).join('，')
    const arrow = fetchStatus(tc.result)
    if (arrow) {
      resultText = arrow.replace(/^ → /, '')
      status = resultText.startsWith('失败：') ? 'error' : 'ok'
    }
  } else if (tool === 'step_facts') {
    const bits = []
    if (typeof args.step_index === 'number') bits.push(`第 ${args.step_index + 1} 步`)
    if (typeof args.line === 'number') bits.push(`行 ${args.line}`)
    argsText = bits.length ? `查询${bits.join('，')}` : ''
    // 附加 result 摘要：越界(共N步)/已获取证据，便于诊断 step_facts
    if (tc.result) {
      try {
        const r = JSON.parse(tc.result)
        if (r.error && String(r.error).trim()) {
          const count = typeof r.steps_count === 'number' ? `（共 ${r.steps_count} 步）` : ''
          resultText = `越界${count}`
          status = 'error'
        } else {
          resultText = '已获取证据'
        }
      } catch { /* 忽略 result 解析失败 */ }
    }
  } else {
    argsText = scalarBits(args).join('，')
  }
  return { tool, label: TOOL_LABELS[tool] || tool, argsText, resultText, status }
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
    toolCards: [],
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
  const toolCards = (Array.isArray(trace.tool_calls) ? trace.tool_calls : [])
    .filter((tc) => tc && tc.tool)
    .map(toolCard)
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
  return { intentLabel, toolCards, toolEmptyText, reviseText, qualityWarnings, latencyText, tokenText }
}

/**
 * 把决策痕迹中的「完整过程」整理成可渲染结构：工具间思考（reasoning）与
 * RAG 检索全过程（retrieval）。
 *
 * 两层都做**缺省容错**——老数据不含这两个键（Agent 侧是纯增量新增），
 * 缺键 / 类型不符一律归空，绝不抛错。
 *
 * `retrieval.candidates` **含被阈值滤掉的候选**（`kept: false`），
 * 这正是「检索没召回到」与「召回到但被阈值滤掉」在界面上可区分的地方。
 */
export function traceProcess(trace) {
  const empty = { reasoning: [], reasoningTruncated: false, retrieval: null, hasContent: false }
  if (!trace || typeof trace !== 'object') return empty

  const reasoning = (Array.isArray(trace.reasoning) ? trace.reasoning : [])
    .filter((r) => r && typeof r === 'object')
    .map((r) => ({
      round: typeof r.round === 'number' ? r.round : 0,
      content: typeof r.content === 'string' ? r.content : '',
      toolsText: Array.isArray(r.tool_calls) ? r.tool_calls.filter(Boolean).join('、') : '',
    }))

  let retrieval = null
  const raw = trace.retrieval
  if (raw && typeof raw === 'object') {
    const candidates = (Array.isArray(raw.candidates) ? raw.candidates : [])
      .filter((c) => c && typeof c === 'object')
      .map((c) => ({
        source: c.source || '',
        score: typeof c.score === 'number' ? c.score : 0,
        kept: c.kept === true,
        preview: typeof c.preview === 'string' ? c.preview : '',
      }))
    const parts = []
    if (raw.query) parts.push(`查询「${raw.query}」`)
    if (typeof raw.threshold === 'number') parts.push(`阈值 ${raw.threshold}`)
    if (typeof raw.best_score === 'number') parts.push(`最高分 ${raw.best_score}`)
    parts.push(`命中 ${typeof raw.kept === 'number' ? raw.kept : 0}`)
    retrieval = { summaryText: parts.join(' · '), candidates }
  }

  const hasContent = reasoning.length > 0 || (retrieval !== null && retrieval.candidates.length > 0)
  return {
    reasoning,
    reasoningTruncated: trace.reasoning_truncated === true,
    retrieval,
    hasContent,
  }
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
