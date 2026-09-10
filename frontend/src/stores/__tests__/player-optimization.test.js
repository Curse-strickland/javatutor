import { setActivePinia, createPinia } from 'pinia'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { usePlayerStore } from '../player'

// Mock localStorage for Node environment（与 player-mode.test.js 同款）
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

/**
 * 按 URL 分派 fetch mock；返回体为 { ok: true, json }。
 * 注意 /api/run/project 必须先于 /api/run 匹配。
 */
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

const RUN_OK = { code: 200, data: [{ step: 0, line: 1, variables: {} }], output: 'hi', runId: 'r1' }

describe('player store 优化卡支持', () => {
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
    expect(s.chatDraft).toBe('')
    expect(s.lastRunError).toBeNull()
    // 运行快照不再是 store 单槽（由优化卡自持，见 applyCandidateRun 的 @returns）
    expect(s.previousRun).toBeUndefined()
  })

  it('applyCandidateRun 刷新运行结果，但不清会话状态', () => {
    const s = usePlayerStore()
    mockFetch([['/api/ai/analyze', () => ({})], ['/api/controlflow', () => ({})]])
    s.chatMessages = [{ role: 'user', text: '问' }, { role: 'assistant', text: '答' }]
    s.explainHistory = { foo: 'bar' }
    s.activeAiTab = 'analysis'
    s.explainError = '旧错误'
    s.steps = [{ step: 0, line: 1 }]
    s.output = 'old'
    s.runId = 'old-run'

    const snap = s.applyCandidateRun({ ...RUN_OK, runId: 'new-run', output: 'new-out' })

    // 运行结果被替换
    expect(s.runId).toBe('new-run')
    expect(s.output).toBe('new-out')
    expect(s.steps).toHaveLength(1)
    // 会话状态原样保留（这是与 applyRunResult 的关键区别）
    expect(s.chatMessages).toHaveLength(2)
    expect(s.explainHistory).toEqual({ foo: 'bar' })
    expect(s.activeAiTab).toBe('analysis')
    expect(s.explainError).toBe('旧错误')
    // 覆盖前快照由返回值交给调用方自持
    expect(snap).toMatchObject({ output: 'old', runId: 'old-run' })
  })

  it('applyCandidateRun + restorePreviousRun 往返后运行结果回到原值', () => {
    const s = usePlayerStore()
    mockFetch([['/api/ai/analyze', () => ({})], ['/api/controlflow', () => ({})]])
    s.steps = [{ step: 0, line: 7 }]
    s.output = 'before'
    s.runId = 'run-before'
    s.currentStep = 3
    s.code = 'old code'

    const snap = s.applyCandidateRun(RUN_OK, 'new code')
    expect(s.output).toBe('hi')
    expect(s.code).toBe('new code')

    s.restorePreviousRun(snap)
    expect(s.steps).toEqual([{ step: 0, line: 7 }])
    expect(s.output).toBe('before')
    expect(s.runId).toBe('run-before')
    expect(s.currentStep).toBe(3)
    expect(s.code).toBe('old code')
  })

  it('两张卡依次应用再依次撤销：各回各的快照（store 单槽会错配）', () => {
    const s = usePlayerStore()
    mockFetch([['/api/ai/analyze', () => ({})], ['/api/controlflow', () => ({})]])
    s.steps = [{ step: 0, line: 1 }]
    s.output = 'A 前'
    s.runId = 'run-A-before'
    s.code = 'code before A'

    const snapA = s.applyCandidateRun({ ...RUN_OK, output: 'A 后', runId: 'run-A-after' }, 'code after A')
    const snapB = s.applyCandidateRun({ ...RUN_OK, output: 'B 后', runId: 'run-B-after' }, 'code after B')

    // 先撤销 B：回退到「B 前」，即 A 之后的状态
    s.restorePreviousRun(snapB)
    expect(s.output).toBe('A 后')
    expect(s.runId).toBe('run-A-after')
    expect(s.code).toBe('code after A')

    // 再撤销 A：必须回退到 A 之前（若用 store 单槽，这里会停在 B 前的运行结果上，
    // 而编辑器已回到 A 前 → 编辑器与右栏/store.code 错配）
    s.restorePreviousRun(snapA)
    expect(s.steps).toEqual([{ step: 0, line: 1 }])
    expect(s.output).toBe('A 前')
    expect(s.runId).toBe('run-A-before')
    expect(s.code).toBe('code before A')
  })

  it('restorePreviousRun 无快照时安全返回', () => {
    const s = usePlayerStore()
    s.steps = [{ step: 0 }]
    expect(() => s.restorePreviousRun(null)).not.toThrow()
    expect(s.steps).toEqual([{ step: 0 }])
  })

  it('applyCandidateRun 省略 code 时不改动 store.code', () => {
    const s = usePlayerStore()
    mockFetch([['/api/ai/analyze', () => ({})], ['/api/controlflow', () => ({})]])
    s.code = 'keep me'
    s.applyCandidateRun(RUN_OK)
    expect(s.code).toBe('keep me')
  })

  it('runCode 成功 → 清空 lastRunError', async () => {
    const s = usePlayerStore()
    mockFetch([['/api/run', () => RUN_OK], ['/api/ai/analyze', () => ({})], ['/api/controlflow', () => ({})]])
    s.lastRunError = { message: '旧错误' }
    await s.runCode('class A {}')
    expect(s.lastRunError).toBeNull()
  })

  it('runCode 后端报错 → 写入 lastRunError（只留错误原文）', async () => {
    const s = usePlayerStore()
    mockFetch([['/api/run', () => ({ code: 400, error: '编译失败：缺少分号' })]])
    await s.runCode('class A {')
    expect(s.error).toBe('编译失败：缺少分号')
    expect(s.lastRunError).toEqual({ message: '编译失败：缺少分号' })
  })

  it('runCode 网络异常 → 写入 lastRunError', async () => {
    const s = usePlayerStore()
    globalThis.fetch = vi.fn(async () => { throw new Error('boom') })
    await s.runCode('class A {}')
    expect(s.lastRunError).toEqual({ message: 'boom' })
  })

  it('applyRunResult 失败分支写 lastRunError；成功分支清空', () => {
    const s = usePlayerStore()
    mockFetch([['/api/ai/analyze', () => ({})], ['/api/controlflow', () => ({})]])
    s.code = 'class A {'
    s.applyRunResult({ code: 400, error: '编译错误' })
    expect(s.lastRunError).toEqual({ message: '编译错误' })
    s.applyRunResult(RUN_OK)
    expect(s.lastRunError).toBeNull()
  })

  it('askGoalOptimization 拼出闭集目标名 + detail 并发送', async () => {
    const s = usePlayerStore()
    const spy = vi.spyOn(s, 'askQuestion').mockResolvedValue(undefined)
    await s.askGoalOptimization('performance', '用哈希表把嵌套循环降为 O(n)', 'Solution.java')
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy.mock.calls[0][0]).toBe(
      '以「性能」为优先优化当前代码，具体要求：用哈希表把嵌套循环降为 O(n)。请给出优化后的完整代码。',
    )
  })

  it('askGoalOptimization 多文件模式追加目标文件', async () => {
    const s = usePlayerStore()
    s.mode = 'multi'
    const spy = vi.spyOn(s, 'askQuestion').mockResolvedValue(undefined)
    await s.askGoalOptimization('memory', '', 'Main.java')
    expect(spy.mock.calls[0][0]).toBe(
      '以「内存」为优先优化当前代码。请给出优化后的完整代码。（目标文件：Main.java）',
    )
  })
})
