import { describe, it, expect } from 'vitest'
import {
  splitLabelsAboveBelow,
  splitTreeLabelsAboveBelow,
  stableHash,
  withCellPlacement,
} from './pointerPlacement.js'

describe('pointerPlacement', () => {
  it('puts first label above and second below', () => {
    expect(splitLabelsAboveBelow(['cur', 'i'])).toEqual({
      above: ['cur'],
      below: ['i'],
    })
  })

  it('alternates for three labels', () => {
    expect(splitLabelsAboveBelow(['cur', 'i', 'j'])).toEqual({
      above: ['cur', 'j'],
      below: ['i'],
    })
  })

  it('keeps root and cur above the tree node', () => {
    expect(splitTreeLabelsAboveBelow(['left', 'root', 'cur'])).toEqual({
      above: ['root', 'cur'],
      below: ['left'],
    })
  })

  it('stableHash is deterministic', () => {
    expect(stableHash(0)).toBe(stableHash(0))
    expect(stableHash(17)).toBe(stableHash(17))
    expect(typeof stableHash(0)).toBe('number')
  })

  it('withCellPlacement: 1 → above, 2 → below, 3+ → stable shared side', () => {
    const one = withCellPlacement([{ index: 0, label: 'i' }])
    expect(one[0].placement).toBe('above')

    const two = withCellPlacement([
      { index: 0, label: 'l' },
      { index: 0, label: 'r' },
    ])
    expect(two[0].placement).toBe('below')
    expect(two[1].placement).toBe('below')

    const three = () => withCellPlacement([
      { index: 3, label: 'l' },
      { index: 3, label: 'r' },
      { index: 3, label: 'pivot' },
    ])
    const a = three()
    const b = three()
    // 同格 chips 共享同一侧（可重叠），且该侧稳定（两次调用一致）
    expect(a[0].placement).toBe(a[1].placement)
    expect(a[1].placement).toBe(a[2].placement)
    expect(a[0].placement).toBe(b[0].placement)
  })
})
