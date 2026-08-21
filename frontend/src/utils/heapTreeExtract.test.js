import { describe, it, expect } from 'vitest'
import { buildHeapTreeFromArray } from './heapTreeExtract.js'

describe('buildHeapTreeFromArray', () => {
  it('returns null for empty array', () => {
    expect(buildHeapTreeFromArray([])).toBeNull()
  })

  it('builds a full binary tree for length 8 with correct parent/child edges', () => {
    const t = buildHeapTreeFromArray([9, 7, 5, 3, 6, 2, 4, 1])
    expect(t.nodes).toHaveLength(8)
    // parent 0 → children 1 (left) and 2 (right)
    expect(t.edges).toContainEqual({ from: '0', to: '1', side: 'left' })
    expect(t.edges).toContainEqual({ from: '0', to: '2', side: 'right' })
    // parent 1 → children 3 (left) and 4 (right)
    expect(t.edges).toContainEqual({ from: '1', to: '3', side: 'left' })
    expect(t.edges).toContainEqual({ from: '1', to: '4', side: 'right' })
    // parent 2 → children 5 (left) and 6 (right)
    expect(t.edges).toContainEqual({ from: '2', to: '5', side: 'left' })
    expect(t.edges).toContainEqual({ from: '2', to: '6', side: 'right' })
    // parent 3 → child 7 (left)
    expect(t.edges).toContainEqual({ from: '3', to: '7', side: 'left' })
    expect(t.rootId).toBe('0')
    expect(t.kind).toBe('heap')
    expect(t.sortedStart).toBe(8)
    expect(t.fadedIndices).toEqual([])
  })

  it('computes correct layer for each index', () => {
    const t = buildHeapTreeFromArray([1, 2, 3, 4, 5, 6, 7])
    const layers = t.nodes.map((n) => n.layer)
    expect(layers).toEqual([0, 1, 1, 2, 2, 2, 2])
  })

  it('marks sorted-tail cells as faded when heapSize < length', () => {
    // heap of size 5 → cells 5,6 are sorted tail
    const t = buildHeapTreeFromArray([1, 2, 3, 4, 5, 9, 8], 5)
    expect(t.sortedStart).toBe(5)
    expect(t.fadedIndices).toEqual([5, 6])
    // heap still has 5 nodes
    expect(t.nodes).toHaveLength(7)
  })

  it('falls back to values.length when heapSize is out of range', () => {
    expect(buildHeapTreeFromArray([1, 2, 3], -1).sortedStart).toBe(3)
    expect(buildHeapTreeFromArray([1, 2, 3], 99).sortedStart).toBe(3)
  })

  it('maps pointers to node labels and highlights cur/i', () => {
    const t = buildHeapTreeFromArray([9, 7, 5, 3, 6], 5, { i: 0, j: 1, left: 1 })
    expect(t.pointerLabels['0']).toEqual(['i'])
    expect(t.pointerLabels['1']).toEqual(['j', 'left'])
    // cur highlight prefers i > cur > curr > current > node
    expect(t.highlightedPath).toEqual(['0'])
  })

  it('cur override wins when both i and cur are present', () => {
    const t = buildHeapTreeFromArray([9, 7, 5, 3], 4, { i: 0, cur: 2 })
    expect(t.highlightedPath).toEqual(['0'])
    // cur label still appears as a chip even though i owns the highlight
    expect(t.pointerLabels['2']).toEqual(['cur'])
  })

  it('drops pointer labels landing in the sorted tail', () => {
    // heapSize=3, j=4 lives in the sorted tail — should NOT light up a tree node
    const t = buildHeapTreeFromArray([9, 7, 5, 3, 6], 3, { i: 0, j: 4 })
    expect(t.pointerLabels['4']).toBeUndefined()
    expect(t.pointerLabels['0']).toEqual(['i'])
  })

  it('survives a single-node heap (heapSize=1)', () => {
    const t = buildHeapTreeFromArray([9, 7, 5], 1)
    expect(t.nodes).toHaveLength(3)
    expect(t.sortedStart).toBe(1)
    expect(t.fadedIndices).toEqual([1, 2])
    // Tree shape stays stable (full original heap) — sorted-tail nodes are
    // just faded. This avoids layout reshuffling as the heap shrinks.
    expect(t.edges.find((e) => e.from === '0' && e.to === '1')).toBeTruthy()
    expect(t.edges.find((e) => e.from === '0' && e.to === '2')).toBeTruthy()
  })
})