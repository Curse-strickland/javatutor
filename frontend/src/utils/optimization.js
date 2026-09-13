// 优化卡（【编辑建议】kind=options/replace）的纯逻辑：目标解析、门禁请求体、响应判定、应用方式。
// 与组件分离，便于单测（本仓无 DOM 测试环境）。协议见
// javatutor-coze docs/spec/2026-09-10-coze-agent-code-optimization.md §4/§6。

import { parseAssistantMessage } from './editSuggestion.js'

/**
 * 解析优化卡的目标文件。
 * @param {'single'|'multi'} mode
 * @param {Array<{name: string, code: string}>} files 多文件项目文件表
 * @param {string} target 块里的 target 字段
 * @returns {{ status: 'ok'|'missing-required'|'not-found', index: number, name: string }}
 *   status='ok' 时 index 为 files 下标（单文件恒为 0）；其余 status 表示「不可覆盖」。
 */
export function resolveTarget(mode, files, target) {
  const name = typeof target === 'string' ? target : ''
  if (mode !== 'multi') return { status: 'ok', index: 0, name }
  // 多文件：target 必填（spec §4.5），缺省或找不到都不得静默落到当前激活文件
  if (!name) return { status: 'missing-required', index: -1, name: '' }
  const index = (files || []).findIndex((f) => f.name === name)
  return index < 0 ? { status: 'not-found', index: -1, name } : { status: 'ok', index, name }
}

/**
 * 构造门禁请求：把候选代码送去真跑一次（spec §6.1）。
 * 单文件 → /api/run（测试模式带 mode/testCases）；多文件 → /api/run/project（target 替换为候选）。
 */
export function buildGateRequest({ mode, files, target, code, testMode, testCases }) {
  if (mode !== 'multi') {
    const body = { code }
    if (testMode) {
      body.mode = 'test'
      body.testCases = testCases || []
    }
    return { url: '/api/run', body }
  }
  return {
    url: '/api/run/project',
    body: { files: (files || []).map((f) => (f.name === target ? { ...f, code } : f)) },
  }
}

/** 门禁响应 → 状态（success 判定与 store.applyRunResult 一致）。 */
export function readGateResponse(data) {
  if (data && (data.code === 200 || data.success)) return { ok: true, error: '' }
  const error = (data && (data.error || data.msg)) || '未知错误'
  return { ok: false, error }
}

/**
 * 选择「整文件覆盖」的落地方式。
 * - `monaco`：单文件下编辑器即唯一载体，用一条 old_string=当前全文的 edit 覆盖，
 *   天然是单个 undo 单元，`undoToken` 语义原样可用（plan §0.1 B2）。
 * - `snapshot`：多文件下 Monaco 只持有当前激活文件，跨文件整份替换必然触发 setCode 重载编辑器、
 *   版本号变动而失去 undo 单元 → 直接写 `multiState.files[i].code`，撤销走覆盖前快照。
 */
export function pickApplyMode(mode) {
  return mode === 'multi' ? 'snapshot' : 'monaco'
}

/**
 * 组合判定「应用」按钮是否可用（spec §6.1）：目标可覆盖、门禁通过、且尚未应用，三者缺一不可。
 * 抽成纯函数是为了让这条最关键的组合判定有自动化覆盖（组件本身无 DOM 测试环境）。
 * @param {{ targetBlocked: boolean, gate: string, applied: boolean }} s
 *   gate 取 'idle'|'running'|'ok'|'fail'
 * @returns {boolean}
 */
export function canApply({ targetBlocked, gate, applied }) {
  return !targetBlocked && gate === 'ok' && !applied
}

/** 覆盖前快照 + 撤销提示文案（快照回退会丢弃此后的编辑，必须显式确认）。 */
export const SNAPSHOT_UNDO_CONFIRM = '代码已改动，撤销将丢弃此后的编辑，确定撤销吗？'

/** 门禁失败后的自动返修次数上限（**额外**生成次数，故最多 3 版候选）。 */
export const MAX_OPT_RETRY = 2

/**
 * 区分门禁失败的两种性质：代码跑不过 vs 链路不通。
 * 不区分就会在断网时把返修额度烧光（重生成一版同样验不了）。
 * @param {{ thrown?: boolean, httpStatus?: number }} s
 *   thrown=true → fetch 抛异常（断网/服务未起）；httpStatus ≥ 400 → 服务端链路失败
 * @returns {'transport'|'run'} 只有 'run' 才值得让 agent 重生成
 */
export function classifyGateFailure({ thrown = false, httpStatus = 0 } = {}) {
  if (thrown) return 'transport'
  return httpStatus >= 400 ? 'transport' : 'run'
}

/**
 * 返修决策（F1/F3/F4/F5 的唯一判定点，纯函数）。
 * @param {{ attempt: number, kind: 'run'|'transport', applied: boolean,
 *           targetBlocked: boolean, isLatest: boolean, hasCode: boolean }} s
 * @returns {{ action: 'retry'|'regate'|'stop', attempt: number, max: number }}
 *   retry  = 发起返修提问（attempt 为**本次**序号，从 1 起）
 *   regate = 只重跑门禁（传输失败）
 *   stop   = 保持现状（显示错误 + 禁用应用）
 */
export function nextRetry({ attempt, kind, applied, targetBlocked, isLatest, hasCode }) {
  const stop = { action: 'stop', attempt, max: MAX_OPT_RETRY }
  if (applied || targetBlocked || !isLatest || !hasCode) return stop
  if (kind === 'transport') return { action: 'regate', attempt, max: MAX_OPT_RETRY }
  if (attempt >= MAX_OPT_RETRY) return stop
  return { action: 'retry', attempt: attempt + 1, max: MAX_OPT_RETRY }
}

/** 返修中的卡片文案。 */
export function retryLabel(attempt, max = MAX_OPT_RETRY) {
  return `校验未通过，正在自动修正 ${attempt}/${max}…`
}

/**
 * 返修提问。
 * 候选代码必须**内联**：提问体里的 `code` 是用户编辑器里的代码，不是候选代码，
 * 而候选只活在 props.plan.code 里。目标与方向也必须写明，避免 agent 改错方向。
 * 首行的两个标记与 coze 侧引导段（prompting/optimization.py）**互为字面包含**，
 * 一端改字另一端即红（见 tests/test_optimization_guidance.py）。
 */
export function buildRetryPrompt({ plan = {}, gateError = '', goalLabel = '', attempt, max = MAX_OPT_RETRY }) {
  const target = plan.target || '（当前文件）'
  return [
    `上一版优化代码没有通过编译/运行校验（第 ${attempt}/${max} 次自动修正），请修正后重新给出完整代码。`,
    '',
    `[目标] 方向：${goalLabel || plan.goal || '（未指明）'}；目标文件：${target}`,
    '[校验错误]',
    gateError || '（未提供）',
    '[上一版候选代码]',
    '```java',
    plan.code || '',
    '```',
    '',
    '要求：只输出一版修正后的完整代码（同一个【编辑建议】块，kind:"replace"，goal 与 target 保持不变），',
    '必须能编译并正常运行；不要只解释错误，也不要改动优化方向，不要新增其它块。',
  ].join('\n')
}

/**
 * 返修结果是否产出可用的 `kind:"replace"` 块（F5 的判据）。
 * 复用既有解析器（`utils/editSuggestion.js`），不另写一套块解析——
 * 拿不到候选时必须**丢弃该次返修**并保留失败卡片（用户还要看到错误原文）。
 */
export function hasUsableReplace(raw) {
  const parsed = parseAssistantMessage(raw)
  return !!(parsed && parsed.plan && parsed.plan.kind === 'replace')
}
