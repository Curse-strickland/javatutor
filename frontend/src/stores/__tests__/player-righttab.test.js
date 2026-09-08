import { setActivePinia, createPinia } from 'pinia'
import { describe, it, expect, beforeEach } from 'vitest'
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

describe('player store rightTab', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('defaults to datastructure（Observe 组默认页）', () => {
    const s = usePlayerStore()
    expect(s.rightTab).toBe('datastructure')
  })

  it.each(['variables', 'flow', 'datastructure', 'algorithm', 'tutor'])(
    'switchRightTab accepts %s',
    (tab) => {
      const s = usePlayerStore()
      s.switchRightTab(tab)
      expect(s.rightTab).toBe(tab)
    }
  )

  it('rejects removed animate tab', () => {
    const s = usePlayerStore()
    s.switchRightTab('animate')
    expect(s.rightTab).toBe('datastructure')
  })

  it('rejects unknown tab', () => {
    const s = usePlayerStore()
    s.switchRightTab('bogus')
    expect(s.rightTab).toBe('datastructure')
  })

  it('multiTab defaults to datastructure', () => {
    const s = usePlayerStore()
    expect(s.multiTab).toBe('datastructure')
  })

  it.each(['variables', 'flow', 'datastructure', 'callgraph', 'classdiagram', 'structure', 'algorithm', 'tutor'])(
    'switchMultiTab accepts %s',
    (tab) => {
      const s = usePlayerStore()
      s.switchMultiTab(tab)
      expect(s.multiTab).toBe(tab)
    }
  )

  it('switchMultiTab rejects unknown tab', () => {
    const s = usePlayerStore()
    s.switchMultiTab('controlflow')
    expect(s.multiTab).toBe('datastructure')
  })

  it('navigateTo 单文件切 rightTab（含 panel=tutor 设 sub）', () => {
    const s = usePlayerStore()
    s.mode = 'single'
    s.navigateTo('tutor', 'analysis')
    expect(s.rightTab).toBe('tutor')
    expect(s.activeAiTab).toBe('analysis')
    s.navigateTo('variables')
    expect(s.rightTab).toBe('variables')
  })

  it('navigateTo 多文件走 multiTab', () => {
    const s = usePlayerStore()
    s.mode = 'multi'
    s.navigateTo('callgraph')
    expect(s.multiTab).toBe('callgraph')
  })

  it('navigateTo 多文件 tutor+sub 同时切 activeAiTab', () => {
    const s = usePlayerStore()
    s.mode = 'multi'
    s.navigateTo('tutor', 'analysis')
    expect(s.multiTab).toBe('tutor')
    expect(s.activeAiTab).toBe('analysis')
  })

  it('navigateTo 忽略非法 panel（不改动任何 tab）', () => {
    const s = usePlayerStore()
    s.navigateTo('bogus')
    expect(s.rightTab).toBe('datastructure')
    expect(s.multiTab).toBe('datastructure')
  })

  it('navigateTo 忽略 tutor 的非法 sub（不改 activeAiTab，仅切 rightTab）', () => {
    const s = usePlayerStore()
    s.navigateTo('tutor', 'bogus')
    expect(s.activeAiTab).toBe('explain')
    expect(s.rightTab).toBe('tutor')
  })
})
