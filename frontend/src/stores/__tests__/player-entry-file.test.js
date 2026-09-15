import { setActivePinia, createPinia } from 'pinia'
import { describe, it, expect, beforeEach, vi } from 'vitest'
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

const ok = (body) => ({ json: async () => body })

const MAIN = 'public class Main { public static void main(String[] a) { int x = 1; } }'
const UTIL = 'public class Util { static int inc(int x) { return x + 1; } }'

/** 多文件模式 + 两个已上传文件。 */
function multiStore() {
  const s = usePlayerStore()
  s.switchMode('multi')
  s.multiState.files = [
    { name: 'Main.java', code: MAIN },
    { name: 'Util.java', code: UTIL },
  ]
  return s
}

describe('player store entryFile（2026-09-14 联调修复 Task 6）', () => {
  beforeEach(() => {
    localStorage.clear()
    http.mockReset()
    // applyRunResult 会顺带触发 requestAnalysis / requestControlFlow，给个兜底实现
    http.mockResolvedValue(ok({}))
    setActivePinia(createPinia())
  })

  it('multiState 默认带 entryFile 键（此前连键都没有）', () => {
    const s = usePlayerStore()
    expect(s.multiState.entryFile).toBe('')
  })

  it('analyzeProject 成功后 entryFile 来自 projectAnalysis.entry.class', async () => {
    const s = multiStore()
    // /api/project/analyze 的 entry 是 { class, method } 对象，不是文件名字符串
    http.mockResolvedValueOnce(
      ok({ entry: { class: 'Main', method: 'main' }, flow: {}, structure: {} })
    )
    await s.analyzeProject()

    expect(s.multiState.entryFile).toBe('Main.java')
  })

  it('analyzeProject 的 entry.class 命中 basename 路径', async () => {
    const s = multiStore()
    s.multiState.files = [
      { name: 'src/Main.java', code: MAIN },
      { name: 'src/Util.java', code: UTIL },
    ]
    http.mockResolvedValueOnce(ok({ entry: { class: 'Main', method: 'main' } }))
    await s.analyzeProject()

    expect(s.multiState.entryFile).toBe('src/Main.java')
  })

  it('buildChatBody 把 entryFile 带进提问体', async () => {
    const s = multiStore()
    http.mockResolvedValueOnce(ok({ entry: { class: 'Main', method: 'main' } }))
    await s.analyzeProject()

    const body = s.buildChatBody('x 怎么变的？')
    expect(body.entryFile).toBe('Main.java')
    expect(body.files.map((f) => f.name)).toEqual(['Main.java', 'Util.java'])
  })

  it('未跑过分析时按含 main 的源文件兜底，不必等用户点开面板', async () => {
    const s = multiStore()
    http.mockResolvedValueOnce(ok({ code: 200, runId: 'r1', data: [], output: '' }))
    await s.runProject({ silent: true })

    expect(s.multiState.entryFile).toBe('Main.java')
  })

  it('分析响应里没有 entry 时保留兜底出的 entryFile，不清空', async () => {
    const s = multiStore()
    http.mockResolvedValueOnce(ok({ code: 200, runId: 'r1', data: [], output: '' }))
    await s.runProject({ silent: true })
    http.mockResolvedValueOnce(ok({ flow: {}, structure: {} }))
    await s.analyzeProject()

    expect(s.multiState.entryFile).toBe('Main.java')
  })
})
