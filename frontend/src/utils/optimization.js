// 优化卡（【编辑建议】kind=options/replace）的纯逻辑：目标解析、门禁请求体、响应判定、应用方式。
// 与组件分离，便于单测（本仓无 DOM 测试环境）。协议见
// javatutor-coze docs/spec/2026-09-10-coze-agent-code-optimization.md §4/§6。

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
