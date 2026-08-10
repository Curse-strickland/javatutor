import { describe, it, expect } from 'vitest'
import { buildMergeLevels, buildMergeSortDynamic, buildMergeRangeLevels, extractSortViz } from './sortVizExtract.js'

describe('buildMergeLevels', () => {
  it('builds divide levels top-down until singles', () => {
    const levels = buildMergeLevels([5, 2, 8, 1])
    expect(levels[0]).toEqual({ segments: [[5, 2, 8, 1]] })
    expect(levels[1].segments).toEqual([[5, 2], [8, 1]])
    expect(levels[2].segments).toEqual([[5], [2], [8], [1]])
    expect(levels).toHaveLength(3)
  })

  it('handles empty array', () => {
    expect(buildMergeLevels([])).toEqual([{ segments: [[]] }])
  })

  it('handles single element', () => {
    expect(buildMergeLevels([7])).toEqual([{ segments: [[7]] }])
  })
})

describe('buildMergeSortDynamic', () => {
  const values = [8, 4, 5, 1, 3, 7, 6, 2]

  it('shows only top level before recursion', () => {
    const snap = buildMergeSortDynamic(values, [{ method: 'main', args: {}, locals: {} }])
    expect(snap.levels).toHaveLength(1)
    expect(snap.levels[0].kind).toBe('divide')
    expect(snap.levels[0].segments[0].values).toEqual(values)
  })

  it('expands PDF-style divide levels when mid is known', () => {
    const frames = [
      { method: 'main', args: {}, locals: {} },
      { method: 'mergeSort', args: {}, locals: { left: 0, right: 7, mid: 3 } },
    ]
    const snap = buildMergeSortDynamic(values, frames)
    expect(snap.phase).toBe('divide')
    expect(snap.levels.length).toBeGreaterThanOrEqual(2)
    expect(snap.levels[0].segments[0].active).toBe(true)
    const childLevel = snap.levels[1]
    expect(childLevel.segments.some((s) => s.left === 0 && s.right === 3)).toBe(true)
    expect(childLevel.segments.some((s) => s.left === 4 && s.right === 7)).toBe(true)
  })

  it('adds a merge row; without tmp falls back to working-array values', () => {
    const frames = [
      { method: 'mergeSort', args: {}, locals: { left: 0, right: 3, mid: 1, i: 0, j: 2, k: 0 } },
    ]
    const snap = buildMergeSortDynamic(values, frames)
    expect(snap.phase).toBe('merge')
    const mergeLevel = snap.levels.find((l) => l.kind === 'merge')
    expect(mergeLevel).toBeTruthy()
    expect(mergeLevel.segments[0].merging).toBe(true)
    expect(mergeLevel.segments[0].values).toEqual([8, 4, 5, 1])
    expect(mergeLevel.segments[0].indices).toEqual([0, 1, 2, 3])
  })

  it('fills merge row from tmp progressively and marks consumed sources', () => {
    // a halves stay [4,8]|[1,5]; tmp has written one element (k=1)
    const a = [4, 8, 1, 5]
    const tmp = [4, 0, 0, 0]
    const frames = [
      { method: 'mergeSort', args: {}, locals: { left: 0, right: 3, mid: 1, i: 1, j: 2, k: 1 } },
    ]
    const snap = buildMergeSortDynamic(a, frames, tmp)
    expect(snap.phase).toBe('merge')
    const childLevel = snap.levels.find((l) => l.kind === 'divide' && l.segments.length === 2
      && l.segments[0].left === 0 && l.segments[0].right === 1)
    expect(childLevel).toBeTruthy()
    expect(childLevel.segments[0].values).toEqual([4, 8])
    expect(childLevel.segments[0].consumed).toEqual([true, false]) // i=1 → index 0 taken
    expect(childLevel.segments[1].values).toEqual([1, 5])
    expect(childLevel.segments[1].consumed).toEqual([false, false])
    const mergeLevel = snap.levels.find((l) => l.kind === 'merge')
    expect(mergeLevel.segments[0].values).toEqual([4, null, null, null])
    expect(mergeLevel.segments[0].filled).toEqual([true, false, false, false])
  })

  it('buildMergeRangeLevels matches PDF split shape for length 6', () => {
    const levels = buildMergeRangeLevels(6)
    expect(levels[0]).toEqual([{ left: 0, right: 5 }])
    expect(levels[1]).toEqual([
      { left: 0, right: 2 },
      { left: 3, right: 5 },
    ])
  })
})

function intArrayHeap(values, id = 'arr') {
  return {
    heap: {
      [id]: {
        id,
        type: 'int[]',
        fields: { slots: values },
      },
    },
    frames: [{ method: 'main', args: {}, locals: { arr: { ref: id } } }],
  }
}

describe('extractSortViz', () => {
  it('returns null when no array in heap', () => {
    const heap = { x: { id: 'x', type: 'Integer', fields: { value: 1 } } }
    expect(extractSortViz(heap, [{ args: {}, locals: {} }])).toBeNull()
  })

  it('returns merge-tree mode with dynamic snapshot for mergeSort', () => {
    const { heap, frames } = intArrayHeap([4, 1, 3, 2])
    frames[0] = {
      method: 'mergeSort',
      args: {},
      locals: { arr: { ref: 'arr' }, left: 0, right: 3, mid: 1 },
    }
    const viz = extractSortViz(heap, frames, 'void mergeSort(int[] a)')
    expect(viz).not.toBeNull()
    expect(viz.mode).toBe('merge-tree')
    expect(viz.values).toEqual([4, 1, 3, 2])
    expect(viz.mergeDynamic.phase).toBe('divide')
    expect(viz.mergeDynamic.levels.length).toBeGreaterThanOrEqual(2)
    expect(viz.mergeDynamic.levels[0].segments[0].active).toBe(true)
    expect(viz.label).toBe('归并排序')
  })

  it('prefers arr over temp when both numeric arrays exist', () => {
    const heap = {
      arr: { id: 'arr', type: 'int[]', fields: { slots: [3, 1, 2] } },
      temp: { id: 'temp', type: 'int[]', fields: { slots: [0, 0, 0] } },
    }
    const frames = [{
      method: 'mergeSort',
      args: {},
      locals: {
        arr: { ref: 'arr' },
        temp: { ref: 'temp' },
        left: 0,
        right: 2,
        mid: 1,
      },
    }]
    const viz = extractSortViz(heap, frames, 'mergeSort')
    expect(viz.values).toEqual([3, 1, 2])
  })

  it('uses deepest-frame live array values after in-place merge writes', () => {
    // heap.arr still has the original order (stale main snapshot),
    // while mergeSort locals.a holds the post-merge values — diagram must follow `a`.
    const heap = {
      arr: {
        id: 'arr',
        type: 'int[]',
        slots: [
          { index: 0, value: 8 },
          { index: 1, value: 4 },
          { index: 2, value: 5 },
          { index: 3, value: 1 },
        ],
      },
      a: {
        id: 'a',
        type: 'int[]',
        slots: [
          { index: 0, value: 1 },
          { index: 1, value: 4 },
          { index: 2, value: 5 },
          { index: 3, value: 8 },
        ],
      },
    }
    const frames = [{
      method: 'mergeSort',
      args: {},
      locals: {
        a: [1, 4, 5, 8],
        tmp: [1, 4, 5, 8],
        left: 0,
        right: 3,
        mid: 1,
        i: 2,
        j: 4,
        k: 4,
      },
    }]
    const viz = extractSortViz(heap, frames, 'mergeSort')
    expect(viz.mode).toBe('merge-tree')
    expect(viz.values).toEqual([1, 4, 5, 8])
    const mergeLevel = viz.mergeDynamic.levels.find((l) => l.kind === 'merge')
    // k=4 → tmp fully written into merge row
    expect(mergeLevel.segments[0].values).toEqual([1, 4, 5, 8])
  })

  it('merge step updates both source consumption and tmp result', () => {
    const frames = [{
      method: 'mergeSort',
      args: {},
      locals: {
        a: [4, 8, 1, 5],
        tmp: [1, 4, 0, 0],
        left: 0,
        right: 3,
        mid: 1,
        i: 1,
        j: 3,
        k: 2,
      },
    }]
    const viz = extractSortViz({}, frames, 'mergeSort')
    const childLevel = viz.mergeDynamic.levels.find(
      (l) => l.kind === 'divide' && l.segments.length === 2 && l.segments[0].right === 1,
    )
    expect(childLevel.segments[0].consumed).toEqual([true, false])
    expect(childLevel.segments[1].consumed).toEqual([true, false]) // j=3 → index 2 taken
    const mergeLevel = viz.mergeDynamic.levels.find((l) => l.kind === 'merge')
    expect(mergeLevel.segments[0].values).toEqual([1, 4, null, null])
  })

  it('prefers heap entry matching live frame name over stale arr', () => {
    const heap = {
      arr: {
        id: 'arr',
        type: 'int[]',
        slots: [
          { index: 0, value: 8 },
          { index: 1, value: 4 },
          { index: 2, value: 5 },
          { index: 3, value: 1 },
        ],
      },
      a: {
        id: 'a',
        type: 'int[]',
        slots: [
          { index: 0, value: 1 },
          { index: 1, value: 4 },
          { index: 2, value: 5 },
          { index: 3, value: 8 },
        ],
      },
    }
    const frames = [{
      method: 'mergeSort',
      args: {},
      locals: {
        a: { ref: 'a' },
        left: 0,
        right: 3,
        mid: 1,
      },
    }]
    const viz = extractSortViz(heap, frames, 'mergeSort')
    expect(viz.values).toEqual([1, 4, 5, 8])
  })

  it('ignores tmp buffer even when it appears first in stack locals', () => {
    const frames = [{
      method: 'mergeSort',
      args: {},
      locals: {
        tmp: [9, 9, 9],
        a: [2, 1, 3],
        left: 0,
        right: 2,
        mid: 1,
      },
    }]
    const viz = extractSortViz({}, frames, 'mergeSort')
    expect(viz.values).toEqual([2, 1, 3])
  })

  it('returns array-pointers for binary search with l, r, mid', () => {
    const { heap, frames } = intArrayHeap([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    frames[0].method = 'binarySearch'
    frames[0].locals = { arr: { ref: 'arr' }, l: 0, r: 9, mid: 4 }
    const viz = extractSortViz(heap, frames)
    expect(viz.mode).toBe('array-pointers')
    expect(viz.pointers).toMatchObject({ l: 0, r: 9, mid: 4 })
    expect(viz.range).toEqual({ lo: 0, hi: 9 })
    expect(viz.activeIndex).toBe(4)
  })

  it('returns array-pointers when l/r/mid present without method name', () => {
    const { heap, frames } = intArrayHeap([1, 2, 3, 4, 5])
    frames[0].locals = { arr: { ref: 'arr' }, l: 1, r: 4, mid: 2 }
    const viz = extractSortViz(heap, frames)
    expect(viz.mode).toBe('array-pointers')
    expect(viz.pointers.mid).toBe(2)
  })

  it('returns bars mode for insertion sort with i and j', () => {
    const { heap, frames } = intArrayHeap([5, 2, 8, 1, 9])
    frames[0].method = 'insertionSort'
    frames[0].locals = { arr: { ref: 'arr' }, i: 2, j: 1 }
    const viz = extractSortViz(heap, frames)
    expect(viz.mode).toBe('bars')
    expect(viz.activeIndex).toBe(2)
    expect(viz.label).toBe('插入排序')
  })

  it('returns heap mode for heapSort', () => {
    const { heap, frames } = intArrayHeap([9, 4, 7, 1])
    frames[0].method = 'heapSort'
    const viz = extractSortViz(heap, frames, 'heapSort(int[] a)')
    expect(viz.mode).toBe('heap')
    expect(viz.label).toBe('堆排序')
  })

  it('returns array mode with shell label from codeHint', () => {
    const { heap, frames } = intArrayHeap([9, 1, 5, 3])
    const viz = extractSortViz(heap, frames, 'shellSort gap 希尔排序')
    expect(viz.mode).toBe('array')
    expect(viz.label).toBe('希尔：数组视图')
  })

  it('returns null for numeric array without sorting context', () => {
    const { heap, frames } = intArrayHeap([1, 2, 3])
    frames[0].method = 'sumArray'
    expect(extractSortViz(heap, frames)).toBeNull()
  })

  it('returns array-pointers for quickSort with l and r', () => {
    const { heap, frames } = intArrayHeap([3, 1, 4, 1, 5])
    frames[0].method = 'quickSort'
    frames[0].locals = { arr: { ref: 'arr' }, l: 0, r: 4 }
    const viz = extractSortViz(heap, frames)
    expect(viz.mode).toBe('array-pointers')
    expect(viz.range).toEqual({ lo: 0, hi: 4 })
  })
})
