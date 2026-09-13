// 报错入口（全局弹窗）的纯判定：是不是「运行类错误」、要不要 6 秒自动消失、预填什么提问。
// 与组件分离，便于单测（本仓无 DOM 测试环境）。规格见
// javatutor-coze docs/spec/2026-09-10-coze-agent-code-optimization.md §5。

/**
 * toast 上这条错误是否为「运行类错误」。
 * `runCode`/`runProject` 失败与 `applyRunResult` 失败分支都会同时写 `store.error` 与
 * `store.lastRunError`（同文），据此与其它错误（AI 流错误等）分流。
 * @param {string|null} error store.error
 * @param {{message: string}|null} lastRunError store.lastRunError
 */
export function isRunError(error, lastRunError) {
  return !!lastRunError && !!error && lastRunError.message === error
}

/** 非运行类错误的自动消失时长（运行类错误常驻，直到手动关闭或下次成功运行）。 */
export const TRANSIENT_ERROR_MS = 6000

/** 运行类错误**不**自动消失——入口挂在弹窗上，弹窗飘走入口就没了。 */
export function shouldAutoDismiss(error, lastRunError) {
  return !isRunError(error, lastRunError)
}

/**
 * 报错入口要预填的提问文本（只预填、不发送）。
 * `ctx` 只承载**事实**（本仓不写任何 JavaTutor 运行语义——语义在 coze 侧知识与引导里）。
 * @param {string} message 错误原文
 * @param {{mode?: 'single'|'multi', fileCount?: number, entryFile?: string,
 *          testMode?: boolean, testCaseCount?: number}} [ctx]
 *   缺省时退化为旧行为（只有错误原文 + 旧首行，无 `[运行环境]`），保证既有调用不受影响。
 */
export function buildFixPrompt(message, ctx) {
  const lines = ['我的代码运行报错了，请帮我看看怎么修正：']
  const env = runEnvLines(ctx)
  if (env.length) lines.push('', '[运行环境]', ...env)
  lines.push('', '[错误原文]', message || '')
  return lines.join('\n')
}

/**
 * 运行环境事实行；`ctx` 缺失或字段缺失时不产出该行（向后兼容）。
 * 用纯文本而非 `**` 强调：这段文本进的是**输入框草稿**与用户消息气泡，
 * 两处都不走 markdown 渲染，加粗标记只会原样显示成星号。
 */
export function runEnvLines(ctx) {
  if (!ctx) return []
  const out = []
  if (ctx.mode === 'multi') {
    out.push(`- 文件模式：多文件（${Number(ctx.fileCount) || 0} 个文件，主入口 ${ctx.entryFile || '未指定'}）`)
  } else if (ctx.mode === 'single') {
    out.push('- 文件模式：单文件')
  }
  if (typeof ctx.testMode === 'boolean') {
    const n = Number(ctx.testCaseCount) || 0
    out.push(
      ctx.testMode
        ? `- 运行模式：测试模式（已保存用例 ${n} 条）`
        : `- 运行模式：默认模式（测试模式未激活：已保存用例 ${n} 条）`,
    )
  }
  return out
}
