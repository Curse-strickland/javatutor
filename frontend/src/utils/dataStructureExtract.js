import { extractLinkedListView } from './linkedListExtract.js'

const ARRAY_TYPE_PATTERN = /ArrayList|Stack|Queue|ArrayDeque/i
const RAW_ARRAY_TYPE_PATTERN = /\[\]/
const INDEX_POINTER_PATTERN = /^(l|r|mid|left|right|i|j|low|high|start|end)$/i
const TREE_TYPE_PATTERN = /TreeNode|BinaryTree|(^Tree$)/i
const HEAP_TYPE_PATTERN = /Heap|PriorityQueue/i
const GRAPH_TYPE_PATTERN = /Graph|Network|Dinic|MaxFlow|Digraph|Directed/i
const FLOW_TYPE_PATTERN = /Flow|Dinic|MaxFlow/i
const DIRECTED_TYPE_PATTERN = /Digraph|Directed/i
const GRAPH_FIELD_NAMES = ['adj', 'graph', 'edges', 'matrix', 'capacity']
const SOURCE_VAR_PATTERN = /^(source|s)$/i
const SINK_VAR_PATTERN = /^(sink|t)$/i
const HIGHLIGHT_VAR_PATTERN = /^(cur|node|p|x)$/i
const ROOT_NAME_BONUS_PATTERN = /root|head|tree/i

function getVal(fields) {
  if (Object.prototype.hasOwnProperty.call(fields, 'val')) return fields.val
  if (Object.prototype.hasOwnProperty.call(fields, 'value')) return fields.value
  if (Object.prototype.hasOwnProperty.call(fields, 'data')) return fields.data
  return undefined
}

function getChildRef(field) {
  if (field === null || field === undefined) return null
  if (typeof field === 'object' && field.ref != null) return field.ref
  return null
}

function hasTreeShape(fields) {
  const hasVal = Object.prototype.hasOwnProperty.call(fields, 'val')
    || Object.prototype.hasOwnProperty.call(fields, 'value')
    || Object.prototype.hasOwnProperty.call(fields, 'data')
  const hasLeft = Object.prototype.hasOwnProperty.call(fields, 'left')
  const hasRight = Object.prototype.hasOwnProperty.call(fields, 'right')
  const hasNext = Object.prototype.hasOwnProperty.call(fields, 'next')
  if (hasNext && !hasLeft && !hasRight) return false
  if (!hasVal || (!hasLeft && !hasRight)) return false
  const left = fields.left
  const right = fields.right
  const leftOk = left === null || left === undefined
    || (typeof left === 'object' && Object.prototype.hasOwnProperty.call(left, 'ref'))
  const rightOk = right === null || right === undefined
    || (typeof right === 'object' && Object.prototype.hasOwnProperty.call(right, 'ref'))
  return leftOk && rightOk
}

function isTreeNodeCandidate(obj) {
  if (!obj || typeof obj !== 'object') return false
  const fields = obj.fields || {}
  if (TREE_TYPE_PATTERN.test(obj.type || '')) return hasTreeShape(fields)
  return hasTreeShape(fields)
}

function collectTreeNodeMap(heap) {
  const nodeMap = {}
  for (const key of Object.keys(heap || {})) {
    const obj = heap[key]
    if (!isTreeNodeCandidate(obj)) continue
    const id = obj.id || key
    const fields = obj.fields || {}
    const entry = {
      val: getVal(fields),
      leftId: getChildRef(fields.left),
      rightId: getChildRef(fields.right),
      type: obj.type || '',
    }
    nodeMap[id] = entry
    if (key !== id) nodeMap[key] = entry
  }
  return nodeMap
}

function resolveStackRef(val, nodeIds) {
  if (val == null) return null
  if (typeof val === 'object' && val.ref != null) {
    const r = String(val.ref)
    return nodeIds.has(r) ? r : null
  }
  if (typeof val === 'string' || typeof val === 'number') {
    const r = String(val)
    return nodeIds.has(r) ? r : null
  }
  return null
}

function collectTreeRootRefs(stackFrames, nodeIds, heap = null) {
  const roots = []
  for (let i = 0; i < (stackFrames || []).length; i++) {
    const frame = stackFrames[i]
    for (const bucket of [frame.args || {}, frame.locals || {}]) {
      for (const [name, val] of Object.entries(bucket)) {
        const ref = resolveStackRef(val, nodeIds)
        if (ref) {
          roots.push({ name, ref, frameDepth: i })
          continue
        }
        // 容器对象（如 RedBlackTree）上的 root 字段
        if (!heap || val == null) continue
        let container = null
        if (typeof val === 'object' && val.ref != null) container = heap[val.ref] || findHeapById(heap, val.ref)
        else if (typeof val === 'string' || typeof val === 'number') container = heap[val] || findHeapById(heap, val)
        const rootField = container?.fields?.root
        const rootRef = getChildRef(rootField)
        if (rootRef && nodeIds.has(String(rootRef))) {
          roots.push({ name: ROOT_NAME_BONUS_PATTERN.test(name) ? 'root' : name, ref: String(rootRef), frameDepth: i })
        }
      }
    }
  }
  return roots
}

function treeSize(rootId, nodeMap) {
  if (!rootId || !nodeMap[rootId]) return 0
  const visited = new Set()
  const stack = [rootId]
  let count = 0
  while (stack.length) {
    const id = stack.pop()
    if (!id || !nodeMap[id] || visited.has(id)) continue
    visited.add(id)
    count++
    const { leftId, rightId } = nodeMap[id]
    if (leftId) stack.push(leftId)
    if (rightId) stack.push(rightId)
  }
  return count
}

function rootNameScore(name) {
  const n = String(name || '').toLowerCase()
  if (n === 'root') return 3
  if (n.startsWith('root')) return 2
  if (/head|tree/.test(n)) return 1
  return 0
}

function pickTreeRoot(roots, nodeMap) {
  if (!roots.length) return null

  // Explicit `root` from the deepest frame wins — even if it points at a smaller subtree
  // after rotation / reassignment (size-first would stick to the old larger tree).
  let bestExplicit = null
  for (const root of roots) {
    if (String(root.name).toLowerCase() !== 'root') continue
    if (!bestExplicit || root.frameDepth > bestExplicit.frameDepth) bestExplicit = root
  }
  if (bestExplicit) return bestExplicit.ref

  let bestRef = null
  let bestSize = -1
  let bestNameScore = -1
  let bestDepth = -1

  for (const root of roots) {
    const size = treeSize(root.ref, nodeMap)
    const nameScore = rootNameScore(root.name)
    const better = nameScore > bestNameScore
      || (nameScore === bestNameScore && root.frameDepth > bestDepth)
      || (nameScore === bestNameScore && root.frameDepth === bestDepth && size > bestSize)

    if (better) {
      bestRef = root.ref
      bestSize = size
      bestNameScore = nameScore
      bestDepth = root.frameDepth
    }
  }

  return bestRef
}

function walkTree(rootId, nodeMap) {
  const nodes = []
  const edges = []
  if (!rootId || !nodeMap[rootId]) return { nodes, edges }

  const visited = new Set()
  const queue = [{ id: rootId, layer: 0 }]

  while (queue.length) {
    const { id, layer } = queue.shift()
    if (!nodeMap[id] || visited.has(id)) continue
    visited.add(id)

    const { val, leftId, rightId } = nodeMap[id]
    nodes.push({ id, val, left: leftId, right: rightId, layer })

    if (leftId && nodeMap[leftId]) {
      edges.push({ from: id, to: leftId, side: 'left' })
      queue.push({ id: leftId, layer: layer + 1 })
    }
    if (rightId && nodeMap[rightId]) {
      edges.push({ from: id, to: rightId, side: 'right' })
      queue.push({ id: rightId, layer: layer + 1 })
    }
  }

  return { nodes, edges }
}

function buildTreePointerLabels(stackFrames, treeNodeIds) {
  const labels = {}
  const seenVars = new Set()
  const frames = stackFrames || []

  for (let i = frames.length - 1; i >= 0; i--) {
    const frame = frames[i]
    for (const bucket of [frame.args || {}, frame.locals || {}]) {
      for (const [name, val] of Object.entries(bucket)) {
        if (seenVars.has(name)) continue
        const ref = resolveStackRef(val, treeNodeIds)
        if (!ref) continue
        seenVars.add(name)
        if (!labels[ref]) labels[ref] = []
        labels[ref].push(name)
      }
    }
  }

  return labels
}

/** Display aliases: curr/current/node → cur */
function normalizeTreeLabelName(name) {
  const lower = String(name).toLowerCase()
  if (lower === 'curr' || lower === 'current' || lower === 'node') return 'cur'
  if (lower === 'root') return 'root'
  return name
}

/**
 * Ensure the live root always shows `root`, cur aliases show as `cur`,
 * and stale `root` labels are stripped from non-root nodes.
 * Label order: root → cur → others (UI places root/cur above the node).
 */
function finalizeTreePointerLabels(pointerLabels, rootId) {
  const out = {}

  for (const [id, names] of Object.entries(pointerLabels || {})) {
    const normalized = []
    const seen = new Set()
    for (const name of names || []) {
      const n = normalizeTreeLabelName(name)
      const key = String(n).toLowerCase()
      if (seen.has(key)) continue
      seen.add(key)
      normalized.push(n)
    }
    out[id] = normalized
  }

  if (rootId) {
    if (!out[rootId]) out[rootId] = []
    const hasRoot = out[rootId].some((l) => String(l).toLowerCase() === 'root')
    if (!hasRoot) out[rootId] = ['root', ...out[rootId]]
  }

  for (const id of Object.keys(out)) {
    if (id === rootId) continue
    out[id] = out[id].filter((l) => String(l).toLowerCase() !== 'root')
    out[id] = orderTreePointerLabels(out[id])
  }
  if (rootId && out[rootId]) out[rootId] = orderTreePointerLabels(out[rootId])

  return out
}

function orderTreePointerLabels(names) {
  const root = []
  const cur = []
  const other = []
  for (const name of names || []) {
    const key = String(name).toLowerCase()
    if (key === 'root') root.push(name)
    else if (key === 'cur') cur.push(name)
    else other.push(name)
  }
  return [...root, ...cur, ...other]
}

function buildHighlightedPath(stackFrames, treeNodeIds) {
  // Only the deepest focus pointer (cur/node/…). Ancestor frames stay unstyled so
  // the tree is not painted all-red along the recursion path; cur/root chips carry meaning.
  const frames = stackFrames || []
  for (let i = frames.length - 1; i >= 0; i--) {
    const frame = frames[i]
    for (const bucket of [frame.args || {}, frame.locals || {}]) {
      for (const [name, val] of Object.entries(bucket)) {
        if (!HIGHLIGHT_VAR_PATTERN.test(name)) continue
        const ref = resolveStackRef(val, treeNodeIds)
        if (ref) return [ref]
      }
    }
  }
  return []
}

function inferTreeKind(nodeMap, rootId) {
  const visited = new Set()
  const stack = [rootId]
  while (stack.length) {
    const id = stack.pop()
    if (!id || !nodeMap[id] || visited.has(id)) continue
    visited.add(id)
    if (HEAP_TYPE_PATTERN.test(nodeMap[id].type || '')) return 'heap'
    const { leftId, rightId } = nodeMap[id]
    if (leftId) stack.push(leftId)
    if (rightId) stack.push(rightId)
  }
  return 'tree'
}

function buildTreeOrphans(stackFrames, nodeMap, walkedNodeIds) {
  const orphans = []
  const seen = new Set()
  const nodeIds = new Set(Object.keys(nodeMap))

  for (let i = (stackFrames || []).length - 1; i >= 0; i--) {
    const frame = stackFrames[i]
    for (const bucket of [frame.args || {}, frame.locals || {}]) {
      for (const [name, val] of Object.entries(bucket)) {
        const id = resolveStackRef(val, nodeIds)
        if (!id || !nodeMap[id] || walkedNodeIds.has(id) || seen.has(id)) continue
        seen.add(id)
        orphans.push({
          id,
          val: nodeMap[id].val,
          labels: [name],
        })
      }
    }
  }

  return orphans
}

function extractTrees(heap, stackFrames) {
  const nodeMap = collectTreeNodeMap(heap)
  const nodeIds = new Set(Object.keys(nodeMap))
  if (nodeIds.size === 0) return []

  const roots = collectTreeRootRefs(stackFrames, nodeIds, heap)
  const rootId = pickTreeRoot(roots, nodeMap)
  if (!rootId) return []

  const { nodes, edges } = walkTree(rootId, nodeMap)
  if (nodes.length < 2) return []

  const treeNodeIds = new Set(nodes.map((n) => n.id))
  const rawLabels = buildTreePointerLabels(stackFrames, treeNodeIds)
  const pointerLabels = finalizeTreePointerLabels(rawLabels, rootId)
  const highlightedPath = buildHighlightedPath(stackFrames, treeNodeIds)
  const orphans = buildTreeOrphans(stackFrames, nodeMap, treeNodeIds)
  const kind = inferTreeKind(nodeMap, rootId)

  return [{ nodes, edges, highlightedPath, pointerLabels, orphans, kind, rootId }]
}

/**
 * Walk an entry field (elementData, items, array) and resolve heap refs to values.
 */
function getArrayValues(heap, entryField) {
  const arr = []
  for (const slot of entryField) {
    if (slot && typeof slot === 'object' && slot.ref) {
      const obj = heap[slot.ref]
      const v = obj?.fields?.value ?? obj?.fields?.val ?? obj?.fields?.item ?? null
      arr.push(v)
    } else if (slot == null) {
      arr.push(null)
    } else {
      arr.push(slot)
    }
  }
  // Trim trailing nulls (ArrayList capacity padding)
  while (arr.length && arr[arr.length - 1] === null) {
    arr.pop()
  }
  return arr
}

function findVarByRef(stackFrames, refId) {
  const target = String(refId)
  for (let i = (stackFrames || []).length - 1; i >= 0; i--) {
    const f = stackFrames[i]
    for (const bucket of [f.args || {}, f.locals || {}]) {
      for (const [name, val] of Object.entries(bucket)) {
        if (val && typeof val === 'object' && val.ref != null && String(val.ref) === target) return name
        if ((typeof val === 'string' || typeof val === 'number') && String(val) === target) return name
        // TraceEngine often keys heap by var name and stores the name in locals for arrays
        if (typeof val === 'string' && val === name && name === refId) return name
      }
    }
  }
  return null
}

function getSlotsValues(heap, slots) {
  const arr = []
  for (const slot of slots) {
    if (slot && typeof slot === 'object') {
      // TraceEngine: { index, value }
      if (Object.prototype.hasOwnProperty.call(slot, 'value')) {
        arr.push(slot.value)
        continue
      }
      if (slot.ref) {
        const obj = heap[slot.ref] || findHeapById(heap, slot.ref)
        const v = obj?.fields?.value ?? obj?.fields?.val ?? obj?.fields?.item ?? null
        arr.push(v)
        continue
      }
    }
    if (slot == null) {
      arr.push(null)
    } else {
      arr.push(slot)
    }
  }
  while (arr.length && arr[arr.length - 1] === null) {
    arr.pop()
  }
  return arr
}

function findHeapById(heap, id) {
  if (!heap || id == null) return null
  if (heap[id]) return heap[id]
  const sid = String(id)
  for (const obj of Object.values(heap)) {
    if (obj && typeof obj === 'object' && String(obj.id) === sid) return obj
  }
  return null
}

function isRawArrayCandidate(obj) {
  if (!obj || typeof obj !== 'object') return false
  const type = obj.type || ''
  const fields = obj.fields || {}
  if (RAW_ARRAY_TYPE_PATTERN.test(type)) return true
  if (Array.isArray(obj.slots)) return true
  if (Array.isArray(fields.slots)) return true
  if (obj.category === 'array') return true
  return false
}

function collectArrayIndexPointers(stackFrames, arrayLength) {
  const indexPointers = {}
  const pointerLabels = {}
  const seenNames = new Set()

  for (let i = (stackFrames || []).length - 1; i >= 0; i--) {
    const frame = stackFrames[i]
    for (const bucket of [frame.args || {}, frame.locals || {}]) {
      for (const [name, val] of Object.entries(bucket)) {
        if (seenNames.has(name)) continue
        if (!INDEX_POINTER_PATTERN.test(name)) continue
        if (typeof val !== 'number' || !Number.isInteger(val)) continue
        if (val < 0 || val >= arrayLength) continue
        seenNames.add(name)
        const key = name.toLowerCase()
        indexPointers[key] = val
        if (!pointerLabels[val]) pointerLabels[val] = []
        pointerLabels[val].push(name)
      }
    }
  }

  return { indexPointers, pointerLabels }
}

function normalizeCell(cell) {
  if (cell == null) return null
  if (typeof cell === 'object' && Object.prototype.hasOwnProperty.call(cell, 'value')) {
    return normalizeCell(cell.value)
  }
  if (Array.isArray(cell)) return cell.map(normalizeCell)
  return cell
}

function tryAsMatrixRow(value) {
  if (value == null) return []
  if (Array.isArray(value)) return value.map(normalizeCell)
  return null
}

/**
 * Detect 2D matrix from 1D slot values whose elements are themselves arrays/lists.
 * @returns {null | { matrix: any[][], rows: number, cols: number }}
 */
function detectMatrix(values) {
  if (!Array.isArray(values) || values.length === 0) return null
  const rows = values.map(tryAsMatrixRow)
  if (!rows.every((r) => Array.isArray(r))) return null
  // At least one row must be non-empty; ragged OK
  if (!rows.some((r) => r.length > 0)) return null
  const cols = Math.max(0, ...rows.map((r) => r.length))
  if (cols < 1) return null
  return { matrix: rows, rows: rows.length, cols }
}

function buildArrayEntry(obj, key, heap, stackFrames, values) {
  if (values.length < 1) return null
  const sourceVar = findVarByRef(stackFrames, obj.id || key) || (typeof key === 'string' ? key : null)
  const matrixInfo = detectMatrix(values)

  if (matrixInfo) {
    const { indexPointers, cellLabels } = collectMatrixPointers(
      stackFrames,
      matrixInfo.rows,
      matrixInfo.cols,
    )
    return {
      id: obj.id || key,
      label: obj.type || 'array[][]',
      dims: 2,
      values: values,
      matrix: matrixInfo.matrix,
      rows: matrixInfo.rows,
      cols: matrixInfo.cols,
      // 二维只用表格内高亮，不再走一维指针条
      indexPointers,
      pointerLabels: cellLabels,
      sourceVar,
    }
  }

  const { indexPointers, pointerLabels } = collectArrayIndexPointers(stackFrames, values.length)

  return {
    id: obj.id || key,
    label: obj.type || 'array',
    dims: 1,
    values,
    indexPointers,
    pointerLabels,
    sourceVar,
  }
}

/**
 * Collect row/col indices and per-cell pointer labels for matrix highlight.
 * Focus cell = (rowPtr, colPtr); chips mimic 1D cur on that single cell (no row/col bands).
 */
function collectMatrixPointers(stackFrames, rowCount, colCount) {
  const indexPointers = {}
  const nameAt = {}
  const seen = new Set()

  for (let i = (stackFrames || []).length - 1; i >= 0; i--) {
    const frame = stackFrames[i]
    for (const bucket of [frame.args || {}, frame.locals || {}]) {
      for (const [name, val] of Object.entries(bucket)) {
        if (seen.has(name)) continue
        if (typeof val !== 'number' || !Number.isInteger(val)) continue
        const lower = name.toLowerCase()

        if (/^(i|row|r)$/.test(lower) && val >= 0 && val < rowCount) {
          seen.add(name)
          indexPointers[lower] = val
          nameAt[lower] = name
        } else if (/^(j|col|c)$/.test(lower) && val >= 0 && val < colCount) {
          seen.add(name)
          indexPointers[lower] = val
          nameAt[lower] = name
        }
      }
    }
  }

  const cellLabels = {}
  const r = indexPointers.i ?? indexPointers.row ?? indexPointers.r
  const c = indexPointers.j ?? indexPointers.col ?? indexPointers.c
  if (typeof r === 'number' && typeof c === 'number') {
    const key = `${r},${c}`
    const labels = ['cur']
    const rowName = nameAt.i || nameAt.row || nameAt.r
    const colName = nameAt.j || nameAt.col || nameAt.c
    if (rowName && !labels.includes(rowName)) labels.push(rowName)
    if (colName && !labels.includes(colName)) labels.push(colName)
    cellLabels[key] = labels
  }

  return { indexPointers, cellLabels }
}

/**
 * Live array snapshots from the deepest stack frame that still carries array locals.
 * TraceEngine deep-copies int[] into frame locals each record(); parent frames keep
 * stale copies under names like `arr` while the callee updates `a`.
 */
function isStackArrayData(val) {
  if (!Array.isArray(val) || val.length === 0) return false
  if (val.every((x) => x == null || typeof x === 'number')) return true
  if (val.every((x) => Array.isArray(x))) return true
  return false
}

function cloneStackArrayData(val) {
  if (val.every((x) => Array.isArray(x))) {
    return val.map((row) => (Array.isArray(row) ? row.slice() : row))
  }
  return val.slice()
}

function collectDeepestLiveArrays(stackFrames) {
  for (let fi = (stackFrames || []).length - 1; fi >= 0; fi--) {
    const frame = stackFrames[fi]
    const live = new Map()
    for (const bucket of [frame.locals || {}, frame.args || {}]) {
      for (const [name, val] of Object.entries(bucket)) {
        if (isStackArrayData(val)) live.set(name, cloneStackArrayData(val))
      }
    }
    if (live.size > 0) return live
  }
  return new Map()
}

function pickPrimaryLive1d(live) {
  const preferred = ['arr', 'a', 'nums', 'array', 'data']
  for (const name of preferred) {
    const vals = live.get(name)
    if (vals && vals.every((x) => x == null || typeof x === 'number')) {
      return { name, values: vals }
    }
  }
  for (const [name, vals] of live) {
    if (/^(tmp|temp|aux)$/i.test(name)) continue
    if (vals.every((x) => x == null || typeof x === 'number')) {
      return { name, values: vals }
    }
  }
  return null
}

function applyLiveArrayOverlay(entry, liveVals) {
  if (entry.dims === 2) {
    const matrixInfo = detectMatrix(liveVals)
    if (!matrixInfo) return entry
    return {
      ...entry,
      values: liveVals,
      matrix: matrixInfo.matrix,
      rows: matrixInfo.rows,
      cols: matrixInfo.cols,
    }
  }
  return { ...entry, values: liveVals.slice() }
}

function refreshArraysFromStack(arrays, stackFrames) {
  const live = collectDeepestLiveArrays(stackFrames)
  if (!live.size) return arrays

  const liveNames = new Set(live.keys())
  const primary1d = pickPrimaryLive1d(live)
  const aliasPattern = /^(arr|array|nums|a|data)$/i

  const refreshed = arrays.map((arr) => {
    const candidates = [arr.sourceVar, arr.id].filter(Boolean).map(String)
    for (const name of candidates) {
      if (live.has(name)) return applyLiveArrayOverlay(arr, live.get(name))
    }
    // Stale main `arr` while callee updates `a`: sync values from primary live
    if (
      arr.dims !== 2
      && primary1d
      && arr.values?.length === primary1d.values.length
      && candidates.some((n) => aliasPattern.test(n))
    ) {
      return applyLiveArrayOverlay(arr, primary1d.values)
    }
    return arr
  })

  // Drop stale 1D alias strips only when a same-length live sibling is already shown
  const deduped = refreshed.filter((arr) => {
    if (arr.dims === 2) return true
    const name = String(arr.sourceVar || arr.id || '')
    if (liveNames.has(name)) return true
    if (!aliasPattern.test(name)) return true
    const hasLiveSibling = refreshed.some((other) => {
      if (other === arr || other.dims === 2) return false
      const on = String(other.sourceVar || other.id || '')
      return liveNames.has(on) && other.values?.length === arr.values?.length
    })
    return !hasLiveSibling
  })

  // If TraceEngine only kept a stale heap key, still surface live stack arrays
  for (const [name, vals] of live) {
    const already = deduped.some(
      (arr) => String(arr.sourceVar || '') === name || String(arr.id || '') === name,
    )
    if (already) continue
    const fakeObj = { id: name, type: Array.isArray(vals[0]) ? 'int[][]' : 'int[]' }
    const entry = buildArrayEntry(fakeObj, name, {}, stackFrames, vals)
    if (entry) deduped.push(entry)
  }

  return deduped
}

function extractArrays(heap, stackFrames) {
  const arrays = []
  const seenIds = new Set()

  for (const [key, obj] of Object.entries(heap || {})) {
    if (!obj || typeof obj !== 'object') continue
    const type = obj.type || ''
    const fields = obj.fields || {}
    const id = obj.id || key

    if (ARRAY_TYPE_PATTERN.test(type) && Array.isArray(fields.elementData)) {
      const values = getArrayValues(heap, fields.elementData)
      const entry = buildArrayEntry(obj, key, heap, stackFrames, values)
      if (entry && !seenIds.has(id)) {
        seenIds.add(id)
        arrays.push(entry)
      }
      continue
    }

    if (isRawArrayCandidate(obj)) {
      const slots = Array.isArray(obj.slots)
        ? obj.slots
        : (Array.isArray(fields.slots) ? fields.slots : null)
      if (!slots) continue
      const values = getSlotsValues(heap, slots)
      const entry = buildArrayEntry(obj, key, heap, stackFrames, values)
      if (entry && !seenIds.has(id)) {
        seenIds.add(id)
        arrays.push(entry)
      }
    }
  }

  return refreshArraysFromStack(arrays, stackFrames)
}

/**
 * Enrich linked-list nodes with `prev` from the original heap objects.
 * extractLinkedListView only tracks val + next; we add prev for doubly-linked lists.
 */
function enrichNodesWithPrev(nodes, heap) {
  return nodes.map((node) => {
    const heapObj = findHeapById(heap, node.id) || heap[node.id]
    if (!heapObj || !heapObj.fields) return node
    const fields = heapObj.fields
    if (!('prev' in fields)) return node
    const prevField = fields.prev
    if (prevField && typeof prevField === 'object' && prevField.ref != null) {
      return { ...node, prev: prevField.ref }
    }
    return { ...node, prev: null }
  })
}

function resolveNodeId(value) {
  if (value === null || value === undefined) return null
  if (typeof value === 'object' && value.ref != null) return String(value.ref)
  return String(value)
}

function parseEdgeEndpoint(fields, keys) {
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(fields, key)) continue
    const resolved = resolveNodeId(fields[key])
    if (resolved) return resolved
  }
  return null
}

function parseEdgeWeight(entry) {
  if (!entry || typeof entry !== 'object') return undefined
  const w = entry.w ?? entry.weight ?? entry.cap ?? entry.capacity
  return w !== undefined && w !== null ? w : undefined
}

function parseEdgeTarget(entry) {
  if (entry === null || entry === undefined) return null
  if (typeof entry === 'string' || typeof entry === 'number') return String(entry)
  if (typeof entry !== 'object') return null
  if (entry.to != null) return resolveNodeId(entry.to)
  if (entry.v != null) return resolveNodeId(entry.v)
  if (entry.target != null) return resolveNodeId(entry.target)
  if (entry.ref != null) return String(entry.ref)
  return null
}

function isGraphContainer(obj) {
  if (!obj || typeof obj !== 'object') return false
  const type = obj.type || ''
  const fields = obj.fields || {}
  if (TREE_TYPE_PATTERN.test(type) && hasTreeShape(fields)) return false
  if (/ListNode/i.test(type)) return false
  if (ARRAY_TYPE_PATTERN.test(type)) return false
  if (GRAPH_TYPE_PATTERN.test(type)) return true
  return GRAPH_FIELD_NAMES.some((name) => Object.prototype.hasOwnProperty.call(fields, name))
}

function nodeValFromHeap(heap, nodeId) {
  const obj = heap?.[nodeId]
  if (!obj || typeof obj !== 'object') return nodeId
  const fields = obj.fields || {}
  const val = getVal(fields)
  return val !== undefined ? val : nodeId
}

function addEdge(edgeMap, from, to, weight, directed) {
  if (!from || !to || from === to) return
  const key = directed ? `${from}->${to}` : [from, to].sort().join('--')
  if (edgeMap.has(key)) return
  const edge = { from, to }
  if (weight !== undefined) edge.weight = weight
  if (directed) edge.directed = true
  edgeMap.set(key, edge)
}

function parseAdjList(adj, heap, edgeMap, directed) {
  if (!adj || typeof adj !== 'object' || Array.isArray(adj)) return
  for (const [fromKey, neighbors] of Object.entries(adj)) {
    const from = resolveNodeId(fromKey)
    if (!from) continue
    const list = Array.isArray(neighbors) ? neighbors : []
    for (const entry of list) {
      const to = parseEdgeTarget(entry)
      if (!to) continue
      addEdge(edgeMap, from, to, parseEdgeWeight(entry), directed)
    }
  }
}

function parseEdgeList(edges, edgeMap, directed) {
  if (!Array.isArray(edges)) return
  for (const entry of edges) {
    if (!entry || typeof entry !== 'object') continue
    const from = parseEdgeEndpoint(entry, ['from', 'u', 'src', 'source'])
    const to = parseEdgeEndpoint(entry, ['to', 'v', 'dst', 'target', 'dest'])
    if (!from || !to) continue
    const isDirected = directed || entry.directed === true
    addEdge(edgeMap, from, to, parseEdgeWeight(entry), isDirected)
  }
}

function parseCapacityMatrix(matrix, edgeMap, directed) {
  if (!matrix || typeof matrix !== 'object') return
  const keys = Object.keys(matrix)
  for (const fromKey of keys) {
    const row = matrix[fromKey]
    if (!row || typeof row !== 'object') continue
    for (const toKey of Object.keys(row)) {
      const cap = row[toKey]
      if (cap === null || cap === undefined || cap === 0) continue
      addEdge(edgeMap, resolveNodeId(fromKey), resolveNodeId(toKey), cap, directed)
    }
  }
}

function collectGraphNodeIds(edgeMap) {
  const ids = new Set()
  for (const edge of edgeMap.values()) {
    ids.add(edge.from)
    ids.add(edge.to)
  }
  return ids
}

function resolveEndpointField(fields, keys) {
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(fields, key)) continue
    return resolveNodeId(fields[key])
  }
  return null
}

function findFlowEndpoints(stackFrames, graphId, fields) {
  let source = resolveEndpointField(fields, ['source', 's'])
  let sink = resolveEndpointField(fields, ['sink', 't'])

  for (let i = (stackFrames || []).length - 1; i >= 0; i--) {
    const frame = stackFrames[i]
    for (const bucket of [frame.args || {}, frame.locals || {}]) {
      for (const [name, val] of Object.entries(bucket)) {
        if (!val || typeof val !== 'object' || val.ref == null) continue
        if (SOURCE_VAR_PATTERN.test(name)) source = String(val.ref)
        if (SINK_VAR_PATTERN.test(name)) sink = String(val.ref)
      }
    }
  }

  return { source, sink }
}

function inferGraphKind(directed, isFlow, source, sink) {
  if (isFlow || source || sink) return 'flow'
  if (directed) return 'directed'
  return 'undirected'
}

/**
 * Expected heap shapes for graph extraction (TraceEngine-style):
 *
 * 1. Adjacency-list container:
 *    { id:'g', type:'Graph', fields:{ adj:{ '1':[{to:'2',w:6}], ... } } }
 *
 * 2. Edge-list container:
 *    { type:'Digraph', fields:{ edges:[{from:'a',to:'b',weight:1,directed:true}] } }
 *
 * 3. Flow / capacity:
 *    { type:'MaxFlow', fields:{ source, sink, capacity:{...} } }
 *
 * Node ids come from adj keys and edge endpoints; vals resolve from heap objects when present.
 */
function extractGraphs(heap, stackFrames) {
  const graphs = []

  for (const [key, obj] of Object.entries(heap || {})) {
    if (!isGraphContainer(obj)) continue

    const id = obj.id || key
    const type = obj.type || 'Graph'
    const fields = obj.fields || {}
    const sourceVar = findVarByRef(stackFrames, id)

    const hasCapacityMatrix = Object.prototype.hasOwnProperty.call(fields, 'capacity')
      || Object.prototype.hasOwnProperty.call(fields, 'matrix')
    let directed = DIRECTED_TYPE_PATTERN.test(type)
      || hasCapacityMatrix
      || (Array.isArray(fields.edges) && fields.edges.some((e) => e?.directed === true))

    const edgeMap = new Map()

    if (fields.adj) parseAdjList(fields.adj, heap, edgeMap, directed)
    if (fields.graph) parseAdjList(fields.graph, heap, edgeMap, directed)
    if (fields.edges) parseEdgeList(fields.edges, edgeMap, directed)
    if (fields.capacity) parseCapacityMatrix(fields.capacity, edgeMap, true)
    if (fields.matrix) parseCapacityMatrix(fields.matrix, edgeMap, directed || hasCapacityMatrix)

    if (edgeMap.size === 0) continue

    const nodeIds = collectGraphNodeIds(edgeMap)
    if (nodeIds.size < 2) continue

    const isFlow = FLOW_TYPE_PATTERN.test(type)
    const { source, sink } = findFlowEndpoints(stackFrames, id, fields)
    const kind = inferGraphKind(directed, isFlow, source, sink)

    if (kind === 'undirected') directed = false

    const nodes = [...nodeIds].map((nodeId) => {
      const node = {
        id: nodeId,
        val: nodeValFromHeap(heap, nodeId),
      }
      if (/^\d+$/.test(nodeId)) {
        node.index = Number(nodeId)
      }
      return node
    })

    const edges = [...edgeMap.values()]

    graphs.push({
      id,
      label: sourceVar || type,
      nodes,
      edges,
      directed,
      source,
      sink,
      kind,
    })
  }

  return graphs
}

export function extractDataStructures(heap, stackFrames, prevHeap = null, prevStackFrames = null) {
  // Linked lists: reuse extractLinkedListView, then enrich with prev for doubly detection
  const ll = extractLinkedListView(heap, stackFrames, prevHeap, prevStackFrames)
  const enrichedNodes = enrichNodesWithPrev(ll.nodes, heap)
  const enrichedLL = { ...ll, nodes: enrichedNodes }
  const doubly = enrichedNodes.some((n) => 'prev' in n)
  const linkedLists = enrichedNodes.length ? [{ ...enrichedLL, doubly }] : []

  // Arrays
  const arrays = extractArrays(heap, stackFrames)

  // Trees
  const trees = extractTrees(heap, stackFrames)

  // Graphs
  const graphs = extractGraphs(heap, stackFrames)

  return { linkedLists, arrays, trees, graphs }
}
