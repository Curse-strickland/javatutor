import { describe, it, expect } from 'vitest'
import { layoutLinkedList, buildLinkedListArrowPaths } from './linkedListLayout.js'

const DEFAULTS = {
  nodeW: 72,
  nodeH: 40,
  gapX: 36,
  gapY: 64,
  padding: 20,
  baseY: 56,
  colsPerRow: 3,
  cycleLift: 0,
  arcPad: 28,
}

describe('layoutLinkedList', () => {
  it('returns empty positions and minimal dimensions for empty array', () => {
    const result = layoutLinkedList([])
    expect(result.positions).toEqual({})
    expect(result.width).toBe(DEFAULTS.padding * 2)
    expect(result.height).toBe(DEFAULTS.baseY + DEFAULTS.nodeH + DEFAULTS.padding)
  })

  it('lays out a 3-node linear chain on one row with increasing x and same baseY', () => {
    const nodes = [{ id: 'A' }, { id: 'B' }, { id: 'C' }]
    const { nodeW, gapX, padding, baseY } = DEFAULTS
    const step = nodeW + gapX

    const result = layoutLinkedList(nodes)

    expect(result.positions.A).toMatchObject({ x: padding + 0 * step, y: baseY })
    expect(result.positions.B).toMatchObject({ x: padding + 1 * step, y: baseY })
    expect(result.positions.C).toMatchObject({ x: padding + 2 * step, y: baseY })

    expect(result.width).toBe(padding + 2 * step + nodeW + padding)
    expect(result.height).toBe(baseY + DEFAULTS.nodeH + DEFAULTS.padding)
  })

  it('wraps to a second row after colsPerRow nodes', () => {
    const nodes = [{ id: 'A' }, { id: 'B' }, { id: 'C' }, { id: 'D' }]
    const { nodeW, nodeH, gapX, gapY, padding, baseY, colsPerRow } = DEFAULTS
    const stepX = nodeW + gapX

    const result = layoutLinkedList(nodes)

    expect(colsPerRow).toBe(3)
    expect(result.positions.D).toMatchObject({
      x: padding + 0 * stepX,
      y: baseY + 1 * (nodeH + gapY),
    })
    expect(result.height).toBe(
      baseY + 1 * (nodeH + gapY) + nodeH + padding,
    )
    // width still sized for full row of 3
    expect(result.width).toBe(padding + 2 * stepX + nodeW + padding)
  })

  it('lifts _cycle nodes upward by cycleLift when configured', () => {
    const nodes = [
      { id: 'A' },
      { id: 'B', _cycle: true },
    ]
    const cycleLift = 28
    const { baseY } = DEFAULTS

    const result = layoutLinkedList(nodes, { cycleLift })

    expect(result.positions.A.y).toBe(baseY)
    expect(result.positions.B.y).toBe(baseY - cycleLift)
  })

  it('places detached fragment nodes on a new row below the main chain', () => {
    const nodes = [
      { id: 'A', _frag: 0 },
      { id: 'B', _frag: 0 },
      { id: 'N', _frag: 1, _detached: true },
    ]
    const { nodeH, gapY, padding, baseY } = DEFAULTS

    const result = layoutLinkedList(nodes)

    expect(result.positions.A.y).toBe(baseY)
    expect(result.positions.B.y).toBe(baseY)
    expect(result.positions.N).toMatchObject({
      x: padding,
      y: baseY + 1 * (nodeH + gapY),
    })
  })

  it('gives each detached singleton (no _frag) its own row below the wrapped main chain', () => {
    const nodes = [
      { id: 'A' },
      { id: 'B' },
      { id: 'C' },
      { id: 'N1', _detached: true },
      { id: 'N2', _detached: true },
    ]
    const { nodeH, gapY, baseY } = DEFAULTS

    const result = layoutLinkedList(nodes)

    // main chain (A,B,C) on one row — wraps every 3
    expect(result.positions.A.y).toBe(baseY)
    expect(result.positions.B.y).toBe(baseY)
    expect(result.positions.C.y).toBe(baseY)
    // each detached singleton gets its own row below, not sharing
    expect(result.positions.N1.y).toBe(baseY + 1 * (nodeH + gapY))
    expect(result.positions.N2.y).toBe(baseY + 2 * (nodeH + gapY))
  })
})

describe('buildLinkedListArrowPaths', () => {
  it('uses a straight segment for adjacent same-row next', () => {
    const nodes = [
      { id: 'A', next: 'B' },
      { id: 'B', next: null },
    ]
    const { positions } = layoutLinkedList(nodes)
    const arrows = buildLinkedListArrowPaths(nodes, positions)

    expect(arrows).toHaveLength(1)
    expect(arrows[0].kind).toBe('straight')
    expect(arrows[0].d.startsWith('M')).toBe(true)
    expect(arrows[0].d.includes('C')).toBe(false)
  })

  it('routes cycle / back edges as an arc above nodes (no straight cross-through)', () => {
    const nodes = [
      { id: 'A', next: 'B' },
      { id: 'B', next: 'C' },
      { id: 'C', next: 'A', _cycle: true },
    ]
    const { positions } = layoutLinkedList(nodes)
    const arrows = buildLinkedListArrowPaths(nodes, positions)
    const back = arrows.find((a) => a.key === 'C->A')

    expect(back).toBeTruthy()
    expect(back.kind).toBe('arc')
    expect(back.d.includes('C')).toBe(true)

    // Control points should sit above the top of all nodes on the chain
    const minNodeY = Math.min(...Object.values(positions).map((p) => p.y))
    const nums = [...back.d.matchAll(/-?\d+\.?\d*/g)].map(Number)
    // cubic: M x0 y0 C cx1 cy1 cx2 cy2 x3 y3 — cy1/cy2 are indices 3,5
    const cy1 = nums[3]
    const cy2 = nums[5]
    expect(cy1).toBeLessThan(minNodeY)
    expect(cy2).toBeLessThan(minNodeY)
  })

  it('routes wrap edges (end of row → start of next) as a curve, not a horizontal cross', () => {
    const nodes = [
      { id: 'A', next: 'B' },
      { id: 'B', next: 'C' },
      { id: 'C', next: 'D' },
      { id: 'D', next: null },
    ]
    const { positions } = layoutLinkedList(nodes)
    const arrows = buildLinkedListArrowPaths(nodes, positions)
    const wrap = arrows.find((a) => a.key === 'C->D')

    expect(wrap).toBeTruthy()
    expect(wrap.kind).toBe('wrap')
    expect(wrap.d.includes('C')).toBe(true)
  })
})
