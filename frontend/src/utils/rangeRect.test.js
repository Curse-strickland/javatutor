import { describe, it, expect } from 'vitest'
import { rangeRect } from './rangeRect.js'

describe('rangeRect', () => {
  it('单格 (lo=hi=0)', () => {
    expect(rangeRect(0, 0, 48, 2)).toEqual({ left: 0, width: 48 })
  })
  it('多格 (lo=2, hi=4, cellWidth=48, gap=2)', () => {
    // left = 2*(48+2) = 100
    // width = 3*48 + 2*2 = 148
    expect(rangeRect(2, 4, 48, 2)).toEqual({ left: 100, width: 148 })
  })
  it('gap=0 时与简单公式一致', () => {
    expect(rangeRect(1, 3, 50, 0)).toEqual({ left: 50, width: 150 })
  })
})
