import { describe, it, expect } from 'vitest'
import { extractKmpViz } from './kmpVizExtract.js'

// 构造 TraceEngine 形状的栈帧：method + locals + args，字符串/数组/整数均为普通值
function frame(method, locals = {}, args = {}) {
  return { method, locals, args }
}

function mainFrame({ text, pattern, next, i, j }) {
  return frame('main', { text, pattern, next, i, j })
}

function buildNextFrame({ pattern, next, i, j }) {
  return frame('buildNext', { p: pattern, next, i, j }, { p: pattern })
}

const KMP_CODE = 'String text = "ababcabcabababd";\nString pattern = "ababd";\nint[] next = buildNext(pattern);\nint i = 0, j = 0;\nwhile (i < text.length()) { if (j == -1 || text.charAt(i) == pattern.charAt(j)) { i++; j++; } else { j = next[j - 1]; } }'

describe('extractKmpViz', () => {
  it('returns null when no pattern string + next array present', () => {
    const frames = [mainFrame({ text: 'ababc', pattern: null, next: null, i: 0, j: 0 })]
    expect(extractKmpViz({}, frames, KMP_CODE)).toBeNull()
  })

  it('recognizes next-build phase from buildNext frame', () => {
    const frames = [
      frame('main', { text: 'ababcabcabababd', pattern: 'ababd' }),
      buildNextFrame({ pattern: 'ababd', next: [0, 0, 0, 0, 0], i: 3, j: 1 }),
    ]
    const viz = extractKmpViz({}, frames, KMP_CODE)
    expect(viz).not.toBeNull()
    expect(viz.mode).toBe('next-build')
    expect(viz.phaseLabel).toBe('构建 next 数组')
    expect(viz.text).toBe('ababcabcabababd')
    expect(viz.pattern).toBe('ababd')
    expect(viz.next).toEqual([0, 0, 0, 0, 0])
    expect(viz.nextName).toBe('next')
    expect(viz.i).toBe(3)
    expect(viz.j).toBe(1)
    expect(viz.alignOffset).toBeNull()
    expect(viz.explanation).toContain('构建 next[3]')
  })

  it('recognizes matching phase from main frame only', () => {
    const frames = [mainFrame({ text: 'ababcabcabababd', pattern: 'ababd', next: [0, 0, 1, 2, 0], i: 4, j: 2 })]
    const viz = extractKmpViz({}, frames, KMP_CODE)
    expect(viz.mode).toBe('matching')
    expect(viz.phaseLabel).toBe('字符串匹配')
    expect(viz.alignOffset).toBe(4 - 2)
  })

  it('detects mismatch jump when prev j > current j', () => {
    const frames = [mainFrame({ text: 'ababcabcabababd', pattern: 'ababd', next: [0, 0, 1, 2, 0], i: 5, j: 2 })]
    const prevFrames = [mainFrame({ text: 'ababcabcabababd', pattern: 'ababd', next: [0, 0, 1, 2, 0], i: 5, j: 4 })]
    const viz = extractKmpViz({}, frames, KMP_CODE, prevFrames)
    expect(viz.jumpInfo).toEqual({
      from: 4,
      to: 2,
      matched: 'abab',
      lcpLen: 2,
      lcp: 'ab',
    })
    expect(viz.explanation).toContain('最长相同前后缀')
  })

  it('does not report jump when j stays equal', () => {
    const frames = [mainFrame({ text: 'ababcabcabababd', pattern: 'ababd', next: [0, 0, 1, 2, 0], i: 4, j: 2 })]
    const prevFrames = [mainFrame({ text: 'ababcabcabababd', pattern: 'ababd', next: [0, 0, 1, 2, 0], i: 3, j: 1 })]
    const viz = extractKmpViz({}, frames, KMP_CODE, prevFrames)
    expect(viz.jumpInfo).toBeNull()
  })

  it('reports full match when j reaches pattern length', () => {
    const frames = [mainFrame({ text: 'ababcabcabababd', pattern: 'ababd', next: [0, 0, 1, 2, 0], i: 11, j: 5 })]
    const viz = extractKmpViz({}, frames, KMP_CODE)
    expect(viz.explanation).toContain('找到完整匹配')
  })

  it('returns null for non-KMP code (sort)', () => {
    const frames = [frame('insertionSort', { arr: [5, 2, 8], i: 1, j: 0 })]
    expect(extractKmpViz({}, frames, 'void insertionSort(int[] a)')).toBeNull()
  })
})
