import { setActivePinia, createPinia } from 'pinia'
import { describe, it, expect, beforeEach } from 'vitest'
import { usePlayerStore } from '../player'

// Mock localStorage for Node environment
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

describe('player store mode', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('starts in single mode by default', () => {
    const s = usePlayerStore()
    expect(s.mode).toBe('single')
  })

  it('switchMode to multi updates state and persists', () => {
    const s = usePlayerStore()
    s.switchMode('multi')
    expect(s.mode).toBe('multi')
    expect(localStorage.getItem('jt-mode')).toBe('multi')
  })

  it('restoreMode reads from localStorage', async () => {
    localStorage.setItem('jt-mode', 'multi')
    const s = usePlayerStore()
    s.restoreMode()
    expect(s.mode).toBe('multi')
  })
})

describe('player store 提问体按模式裁剪（2026-09-14 联调修复 Task 7）', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('单文件模式不发送残留的项目文件与 entryFile', () => {
    const s = usePlayerStore()
    s.multiState.files = [
      { name: 'Main.java', code: 'class Main {}' },
      { name: 'Util.java', code: 'class Util {}' },
    ]
    s.multiState.entryFile = 'Main.java'
    // 不做状态销毁，只按当前模式裁剪 payload
    const body = s.buildChatBody('问题')
    expect(body.files).toEqual([])
    expect(body.entryFile).toBe('')
  })

  it('切回单文件后 payload 立刻干净，且多文件状态仍可恢复', () => {
    const s = usePlayerStore()
    s.switchMode('multi')
    s.multiState.files = [
      { name: 'Main.java', code: 'class Main {}' },
      { name: 'Util.java', code: 'class Util {}' },
    ]
    s.multiState.entryFile = 'Main.java'
    s.switchMode('single')

    expect(s.buildChatBody('问题').files).toEqual([])
    expect(s.buildChatBody('问题').entryFile).toBe('')
    // 「切回多文件能恢复上次项目」不被破坏
    expect(s.multiState.files.map((f) => f.name)).toEqual(['Main.java', 'Util.java'])
    s.switchMode('multi')
    expect(s.buildChatBody('问题').files.map((f) => f.name)).toEqual(['Main.java', 'Util.java'])
    expect(s.buildChatBody('问题').entryFile).toBe('Main.java')
  })

  it('多文件模式照常携带全部文件', () => {
    const s = usePlayerStore()
    s.switchMode('multi')
    s.multiState.files = [{ name: 'Main.java', code: 'class Main {}' }]
    expect(s.buildChatBody('问题').files).toEqual([{ name: 'Main.java', code: 'class Main {}' }])
  })
})