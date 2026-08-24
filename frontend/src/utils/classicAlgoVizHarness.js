/**
 * Classic preset → visualization recognition harness.
 *
 * Cases are keyed by ClassicCodePanel item names. Tests load the real preset
 * `code` from ClassicCodePanel.vue, build a TraceEngine-shaped mid-step
 * snapshot (heap + stackFrames), then assert extractDataStructures /
 * extractSortViz produce the expected structure + viz mode.
 */
import { extractDataStructures } from './dataStructureExtract.js'
import { extractSortViz } from './sortVizExtract.js'
import { extractKmpViz } from './kmpVizExtract.js'

export function intArrayStep(values, varName = 'arr', localsExtra = {}, method = 'main') {
  return {
    heap: {
      [varName]: {
        id: varName,
        type: `int[${values.length}]`,
        name: varName,
        length: values.length,
        slots: values.map((v, i) => ({ index: i, value: v })),
      },
    },
    stackFrames: [{
      method,
      args: {},
      locals: { [varName]: values.slice(), ...localsExtra },
    }],
  }
}

export function matrixStep(matrix, varName = 'grid', localsExtra = {}, method = 'main', type = 'int[][]') {
  return {
    heap: {
      [varName]: {
        id: varName,
        type,
        name: varName,
        length: matrix.length,
        slots: matrix.map((row, i) => ({ index: i, value: row.slice() })),
      },
    },
    stackFrames: [{
      method,
      args: {},
      locals: { [varName]: matrix.map((r) => r.slice()), ...localsExtra },
    }],
  }
}

export function linkedListStep(values, { headName = 'head', pointers = {}, cyclicToIndex = null } = {}) {
  const heap = {}
  const ids = values.map((_, i) => `n${i}`)
  values.forEach((val, i) => {
    let next = null
    if (cyclicToIndex != null && i === values.length - 1) {
      next = { ref: ids[cyclicToIndex] }
    } else if (i < values.length - 1) {
      next = { ref: ids[i + 1] }
    }
    heap[ids[i]] = {
      id: ids[i],
      type: 'ListNode',
      fields: { val, next },
    }
  })
  const locals = { [headName]: ids[0], ...pointers }
  // Resolve pointer names that refer to node indices
  for (const [k, v] of Object.entries(locals)) {
    if (typeof v === 'number' && ids[v]) locals[k] = ids[v]
  }
  return {
    heap,
    stackFrames: [{ method: 'main', args: {}, locals }],
  }
}

export function treeStep(spec, { rootName = 'root', pointers = {} } = {}) {
  // spec: { id, val, left?, right? }[]
  const heap = {}
  for (const n of spec) {
    heap[n.id] = {
      id: n.id,
      type: 'TreeNode',
      fields: {
        val: n.val,
        left: n.left ? { ref: n.left } : null,
        right: n.right ? { ref: n.right } : null,
      },
    }
  }
  const locals = { [rootName]: { ref: spec[0].id }, ...pointers }
  return {
    heap,
    stackFrames: [{ method: 'main', args: {}, locals }],
  }
}

export function kmpStep({ text, pattern, next, i, j, mode = 'matching' }) {
  const heap = {
    next: {
      id: 'next',
      type: `int[${next.length}]`,
      name: 'next',
      length: next.length,
      slots: next.map((v, idx) => ({ index: idx, value: v })),
    },
  }
  const mainFrame = {
    method: 'main',
    args: {},
    locals: { text, pattern, next: next.slice(), i, j },
  }
  const stackFrames = [mainFrame]
  if (mode === 'next-build') {
    stackFrames.push({
      method: 'buildNext',
      args: { p: pattern },
      locals: { p: pattern, next: next.slice(), i, j },
    })
  }
  return { heap, stackFrames }
}

/**
 * Mirror of DataStructureTab recognition pipeline.
 */
export function recognizePresetStep(heap, stackFrames, code = '') {
  const ds = extractDataStructures(heap, stackFrames)
  const sortViz = extractSortViz(heap, stackFrames, code)
  const kmpViz = extractKmpViz(heap, stackFrames, code)
  return {
    linkedLists: ds.linkedLists,
    arrays: ds.arrays,
    trees: ds.trees,
    graphs: ds.graphs,
    sortViz,
    kmpViz,
    badges: {
      linkedLists: ds.linkedLists.length,
      arrays: ds.arrays.length,
      trees: ds.trees.length,
      graphs: ds.graphs.length,
      sort: sortViz ? 1 : 0,
      kmp: kmpViz ? 1 : 0,
    },
  }
}

/**
 * Extract preset source by item name from ClassicCodePanel.vue source text.
 */
export function extractPresetCodeFromPanel(panelSrc, name) {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(
    `name:\\s*'${escaped}'[\\s\\S]*?code:\\s*\`([\\s\\S]*?)\``,
  )
  const m = panelSrc.match(re)
  return m ? m[1] : null
}

/**
 * Viz-capable classic presets. Fingerprints must stay in sync with ClassicCodePanel.
 */
export const classicVizCases = [
  {
    name: '冒泡排序',
    fingerprint: 'int[] arr = {5, 3, 8, 1, 2};',
    build: () => intArrayStep([5, 3, 8, 1, 2], 'arr', { i: 1, j: 2 }, 'main'),
    expect: {
      badges: { arrays: 1, sort: 1, linkedLists: 0, trees: 0, graphs: 0 },
      sortMode: 'bars',
      arrayValues: [5, 3, 8, 1, 2],
    },
  },
  {
    name: '选择排序',
    fingerprint: 'int[] arr = {9, 6, 1, 4, 7};',
    build: () => intArrayStep([9, 6, 1, 4, 7], 'arr', { i: 1, j: 3 }, 'main'),
    expect: {
      badges: { arrays: 1, sort: 1, linkedLists: 0, trees: 0, graphs: 0 },
      sortMode: 'bars',
      arrayValues: [9, 6, 1, 4, 7],
    },
  },
  {
    name: '插入排序',
    fingerprint: 'int[] arr = {7, 2, 5, 1, 8};',
    build: () => intArrayStep([7, 2, 5, 1, 8], 'arr', { i: 2, j: 1 }, 'main'),
    expect: {
      badges: { arrays: 1, sort: 1, linkedLists: 0, trees: 0, graphs: 0 },
      // class InsertionSort + i/j → bars (insertion pattern wins)
      sortMode: 'bars',
      arrayValues: [7, 2, 5, 1, 8],
    },
  },
  {
    name: '快速排序',
    fingerprint: 'quickSort(arr, 0, arr.length - 1);',
    build: () => intArrayStep([8, 3, 5, 1, 9, 2], 'arr', { low: 0, high: 5, i: 1, j: 3 }, 'quickSort'),
    expect: {
      badges: { arrays: 1, sort: 1, linkedLists: 0, trees: 0, graphs: 0 },
      sortMode: 'array-pointers',
      arrayValues: [8, 3, 5, 1, 9, 2],
    },
  },
  {
    name: '归并排序',
    fingerprint: 'int[] arr = {8, 4, 5, 1, 3, 7, 6, 2};',
    build: () => intArrayStep([8, 4, 5, 1, 3, 7, 6, 2], 'arr', { left: 0, right: 7, mid: 3 }, 'mergeSort'),
    expect: {
      badges: { arrays: 1, sort: 1, linkedLists: 0, trees: 0, graphs: 0 },
      sortMode: 'merge-tree',
      arrayValues: [8, 4, 5, 1, 3, 7, 6, 2],
      mergePhase: 'divide',
    },
  },
  {
    name: '两数之和II',
    fingerprint: 'int[] nums = {2, 7, 11, 15};',
    build: () => intArrayStep([2, 7, 11, 15], 'nums', { left: 0, right: 3 }, 'main'),
    expect: {
      badges: { arrays: 1, sort: 1, linkedLists: 0, trees: 0, graphs: 0 },
      sortMode: 'array-pointers',
      arrayValues: [2, 7, 11, 15],
      pointers: { left: 0, right: 3 },
    },
  },
  {
    name: '盛最多水的容器',
    fingerprint: 'int[] height = {1, 8, 6, 2, 5, 4, 8, 3, 7};',
    build: () => intArrayStep([1, 8, 6, 2, 5, 4, 8, 3, 7], 'height', { left: 0, right: 8 }, 'main'),
    expect: {
      badges: { arrays: 1, sort: 1, linkedLists: 0, trees: 0, graphs: 0 },
      sortMode: 'array-pointers',
      arrayValues: [1, 8, 6, 2, 5, 4, 8, 3, 7],
    },
  },
  {
    name: '二分查找',
    fingerprint: 'int[] arr = {2, 5, 8, 12, 16, 23, 38, 45};',
    build: () => intArrayStep(
      [2, 5, 8, 12, 16, 23, 38, 45],
      'arr',
      { left: 0, right: 7, mid: 3 },
      'binarySearch',
    ),
    expect: {
      badges: { arrays: 1, sort: 1, linkedLists: 0, trees: 0, graphs: 0 },
      sortMode: 'array-pointers',
      arrayValues: [2, 5, 8, 12, 16, 23, 38, 45],
      pointers: { left: 0, right: 7, mid: 3 },
    },
  },
  {
    name: '岛屿数量',
    fingerprint: "char[][] grid = {",
    build: () => matrixStep(
      [
        ['1', '1', '0', '0', '0'],
        ['1', '1', '0', '0', '0'],
        ['0', '0', '1', '0', '0'],
        ['0', '0', '0', '1', '1'],
      ],
      'grid',
      { i: 0, j: 1 },
      'main',
      'char[][]',
    ),
    expect: {
      badges: { arrays: 1, sort: 0, linkedLists: 0, trees: 0, graphs: 0 },
      sortMode: null,
      matrix: { rows: 4, cols: 5, dims: 2 },
    },
  },
  {
    name: '网格最短路径',
    fingerprint: 'int[][] grid = {',
    build: () => matrixStep(
      [
        [0, 0, 0],
        [0, 1, 0],
        [0, 0, 0],
      ],
      'grid',
      { r: 0, c: 0 },
      'main',
    ),
    expect: {
      badges: { arrays: 1, sort: 0, linkedLists: 0, trees: 0, graphs: 0 },
      sortMode: null,
      matrix: { rows: 3, cols: 3, dims: 2 },
    },
  },
  {
    name: 'Dijkstra最短路径',
    fingerprint: 'int[][] edges = {',
    build: () => matrixStep(
      [
        [0, 1, 4],
        [0, 2, 1],
        [1, 3, 1],
        [2, 1, 2],
        [2, 3, 5],
        [3, 4, 3],
      ],
      'edges',
      {},
      'main',
    ),
    expect: {
      badges: { arrays: 1, sort: 0, linkedLists: 0, trees: 0, graphs: 0 },
      sortMode: null,
      matrix: { rows: 6, cols: 3, dims: 2 },
    },
  },
  {
    name: '编辑距离',
    fingerprint: 'String w1 = "horse";',
    build: () => matrixStep(
      [
        [0, 1, 2, 3],
        [1, 1, 2, 3],
        [2, 2, 1, 2],
        [3, 2, 2, 2],
        [4, 3, 3, 2],
        [5, 4, 4, 3],
      ],
      'dp',
      { i: 3, j: 2 },
      'main',
    ),
    expect: {
      badges: { arrays: 1, sort: 0, linkedLists: 0, trees: 0, graphs: 0 },
      sortMode: null,
      matrix: { rows: 6, cols: 4, dims: 2 },
    },
  },
  {
    name: 'KMP字符串匹配',
    fingerprint: 'String text = "ababcabcabababd";',
    build: () => kmpStep({
      text: 'ababcabcabababd',
      pattern: 'ababd',
      next: [0, 0, 1, 2, 0],
      i: 4,
      j: 2,
      mode: 'matching',
    }),
    expect: {
      badges: { arrays: 1, linkedLists: 0, trees: 0, graphs: 0, kmp: 1 },
      kmpMode: 'matching',
    },
  },
  {
    name: '最大子数组和',
    fingerprint: 'int[] nums = {-2, 1, -3, 4, -1, 2, 1, -5, 4};',
    // No index pointers → should be array DS only, not sort viz
    build: () => intArrayStep([-2, 1, -3, 4, -1, 2, 1, -5, 4], 'nums', {}, 'main'),
    expect: {
      badges: { arrays: 1, sort: 0, linkedLists: 0, trees: 0, graphs: 0 },
      sortMode: null,
      arrayValues: [-2, 1, -3, 4, -1, 2, 1, -5, 4],
    },
  },
  {
    name: '链表反转',
    fingerprint: 'ListNode head = new ListNode(1);',
    build: () => linkedListStep([1, 2, 3, 4, 5], {
      pointers: { prev: null, curr: 0 },
    }),
    expect: {
      badges: { arrays: 0, sort: 0, linkedLists: 1, trees: 0, graphs: 0 },
      sortMode: null,
      listValues: [1, 2, 3, 4, 5],
    },
  },
  {
    name: '环形链表检测',
    fingerprint: 'head.next.next.next.next = head.next; // 成环',
    build: () => linkedListStep([3, 2, 0, -4], {
      cyclicToIndex: 1,
      pointers: { slow: 0, fast: 0 },
    }),
    expect: {
      badges: { arrays: 0, sort: 0, linkedLists: 1, trees: 0, graphs: 0 },
      sortMode: null,
      listValues: [3, 2, 0, -4],
    },
  },
  {
    name: '二叉树遍历',
    fingerprint: 'TreeNode root = new TreeNode(1);',
    build: () => treeStep(
      [
        { id: 'r', val: 1, left: 'l', right: 'rt' },
        { id: 'l', val: 2, left: 'll', right: 'lr' },
        { id: 'rt', val: 3, left: null, right: null },
        { id: 'll', val: 4, left: null, right: null },
        { id: 'lr', val: 5, left: null, right: null },
      ],
      { pointers: { node: { ref: 'l' } } },
    ),
    expect: {
      badges: { arrays: 0, sort: 0, linkedLists: 0, trees: 1, graphs: 0 },
      sortMode: null,
      treeNodeCount: 5,
      treeRootOn: 'r',
      treeCurOn: 'l',
    },
  },
]

export function assertRecognition(result, expectSpec) {
  const {
    badges, sortMode, arrayValues, matrix, listValues, treeNodeCount,
    mergeLevelsMin, mergePhase, pointers, treeRootOn, treeCurOn, kmpMode,
  } = expectSpec

  if (badges) {
    expectEqualBadges(result.badges, badges)
  }

  if (sortMode === null) {
    if (result.sortViz !== null) {
      throw new Error(`expected no sortViz, got mode=${result.sortViz.mode}`)
    }
  } else if (sortMode != null) {
    if (!result.sortViz) throw new Error(`expected sortMode=${sortMode}, got null`)
    if (result.sortViz.mode !== sortMode) {
      throw new Error(`expected sortMode=${sortMode}, got ${result.sortViz.mode}`)
    }
  }

  if (kmpMode === null) {
    if (result.kmpViz !== null) {
      throw new Error(`expected no kmpViz, got mode=${result.kmpViz.mode}`)
    }
  } else if (kmpMode != null) {
    if (!result.kmpViz) throw new Error(`expected kmpMode=${kmpMode}, got null`)
    if (result.kmpViz.mode !== kmpMode) {
      throw new Error(`expected kmpMode=${kmpMode}, got ${result.kmpViz.mode}`)
    }
  }

  if (arrayValues) {
    const arr = result.arrays[0]
    if (!arr) throw new Error('expected an array')
    if (JSON.stringify(arr.values) !== JSON.stringify(arrayValues)) {
      throw new Error(`array values mismatch: ${JSON.stringify(arr.values)}`)
    }
  }

  if (matrix) {
    const arr = result.arrays[0]
    if (!arr || arr.dims !== 2) throw new Error('expected dims=2 matrix array')
    if (arr.rows !== matrix.rows || arr.cols !== matrix.cols) {
      throw new Error(`matrix size ${arr.rows}x${arr.cols}, expected ${matrix.rows}x${matrix.cols}`)
    }
  }

  if (listValues) {
    const ll = result.linkedLists[0]
    if (!ll) throw new Error('expected linked list')
    const vals = ll.nodes.map((n) => n.val)
    if (JSON.stringify(vals) !== JSON.stringify(listValues)) {
      throw new Error(`list values mismatch: ${JSON.stringify(vals)}`)
    }
  }

  if (treeNodeCount != null) {
    const tree = result.trees[0]
    if (!tree || tree.nodes.length !== treeNodeCount) {
      throw new Error(`expected ${treeNodeCount} tree nodes, got ${tree?.nodes?.length}`)
    }
  }

  if (treeRootOn != null) {
    const tree = result.trees[0]
    if (!tree) throw new Error('expected a tree for treeRootOn')
    if (tree.rootId !== treeRootOn) {
      throw new Error(`tree rootId: expected ${treeRootOn}, got ${tree.rootId}`)
    }
    const labels = tree.pointerLabels?.[treeRootOn] || []
    if (!labels.map((l) => String(l).toLowerCase()).includes('root')) {
      throw new Error(`expected root label on ${treeRootOn}, got ${JSON.stringify(labels)}`)
    }
  }

  if (treeCurOn != null) {
    const tree = result.trees[0]
    if (!tree) throw new Error('expected a tree for treeCurOn')
    const labels = tree.pointerLabels?.[treeCurOn] || []
    if (!labels.map((l) => String(l).toLowerCase()).includes('cur')) {
      throw new Error(`expected cur label on ${treeCurOn}, got ${JSON.stringify(labels)}`)
    }
  }

  if (mergeLevelsMin != null) {
    const n = result.sortViz?.mergeDynamic?.frames?.length
      ?? result.sortViz?.mergeLevels?.length
      ?? 0
    if (n < mergeLevelsMin) {
      throw new Error(`expected >=${mergeLevelsMin} merge frames/levels, got ${n}`)
    }
  }

  if (mergePhase != null) {
    const phase = result.sortViz?.mergeDynamic?.phase
    if (phase !== mergePhase) {
      throw new Error(`expected merge phase ${mergePhase}, got ${phase}`)
    }
  }

  if (pointers && result.sortViz) {
    for (const [k, v] of Object.entries(pointers)) {
      if (result.sortViz.pointers[k] !== v) {
        throw new Error(`pointer ${k}: expected ${v}, got ${result.sortViz.pointers[k]}`)
      }
    }
  }
}

function expectEqualBadges(actual, expected) {
  for (const key of Object.keys(expected)) {
    if (actual[key] !== expected[key]) {
      throw new Error(`badge ${key}: expected ${expected[key]}, got ${actual[key]}`)
    }
  }
}
