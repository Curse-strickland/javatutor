import { describe, it, expect } from 'vitest'
import { extractLinkedListView } from './linkedListExtract.js'

describe('extractLinkedListView', () => {
  it('returns empty when heap has no list nodes', () => {
    const heap = {
      arr0: { id: 'H1', type: 'int[]', fields: {}, slots: [1, 2] },
    }
    expect(extractLinkedListView(heap, [])).toEqual({
      nodes: [],
      pointerLabels: {},
      highlightedNodeIds: [],
    })
  })

  it('builds a linear chain from head', () => {
    const heap = {
      n1: {
        id: 'N1', type: 'ListNode',
        fields: { val: 1, next: { ref: 'N2' } },
      },
      n2: {
        id: 'N2', type: 'ListNode',
        fields: { val: 2, next: null },
      },
    }
    const frames = [{
      method: 'reverse',
      locals: { head: { ref: 'N1' } },
      args: {},
    }]
    const view = extractLinkedListView(heap, frames)
    expect(view.nodes.map(n => n.id)).toEqual(['N1', 'N2'])
    expect(view.nodes[0]).toMatchObject({ id: 'N1', val: 1, next: 'N2' })
    expect(view.nodes[1]).toMatchObject({ id: 'N2', val: 2, next: null })
    expect(view.pointerLabels.N1).toContain('head')
  })

  it('marks cycle and stops', () => {
    const heap = {
      a: { id: 'A', type: 'ListNode', fields: { val: 1, next: { ref: 'B' } } },
      b: { id: 'B', type: 'ListNode', fields: { val: 2, next: { ref: 'A' } } },
    }
    const frames = [{ method: 'f', locals: { head: { ref: 'A' } }, args: {} }]
    const view = extractLinkedListView(heap, frames)
    expect(view.nodes.some(n => n._cycle)).toBe(true)
    expect(view.nodes.length).toBeLessThanOrEqual(2)
  })

  it('prefers longer chain as main and keeps other stack roots as detached', () => {
    const heap = {
      a: { id: 'A', type: 'ListNode', fields: { val: 1, next: null } },
      b: { id: 'B', type: 'ListNode', fields: { val: 1, next: { ref: 'C' } } },
      c: { id: 'C', type: 'ListNode', fields: { val: 2, next: null } },
    }
    const frames = [{
      method: 'f',
      locals: { shortHead: { ref: 'A' }, head: { ref: 'B' } },
      args: {},
    }]
    const view = extractLinkedListView(heap, frames)
    expect(view.nodes.filter((n) => !n._detached).map((n) => n.id)).toEqual(['B', 'C'])
    expect(view.nodes.filter((n) => n._detached).map((n) => n.id)).toEqual(['A'])
    expect(view.pointerLabels.A).toContain('shortHead')
  })

  it('shows a newly created singleton on a detached fragment', () => {
    const heap = {
      h: { id: 'H', type: 'ListNode', fields: { val: 1, next: { ref: 'T' } } },
      t: { id: 'T', type: 'ListNode', fields: { val: 2, next: null } },
      n: { id: 'N', type: 'ListNode', fields: { val: 9, next: null } },
    }
    const frames = [{
      method: 'insert',
      locals: { head: { ref: 'H' }, node: { ref: 'N' } },
      args: {},
    }]
    const view = extractLinkedListView(heap, frames)
    expect(view.nodes.filter((n) => !n._detached).map((n) => n.id)).toEqual(['H', 'T'])
    expect(view.nodes.filter((n) => n._detached)).toEqual([
      expect.objectContaining({ id: 'N', val: 9, next: null, _detached: true, _frag: 1 }),
    ])
  })

  it('does not show a singleton once it is inserted into the main chain', () => {
    const heap = {
      h: { id: 'H', type: 'ListNode', fields: { val: 1, next: { ref: 'N' } } },
      n: { id: 'N', type: 'ListNode', fields: { val: 9, next: { ref: 'T' } } },
      t: { id: 'T', type: 'ListNode', fields: { val: 2, next: null } },
    }
    const frames = [{
      method: 'insert',
      locals: { head: { ref: 'H' }, node: { ref: 'N' } },
      args: {},
    }]
    const view = extractLinkedListView(heap, frames)
    expect(view.nodes.map((n) => n.id)).toEqual(['H', 'N', 'T'])
    expect(view.nodes.every((n) => !n._detached)).toBe(true)
  })

  it('highlights nodes whose pointer target changed', () => {
    const heap = {
      a: { id: 'A', type: 'ListNode', fields: { val: 1, next: { ref: 'B' } } },
      b: { id: 'B', type: 'ListNode', fields: { val: 2, next: null } },
    }
    const prevFrames = [{ method: 'f', locals: { curr: { ref: 'A' } }, args: {} }]
    const frames = [{ method: 'f', locals: { curr: { ref: 'B' } }, args: {} }]
    const view = extractLinkedListView(heap, frames, heap, prevFrames)
    expect(view.highlightedNodeIds).toContain('B')
  })

  it('accepts value field alias', () => {
    const heap = {
      n: { id: 'N', type: 'Node', fields: { value: 9, next: null } },
    }
    const frames = [{ method: 'f', locals: { head: { ref: 'N' } }, args: {} }]
    const view = extractLinkedListView(heap, frames)
    expect(view.nodes[0].val).toBe(9)
  })

  it('highlights root pointers on first step', () => {
    const heap = {
      a: { id: 'A', type: 'ListNode', fields: { val: 1, next: null } },
    }
    const frames = [{ method: 'f', locals: { head: { ref: 'A' } }, args: {} }]
    const view = extractLinkedListView(heap, frames)
    expect(view.highlightedNodeIds).toContain('A')
  })

  it('resolves TraceEngine string heap ids on the stack', () => {
    const heap = {
      head: { id: '0x10', type: 'ListNode', fields: { val: 1, next: { ref: '0x20' } } },
      n2: { id: '0x20', type: 'ListNode', fields: { val: 2, next: null } },
    }
    const frames = [{ method: 'main', locals: { head: '0x10' }, args: {} }]
    const view = extractLinkedListView(heap, frames)
    expect(view.nodes.map((n) => n.id)).toEqual(['0x10', '0x20'])
    expect(view.pointerLabels['0x10']).toContain('head')
  })

  it('ignores TreeNode without list shape', () => {
    const heap = {
      t: { id: 'T', type: 'TreeNode', fields: { val: 1, left: null, right: null } },
    }
    const frames = [{ method: 'f', locals: { root: { ref: 'T' } }, args: {} }]
    const view = extractLinkedListView(heap, frames)
    expect(view.nodes).toEqual([])
  })
})
