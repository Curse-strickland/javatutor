import { describe, it, expect } from 'vitest'
import { splitLabelsAboveBelow, splitTreeLabelsAboveBelow, withVerticalPlacement } from './pointerPlacement.js'

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

  it('assigns placement per shared index', () => {
    const out = withVerticalPlacement([
      { index: 2, label: 'left' },
      { index: 2, label: 'mid' },
      { index: 5, label: 'right' },
    ])
    expect(out[0].placement).toBe('above')
    expect(out[1].placement).toBe('below')
    expect(out[2].placement).toBe('above')
  })
})
