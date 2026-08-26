import { describe, it, expect } from 'vitest'
import { computeChipLayout } from './chipOverlayLayout.js'

describe('computeChipLayout', () => {
  it('returns empty arrays for length 0', () => {
    const out = computeChipLayout({ chipsByCell: new Map(), length: 0 })
    expect(out.chipFontSize).toBe(11)
    expect(out.cellWidths).toEqual([])
    expect(out.gridTemplate).toBe('')
  })

  it('keeps every column at the minimum width when no chips overflow', () => {
    const chips = new Map([[0, [{ name: 'i', color: '#eab308' }]]])
    const out = computeChipLayout({ chipsByCell: chips, length: 3 })
    expect(out.cellWidths).toEqual([48, 48, 48])
    expect(out.gridTemplate).toBe('48px 48px 48px')
  })

  it('expands only the column whose chip is wider than the minimum', () => {
    const chips = new Map([
      [1, [{ name: 'pivot=42', color: '#f97316' }]],
    ])
    const out = computeChipLayout({ chipsByCell: chips, length: 3 })
    // 'pivot=42' = 8 chars → 8 * 11 * 0.62 ≈ 54.56 + 14 = 68.56 → ceil 69
    expect(out.cellWidths[0]).toBe(48)
    expect(out.cellWidths[1]).toBeGreaterThan(48)
    expect(out.cellWidths[2]).toBe(48)
    expect(out.cellWidths[1]).toBe(Math.ceil(8 * 11 * 0.62 + 14))
  })

  it('uses the widest chip in a column', () => {
    const chips = new Map([
      [0, [{ name: 'i' }, { name: 'rightmostPointer' }]],
    ])
    const out = computeChipLayout({ chipsByCell: chips, length: 1 })
    // 'rightmostPointer' = 16 chars → 16 * 11 * 0.62 + 14 = 123.12 → ceil 124
    expect(out.cellWidths[0]).toBe(Math.ceil(16 * 11 * 0.62 + 14))
  })

  it('extends column count to the highest chip index when length is omitted', () => {
    const chips = new Map([[2, [{ name: 'i' }]]])
    const out = computeChipLayout({ chipsByCell: chips })
    expect(out.cellWidths).toHaveLength(3)
    expect(out.cellWidths).toEqual([48, 48, 48])
  })
})
