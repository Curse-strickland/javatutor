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