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

/** 报错入口要预填的提问文本（只预填、不发送）。 */
export function buildFixPrompt(message) {
  return `我的代码运行报错了，请帮我看看怎么修正：\n${message || ''}`
}
