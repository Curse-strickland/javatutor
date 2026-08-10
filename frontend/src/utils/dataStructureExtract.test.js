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
    expect(linkedLists).toEqual([])
  })
})
