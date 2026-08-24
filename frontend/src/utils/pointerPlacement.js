/**
 * When multiple pointer chips share one cell/node, place odd/even
 * slots above and below to avoid overlap.
 */

/**
 * @param {string[]} labels
 * @returns {{ above: string[], below: string[] }}
 */
export function splitLabelsAboveBelow(labels) {
  const above = []
  const below = []
  for (let i = 0; i < (labels || []).length; i++) {
    if (i % 2 === 0) above.push(labels[i])
    else below.push(labels[i])
  }
  return { above, below }
}

/**
 * Tree/heap: keep `root` and `cur` above the node (yellow cur / red root chips).
 * Remaining labels alternate; prefer parking extras below first.
 * @param {string[]} labels
 * @returns {{ above: string[], below: string[] }}
 */
export function splitTreeLabelsAboveBelow(labels) {
  const above = []
  const rest = []
  for (const label of labels || []) {
    const key = String(label).toLowerCase()
    if (key === 'root' || key === 'cur') above.push(label)
    else rest.push(label)
  }
  // Visual order on top: root then cur
  above.sort((a, b) => {
    const rank = (x) => (String(x).toLowerCase() === 'root' ? 0 : 1)
    return rank(a) - rank(b)
  })
  const below = []
  for (let i = 0; i < rest.length; i++) {
    if (i % 2 === 0) below.push(rest[i])
    else above.push(rest[i])
  }
  return { above, below }
}

/**
 * Deterministic 32-bit hash of a cell index (FNV-1a). Stable across renders,
 * so the same cell always resolves to the same above/below side.
 * @param {number} n
 * @returns {number}
 */
export function stableHash(n) {
  let h = 2166136261
  const s = String(n == null ? '' : n)
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/**
 * Per-cell placement for the「展示的变量」chip layout:
 *   1 chip → above; 2 chips → below; 3+ chips → overlap on one side,
 *   side chosen by stable pseudo-random hash of the cell index.
 * All chips in the same cell share the same placement.
 * @param {Array<{ index: number }>} entries
 * @returns {Array<{ placement: 'above'|'below' }>}
 */
export function withCellPlacement(entries) {
  const list = entries || []
  const countByIndex = Object.create(null)
  for (const e of list) {
    const k = e.index
    countByIndex[k] = (countByIndex[k] || 0) + 1
  }
  return list.map((entry) => {
    const count = countByIndex[entry.index] || 0
    let placement
    if (count <= 1) placement = 'above'
    else if (count === 2) placement = 'below'
    else placement = stableHash(entry.index) % 2 === 0 ? 'above' : 'below'
    return { ...entry, placement }
  })
}
