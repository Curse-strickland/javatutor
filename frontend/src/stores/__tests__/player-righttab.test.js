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
})
