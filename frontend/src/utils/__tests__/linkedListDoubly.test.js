import { describe, it, expect } from 'vitest'
import { layoutLinkedList, buildPrevArrowPaths } from '../linkedListLayout.js'

describe('doubly linked list layout', () => {
  it('positions prev arrow anchor on left cell', () => {
    const nodes = [
      { id: 'a', val: 1, prev: null, next: 'b' },
      { id: 'b', val: 2, prev: 'a', next: 'c' },
      { id: 'c', val: 3, prev: 'b', next: null },
    ]
    const layout = layoutLinkedList(nodes, { nodeW: 100, nodeH: 50 })
    expect(layout.nodes.b.prevAnchor).toBeDefined()
    expect(layout.nodes.b.nextAnchor).toBeDefined()
    expect(layout.nodes.b.prevAnchor.x).toBeLessThan(layout.nodes.b.nextAnchor.x)
  })

  it('buildPrevArrowPaths generates paths for prev links', () => {
    const nodes = [
      { id: 'a', val: 1, prev: null, next: 'b' },
      { id: 'b', val: 2, prev: 'a', next: 'c' },
      { id: 'c', val: 3, prev: 'b', next: null },
    ]
    const { positions } = layoutLinkedList(nodes, { nodeW: 100, nodeH: 50 })
    const arrows = buildPrevArrowPaths(nodes, positions)

    // b.prev = 'a' and c.prev = 'b', so 2 prev arrows
    expect(arrows).toHaveLength(2)

    // Keys should use '<-' to distinguish from next arrows
    const keys = arrows.map((a) => a.key)
    expect(keys).toContain('a<-b')
    expect(keys).toContain('b<-c')

    // Each path should be a valid SVG d string starting with M
    for (const a of arrows) {
      expect(a.d.startsWith('M')).toBe(true)
    }
  })
})
