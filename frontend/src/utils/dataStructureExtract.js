import { extractLinkedListView } from './linkedListExtract.js'

const ARRAY_TYPE_PATTERN = /ArrayList|Stack|Queue|ArrayDeque/i

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
  for (let i = (stackFrames || []).length - 1; i >= 0; i--) {
    const f = stackFrames[i]
    for (const bucket of [f.args || {}, f.locals || {}]) {
      for (const [name, val] of Object.entries(bucket)) {
        if (val && typeof val === 'object' && val.ref === refId) return name
      }
    }
  }
  return null
}

function extractArrays(heap, stackFrames) {
  const arrays = []
  for (const [key, obj] of Object.entries(heap || {})) {
    if (!obj || typeof obj !== 'object') continue
    const type = obj.type || ''
    const fields = obj.fields || {}
    const sourceVar = findVarByRef(stackFrames, obj.id || key)
    if (ARRAY_TYPE_PATTERN.test(type) && Array.isArray(fields.elementData)) {
      arrays.push({
        id: obj.id || key,
        label: type,
        values: getArrayValues(heap, fields.elementData),
        headIndex: 0,
        tailIndex: fields.elementData.length - 1,
        sourceVar,
      })
    }
  }
  return arrays
}

/**
 * Enrich linked-list nodes with `prev` from the original heap objects.
 * extractLinkedListView only tracks val + next; we add prev for doubly-linked lists.
 */
function enrichNodesWithPrev(nodes, heap) {
  return nodes.map((node) => {
    const heapObj = heap[node.id]
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

export function extractDataStructures(heap, stackFrames, prevHeap = null, prevStackFrames = null) {
  // Linked lists: reuse extractLinkedListView, then enrich with prev for doubly detection
  const ll = extractLinkedListView(heap, stackFrames, prevHeap, prevStackFrames)
  const enrichedNodes = enrichNodesWithPrev(ll.nodes, heap)
  const enrichedLL = { ...ll, nodes: enrichedNodes }
  const doubly = enrichedNodes.some((n) => n.prev !== undefined && n.prev !== null)
  const linkedLists = enrichedNodes.length ? [{ ...enrichedLL, doubly }] : []

  // Arrays
  const arrays = extractArrays(heap, stackFrames)

  // Trees and graphs: placeholder for M2
  return { linkedLists, arrays, trees: [], graphs: [] }
}
