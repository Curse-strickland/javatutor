import { describe, it, expect } from 'vitest'
import {
  inferPointerRole,
  colorForPointerName,
  primaryRoleFromLabels,
  POINTER_ROLE_COLORS,
  colorForRole,
} from './pointerRoleColors.js'

describe('pointerRoleColors', () => {
  it('maps mid/cur to yellow mid role', () => {
    expect(inferPointerRole('mid')).toBe('mid')
    expect(inferPointerRole('cur')).toBe('mid')
    expect(inferPointerRole('curr')).toBe('mid')
    expect(inferPointerRole('node')).toBe('mid')
    expect(colorForPointerName('mid')).toBe(POINTER_ROLE_COLORS.mid)
    expect(POINTER_ROLE_COLORS.mid).toBe('#eab308')
  })

  it('maps root to red root role', () => {
    expect(inferPointerRole('root')).toBe('root')
    expect(colorForPointerName('root')).toBe('#ef476f')
  })

  it('prefers cur/mid over root when both labels present', () => {
    expect(primaryRoleFromLabels(['root', 'cur'])).toBe('mid')
  })

  it('maps next/right to blue and prev/left to grey', () => {
    expect(inferPointerRole('next')).toBe('next')
    expect(inferPointerRole('right')).toBe('next')
    expect(inferPointerRole('r')).toBe('next')
    expect(colorForPointerName('next')).toBe('#3b82f6')

    expect(inferPointerRole('prev')).toBe('prev')
    expect(inferPointerRole('left')).toBe('prev')
    expect(inferPointerRole('l')).toBe('prev')
    expect(colorForPointerName('prev')).toBe('#6b7280')
  })

  it('treats i as mid (yellow) and j as next (blue)', () => {
    expect(inferPointerRole('i')).toBe('mid')
    expect(inferPointerRole('j')).toBe('next')
  })

  it('prefers mid when multiple labels share a cell', () => {
    expect(primaryRoleFromLabels(['left', 'mid', 'right'])).toBe('mid')
    expect(primaryRoleFromLabels(['prev', 'next'])).toBe('next')
  })
})

describe('neutral role (else chip fallback)', () => {
  it('exposes neutral role color', () => {
    expect(POINTER_ROLE_COLORS.neutral).toBe('#f59e0b')
    expect(colorForRole('neutral')).toBe('#f59e0b')
  })

  it('does not infer neutral from pointer names', () => {
    expect(inferPointerRole('neutral')).toBeNull()
  })
})

describe('extended color palette (insert/neutral)', () => {
  it('insert 与 root 颜色不同', () => {
    expect(colorForRole('insert')).not.toBe(colorForRole('root'))
  })
  it('insert 为 magenta', () => {
    expect(colorForRole('insert')).toBe('#d946ef')
  })
  it('neutral 为 amber', () => {
    expect(colorForRole('neutral')).toBe('#f59e0b')
  })
})
