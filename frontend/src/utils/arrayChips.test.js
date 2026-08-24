import { describe, it, expect } from 'vitest'
import { buildArrayChipsByCell, matchesPrimaryArray } from './arrayChips.js'

describe('buildArrayChipsByCell', () => {
  it('deduplicates indexPointers and pointerLabels for the same cell', () => {
    const arr = {
      values: [10, 20, 30],
      indexPointers: { i: 1, j: 1 },
      pointerLabels: { 1: ['i', 'j'] },
    }
    const map = buildArrayChipsByCell(arr)
    const chips = map.get(1)
    expect(chips).toHaveLength(2)
    const names = chips.map((c) => c.name).sort()
    expect(names).toEqual(['i', 'j'])
  })

  it('keeps distinct labels across cells', () => {
    const arr = {
      values: [10, 20, 30],
      indexPointers: { i: 0, j: 1 },
      pointerLabels: { 0: ['i'], 1: ['j'] },
    }
    const map = buildArrayChipsByCell(arr)
    expect(map.get(0)).toHaveLength(1)
    expect(map.get(1)).toHaveLength(1)
  })
})

describe('matchesPrimaryArray', () => {
  it('matches by id', () => {
    expect(matchesPrimaryArray({ id: 'a', sourceVar: 'b' }, 'a')).toBe(true)
  })
  it('matches by sourceVar when id differs', () => {
    expect(matchesPrimaryArray({ id: 'heap-7', sourceVar: 'a' }, 'a')).toBe(true)
  })
  it('does not match unrelated array', () => {
    expect(matchesPrimaryArray({ id: 'heap-8', sourceVar: 'tmp' }, 'a')).toBe(false)
  })
  it('returns false for null/undefined primaryId', () => {
    expect(matchesPrimaryArray({ id: 'a' }, null)).toBe(false)
    expect(matchesPrimaryArray({ id: 'a' }, undefined)).toBe(false)
  })
})
