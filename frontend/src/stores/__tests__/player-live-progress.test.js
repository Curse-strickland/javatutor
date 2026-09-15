import { setActivePinia, createPinia } from 'pinia'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { usePlayerStore } from '../player'
import { http } from '../../utils/http.js'

vi.mock('../../utils/http.js', () => ({ http: vi.fn() }))

// Mock localStorage for Node environment（与 player-timeline.test.js 同款）
const localStorageMock = (() => {
  let store = {}
  return {
    getItem: (key) => store[key] ?? null,
    setItem: (key, value) => { store[key] = value },
    removeItem: (key) => { delete store[key] },
    clear: () => { store = {} },
  }
})()
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock })

const MARK = '<!--jt:process '
const encoder = new TextEncoder()

/**
 * 一个可手动推的 SSE 流。**必须逐条推、逐条等**：`askQuestion` 的 finally 会清空
 * 实时进度字段，所以「流式期间」的断言只能在流未结束时取，靠 `vi.waitFor` 等副作用落地。
 */
function makeStream() {
  let controller
  const stream = new ReadableStream({ start(c) { controller = c } })
  return { stream, controller }
}

/** 按 SSE 规范编码：chunk 内的换行必须拆成多条 `data:` 行（store 侧按 \n 拼回）。 */
const chunk = (text) => `event:chunk\n${text.split('\n').map((l) => `data:${l}\n`).join('')}\n`

/**
 * 推一条 chunk **并触发 flush**。store 的解析器只在遇到下一条 `event:` 行（或流结束）时
 * 才把累积的 `data:` 交给 `onChunk`——所以生产里每个事件是被**下一个事件**推出来的，
 * 这里用一个空 `event:` 行复现同一时序（否则断言会看到「永远差一条」）。
 */
function push(controller, text) {
  controller.enqueue(encoder.encode(chunk(text)))
  controller.enqueue(encoder.encode('event:\n\n'))
}

const sentinel = (event) => `${MARK}${JSON.stringify(event)}-->\n`
const stage = (text) => sentinel({ kind: 'stage', text })
const tool = (name, args = {}) => sentinel({ kind: 'tool', tool: name, args, status: 'ok', latency_ms: 1 })

function traceAnswer(toolCalls) {
  const trace = { intent: 'data_query', tool_calls: toolCalls, rag_degraded: false }
  return `根据第 2 步，x 变成了 2\n\n【决策痕迹】\n${JSON.stringify(trace)}`
}

/** 推一条 chunk 并等到它的副作用落地，返回此刻的实时进度快照。 */
async function pushAndSnapshot(s, controller, text, predicate) {
  push(controller, text)
  await vi.waitFor(predicate)
  return { liveStage: s.liveStage, tools: s.liveTools.map((t) => t.tool) }
}

describe('player store 实时进度（过程哨兵）', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('新增状态默认值', () => {
    const s = usePlayerStore()
    expect(s.liveStage).toBe('')
    expect(s.liveTools).toEqual([])
  })

  it('流式期间：liveStage 取最后一条 stage，liveTools 按序累积', async () => {
    const s = usePlayerStore()
    s.code = 'class A {}'
    const { stream, controller } = makeStream()
    http.mockResolvedValue({ ok: true, body: stream })

    const p = s.askQuestion('x 怎么变了？')

    const first = await pushAndSnapshot(
      s, controller, stage('知识库检索不可用，已用通用知识回答'),
      () => expect(s.liveStage).toBe('知识库检索不可用，已用通用知识回答')
    )
    expect(first.tools).toEqual([])

    // stage 是覆盖式：第二条 stage 顶掉第一条
    const second = await pushAndSnapshot(
      s, controller, stage('正在分析问题…'),
      () => expect(s.liveStage).toBe('正在分析问题…')
    )
    expect(second.tools).toEqual([])

    // tool 是追加式：按序累积，且不影响 stage
    await pushAndSnapshot(
      s, controller, tool('fetch_execution_context'),
      () => expect(s.liveTools).toHaveLength(1)
    )
    const afterTools = await pushAndSnapshot(
      s, controller, tool('step_facts', { step_index: 1 }),
      () => expect(s.liveTools).toHaveLength(2)
    )
    expect(afterTools.tools).toEqual(['fetch_execution_context', 'step_facts'])
    expect(afterTools.liveStage).toBe('正在分析问题…')

    // 收尾 stage 覆盖前面所有 stage
    const last = await pushAndSnapshot(
      s, controller, stage('证据已就绪，正在生成回答…'),
      () => expect(s.liveStage).toBe('证据已就绪，正在生成回答…')
    )
    expect(last.tools).toEqual(['fetch_execution_context', 'step_facts'])

    controller.close()
    await p
  })

  it('进正文后 liveStage 与工具列表都保持不变（正文 chunk 不影响实时区）', async () => {
    const s = usePlayerStore()
    s.code = 'class A {}'
    const { stream, controller } = makeStream()
    http.mockResolvedValue({ ok: true, body: stream })

    const p = s.askQuestion('x 怎么变了？')
    await pushAndSnapshot(
      s, controller, stage('证据已就绪，正在生成回答…'),
      () => expect(s.liveStage).toBe('证据已就绪，正在生成回答…')
    )
    const afterProse = await pushAndSnapshot(
      s, controller, '根据第 2 步，x 变成了 2',
      () => expect(s.chatMessages[s.chatMessages.length - 1].text).toContain('根据第 2 步')
    )
    expect(afterProse.liveStage).toBe('证据已就绪，正在生成回答…')
    expect(afterProse.tools).toEqual([])

    controller.close()
    await p
  })

  it('流结束后两个字段清空（实时区随 isExplaining 一起收）', async () => {
    const s = usePlayerStore()
    s.code = 'class A {}'
    http.mockResolvedValue({
      ok: true,
      body: (() => {
        const { stream, controller } = makeStream()
        controller.enqueue(encoder.encode(chunk(stage('正在分析问题…'))))
        controller.enqueue(encoder.encode(chunk(tool('step_facts'))))
        controller.close()
        return stream
      })(),
    })

    await s.askQuestion('x 怎么变了？')

    expect(s.liveStage).toBe('')
    expect(s.liveTools).toEqual([])
    expect(s.isExplaining).toBe(false)
  })

  it('重新提问时先清空，不带上一轮的残留', async () => {
    const s = usePlayerStore()
    s.code = 'class A {}'
    http.mockResolvedValue({
      ok: true,
      body: (() => {
        const { stream, controller } = makeStream()
        controller.enqueue(encoder.encode(chunk(stage('第一轮阶段'))))
        controller.enqueue(encoder.encode(chunk(tool('step_facts'))))
        controller.close()
        return stream
      })(),
    })
    await s.askQuestion('第一次')

    const { stream, controller } = makeStream()
    http.mockResolvedValue({ ok: true, body: stream })
    const p = s.askQuestion('第二次')
    // 第二条提问刚开始：上一轮的实时进度必须已经清掉
    expect(s.liveStage).toBe('')
    expect(s.liveTools).toEqual([])
    controller.close()
    await p
  })

  it('终态一致性：实时区列出的工具集合与【执行过程】的 trace.tool_calls 一致', async () => {
    const s = usePlayerStore()
    s.code = 'class A {}'
    const toolCalls = [
      { tool: 'fetch_execution_context', args: {} },
      { tool: 'step_facts', args: { step_index: 1 } },
    ]
    const { stream, controller } = makeStream()
    http.mockResolvedValue({ ok: true, body: stream })

    const p = s.askQuestion('x 怎么变了？')
    await pushAndSnapshot(
      s, controller, tool('fetch_execution_context'), () => expect(s.liveTools).toHaveLength(1)
    )
    await pushAndSnapshot(
      s, controller, tool('step_facts', { step_index: 1 }), () => expect(s.liveTools).toHaveLength(2)
    )
    const live = await pushAndSnapshot(
      s, controller, stage('证据已就绪，正在生成回答…'),
      () => expect(s.liveStage).toBe('证据已就绪，正在生成回答…')
    )
    controller.enqueue(encoder.encode(chunk(traceAnswer(toolCalls))))
    push(controller, '')   // 触发上一条 flush
    await vi.waitFor(() => expect(s.chatMessages[s.chatMessages.length - 1].text).toContain('【决策痕迹】'))
    controller.close()
    await p

    expect(live.tools).toEqual(toolCalls.map((tc) => tc.tool))
  })

  it('L4 老 agent（无哨兵）：实时区始终为空，正文逐字不变', async () => {
    const s = usePlayerStore()
    s.code = 'class A {}'
    const { stream, controller } = makeStream()
    http.mockResolvedValue({ ok: true, body: stream })

    const p = s.askQuestion('x 怎么变了？')
    push(controller, '根据第 2 步，x 变成了 2')
    await vi.waitFor(() =>
      expect(s.chatMessages[s.chatMessages.length - 1].text).toContain('根据第 2 步')
    )
    // 没有哨兵就不该冒出任何新 UI 数据
    expect(s.liveStage).toBe('')
    expect(s.liveTools).toEqual([])
    controller.close()
    await p

    // 且剥离器对普通文本是恒等的（不会误伤正文）
    expect(s.chatMessages[s.chatMessages.length - 1].text).toBe('根据第 2 步，x 变成了 2')
  })

  it('流式期间最后一条消息的渲染文本不含哨兵标记', async () => {
    const s = usePlayerStore()
    s.code = 'class A {}'
    const { stream, controller } = makeStream()
    http.mockResolvedValue({ ok: true, body: stream })

    const p = s.askQuestion('x 怎么变了？')
    push(controller, stage('正在分析问题…'))
    push(controller, '正文')
    await vi.waitFor(() =>
      expect(s.chatMessages[s.chatMessages.length - 1].text).toContain('正文')
    )
    controller.close()
    await p

    // m.text 保留原文（含哨兵），渲染层负责剥离——这里验证剥离器本身可用
    const raw = s.chatMessages[s.chatMessages.length - 1].text
    expect(raw).toContain(MARK)
    const { extractProcessEvents } = await import('../../utils/processEvents.js')
    expect(extractProcessEvents(raw).clean).toBe('正文')
  })
})
