import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import {
  PANEL_MANIFEST, panelById, allowedPanels, groupOfPanel, defaultPanelOfGroup, algoSubTabs,
} from './uiPanelManifest'
import { usePlayerStore } from '../stores/player'

// localStorage mock（与 player 其他测试同款）
const localStorageMock = (() => {
  let store = {}
  return {
    getItem: (k) => store[k] ?? null,
    setItem: (k, v) => { store[k] = v },
    removeItem: (k) => { delete store[k] },
    clear: () => { store = {} },
  }
})()
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock })

describe('ui-panel-manifest 单一事实源自洽', () => {
  it('可 JSON 序列化（供 coze 脚本/校验用）', () => {
    expect(() => JSON.stringify(PANEL_MANIFEST)).not.toThrow()
  })

  it('groups 只引用合法 panel，且每个 panel 都属于某个 group', () => {
    const ids = Object.keys(PANEL_MANIFEST.panels)
    const grouped = Object.values(PANEL_MANIFEST.groups).flat()
    for (const list of Object.values(PANEL_MANIFEST.groups)) {
      for (const id of list) expect(panelById(id)).toBeDefined()
    }
    for (const id of ids) expect(grouped).toContain(id)
  })

  it('每个 panel 的 group 字段与 groups 归属一致', () => {
    for (const [id, p] of Object.entries(PANEL_MANIFEST.panels)) {
      expect(groupOfPanel(id)).toBe(p.group)
      expect(PANEL_MANIFEST.groups[p.group]).toContain(id)
    }
  })

  it('mode:multi 面板被 single 排除，multi 包含全部', () => {
    const allIds = Object.keys(PANEL_MANIFEST.panels)
    const multiOnly = allIds.filter((id) => panelById(id)?.mode === 'multi')
    const single = allowedPanels('single')
    const multi = allowedPanels('multi')
    expect(multiOnly.length).toBeGreaterThan(0) // callgraph/classdiagram/structure
    for (const id of multiOnly) {
      expect(single).not.toContain(id)
      expect(multi).toContain(id)
    }
    expect(multi).toEqual(expect.arrayContaining(allIds))
  })

  it('algorithm/tutor 的 subTabs 合法', () => {
    expect(algoSubTabs()).toEqual(['knowledge', 'template'])
    expect(PANEL_MANIFEST.panels.algorithm.subTabs).toEqual(['knowledge', 'template'])
    expect(PANEL_MANIFEST.panels.tutor.subTabs).toEqual(['explain', 'analysis'])
  })

  it('defaultPanelOfGroup 返回该组默认面板', () => {
    expect(defaultPanelOfGroup('observe')).toBe('datastructure')
    expect(defaultPanelOfGroup('learn')).toBe('algorithm')
    expect(defaultPanelOfGroup('ask')).toBe('tutor')
  })
})

describe('player store 白名单与 manifest 一致', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('switchRightTab 白名单 == 单文件面板集合', () => {
    const s = usePlayerStore()
    for (const id of allowedPanels('single')) {
      s.switchRightTab(id)
      expect(s.rightTab).toBe(id)
    }
    const last = s.rightTab
    s.switchRightTab('callgraph') // multi-only，单文件下应被拒
    expect(s.rightTab).toBe(last)
  })

  it('switchMultiTab 白名单 == 全量面板集合', () => {
    const s = usePlayerStore()
    for (const id of allowedPanels('multi')) {
      s.switchMultiTab(id)
      expect(s.multiTab).toBe(id)
    }
    const last = s.multiTab
    s.switchMultiTab('bogus')
    expect(s.multiTab).toBe(last)
  })
})
