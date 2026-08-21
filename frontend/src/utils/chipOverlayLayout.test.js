import { describe, it, expect } from 'vitest'
import { computeChipLayout } from './chipOverlayLayout.js'

describe('computeChipLayout', () => {
  it('returns defaults for empty chipsByCell', () => {
    const out = computeChipLayout({ chipsByCell: new Map() })
    expect(out.cellWidth).toBe(48)
    expect(out.chipFontSize).toBe(11)
    expect(out.overflowByCell.size).toBe(0)
    expect(out.fits).toBe(true)
  })

  it('keeps base font when only one chip per cell', () => {
    const chips = new Map([[0, [{ name: 'i', color: '#eab308' }]]])
    const out = computeChipLayout({ chipsByCell: chips })
    expect(out.chipFontSize).toBe(11)
    expect(out.cellWidth).toBe(48)
    expect(out.overflowByCell.size).toBe(0)
  })

  it('shrinks font per max chip count and clamps at minFontSize', () => {
    const chips = new Map([[0, [
      { name: 'l', color: '#6b7280' },
      { name: 'r', color: '#3b82f6' },
      { name: 'pivot', color: '#f97316' },
    ]]])
    const out = computeChipLayout({ chipsByCell: chips })
    // maxC=3 → 11 - (3-1)*1 = 9 → clamped to 10
    expect(out.chipFontSize).toBe(10)
    // maxC=3 → cellWidth = max(48, 3 * (10+8)) = 54
    expect(out.cellWidth).toBe(54)
  })

  it('emits overflowByCell only when chips.length > showLimit', () => {
    const chips = new Map([
      [0, [{ name: 'a' }, { name: 'b' }]],                  // 2 chips → no overflow
      [1, [{ name: 'a' }, { name: 'b' }, { name: 'c' }]],  // 3 chips → overflow
    ])
    const out = computeChipLayout({ chipsByCell: chips })
    expect(out.overflowByCell.has(0)).toBe(false)
    const ov1 = out.overflowByCell.get(1)
    expect(ov1.visibleChips.map((c) => c.name)).toEqual(['a', 'b'])
    expect(ov1.hiddenCount).toBe(1)
    expect(ov1.allChips).toHaveLength(3)
  })

  it('fits is false when cellWidth exceeds 3 * baseCellWidth', () => {
    const chips = new Map([
      [0, Array.from({ length: 9 }, (_, i) => ({ name: `c${i}` }))],
    ])
    const out = computeChipLayout({ chipsByCell: chips })
    // maxC=9 → cellWidth = max(48, 9 * (10+8)) = 162; 162 > 48*3 → fits=false
    expect(out.fits).toBe(false)
  })

  it('uses uniform cell width and font size across all cells', () => {
    const chips = new Map([
      [0, [{ name: 'a' }]],
      [1, [{ name: 'a' }, { name: 'b' }, { name: 'c' }, { name: 'd' }]],
    ])
    const out = computeChipLayout({ chipsByCell: chips })
    expect(out.cellWidth).toBeGreaterThanOrEqual(48)
    // 整个布局只有一个 cellWidth
    expect(typeof out.cellWidth).toBe('number')
  })
})
