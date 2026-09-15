/**
 * 过程哨兵解析：从流式 chunk 里抽出「已发生的事实」（阶段 / 工具调用）。
 *
 * agent 侧把一条 HTML 注释形式的轻量消息塞进 `messages`，随既有 SSE 通道流出：
 *
 *     \n<!--jt:process {"kind":"stage","text":"正在分析问题…"}-->\n
 *
 * 用 HTML 注释是关键取舍：即使本前端**未**拦截（老前端 + 新 agent），markdown 渲染器
 * 也会把它当注释不可见。**最坏情况是「没有进度条」，而不是「界面上一堆乱码」。**
 *
 * 本文件与 coze 侧 `src/graphs/javatutor/process_events.py` **同构**——同一格式两份实现，
 * 靠两侧测试对齐（`tests/test_process_events.py` ↔ `processEvents.test.js`）。
 */

const MARK_PREFIX = '<!--jt:process '

// 连同两侧换行一起吞掉，使剥离后的正文与原文的散文部分**逐字相等**
// （agent 侧构造时在两侧各加一个 `\n`，不吞掉就会留下空行）。
//
// 负载内**不含** `-->`：agent 侧构造时会把负载里的终止符替换成 JSON 转义形式
// （反斜杠 + u003e，解析后还原为 `>`），所以 `.` 默认不跨行的惰性匹配是安全的
// （无需担心跨大括号贪心陷阱）。
const MARK_RE = /\n?<!--jt:process (.+?)-->\n?/g

/**
 * 抽出文本里所有哨兵，返回 `{ clean, events }`。
 *
 * 单条 JSON 解析失败、或解析结果不是对象时，**丢弃该条**：既不进 `events`，
 * 也不留在 `clean` 里（哨兵是内部通道，任何情况下都不该当正文漏给用户）。
 *
 * 非字符串输入原样返回（调用方可能传 undefined），不抛错。
 */
export function extractProcessEvents(text) {
  if (typeof text !== 'string') return { clean: text, events: [] }

  const events = []
  const clean = text.replace(MARK_RE, (_match, payload) => {
    try {
      const event = JSON.parse(payload)
      if (event && typeof event === 'object' && !Array.isArray(event)) {
        events.push(event)
      }
    } catch {
      /* 畸形负载：丢弃，且不留在正文里 */
    }
    return ''
  })
  return { clean, events }
}

/**
 * 把一串新到的事件并入实时进度状态（纯函数，返回新对象）。
 *
 * `stage` 是**覆盖式**（界面只显示最新一条），`tool` 是**追加式**（累积成列表）。
 * `kind` 是开放集合：未知 kind 一并忽略，老前端遇到新 kind 只当没看见。
 */
export function applyProcessEvents(state, events) {
  let liveStage = state && state.liveStage ? state.liveStage : ''
  const liveTools = Array.isArray(state && state.liveTools) ? [...state.liveTools] : []
  for (const event of events || []) {
    if (!event || typeof event !== 'object') continue
    if (event.kind === 'stage' && typeof event.text === 'string') {
      liveStage = event.text
    } else if (event.kind === 'tool' && event.tool) {
      liveTools.push(event)
    }
  }
  return { liveStage, liveTools }
}

export { MARK_PREFIX }
