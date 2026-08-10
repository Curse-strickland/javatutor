const NODE_TYPE_PATTERN = /ListNode|LinkedList|(^Node$)/i

function hasListShape(fields) {
  const hasVal = Object.prototype.hasOwnProperty.call(fields, 'val')
    || Object.prototype.hasOwnProperty.call(fields, 'value')
  const next = fields.next
  const hasNext = next === null
    || (next && typeof next === 'object' && Object.prototype.hasOwnProperty.call(next, 'ref'))
  return hasVal && hasNext
}

function isListNodeCandidate(obj) {
  if (!obj || typeof obj !== 'object') return false
  const fields = obj.fields || {}
  // 即使 type 命中，也要求 val|value + next，避免 TreeNode 等误判
  if (NODE_TYPE_PATTERN.test(obj.type || '')) return hasListShape(fields)
  return hasListShape(fields)
}

function getVal(fields) {
  if (Object.prototype.hasOwnProperty.call(fields, 'val')) return fields.val
  if (Object.prototype.hasOwnProperty.call(fields, 'value')) return fields.value
  return undefined
}

function getNextRef(fields) {
  const next = fields.next
  if (next === null || next === undefined) return null
  if (typeof next === 'object' && next.ref != null) return next.ref
  return null
}

function collectNodeMap(heap) {
  const nodeMap = {}
  for (const key of Object.keys(heap || {})) {
    const obj = heap[key]
    if (!isListNodeCandidate(obj)) continue
    const id = obj.id || key
    const fields = obj.fields || {}
    const entry = {
      val: getVal(fields),
      nextId: getNextRef(fields),
    }
    nodeMap[id] = entry
    // 同时按 heap map key 索引，兼容 ref 指向 name 的情况
    if (key !== id) nodeMap[key] = entry
  }
  return nodeMap
}

function collectRootRefs(stackFrames, nodeIds) {
  const roots = []
  for (let i = 0; i < (stackFrames || []).length; i++) {
    const frame = stackFrames[i]
    for (const bucket of [frame.args || {}, frame.locals || {}]) {
      for (const [name, val] of Object.entries(bucket)) {
        const ref = resolveStackRef(val, nodeIds)
        if (ref) roots.push({ name, ref, frameDepth: i })
      }
    }
  }
  return roots
}

/** TraceEngine may store object locals as `{ref}` or bare heap id / name strings. */
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

function chainLength(rootId, nodeMap) {
  const visited = new Set()
  let currentId = rootId
  let length = 0
  while (currentId && nodeMap[currentId]) {
    if (visited.has(currentId)) break
    visited.add(currentId)
    length++
    currentId = nodeMap[currentId].nextId
  }
  return length
}

function pickRoot(roots, nodeMap) {
  if (!roots.length) return null

  let bestRef = null
  let bestLength = -1
  let bestHeadBonus = -1
  let bestDepth = -1

  for (const root of roots) {
    const length = chainLength(root.ref, nodeMap)
    const headBonus = /head/i.test(root.name) ? 1 : 0
    const better = length > bestLength
      || (length === bestLength && headBonus > bestHeadBonus)
      || (length === bestLength && headBonus === bestHeadBonus && root.frameDepth > bestDepth)

    if (better) {
      bestRef = root.ref
      bestLength = length
      bestHeadBonus = headBonus
      bestDepth = root.frameDepth
    }
  }

  return bestRef
}

function walkChain(rootId, nodeMap) {
  const nodes = []
  const visited = new Set()
  let currentId = rootId

  while (currentId && nodeMap[currentId]) {
    if (visited.has(currentId)) break
    visited.add(currentId)
    const { val, nextId } = nodeMap[currentId]
    const node = { id: currentId, val, next: nextId }
    if (nextId && visited.has(nextId)) {
      node._cycle = true
    }
    nodes.push(node)
    if (node._cycle) break
    currentId = nextId
  }

  return nodes
}

/** Walk a stack-rooted fragment that is not part of the main chain. Stops before entering mainIds. */
function walkDetachedChain(rootId, nodeMap, mainIds) {
  const nodes = []
  const visited = new Set()
  let currentId = rootId

  while (currentId && nodeMap[currentId] && !mainIds.has(currentId)) {
    if (visited.has(currentId)) break
    visited.add(currentId)
    const { val, nextId } = nodeMap[currentId]
    const node = {
      id: currentId,
      val,
      next: nextId,
      _detached: true,
    }
    if (nextId && visited.has(nextId)) {
      node._cycle = true
    }
    nodes.push(node)
    if (node._cycle) break
    // Points into main chain (e.g. about to splice) — keep next for arrow, stop walking
    if (nextId && mainIds.has(nextId)) break
    currentId = nextId
  }

  return nodes
}

function collectDetachedFragments(roots, nodeMap, mainIds, coveredIds) {
  const fragments = []
  for (const root of roots) {
    if (mainIds.has(root.ref) || coveredIds.has(root.ref)) continue
    const frag = walkDetachedChain(root.ref, nodeMap, mainIds)
    if (!frag.length) continue
    fragments.push(frag)
    for (const n of frag) coveredIds.add(n.id)
  }
  return fragments
}

function buildPointerLabels(stackFrames, chainNodeIds) {
  const labels = {}
  const seenVars = new Set()
  const frames = stackFrames || []

  for (let i = frames.length - 1; i >= 0; i--) {
    const frame = frames[i]
    for (const bucket of [frame.args || {}, frame.locals || {}]) {
      for (const [name, val] of Object.entries(bucket)) {
        if (seenVars.has(name)) continue
        const ref = resolveStackRef(val, chainNodeIds)
        if (!ref) continue
        seenVars.add(name)
        if (!labels[ref]) labels[ref] = []
        labels[ref].push(name)
      }
    }
  }

  return labels
}

function collectVarRefs(stackFrames, chainNodeIds) {
  const refs = {}
  const frames = stackFrames || []

  for (let i = frames.length - 1; i >= 0; i--) {
    const frame = frames[i]
    for (const bucket of [frame.args || {}, frame.locals || {}]) {
      for (const [name, val] of Object.entries(bucket)) {
        if (refs[name] !== undefined) continue
        const ref = resolveStackRef(val, chainNodeIds)
        if (ref) refs[name] = ref
      }
    }
  }

  return refs
}

function computeHighlights(stackFrames, prevStackFrames, chainNodeIds, allNodeIds) {
  const currRefs = collectVarRefs(stackFrames, chainNodeIds)

  // 第一步：高亮当前根指针所指节点（规格 §5.4）
  if (!prevStackFrames) {
    return [...new Set(Object.values(currRefs))]
  }

  const prevRefs = collectVarRefs(prevStackFrames, allNodeIds)
  const highlighted = []

  for (const [name, currRef] of Object.entries(currRefs)) {
    const prevRef = prevRefs[name]
    if (prevRef !== undefined && prevRef !== currRef && !highlighted.includes(currRef)) {
      highlighted.push(currRef)
    }
  }

  return highlighted
}

/**
 * @param {object} heap - currentHeap map (id/name keys → heap objects)
 * @param {Array} stackFrames - activeStackFrames
 * @param {object|null} prevHeap
 * @param {Array|null} prevStackFrames
 * @returns {{ nodes: Array<{id,val,next,_cycle?,_detached?,_frag?}>, pointerLabels: Record<string,string[]>, highlightedNodeIds: string[] }}
 */
export function extractLinkedListView(heap, stackFrames, prevHeap = null, prevStackFrames = null) {
  void prevHeap

  const nodeMap = collectNodeMap(heap)
  const nodeIds = new Set(Object.keys(nodeMap))

  if (nodeIds.size === 0) {
    return { nodes: [], pointerLabels: {}, highlightedNodeIds: [] }
  }

  const roots = collectRootRefs(stackFrames, nodeIds)
  const rootId = pickRoot(roots, nodeMap)
  if (!rootId) {
    return { nodes: [], pointerLabels: {}, highlightedNodeIds: [] }
  }

  const mainNodes = walkChain(rootId, nodeMap).map((n) => ({ ...n, _frag: 0 }))
  const mainIds = new Set(mainNodes.map((n) => n.id))
  const coveredIds = new Set(mainIds)

  const detachedFrags = collectDetachedFragments(roots, nodeMap, mainIds, coveredIds)
  const detachedNodes = []
  detachedFrags.forEach((frag, i) => {
    const fragIndex = i + 1
    for (const n of frag) {
      detachedNodes.push({ ...n, _frag: fragIndex })
    }
  })

  const nodes = [...mainNodes, ...detachedNodes]
  const visibleIds = new Set(nodes.map((n) => n.id))
  const pointerLabels = buildPointerLabels(stackFrames, visibleIds)
  const highlightedNodeIds = computeHighlights(stackFrames, prevStackFrames, visibleIds, nodeIds)

  return {
    nodes,
    pointerLabels,
    highlightedNodeIds,
  }
}
