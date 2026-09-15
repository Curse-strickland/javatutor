// Agent 编辑建议 + 视角导航：解析 assistant 消息中的结构化块，并把编辑定位到源码
// 协议见 javatutor-coze docs/spec/2026-08-10-coze-agent-interface.md 与 2026-09-07-coze-agent-view-navigation.md

const TRACE_MARK = '\n【决策痕迹】'
const EDIT_MARK = '\n【编辑建议】'
const NAV_MARK = '\n【视角导航】'
const STRUCT_MARKS = [EDIT_MARK, NAV_MARK]
const ALGO_SUB_TABS = ['knowledge', 'template']

// 优化目标闭集（与 coze 侧 prompting/optimization.py 的 GOALS 一致）：
// 前端据此渲染 label 缺省值，并按模板拼「提交所选方向」后的提问（确定、可日志，不由模型自由发挥）。
// comprehensive 仅用于第 2 轮 replace 的 goal（勾 ≥2 个方向时），方案卡的 options 不产出它。
export const GOALS = {
  performance: '性能',
  readability: '可读性',
  memory: '内存',
  style: '规范',
  correctness: '正确性',
  comprehensive: '综合',
}

const ORDINALS = ['①', '②', '③'] // 与 options 上限（3 项）一致

/**
 * 第二步提问的判别标记（coze 侧 `prompting/optimization.py::STEP2_MARKER`，两侧字面量必须一致）。
 *
 * 为什么必须由前端写进提问：无状态——聊天请求不带任何对话历史，会话工作记忆只留上一答**前 200 字**，
 * 而 `options` 块在回答**末尾** ⇒「上一轮已经给过方案卡」在服务端基本读不到。
 * 而第二步提问的形状（「只做「以性能为先」方向的优化」）**恰好就是**「已含明确目标」，
 * 与第一步的判别依据冲突，模型无法区分，表现为「再给一张一模一样的方案卡、一行代码都没有」。
 */
export const STEP2_MARKER = '【优化第二步】'

/** 某一项方向的显示名：优先 agent 给的 label，回落闭集中文名。 */
function optionName(o) {
  return o.label || GOALS[o.goal] || o.goal
}

/**
 * 拼「已勾选优化方向」后发出的第 2 轮提问（F2：白名单 + 显式黑名单）。
 * 「以 X 为优先」是软偏好，会把选择变成建议；这里改成「只做 X」+「不要顺带做 Y」，
 * 让选择成为硬约束（agent 侧 guidance 同步要求「只做所列方向」）。
 * 开头固定带 `STEP2_MARKER`：那是 agent 判别「第二步」的唯一依据。
 * @param {Array<{goal: string, label?: string, detail?: string}>} selected 已勾选方向（≥1 项）
 * @param {Array<{goal: string, label?: string, detail?: string}>} [excluded] 同一张方案卡里未被勾选的项
 * @returns {string} 空选择返回 ''（调用方不得发送）
 */
export function buildGoalPrompt(selected, excluded = []) {
  const list = (Array.isArray(selected) ? selected : []).filter(Boolean)
  if (!list.length) return ''
  const name = optionName

  let head
  if (list.length === 1) {
    const o = list[0]
    head = `只做「${name(o)}」方向的优化` + (o.detail ? `，具体要求：${o.detail}` : '')
  } else {
    const items = list
      .map((o, i) => `${ORDINALS[i] || `${i + 1}.`}「${name(o)}」${o.detail ? `：${o.detail}` : ''}`)
      .join('；')
    head = `只做以下方向的优化：${items}`
  }

  const bad = (Array.isArray(excluded) ? excluded : []).filter(Boolean)
  const tail = bad.length
    ? `。不要顺带做其他方向的改动（例如：${bad.map((o) => `「${name(o)}」${o.detail ? `：${o.detail}` : ''}`).join('；')}）`
    : ''

  return `${STEP2_MARKER}${head}${tail}。请给出优化后的完整代码。`
}

// 归一化非 patch 的【编辑建议】块（kind=options/replace）；不合法返回 null → 调用方回退为正文。
function normalizePlan(parsed) {
  const kind = typeof parsed?.kind === 'string' ? parsed.kind : 'patch'
  if (kind === 'options') {
    const options = (Array.isArray(parsed.options) ? parsed.options : [])
      .filter((o) => o && typeof o.goal === 'string' && GOALS[o.goal])
      .slice(0, 3)
      .map((o) => ({
        goal: o.goal,
        label: typeof o.label === 'string' && o.label ? o.label : GOALS[o.goal],
        detail: typeof o.detail === 'string' ? o.detail : '',
      }))
    if (!options.length) return null
    return {
      kind: 'options',
      target: typeof parsed.target === 'string' ? parsed.target : '',
      options,
    }
  }
  if (kind === 'replace') {
    const code = typeof parsed.code === 'string' ? parsed.code : ''
    if (!code.trim()) return null
    return {
      kind: 'replace',
      target: typeof parsed.target === 'string' ? parsed.target : '',
      goal: typeof parsed.goal === 'string' && GOALS[parsed.goal] ? parsed.goal : '',
      rationale: typeof parsed.rationale === 'string' ? parsed.rationale : '',
      code,
    }
  }
  return null // patch / 非法 kind → 走既有 edits 分支
}

// 归一化【视角导航】的 algo 精确定位字段（panel='algorithm' 时使用）。
// 只保留合法 subTab 与字符串 categoryId/anchorId；空对象返回 undefined，避免 nav.views 塞进无意义项。
function normalizeAlgo(algo) {
  if (!algo || typeof algo !== 'object') return undefined
  const out = {}
  if (ALGO_SUB_TABS.includes(algo.subTab)) out.subTab = algo.subTab
  if (typeof algo.categoryId === 'string' && algo.categoryId) out.categoryId = algo.categoryId
  if (typeof algo.anchorId === 'string' && algo.anchorId) out.anchorId = algo.anchorId
  return Object.keys(out).length ? out : undefined
}

// 归一化一条【视角导航】view。算法库若缺 `algo` 字段，回收顶层 sub/subTab/categoryId/anchorId，
// 兼容 agent 把定位字段放顶层（而非放进 algo:{...}）的产出，避免定位被丢弃、只落到「算法库」默认页。
function normalizeView(v) {
  const panel = typeof v.panel === 'string' ? v.panel : ''
  let algo = normalizeAlgo(v.algo)
  if (!algo && panel === 'algorithm') {
    const subTab = v.subTab ?? (ALGO_SUB_TABS.includes(v.sub) ? v.sub : undefined)
    algo = normalizeAlgo({ subTab, categoryId: v.categoryId, anchorId: v.anchorId })
  }
  return {
    panel,
    sub: typeof v.sub === 'string' ? v.sub : undefined,
    algo,
    label: typeof v.label === 'string' && v.label ? v.label : '',
  }
}

// 从 text[start]（跳过空白）找到与首字符配对的平衡 {…}/[…] 区间。
// 返回 [end, jsonStr]（end 为闭括号后一位）；找不到合法起点时返回 null。
function parseJsonAt(text, start) {
  while (start < text.length && /\s/.test(text[start])) start++
  const open = text[start]
  const close = open === '{' ? '}' : open === '[' ? ']' : null
  if (!close) return null
  let depth = 0, inStr = false, esc = false
  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (inStr) {
      if (esc) esc = false
      else if (ch === '\\') esc = true
      else if (ch === '"') inStr = false
      continue
    }
    if (ch === '"') { inStr = true; continue }
    if (ch === open) depth++
    else if (ch === close) { depth--; if (depth === 0) return [i + 1, text.slice(start, i + 1)] }
  }
  return null
}

// 折叠 3 连及以上空行为单个空行，避免移除块后留下多余的空白分隔。
function collapseBlankLines(text) {
  return text.replace(/\n{3,}/g, '\n\n')
}

/**
 * 反复剥掉正文**开头**的裸工具调用 JSON（形如 `{"tool":"step_facts","args":{...}}`）。
 *
 * 为什么前端要做这件事：`main_agent` 的**中间提案**也会随 `answer` delta 流到客户端——
 * LangGraph `stream_mode="messages"` 会把节点返回值里**所有键**的消息一起转出（不只
 * `messages`，`agent_messages` 也在内），平台 SDK 只过滤 `langgraph_node === "tools"`，
 * 其余非 chunk 的 `AIMessage` 一律转成 `answer`。而本 store 是**纯累加**（`text += t`，
 * 不插分隔符），于是提案 JSON 会粘在正文最前面、连标题一起糊成
 * `{"tool":…}}### 当前这一步的执行内容`——`}}###` 的粘连不是模型少打了换行，
 * 是 `+=` 本身不插分隔符。
 *
 * coze 侧的 `_strip_leaked_json` 规则 0 管的是 `state["answer"]`，**够不到流**
 * （见 `docs/reviews/2026-09-13-process-streaming-and-strip-leading-tool-json-review.md` §1.2），
 * 所以这一层必须在前端补。两端判据刻意同口径。
 *
 * **必须循环到不动为止**：一次提问有多轮提案（`MAX_ROUNDS`），每轮各一段 JSON，
 * 剥掉第一段后第二段会**新暴露**成开头。
 *
 * **判别收在 `tool` 键上**（与 harness `parse_action` 同口径，见
 * `src/graphs/javatutor/harness/contracts.py`）：正文若恰好以别的 JSON 对象开头
 * （例如用户就是在问一份配置，或【视角导航】的 `{"views":[…]}`），一律不碰。
 *
 * 对不含前导工具 JSON 的文本**恒等**（不改变一个字），失败一律原样返回、不抛错。
 */
export function stripLeadingToolJson(text) {
  if (typeof text !== 'string' || !text) return text
  let out = text
  for (;;) {
    // parseJsonAt 自带前导空白跳过，故返回的结束下标可直接切片。
    const range = parseJsonAt(out, 0)
    if (!range) return out
    let parsed
    try { parsed = JSON.parse(range[1]) } catch { return out }
    // 只有「对象且有 tool 键」才剥：数组 / 无 tool 的对象（导航、编辑建议）原样保留。
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || !parsed.tool) return out
    out = out.slice(range[0])
  }
}

// 剥掉 body（已去掉【决策痕迹】）的结构化指令块。为兼容既有语义：
// 从「最后一块」开始：只剥「解析成功且产出 ≥1 个可用项」的块；可用项为空的块按正文保留并停止。
// 这样「编辑建议 JSON 合法但 edits 空」与「导航 views 空」都回退为正文，不静默丢弃。
function extractStructBlocks(body) {
  let text = stripLeadingToolJson(body)
  const edits = []
  const nav = { views: [] }
  let plan = null
  let guard = 0
  while (guard++ < 20) {
    let bestMark = null
    let bestIdx = -1
    for (const m of STRUCT_MARKS) {
      const idx = text.lastIndexOf(m)
      if (idx !== -1 && idx > bestIdx) { bestMark = m; bestIdx = idx }
    }
    if (!bestMark) break
    let jsonEnd = null
    let usable = false
    const range = parseJsonAt(text, bestIdx + bestMark.length)
    if (range) {
      jsonEnd = range[0]
      const jsonStr = range[1]
      try {
        const parsed = JSON.parse(jsonStr)
        if (bestMark === NAV_MARK) {
          const views = (Array.isArray(parsed?.views) ? parsed.views : [])
            .filter((v) => v && typeof v.panel === 'string')
            .slice(0, 3)
            .map(normalizeView)
          if (views.length) { nav.views = views; usable = true }
        } else {
          // kind=options/replace：方案卡与整文件覆盖，与 patch 互斥（不同时走两个分支）
          const p = normalizePlan(parsed)
          if (p) {
            plan = p
            usable = true
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
        }
      } catch { /* JSON 解析失败 → 整块按正文展示 */ }
    }
    if (!usable) break
    // 移除 [bestIdx, jsonEnd)：块前正文 + 块后正文（若 agent 在块后又写了正文）拼接保留
    text = (text.slice(0, bestIdx) + text.slice(jsonEnd)).trimEnd()
  }
  return { body: collapseBlankLines(text.trimEnd()), edits, nav, plan }
}

/**
 * 剥离【决策痕迹】/【编辑建议】/【视角导航】块。
 * @returns {{ body: string, edits: Array<{title: string, explanation: string, old_string: string, new_string: string}>, nav: {views: Array<{panel: string, sub?: string, label?: string}>}, plan: null | {kind:'options', target: string, options: Array<{goal: string, label: string, detail: string}>} | {kind:'replace', target: string, goal: string, rationale: string, code: string} }}
 * 任何解析失败都不抛出：块按正文展示，edits/nav 为空、plan 为 null。
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
