import { setActivePinia, createPinia } from 'pinia'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { usePlayerStore } from '../player'
import { MAX_TIMELINE } from '../../utils/timeline'

// Mock localStorage for Node environment（与 player-optimization.test.js 同款）
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

/** 按 URL 分派 fetch mock；/api/run/project 必须先于 /api/run 匹配。 */
function mockFetch(handlers) {
  const calls = []
  globalThis.fetch = vi.fn(async (url, opts) => {
    const body = opts?.body ? JSON.parse(opts.body) : {}
    calls.push({ url: String(url), body })
    for (const [key, fn] of handlers) {
      if (String(url).includes(key)) return { ok: true, json: async () => fn(body) }
    }
    return { ok: true, json: async () => ({}) }
  })
  return calls
}

const OK = (over = {}) => ({
  code: 200,
  data: [{ step: 0, line: 1, variables: {} }, { step: 1, line: 2, variables: {} }],
  output: 'hi',
  runId: 'r1',
  ...over,
})

const RUN_OK = OK()
/** 只 mock 运行与两个跟随请求（否则 requestAnalysis/requestControlFlow 会走默认空响应，无妨） */
const handlers = (run) => [['/api/run/project', run], ['/api/run', run], ['/api/ai/analyze', () => ({})], ['/api/controlflow', () => ({})]]

describe('player store 对话时间线', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })
  afterEach(() => {
    vi.restoreAllMocks()
    delete globalThis.fetch
  })

  it('新增状态默认值', () => {
    const s = usePlayerStore()
    expect(s.timeline).toEqual([])
    expect(s.timelineSeq).toBe(0)
    expect(s.foldFromIndex).toBeNull()
  })

  it('成功运行：不清空对话，末尾多一条 divider，建一条 run 记录点', async () => {
    const s = usePlayerStore()
    mockFetch(handlers(() => RUN_OK))
    s.chatMessages = [{ role: 'user', text: '问' }, { role: 'assistant', text: '答' }]

    await s.runCode('class A {}', {})

    expect(s.chatMessages).toHaveLength(3)          // 旧对话未被清空
    expect(s.chatMessages[0].text).toBe('问')
    const divider = s.chatMessages[2]
    expect(divider.role).toBe('divider')
    expect(divider.checkpointId).toBe('cp-1')
    expect(s.timeline).toHaveLength(1)
    expect(s.timeline[0]).toMatchObject({ id: 'cp-1', seq: 1, kind: 'run', mode: 'single' })
    // 折叠起点 = 分割线所在下标 = 运行前的消息数
    expect(s.timeline[0].chatIndex).toBe(2)
    // 只存代码快照，不存运行结果（决策 T2）
    expect(s.timeline[0].code).toBe('class A {}')
    expect(s.timeline[0].steps).toBeUndefined()
    expect(divider.text).toContain('#1')
    expect(divider.text).toContain('2 步')
  })

  it('失败运行：不建记录点、不插分割线，仍写 lastRunError', async () => {
    const s = usePlayerStore()
    mockFetch(handlers(() => ({ code: 400, error: '编译失败：缺少分号' })))
    s.chatMessages = [{ role: 'user', text: '问' }]

    await s.runCode('class A {', {})

    expect(s.timeline).toHaveLength(0)
    expect(s.chatMessages).toHaveLength(1)
    expect(s.lastRunError).toEqual({ message: '编译失败：缺少分号' })
  })

  it('多文件成功运行：记录点存整项目快照与激活下标', async () => {
    const s = usePlayerStore()
    mockFetch(handlers(() => OK({ runId: 'r-multi' })))
    s.mode = 'multi'
    s.multiState.files = [{ name: 'Main.java', code: 'a' }, { name: 'Util.java', code: 'b' }]
    s.multiState.activeFileIndex = 1

    await s.runProject({})

    const cp = s.timeline[0]
    expect(cp.mode).toBe('multi')
    expect(cp.files).toEqual([{ name: 'Main.java', code: 'a' }, { name: 'Util.java', code: 'b' }])
    expect(cp.activeFileIndex).toBe(1)
    expect(cp.code).toBeUndefined()
    expect(cp.label).toContain('项目 2 文件')
  })

  it('记录点快照是深拷贝：此后就地改写 files 不影响快照', async () => {
    const s = usePlayerStore()
    mockFetch(handlers(() => OK()))
    s.mode = 'multi'
    s.multiState.files = [{ name: 'Main.java', code: 'old' }]

    await s.runProject({})
    s.multiState.files[0].code = 'edited later'

    expect(s.timeline[0].files[0].code).toBe('old')
  })

  it('applyCandidateRun 带 meta：建 optimize 记录点，label 含方向', () => {
    const s = usePlayerStore()
    mockFetch(handlers(() => OK()))
    s.code = 'before'

    s.applyCandidateRun(RUN_OK, 'after', { goalLabel: '性能', target: 'Solution.java' })

    expect(s.timeline).toHaveLength(1)
    expect(s.timeline[0]).toMatchObject({ kind: 'optimize', goalLabel: '性能', target: 'Solution.java' })
    expect(s.timeline[0].code).toBe('after')
    expect(s.timeline[0].label).toContain('已应用优化（性能）')
    expect(s.chatMessages.at(-1).role).toBe('divider')
  })

  it('revertToCheckpoint：折叠到该点 + 静默重跑，不新增记录点', async () => {
    const s = usePlayerStore()
    mockFetch(handlers(() => RUN_OK))
    s.chatMessages = [{ role: 'user', text: '问' }, { role: 'assistant', text: '答' }]
    await s.runCode('class A {}', {})
    s.chatMessages.push({ role: 'user', text: '问 2' }, { role: 'assistant', text: '答 2' })
    const cp = s.timeline[0]

    const ok = await s.revertToCheckpoint(cp)

    expect(ok).toBe(true)
    expect(s.foldFromIndex).toBe(cp.chatIndex)         // 折叠「分割线之后」的对话
    expect(s.timeline).toHaveLength(1)                 // silent：不新增记录点
    // 折叠只影响渲染，不删消息（T7）：user/assistant/divider + 其后的两条问答
    expect(s.chatMessages).toHaveLength(5)
    expect(s.code).toBe('class A {}')
    expect(s.steps).toHaveLength(2)                    // 重跑复现了运行结果
  })

  it('折叠后一次真实的成功运行 → 折叠解除并新增记录点', async () => {
    const s = usePlayerStore()
    mockFetch(handlers(() => RUN_OK))
    await s.runCode('class A {}', {})
    s.foldFromIndex = 0

    await s.runCode('class B {}', {})

    expect(s.foldFromIndex).toBeNull()
    expect(s.timeline).toHaveLength(2)
  })

  it('超过 MAX_TIMELINE：只丢最旧的代码快照，记录与分割线都保留（按钮可判过期）', async () => {
    const s = usePlayerStore()
    mockFetch(handlers(() => RUN_OK))
    for (let i = 0; i < MAX_TIMELINE + 1; i++) {
      await s.runCode(`class A${i} {}`, {})
    }

    // 记录不删：分割线还要靠它渲染「记录已过期」；被丢的只是快照（内存大头）
    expect(s.timeline).toHaveLength(MAX_TIMELINE + 1)
    expect(s.timeline.filter((t) => !t.expired)).toHaveLength(MAX_TIMELINE)
    const oldest = s.timeline[0]
    expect(oldest.expired).toBe(true)
    expect(oldest.code).toBeUndefined()
    expect(s.timeline[1].expired).toBeUndefined()
    expect(s.timeline[1].code).toBe('class A1 {}')
    expect(s.chatMessages).toHaveLength(MAX_TIMELINE + 1)
  })

  it('revertToCheckpoint 对过期记录点安全返回 false', async () => {
    const s = usePlayerStore()
    const ok = await s.revertToCheckpoint({ id: 'cp-x', expired: true, chatIndex: 0 })
    expect(ok).toBe(false)
    expect(s.foldFromIndex).toBeNull()
  })

  it('revertToCheckpoint 无参安全返回', async () => {
    const s = usePlayerStore()
    expect(await s.revertToCheckpoint(null)).toBe(false)
  })

  // 跨模式回退在 UI 上不可达（分割线只在自己模式的对话里渲染），这里锁的是 revertToCheckpoint 的防御分支：
  // 万一被走到，也必须先把模式切过去再重跑，否则 runProject 打的还是单文件的 files。
  it('回退到另一模式的记录点会先切模式（T5，防御分支）', async () => {
    const s = usePlayerStore()
    mockFetch(handlers(() => OK()))
    s.mode = 'multi'
    s.multiState.files = [{ name: 'Main.java', code: 'x' }]
    await s.runProject({})
    const cp = s.timeline[0]

    s.mode = 'single'          // 用户切回单文件后又点了该记录点的「回退到此」
    await s.revertToCheckpoint(cp)

    expect(s.mode).toBe('multi')
    expect(s.steps).toHaveLength(2)
  })
})
