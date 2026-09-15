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
    // 会话状态原样保留（这是与 applyRunResult 的关键区别）：原有两条消息仍在，
    // 只在末尾追加一条时间线分割线（建记录点，见 player-timeline.test.js）
    expect(s.chatMessages).toHaveLength(3)
    expect(s.chatMessages[0]).toEqual({ role: 'user', text: '问' })
    expect(s.chatMessages[1]).toEqual({ role: 'assistant', text: '答' })
    expect(s.chatMessages[2].role).toBe('divider')
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

  it('focusChatWithDraft：预填 + 切到 agent 面板 + 请求聚焦，但不发送', () => {
    const s = usePlayerStore()
    const spy = vi.spyOn(s, 'askQuestion').mockResolvedValue(undefined)
    s.mode = 'multi'
    s.multiTab = 'variables'
    const nonce = s.chatFocusNonce

    s.focusChatWithDraft('我的代码运行报错了，请帮我看看怎么修正：\n编译失败')

    expect(s.chatDraft).toBe('我的代码运行报错了，请帮我看看怎么修正：\n编译失败')
    expect(s.multiTab).toBe('tutor')      // 入口在全局弹窗，用户可能停在任意 tab
    expect(s.chatFocusNonce).toBe(nonce + 1)
    expect(spy).not.toHaveBeenCalled()
  })

  it('clearRunError 只撤下入口，不动 store.error', () => {
    const s = usePlayerStore()
    s.lastRunError = { message: '编译错误' }
    s.error = '编译错误'
    s.clearRunError()
    expect(s.lastRunError).toBeNull()
    expect(s.error).toBe('编译错误')
  })

  it('askGoalOptimization 按所选方向（白名单）拼提问并发送', async () => {
    const s = usePlayerStore()
    const spy = vi.spyOn(s, 'askQuestion').mockResolvedValue(undefined)
    await s.askGoalOptimization(
      [{ goal: 'performance', label: '以性能为先', detail: '用哈希表把嵌套循环降为 O(n)' }],
      [],
      'Solution.java',
    )
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy.mock.calls[0][0]).toBe(
      '【优化第二步】只做「以性能为先」方向的优化，具体要求：用哈希表把嵌套循环降为 O(n)。请给出优化后的完整代码。',
    )
  })

  it('askGoalOptimization 把同一张卡的未选项列为排除项（黑名单）', async () => {
    const s = usePlayerStore()
    const spy = vi.spyOn(s, 'askQuestion').mockResolvedValue(undefined)
    await s.askGoalOptimization(
      [{ goal: 'performance', label: '以性能为先', detail: '降为 O(n)' }],
      [{ goal: 'memory', label: '以空间优化为先', detail: '用左右边界索引' }],
    )
    expect(spy.mock.calls[0][0]).toContain('不要顺带做其他方向的改动（例如：「以空间优化为先」：用左右边界索引）')
  })

  it('askGoalOptimization 多文件模式追加目标文件', async () => {
    const s = usePlayerStore()
    s.mode = 'multi'
    const spy = vi.spyOn(s, 'askQuestion').mockResolvedValue(undefined)
    await s.askGoalOptimization([{ goal: 'memory', label: '以空间优化为先', detail: '' }], [], 'Main.java')
    expect(spy.mock.calls[0][0]).toBe(
      '【优化第二步】只做「以空间优化为先」方向的优化。请给出优化后的完整代码。（目标文件：Main.java）',
    )
  })

  it('askGoalOptimization 空选择 → 不发送', async () => {
    const s = usePlayerStore()
    const spy = vi.spyOn(s, 'askQuestion').mockResolvedValue(undefined)
    await s.askGoalOptimization([], [], 'Main.java')
    expect(spy).not.toHaveBeenCalled()
  })

  // ── 自动返修状态机（review P2-1：这条路径曾漏出过无界循环，必须有回归网） ──────────

  const REPLACE_PLAN = {
    kind: 'replace',
    target: 'A.java',
    goal: 'performance',
    rationale: '',
    code: 'class A { void f() {} }',
  }
  /** 一版可用候选：必须带「【编辑建议】」标记，parseAssistantMessage 才认（前缀 \n 是标记的一部分） */
  const REPLACE_CHUNK = '\n【编辑建议】\n'
    + '{"kind":"replace","target":"A.java","goal":"performance","code":"class A { int x; }"}'
  /** 门禁失败上报的入参基座（run = 编译/运行失败；transport = 链路失败） */
  const UP_RUN = { gateError: '编译失败：缺少分号', kind: 'run', plan: REPLACE_PLAN, applied: false, targetBlocked: false }
  const UP_TRANSPORT = { ...UP_RUN, gateError: 'HTTP 500', kind: 'transport' }

  /** 造一条「最新的 assistant 候选卡」，返回它的下标 */
  function seedRetry(s) {
    s.chatMessages = [{ role: 'user', text: '优化' }, { role: 'assistant', text: '候选卡' }]
    return 1
  }

  it('传输失败：闩按消息生效，重复上报不叠加（终止性的回归网，review P2-1）', async () => {
    const s = usePlayerStore()
    const i = seedRetry(s)

    await s.requestOptimizationRetry(i, UP_TRANSPORT)
    expect(s.chatMessages[i].optRegate).toBe(true)
    expect(s.chatMessages[i].optRegateNonce).toBe(1)

    // 第二次上报：闩命中 → 不 bump ⇒ 卡片不会被再次唤醒 ⇒ 无 fetch 风暴
    await s.requestOptimizationRetry(i, UP_TRANSPORT)
    expect(s.chatMessages[i].optRegateNonce).toBe(1)
    // 传输失败只重跑门禁，不烧返修次数、不留返修态
    expect(s.chatMessages[i].optAttempt ?? 0).toBe(0)
    expect(s.optRepair).toBeNull()
  })

  it('notifyGateOk 解闩：下一次传输失败仍能自动重跑一次（闩按故障时段生效）', async () => {
    const s = usePlayerStore()
    const i = seedRetry(s)

    await s.requestOptimizationRetry(i, UP_TRANSPORT)
    s.notifyGateOk(i)
    expect(s.chatMessages[i].optRegate).toBe(false)

    await s.requestOptimizationRetry(i, UP_TRANSPORT)
    expect(s.chatMessages[i].optRegateNonce).toBe(2)
  })

  it('nonce 按消息记：只唤醒发起卡，其它挂载中的卡不连坐（review P3-6）', async () => {
    const s = usePlayerStore()
    s.chatMessages = [
      { role: 'user', text: 'a' }, { role: 'assistant', text: '卡1' },
      { role: 'user', text: 'b' }, { role: 'assistant', text: '卡2' },
    ]

    await s.requestOptimizationRetry(3, UP_TRANSPORT)

    // 判别性断言：通知量不再有全局槽（旧的全局量 = 任一卡故障唤醒所有挂载卡 → O(N²) 请求）
    expect(s.optRegateNonce).toBeUndefined()
    expect(s.chatMessages[3].optRegateNonce).toBe(1)
    expect(s.chatMessages[1].optRegateNonce).toBeUndefined()   // 卡1 的门禁不被唤醒
    // 非最新消息拿不到 regate（nextRetry 的 isLatest）——这也是「只可能最新卡 bump」的原因
    await s.requestOptimizationRetry(1, UP_TRANSPORT)
    expect(s.chatMessages[1].optRegateNonce).toBeUndefined()
  })

  it('返修两次后第三次 stop；每次产出的候选原地改写文本并 +1 rev', async () => {
    const s = usePlayerStore()
    const i = seedRetry(s)
    const runChat = vi.spyOn(s, '_runChat').mockImplementation(async ({ onChunk }) => {
      onChunk(REPLACE_CHUNK)
    })

    await s.requestOptimizationRetry(i, UP_RUN)
    expect(s.chatMessages[i].optAttempt).toBe(1)
    expect(s.chatMessages[i].optRev).toBe(1)
    // 返修提问必须带跨仓握手标记（与 coze「候选返修」段互为字面包含）
    expect(runChat.mock.calls[0][0].question).toContain('上一版优化代码没有通过编译/运行校验')
    expect(runChat.mock.calls[0][0].question).toContain('上一版候选代码')

    await s.requestOptimizationRetry(i, UP_RUN)
    expect(s.chatMessages[i].optAttempt).toBe(2)
    const textAfterTwo = s.chatMessages[i].text

    await s.requestOptimizationRetry(i, UP_RUN)          // 第 3 次：耗尽 → stop
    expect(runChat).toHaveBeenCalledTimes(2)             // 上限 2 次（MAX_OPT_RETRY）
    expect(s.chatMessages[i].optAttempt).toBe(2)
    expect(s.chatMessages[i].text).toBe(textAfterTwo)
    // 不新增消息、不新增记录点（时间线 chatIndex 语义的前提）
    expect(s.chatMessages).toHaveLength(2)
    expect(s.timeline).toHaveLength(0)
  })

  it('返修没产出可用 replace 块 → 丢弃该次结果，保留失败卡片（F5）', async () => {
    const s = usePlayerStore()
    const i = seedRetry(s)
    vi.spyOn(s, '_runChat').mockImplementation(async ({ onChunk }) => {
      onChunk('这个错误我没法在不改方向的前提下修好。')
    })

    await s.requestOptimizationRetry(i, UP_RUN)

    expect(s.chatMessages[i].text).toBe('候选卡')       // 卡片不被破坏（用户还要看错误原文）
    expect(s.chatMessages[i].optRev).toBeUndefined()    // 不触发重跑门禁
    expect(s.chatMessages[i].optAttempt).toBe(1)        // 次数照烧（上限按「生成」计）
  })

  it('返修在飞时再次上报 → 不重入', async () => {
    const s = usePlayerStore()
    const i = seedRetry(s)
    let release
    const runChat = vi.spyOn(s, '_runChat').mockImplementation(
      () => new Promise((res) => { release = res }),
    )

    const p = s.requestOptimizationRetry(i, UP_RUN)
    expect(s.optRepair).toEqual({ msgIndex: i, attempt: 1, max: 2 })

    await s.requestOptimizationRetry(i, UP_RUN)
    expect(runChat).toHaveBeenCalledTimes(1)
    expect(s.chatMessages[i].optAttempt).toBe(1)

    release()
    await p
    expect(s.optRepair).toBeNull()
    expect(s.optAbortController).toBeNull()
  })

  it('返修被用户提问抢占（abort）→ 保持失败卡片，且已烧掉的次数不退还', async () => {
    const s = usePlayerStore()
    const i = seedRetry(s)
    vi.spyOn(s, '_runChat').mockImplementation(({ signal }) => new Promise((_, reject) => {
      signal.addEventListener('abort', () => {
        const e = new Error('aborted')
        e.name = 'AbortError'
        reject(e)
      })
    }))

    const p = s.requestOptimizationRetry(i, UP_RUN)
    s.optAbortController.abort()          // 等价于 askQuestion 首部的抢占

    await p
    expect(s.chatMessages[i].optAttempt).toBe(1)      // 不退还（次数按「生成」计）
    expect(s.chatMessages[i].text).toBe('候选卡')
    expect(s.optRepair).toBeNull()
    expect(s.optAbortController).toBeNull()
  })
})
