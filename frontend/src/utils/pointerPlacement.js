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
 * Annotate pointer entries that share the same `index` with placement.
 * First → above, second → below, third → above, …
 * @param {Array<{ index: number }>} entries
 * @returns {Array}
 */
export function withVerticalPlacement(entries) {
  const seen = Object.create(null)
  return (entries || []).map((entry) => {
    const idx = entry.index
    const slot = seen[idx] || 0
    seen[idx] = slot + 1
    return {
      ...entry,
      slot,
      placement: slot % 2 === 0 ? 'above' : 'below',
    }
  })
}
