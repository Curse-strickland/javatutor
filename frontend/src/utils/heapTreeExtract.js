/**
 * Synthesize a binary-tree view of an array-shaped heap for visualization.
 *
 * Heap sort stores the heap in an int[] using parent = (i-1)/2,
 * left = 2i+1, right = 2i+2. The first `heapSize` cells are the live heap;
 * cells `[heapSize..length)` are the sorted tail.
 *
 * Returns a tree object compatible with TreeCanvas, plus extra fields
 * (`fadedIndices`, `sortedStart`) the caller can pass to SortArrayCanvas.
 *
 * @param {number[]} values
 * @param {number} [heapSize] defaults to values.length
 * @param {Record<string, number>} [pointers]  live { i, j, left, right, l, r }
 * @returns {null | {
 *   nodes: Array<{id:string,val:any,layer:number}>,
 *   edges: Array<{from:string,to:string,side:'left'|'right'}>,
 *   highlightedPath: string[],
 *   pointerLabels: Record<string, string[]>,
 *   rootId: string,
 *   kind: 'heap',
 *   sortedStart: number,
 *   fadedIndices: number[],
 * }}
 */
export function buildHeapTreeFromArray(values, heapSize, pointers = {}) {
  if (!Array.isArray(values) || values.length === 0) return null

  const total = values.length
  const n = typeof heapSize === 'number' && heapSize >= 0 && heapSize <= total
    ? Math.floor(heapSize)
    : total
  const sortedStart = Math.max(0, Math.min(n, total))

  const nodes = []
  const edges = []
  const fadedIndices = []

  for (let i = 0; i < total; i++) {
    const layer = i === 0 ? 0 : Math.floor(Math.log2(i + 1))
    nodes.push({ id: String(i), val: values[i], layer })
    if (i >= sortedStart) fadedIndices.push(i)
    if (i > 0) {
      const parent = Math.floor((i - 1) / 2)
      edges.push({
        from: String(parent),
        to: String(i),
        side: i % 2 === 1 ? 'left' : 'right',
      })
    }
  }

  // Pointer → node label mapping
  const pointerLabels = {}
  const seen = new Set()
  for (const key of Object.keys(pointers || {})) {
    const idx = pointers[key]
    if (typeof idx !== 'number' || !Number.isInteger(idx)) continue
    if (idx < 0 || idx >= total) continue
    // Skip pointers landing on the sorted tail — they're stale or zero-initialized
    if (idx >= sortedStart) continue
    const id = String(idx)
    if (seen.has(`${id}:${key}`)) continue
    seen.add(`${id}:${key}`)
    if (!pointerLabels[id]) pointerLabels[id] = []
    pointerLabels[id].push(key)
  }

  // highlightedPath: only the deepest focus pointer (cur) lights up the node;
  // all chips still appear via pointerLabels so the user sees every active var.
  let highlight = null
  for (const key of ['i', 'cur', 'curr', 'current', 'node']) {
    if (typeof pointers[key] === 'number') {
      highlight = String(pointers[key])
      break
    }
  }

  return {
    nodes,
    edges,
    highlightedPath: highlight ? [highlight] : [],
    pointerLabels,
    rootId: '0',
    kind: 'heap',
    sortedStart,
    fadedIndices,
  }
}