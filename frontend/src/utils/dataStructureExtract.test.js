import { describe, it, expect } from 'vitest'
import { extractDataStructures } from './dataStructureExtract.js'

describe('extractDataStructures — linked list', () => {
  it('returns singly nodes when prev is absent', () => {
    const heap = { 'n1': { id: 'n1', type: 'Node', fields: { val: 1, next: { ref: 'n2' } } }, 'n2': { id: 'n2', type: 'Node', fields: { val: 2, next: null } } }
    const frames = [{ args: {}, locals: { head: { ref: 'n1' } } }]
    const { linkedLists, arrays } = extractDataStructures(heap, frames)
    expect(linkedLists[0].nodes).toHaveLength(2)
    expect(linkedLists[0].nodes[0].prev).toBeUndefined()
    expect(arrays).toEqual([])
  })

  it('returns doubly nodes when prev is present', () => {
    const heap = {
      'n1': { id: 'n1', type: 'Node', fields: { val: 1, prev: null, next: { ref: 'n2' } } },
      'n2': { id: 'n2', type: 'Node', fields: { val: 2, prev: { ref: 'n1' }, next: null } },
    }
    const frames = [{ args: {}, locals: { head: { ref: 'n1' } } }]
    const { linkedLists } = extractDataStructures(heap, frames)
    expect(linkedLists[0].nodes[1].prev).toBe('n1')
  })
})

describe('extractDataStructures — array', () => {
  it('identifies ArrayList-like with elementData field', () => {
    const heap = {
      'arr': {
        id: 'arr', type: 'ArrayList', fields: {
          elementData: [
            { ref: 'e0' }, { ref: 'e1' }, null, null,
          ],
        },
      },
      'e0': { id: 'e0', type: 'Integer', fields: { value: 10 } },
      'e1': { id: 'e1', type: 'Integer', fields: { value: 20 } },
    }
    const frames = [{ args: {}, locals: { list: { ref: 'arr' } } }]
    const { arrays, linkedLists } = extractDataStructures(heap, frames)
    expect(arrays).toHaveLength(1)
    expect(arrays[0].values).toEqual([10, 20])
    expect(arrays[0].indexPointers || {}).toEqual({})
    expect(linkedLists).toEqual([])
  })

  it('identifies raw int[] with slots field and indexPointers', () => {
    const heap = {
      arr: {
        id: 'arr',
        type: 'int[]',
        fields: { slots: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
      },
    }
    const frames = [{
      args: {},
      locals: { head: 0, tail: 9, mid: 4, arr: { ref: 'arr' } },
    }]
    const { arrays } = extractDataStructures(heap, frames)
    expect(arrays).toHaveLength(1)
    expect(arrays[0].values).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    // head/tail 不参与数组指针高亮
    expect(arrays[0].indexPointers).toMatchObject({ mid: 4 })
    expect(arrays[0].indexPointers.head).toBeUndefined()
    expect(arrays[0].indexPointers.tail).toBeUndefined()
    expect(arrays[0].pointerLabels[4]).toContain('mid')
    expect(arrays[0].headIndex).toBeUndefined()
    expect(arrays[0].tailIndex).toBeUndefined()
  })

  it('identifies TraceEngine int[] with top-level slots {index,value}', () => {
    const heap = {
      arr: {
        id: '0x1A',
        type: 'int[5]',
        name: 'arr',
        length: 5,
        slots: [
          { index: 0, value: 5 },
          { index: 1, value: 3 },
          { index: 2, value: 8 },
          { index: 3, value: 1 },
          { index: 4, value: 2 },
        ],
      },
    }
    const frames = [{ args: {}, locals: { arr: [5, 3, 8, 1, 2], i: 1 } }]
    const { arrays } = extractDataStructures(heap, frames)
    expect(arrays).toHaveLength(1)
    expect(arrays[0].values).toEqual([5, 3, 8, 1, 2])
    expect(arrays[0].dims).toBe(1)
    expect(arrays[0].indexPointers.i).toBe(1)
  })

  it('handles multi-file heap keys with file#name prefix', () => {
    // 模拟多文件后端：堆 key 为 `file#name`，对象带短名 name + file
    const heap = {
      'Main.java#arr': {
        id: '0xA1',
        type: 'int[3]',
        name: 'arr',
        file: 'Main.java',
        slots: [
          { index: 0, value: 5 },
          { index: 1, value: 3 },
          { index: 2, value: 8 },
        ],
      },
      'Helper.java#arr': {
        id: '0xA2',
        type: 'int[2]',
        name: 'arr',
        file: 'Helper.java',
        slots: [
          { index: 0, value: 1 },
          { index: 1, value: 2 },
        ],
      },
    }
    const frames = [
      { method: 'main', file: 'Main.java', args: {}, locals: { arr: [5, 3, 8] } },
    ]
    const { arrays } = extractDataStructures(heap, frames)
    expect(arrays.length).toBeGreaterThanOrEqual(1)
    // 主数组应正确识别为 Main.java 的 arr，且标签不带文件名前缀
    const mainArr = arrays.find((a) => (a.sourceVar || a.id) === 'arr' && a.values.join() === '5,3,8')
    expect(mainArr).toBeTruthy()
    expect(mainArr.sourceVar).toBe('arr')
  })

  it('overlays deepest-frame live values and drops stale arr alias during mergeSort', () => {
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
      tmp: {
        id: 'tmp',
        type: 'int[]',
        slots: [
          { index: 0, value: 1 },
          { index: 1, value: 4 },
          { index: 2, value: 5 },
          { index: 3, value: 8 },
        ],
      },
    }
    const frames = [
      {
        method: 'main',
        args: {},
        locals: { arr: [8, 4, 5, 1], temp: [0, 0, 0, 0] },
      },
      {
        method: 'mergeSort',
        args: {},
        locals: {
          a: [1, 4, 5, 8],
          tmp: [1, 4, 5, 8],
          left: 0,
          right: 3,
        },
      },
    ]
    const { arrays } = extractDataStructures(heap, frames)
    const byVar = Object.fromEntries(arrays.map((a) => [a.sourceVar || a.id, a.values]))
    expect(byVar.a).toEqual([1, 4, 5, 8])
    expect(byVar.tmp).toEqual([1, 4, 5, 8])
    // stale main `arr` alias hidden when live `a` is present
    expect(byVar.arr).toBeUndefined()
  })

  it('syncs sole heap arr from live stack when callee only exposes a', () => {
    const heap = {
      arr: {
        id: 'arr',
        type: 'int[]',
        slots: [
          { index: 0, value: 3 },
          { index: 1, value: 1 },
          { index: 2, value: 2 },
        ],
      },
    }
    const frames = [{
      method: 'mergeSort',
      args: {},
      locals: { a: [1, 2, 3], left: 0, right: 2 },
    }]
    const { arrays } = extractDataStructures(heap, frames)
    // live `a` synthesized; stale arr dropped as alias sibling
    expect(arrays.some((a) => (a.sourceVar || a.id) === 'a' && a.values.join() === '1,2,3')).toBe(true)
    expect(arrays.every((a) => (a.sourceVar || a.id) !== 'arr' || a.values.join() === '1,2,3')).toBe(true)
  })

  it('identifies TraceEngine int[][] as dims=2 matrix with i/j pointers', () => {
    const heap = {
      grid: {
        id: '0x2D',
        type: 'int[][]',
        name: 'grid',
        length: 3,
        slots: [
          { index: 0, value: [1, 2, 3] },
          { index: 1, value: [4, 5, 6] },
          { index: 2, value: [7, 8, 9] },
        ],
      },
    }
    const frames = [{ args: {}, locals: { grid: [[1, 2, 3], [4, 5, 6], [7, 8, 9]], i: 1, j: 2 } }]
    const { arrays } = extractDataStructures(heap, frames)
    expect(arrays).toHaveLength(1)
    expect(arrays[0].dims).toBe(2)
    expect(arrays[0].rows).toBe(3)
    expect(arrays[0].cols).toBe(3)
    expect(arrays[0].matrix).toEqual([
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
    ])
    expect(arrays[0].indexPointers).toMatchObject({ i: 1, j: 2 })
    expect(arrays[0].pointerLabels['1,2']).toEqual(expect.arrayContaining(['cur', 'i', 'j']))
  })

  it('supports ragged 2D rows and nested {index,value} cells', () => {
    const heap = {
      mat: {
        id: 'mat',
        type: 'int[][]',
        slots: [
          { index: 0, value: [{ index: 0, value: 10 }, { index: 1, value: 20 }] },
          { index: 1, value: [30] },
        ],
      },
    }
    const frames = [{ args: {}, locals: { mat: 'mat' } }]
    const { arrays } = extractDataStructures(heap, frames)
    expect(arrays[0].dims).toBe(2)
    expect(arrays[0].matrix).toEqual([[10, 20], [30]])
    expect(arrays[0].cols).toBe(2)
  })
})

describe('extractDataStructures — TraceEngine string refs', () => {
  it('resolves linked-list roots when locals store heap id strings', () => {
    const heap = {
      head: {
        id: '0xAA',
        type: 'ListNode',
        fields: { val: 1, next: { ref: '0xBB' } },
      },
      'head.next': {
        id: '0xBB',
        type: 'ListNode',
        fields: { val: 2, next: null },
      },
    }
    const frames = [{ args: {}, locals: { head: '0xAA' } }]
    const { linkedLists } = extractDataStructures(heap, frames)
    expect(linkedLists[0].nodes.map((n) => n.id)).toEqual(['0xAA', '0xBB'])
    expect(linkedLists[0].pointerLabels['0xAA']).toContain('head')
  })
})

describe('extractDataStructures — tree', () => {
  it('returns empty trees when heap has no tree nodes', () => {
    const heap = { x: { id: 'x', type: 'Integer', fields: { value: 1 } } }
    const frames = [{ args: {}, locals: {} }]
    const { trees } = extractDataStructures(heap, frames)
    expect(trees).toEqual([])
  })

  it('builds a binary tree of 3 nodes with layers and edges', () => {
    const heap = {
      r: { id: 'r', type: 'TreeNode', fields: { val: 4, left: { ref: 'l' }, right: { ref: 'rt' } } },
      l: { id: 'l', type: 'TreeNode', fields: { val: 2, left: null, right: null } },
      rt: { id: 'rt', type: 'TreeNode', fields: { val: 6, left: null, right: null } },
    }
    const frames = [{ args: {}, locals: { root: { ref: 'r' }, cur: { ref: 'l' } } }]
    const { trees, linkedLists } = extractDataStructures(heap, frames)
    expect(linkedLists).toEqual([])
    expect(trees).toHaveLength(1)
    const tree = trees[0]
    expect(tree.kind).toBe('tree')
    expect(tree.rootId).toBe('r')
    expect(tree.nodes).toHaveLength(3)
    expect(tree.nodes.find((n) => n.id === 'r')).toMatchObject({ val: 4, layer: 0, left: 'l', right: 'rt' })
    expect(tree.nodes.find((n) => n.id === 'l')).toMatchObject({ val: 2, layer: 1, left: null, right: null })
    expect(tree.edges).toEqual(
      expect.arrayContaining([
        { from: 'r', to: 'l', side: 'left' },
        { from: 'r', to: 'rt', side: 'right' },
      ]),
    )
    expect(tree.highlightedPath).toContain('l')
    expect(tree.pointerLabels.r).toContain('root')
    expect(tree.pointerLabels.l).toContain('cur')
  })

  it('normalizes current→cur and keeps root label on live root', () => {
    const heap = {
      r: { id: 'r', type: 'TreeNode', fields: { val: 1, left: { ref: 'l' }, right: null } },
      l: { id: 'l', type: 'TreeNode', fields: { val: 2, left: null, right: null } },
    }
    const frames = [{ args: {}, locals: { tree: { ref: 'r' }, current: { ref: 'l' } } }]
    const { trees } = extractDataStructures(heap, frames)
    expect(trees[0].rootId).toBe('r')
    expect(trees[0].pointerLabels.r).toContain('root')
    expect(trees[0].pointerLabels.l).toContain('cur')
    expect(trees[0].pointerLabels.l).not.toContain('current')
  })

  it('maps traversal param node→cur (classic 二叉树遍历 preset)', () => {
    const heap = {
      r: { id: 'r', type: 'TreeNode', fields: { val: 1, left: { ref: 'l' }, right: { ref: 'rt' } } },
      l: { id: 'l', type: 'TreeNode', fields: { val: 2, left: { ref: 'll' }, right: null } },
      rt: { id: 'rt', type: 'TreeNode', fields: { val: 3, left: null, right: null } },
      ll: { id: 'll', type: 'TreeNode', fields: { val: 4, left: null, right: null } },
    }
    const frames = [
      { method: 'main', args: {}, locals: { root: { ref: 'r' } } },
      { method: 'preorder', args: {}, locals: { node: { ref: 'l' } } },
      { method: 'preorder', args: {}, locals: { node: { ref: 'll' } } },
    ]
    const { trees } = extractDataStructures(heap, frames)
    expect(trees[0].rootId).toBe('r')
    expect(trees[0].pointerLabels.r).toContain('root')
    expect(trees[0].pointerLabels.ll).toContain('cur')
    expect(trees[0].pointerLabels.ll).not.toContain('node')
    // Only deepest focus is highlighted — not the whole recursion chain
    expect(trees[0].highlightedPath).toEqual(['ll'])
  })

  it('moves rootId and root label when stack root is reassigned', () => {
    const heap = {
      r: { id: 'r', type: 'TreeNode', fields: { val: 1, left: { ref: 'l' }, right: { ref: 'rt' } } },
      l: { id: 'l', type: 'TreeNode', fields: { val: 2, left: { ref: 'll' }, right: null } },
      rt: { id: 'rt', type: 'TreeNode', fields: { val: 3, left: null, right: null } },
      ll: { id: 'll', type: 'TreeNode', fields: { val: 4, left: null, right: null } },
    }
    const before = extractDataStructures(heap, [{ args: {}, locals: { root: { ref: 'r' }, cur: { ref: 'r' } } }])
    expect(before.trees[0].rootId).toBe('r')
    expect(before.trees[0].pointerLabels.r).toEqual(expect.arrayContaining(['root', 'cur']))

    const after = extractDataStructures(heap, [{ args: {}, locals: { root: { ref: 'l' }, cur: { ref: 'll' } } }])
    expect(after.trees[0].rootId).toBe('l')
    expect(after.trees[0].pointerLabels.l).toContain('root')
    expect(after.trees[0].pointerLabels.ll).toContain('cur')
    expect(after.trees[0].pointerLabels.r).toBeUndefined()
    expect(after.trees[0].nodes.map((n) => n.id).sort()).toEqual(['l', 'll'])
  })

  it('prefers explicit root over a larger tree alias when root is reassigned', () => {
    const heap = {
      r: { id: 'r', type: 'TreeNode', fields: { val: 1, left: { ref: 'l' }, right: { ref: 'rt' } } },
      l: { id: 'l', type: 'TreeNode', fields: { val: 2, left: { ref: 'll' }, right: null } },
      rt: { id: 'rt', type: 'TreeNode', fields: { val: 3, left: null, right: null } },
      ll: { id: 'll', type: 'TreeNode', fields: { val: 4, left: null, right: null } },
    }
    // Old full tree still referenced as `tree`, but live `root` moved to left subtree
    const frames = [{
      args: {},
      locals: { tree: { ref: 'r' }, root: { ref: 'l' }, cur: { ref: 'll' } },
    }]
    const { trees } = extractDataStructures(heap, frames)
    expect(trees[0].rootId).toBe('l')
    expect(trees[0].pointerLabels.l).toContain('root')
    expect(trees[0].pointerLabels.ll).toContain('cur')
    expect(trees[0].pointerLabels.r || []).not.toContain('root')
  })

  it('does not treat ListNode as a tree', () => {
    const heap = {
      n1: { id: 'n1', type: 'ListNode', fields: { val: 1, next: { ref: 'n2' } } },
      n2: { id: 'n2', type: 'ListNode', fields: { val: 2, next: null } },
    }
    const frames = [{ args: {}, locals: { head: { ref: 'n1' } } }]
    const { trees, linkedLists } = extractDataStructures(heap, frames)
    expect(trees).toEqual([])
    expect(linkedLists).toHaveLength(1)
  })

  it('omits trees with fewer than 2 nodes', () => {
    const heap = {
      solo: { id: 'solo', type: 'TreeNode', fields: { val: 1, left: null, right: null } },
    }
    const frames = [{ args: {}, locals: { root: { ref: 'solo' } } }]
    const { trees } = extractDataStructures(heap, frames)
    expect(trees).toEqual([])
  })

  it('detects heap kind from type name', () => {
    const heap = {
      r: { id: 'r', type: 'MinHeapNode', fields: { val: 1, left: { ref: 'l' }, right: null } },
      l: { id: 'l', type: 'MinHeapNode', fields: { val: 3, left: null, right: null } },
    }
    const frames = [{ args: {}, locals: { heap: { ref: 'r' } } }]
    const { trees } = extractDataStructures(heap, frames)
    expect(trees).toHaveLength(1)
    expect(trees[0].kind).toBe('heap')
  })

  it('returns orphan tree nodes referenced from stack but not in main walk', () => {
    const heap = {
      r: { id: 'r', type: 'TreeNode', fields: { val: 4, left: { ref: 'l' }, right: null } },
      l: { id: 'l', type: 'TreeNode', fields: { val: 2, left: null, right: null } },
      orphan: { id: 'orphan', type: 'TreeNode', fields: { val: 99, left: null, right: null } },
    }
    const frames = [{ args: {}, locals: { root: { ref: 'r' }, insert: { ref: 'orphan' } } }]
    const { trees } = extractDataStructures(heap, frames)
    expect(trees).toHaveLength(1)
    expect(trees[0].orphans).toHaveLength(1)
    expect(trees[0].orphans[0]).toMatchObject({ id: 'orphan', val: 99 })
    expect(trees[0].orphans[0].labels).toContain('insert')
  })

  it('recognizes tree nodes with data field and container.root', () => {
    const heap = {
      tree: {
        id: 'tree',
        type: 'RedBlackTree',
        fields: { root: { ref: 'n1' } },
      },
      n1: {
        id: 'n1',
        type: 'RedBlackTree$Node',
        fields: { data: 10, left: { ref: 'n2' }, right: { ref: 'n3' }, color: false },
      },
      n2: {
        id: 'n2',
        type: 'RedBlackTree$Node',
        fields: { data: 5, left: null, right: null, color: true },
      },
      n3: {
        id: 'n3',
        type: 'RedBlackTree$Node',
        fields: { data: 15, left: null, right: null, color: true },
      },
    }
    const frames = [{ args: {}, locals: { tree: { ref: 'tree' } } }]
    const { trees } = extractDataStructures(heap, frames)
    expect(trees).toHaveLength(1)
    expect(trees[0].rootId).toBe('n1')
    expect(trees[0].pointerLabels.n1).toContain('root')
    expect(trees[0].nodes.find((n) => n.id === 'n1').val).toBe(10)
    expect(trees[0].nodes).toHaveLength(3)
  })
})

describe('extractDataStructures — graph', () => {
  it('extracts undirected weighted triangle and de-duplicates edges', () => {
    const heap = {
      g: {
        id: 'g',
        type: 'Graph',
        fields: {
          adj: {
            '1': [{ to: '2', w: 6 }, { to: '3', w: 5 }],
            '2': [{ to: '1', w: 6 }, { to: '3', w: 7 }],
            '3': [{ to: '1', w: 5 }, { to: '2', w: 7 }],
          },
        },
      },
    }
    const frames = [{ args: {}, locals: { g: { ref: 'g' } } }]
    const { graphs, trees, linkedLists } = extractDataStructures(heap, frames)
    expect(trees).toEqual([])
    expect(linkedLists).toEqual([])
    expect(graphs).toHaveLength(1)
    const graph = graphs[0]
    expect(graph.kind).toBe('undirected')
    expect(graph.directed).toBe(false)
    expect(graph.nodes).toHaveLength(3)
    expect(graph.nodes.find((n) => n.id === '1')).toMatchObject({ index: 1 })
    expect(graph.nodes.map((n) => n.val).sort()).toEqual(['1', '2', '3'])
    expect(graph.edges).toHaveLength(3)
    expect(graph.edges).toEqual(
      expect.arrayContaining([
        { from: '1', to: '2', weight: 6 },
        { from: '1', to: '3', weight: 5 },
        { from: '2', to: '3', weight: 7 },
      ]),
    )
  })

  it('extracts directed edges with weights', () => {
    const heap = {
      dg: {
        id: 'dg',
        type: 'Digraph',
        fields: {
          edges: [
            { from: 'a', to: 'b', weight: 1, directed: true },
            { from: 'b', to: 'c', weight: 2, directed: true },
            { from: 'c', to: 'a', weight: 3, directed: true },
          ],
        },
      },
    }
    const frames = [{ args: {}, locals: { dg: { ref: 'dg' } } }]
    const { graphs } = extractDataStructures(heap, frames)
    expect(graphs).toHaveLength(1)
    const graph = graphs[0]
    expect(graph.kind).toBe('directed')
    expect(graph.directed).toBe(true)
    expect(graph.nodes).toHaveLength(3)
    expect(graph.edges).toEqual(
      expect.arrayContaining([
        { from: 'a', to: 'b', weight: 1, directed: true },
        { from: 'b', to: 'c', weight: 2, directed: true },
        { from: 'c', to: 'a', weight: 3, directed: true },
      ]),
    )
  })

  it('does not treat ListNode chain as a graph', () => {
    const heap = {
      n1: { id: 'n1', type: 'ListNode', fields: { val: 1, next: { ref: 'n2' } } },
      n2: { id: 'n2', type: 'ListNode', fields: { val: 2, next: null } },
    }
    const frames = [{ args: {}, locals: { head: { ref: 'n1' } } }]
    const { graphs, linkedLists } = extractDataStructures(heap, frames)
    expect(graphs).toEqual([])
    expect(linkedLists).toHaveLength(1)
  })

  it('omits graphs with fewer than 2 nodes', () => {
    const heap = {
      solo: {
        id: 'solo',
        type: 'Graph',
        fields: {
          adj: {
            '1': [],
          },
        },
      },
    }
    const frames = [{ args: {}, locals: { g: { ref: 'solo' } } }]
    const { graphs } = extractDataStructures(heap, frames)
    expect(graphs).toEqual([])
  })
})
