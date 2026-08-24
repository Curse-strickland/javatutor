/**
 * Resolve the layout fragment for a node. An explicit `_frag` always wins;
 * otherwise each detached node gets its own unique (negative) fragment so a
 * detached singleton lands on its own row rather than sharing one with other
 * detached nodes, while every other node belongs to the main fragment 0.
 */
function fragOf(node, index) {
  if (node._frag != null) return node._frag
  if (node._detached) return -1 - index
  return 0
}

/**
 * Compute semantic canvas positions for linked-list nodes (wraps by colsPerRow).
 *
 * @param {Array<{id:string,_cycle?:boolean}>} nodes
 * @param {{
 *   nodeW?:number, nodeH?:number, gapX?:number, gapY?:number,
 *   padding?:number, baseY?:number, colsPerRow?:number, cycleLift?:number, arcPad?:number
 * }} [opts]
 * @returns {{ positions: Record<string,{x:number,y:number}>, width:number, height:number }}
 */
export function layoutLinkedList(nodes, opts = {}) {
  const {
    nodeW = 72,
    nodeH = 40,
    gapX = 36,
    gapY = 64,
    padding = 20,
    baseY = 56,
    colsPerRow = 3,
    cycleLift = 0,
    arcPad = 28,
  } = opts

  const positions = {}
  const stepX = nodeW + gapX
  const stepY = nodeH + gapY
  const cols = Math.max(1, colsPerRow)

  // Group by _frag (default 0); each fragment starts on a fresh row
  const fragOrder = []
  const fragGroups = new Map()
  for (let idx = 0; idx < nodes.length; idx++) {
    const node = nodes[idx]
    const frag = fragOf(node, idx)
    if (!fragGroups.has(frag)) {
      fragGroups.set(frag, [])
      fragOrder.push(frag)
    }
    fragGroups.get(frag).push(node)
  }

  let rowOffset = 0
  for (const frag of fragOrder) {
    const group = fragGroups.get(frag)
    for (let i = 0; i < group.length; i++) {
      const node = group[i]
      const col = i % cols
      const row = rowOffset + Math.floor(i / cols)
      const yBase = baseY + row * stepY
      const y = node._cycle ? yBase - cycleLift : yBase
      const nodeX = padding + col * stepX
      const nodeLayout = {
        x: nodeX,
        y,
        anchor: { x: nodeX + nodeW, y: y + nodeH / 2 },
        nextAnchor: { x: nodeX + nodeW, y: y + nodeH / 2 },
      }
      if ('prev' in node) {
        nodeLayout.prevAnchor = { x: nodeX, y: y + nodeH / 2 }
      }
      positions[node.id] = nodeLayout
    }
    const rowsUsed = Math.max(1, Math.ceil(group.length / cols))
    rowOffset += rowsUsed
  }

  let width
  if (nodes.length === 0) {
    width = padding * 2
  } else {
    // Always reserve a full row so short lists still feel open
    width = padding + (cols - 1) * stepX + nodeW + padding
  }

  let height
  if (nodes.length === 0) {
    height = baseY + nodeH + padding
  } else {
    const maxBottom = Math.max(
      ...Object.values(positions).map(({ y }) => y + nodeH),
    )
    const minY = Math.min(...Object.values(positions).map(({ y }) => y))
    // Leave headroom above the first row for back-edge arcs + pointer labels
    const topNeed = Math.max(0, arcPad + 8 - minY)
    height = maxBottom + padding + topNeed
  }

  return { positions, nodes: positions, width, height }
}

function dist(a, b) {
  return Math.hypot(b.x - a.x, b.y - a.y)
}

function cubicPoint(p0, p1, p2, p3, t) {
  const u = 1 - t
  return {
    x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
    y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y,
  }
}

function cubicLength(p0, p1, p2, p3, samples = 24) {
  let len = 0
  let prev = p0
  for (let i = 1; i <= samples; i++) {
    const pt = cubicPoint(p0, p1, p2, p3, i / samples)
    len += dist(prev, pt)
    prev = pt
  }
  return len
}

function roundPt(p) {
  return { x: Math.round(p.x), y: Math.round(p.y) }
}

/**
 * Build SVG path arrows that avoid cutting through nodes on wrap / cycle edges.
 *
 * @param {Array<{id:string,next?:string|null,_cycle?:boolean}>} nodes
 * @param {Record<string,{x:number,y:number}>} positions
 * @param {{ nodeW?:number, nodeH?:number, colsPerRow?:number, arcPad?:number }} [opts]
 * @returns {Array<{key:string,d:string,length:number,kind:'straight'|'wrap'|'arc'}>}
 */
export function buildLinkedListArrowPaths(nodes, positions, opts = {}) {
  const {
    nodeW = 72,
    nodeH = 40,
    colsPerRow = 3,
    arcPad = 28,
  } = opts

  const result = []
  if (!nodes || nodes.length < 2) return result

  const metaById = {}
  const fragLocal = new Map() // frag -> ids in order
  nodes.forEach((n, idx) => {
    if (n.id == null) return
    const frag = fragOf(n, idx)
    if (!fragLocal.has(frag)) fragLocal.set(frag, [])
    const localIdx = fragLocal.get(frag).length
    fragLocal.get(frag).push(n.id)
    metaById[n.id] = { frag, localIdx }
  })
  const nodeMap = {}
  nodes.forEach((n) => {
    if (n.id) nodeMap[n.id] = n
  })

  const cols = Math.max(1, colsPerRow)

  for (const cur of nodes) {
    if (!cur.next) continue
    const nxt = nodeMap[cur.next]
    if (!nxt) continue
    const fromPos = positions[cur.id]
    const toPos = positions[nxt.id]
    if (!fromPos || !toPos) continue

    const fromMeta = metaById[cur.id]
    const toMeta = metaById[nxt.id]
    if (!fromMeta || !toMeta) continue

    const sameFrag = fromMeta.frag === toMeta.frag
    const fromIdx = fromMeta.localIdx
    const toIdx = toMeta.localIdx
    const fromRow = Math.floor(fromIdx / cols)
    const toRow = Math.floor(toIdx / cols)
    const key = `${cur.id}->${cur.next}`

    const isConsecutive = sameFrag && toIdx === fromIdx + 1
    const isBack = !sameFrag || toIdx <= fromIdx || !!cur._cycle

    if (isConsecutive && fromRow === toRow) {
      const p0 = roundPt({ x: fromPos.x + nodeW, y: fromPos.y + nodeH / 2 })
      const p3 = roundPt({ x: toPos.x, y: toPos.y + nodeH / 2 })
      const d = `M ${p0.x} ${p0.y} L ${p3.x} ${p3.y}`
      result.push({ key, d, length: Math.ceil(dist(p0, p3)), kind: 'straight' })
      continue
    }

    if (isConsecutive && toRow === fromRow + 1) {
      const p0 = roundPt({ x: fromPos.x + nodeW / 2, y: fromPos.y + nodeH })
      const p3 = roundPt({ x: toPos.x + nodeW / 2, y: toPos.y })
      const midY = (p0.y + p3.y) / 2
      const p1 = roundPt({ x: p0.x, y: midY })
      const p2 = roundPt({ x: p3.x, y: midY })
      const d = `M ${p0.x} ${p0.y} C ${p1.x} ${p1.y}, ${p2.x} ${p2.y}, ${p3.x} ${p3.y}`
      result.push({
        key,
        d,
        length: Math.ceil(cubicLength(p0, p1, p2, p3)),
        kind: 'wrap',
      })
      continue
    }

    if (isBack || !isConsecutive) {
      let minY = Math.min(fromPos.y, toPos.y)
      for (const n of nodes) {
        const p = positions[n.id]
        if (p) minY = Math.min(minY, p.y)
      }
      // Cross-fragment link (insert preview): curve between rows instead of top arc only
      if (!sameFrag) {
        const p0 = roundPt({ x: fromPos.x + nodeW / 2, y: fromPos.y + nodeH })
        const p3 = roundPt({ x: toPos.x + nodeW / 2, y: toPos.y })
        const midY = (p0.y + p3.y) / 2
        const p1 = roundPt({ x: p0.x, y: midY })
        const p2 = roundPt({ x: p3.x, y: midY })
        const d = `M ${p0.x} ${p0.y} C ${p1.x} ${p1.y}, ${p2.x} ${p2.y}, ${p3.x} ${p3.y}`
        result.push({
          key,
          d,
          length: Math.ceil(cubicLength(p0, p1, p2, p3)),
          kind: 'arc',
        })
        continue
      }
      const arcY = Math.max(8, minY - arcPad)
      const p0 = roundPt({ x: fromPos.x + nodeW / 2, y: fromPos.y })
      const p3 = roundPt({ x: toPos.x + nodeW / 2, y: toPos.y })
      const p1 = roundPt({ x: p0.x, y: arcY })
      const p2 = roundPt({ x: p3.x, y: arcY })
      const d = `M ${p0.x} ${p0.y} C ${p1.x} ${p1.y}, ${p2.x} ${p2.y}, ${p3.x} ${p3.y}`
      result.push({
        key,
        d,
        length: Math.ceil(cubicLength(p0, p1, p2, p3)),
        kind: 'arc',
      })
      continue
    }

    const p0 = roundPt({ x: fromPos.x + nodeW, y: fromPos.y + nodeH / 2 })
    const p3 = roundPt({ x: toPos.x, y: toPos.y + nodeH / 2 })
    const d = `M ${p0.x} ${p0.y} L ${p3.x} ${p3.y}`
    result.push({ key, d, length: Math.ceil(dist(p0, p3)), kind: 'straight' })
  }

  return result
}

/**
 * Build SVG path arrows for doubly-linked list prev pointers (dashed lines).
 *
 * @param {Array<{id:string,prev?:string|null}>} nodes
 * @param {Record<string,{x:number,y:number,prevAnchor?:{x:number,y:number},nextAnchor?:{x:number,y:number},anchor?:{x:number,y:number}}>} positions
 * @param {{ nodeW?:number, nodeH?:number }} [opts]
 * @returns {Array<{key:string,d:string,length:number}>}
 */
export function buildPrevArrowPaths(nodes, positions, opts = {}) {
  const { nodeW = 72, nodeH = 40 } = opts

  const result = []
  if (!nodes || nodes.length < 2) return result

  const nodeMap = {}
  nodes.forEach((n) => {
    if (n.id) nodeMap[n.id] = n
  })

  for (const cur of nodes) {
    if (!cur.prev) continue
    const prevNode = nodeMap[cur.prev]
    if (!prevNode) continue

    const fromPos = positions[prevNode.id]
    const curPos = positions[cur.id]
    if (!fromPos || !curPos) continue

    const key = `${prevNode.id}<-${cur.id}`

    // From prev node's right edge to current node's left edge (prevAnchor)
    const fromAnchor = (fromPos.nextAnchor || fromPos.anchor || { x: fromPos.x + nodeW, y: fromPos.y + nodeH / 2 })
    const toAnchor = (curPos.prevAnchor || { x: curPos.x, y: curPos.y + nodeH / 2 })

    const p0 = roundPt(fromAnchor)
    const p3 = roundPt(toAnchor)
    const d = `M ${p0.x} ${p0.y} L ${p3.x} ${p3.y}`
    result.push({ key, d, length: Math.ceil(dist(p0, p3)) })
  }

  return result
}
