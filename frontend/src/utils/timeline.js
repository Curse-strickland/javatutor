/**
 * 对话时间线纯函数：记录点摘要、折叠边界、下标收敛。
 *
 * 组件只做渲染，判定全部落在这里（本仓无 DOM 测试环境，见 plan §0）。
 * 决策 T1–T7 见 docs/plan/2026-09-10-coze-agent-run-timeline-plan.md §1。
 */

/** 记录点上限：超出后丢最旧的**代码快照**（分割线保留、按钮置灰）。 */
export const MAX_TIMELINE = 30

/** 回退前的确认文案：明示会覆盖当前编辑器内容并重跑（T2：只存代码快照，回退时重跑复现运行结果）。 */
export const REVERT_CONFIRM =
  '回退会覆盖当前编辑器内容，并把右侧刷新为那次运行的结果（其后对话将折叠保留）。确定回退吗？'

/** 记录点摘要：分割线上那一行「简短的新代码信息记录」。 */
export function buildCheckpointLabel({
  seq, kind, mode, time, methodName, entryFile, fileCount,
  code, steps, output, goalLabel, target,
}) {
  const head = `#${seq}`
  const when = time || ''
  if (kind === 'optimize') {
    const what = goalLabel ? `已应用优化（${goalLabel}）` : '已应用优化'
    return [head, what, target, when].filter(Boolean).join(' · ')
  }
  if (mode === 'multi') {
    const entry = fileCount ? `项目 ${fileCount} 文件${entryFile ? `（入口 ${entryFile}）` : ''}` : '项目'
    const n = Array.isArray(steps) ? `${steps.length} 步` : ''
    const out = shortOutput(output)
    return [head, entry, when, n, out].filter(Boolean).join(' · ')
  }
  const lines = typeof code === 'string' && code ? `${code.split('\n').length} 行` : ''
  const n = Array.isArray(steps) ? `${steps.length} 步` : ''
  return [head, methodName || '', when, lines, n, shortOutput(output)].filter(Boolean).join(' · ')
}

/** 输出首行，截断 20 字（空输出返回 ''）。 */
function shortOutput(output) {
  const first = String(output || '').split('\n').find((l) => l.trim()) || ''
  if (!first) return ''
  const trimmed = first.trim()
  const cut = trimmed.slice(0, 20)
  return `输出 "${cut}${trimmed.length > 20 ? '…' : ''}"`
}

/** 折叠边界：返回 [start, end) 的起始下标；未折叠返回 -1。 */
export function foldStartIndex(foldFromIndex) {
  return typeof foldFromIndex === 'number' && foldFromIndex >= 0 ? foldFromIndex + 1 : -1
}

/** 下标 i 的消息是否被折叠（分割线自身不折叠）。 */
export function isFolded(index, foldFromIndex) {
  const start = foldStartIndex(foldFromIndex)
  return start >= 0 && index >= start
}

/** 被折叠的消息条数（折叠起点越界时为 0，不出现负数）。 */
export function foldedCount(total, foldFromIndex) {
  const start = foldStartIndex(foldFromIndex)
  return start < 0 ? 0 : Math.max(0, total - start)
}

/** 回退时把激活文件下标收敛到合法范围（文件数可能已变）。 */
export function clampActiveIndex(index, fileCount) {
  if (!fileCount) return -1
  const i = Number.isInteger(index) ? index : 0
  return Math.max(0, Math.min(i, fileCount - 1))
}
