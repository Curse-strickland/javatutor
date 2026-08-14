import { describe, it, expect } from 'vitest'

import { sourceLabels, splitDecisionTrace } from './decisionTrace.js'

describe('splitDecisionTrace', () => {
  it('returns body unchanged when no trace marker', () => {
    const result = splitDecisionTrace('普通回答')
    expect(result.body).toBe('普通回答')
    expect(result.trace).toBeNull()
  })

  it('splits body and parses trace', () => {
    const text = '正文\n\n【决策痕迹】\n{"intent":"concept","confidence":0.9,"sources":[]}'
    const result = splitDecisionTrace(text)
    expect(result.body).toBe('正文')
    expect(result.trace.intent).toBe('concept')
    expect(result.trace.confidence).toBe(0.9)
  })

  it('invalid trace json falls back to full text body', () => {
    const text = '正文\n\n【决策痕迹】\nnot-json'
    const result = splitDecisionTrace(text)
    expect(result.body).toBe(text)
    expect(result.trace).toBeNull()
  })

  it('handles non-string input', () => {
    expect(splitDecisionTrace(null)).toEqual({ body: null, trace: null })
    expect(splitDecisionTrace(undefined)).toEqual({ body: undefined, trace: null })
  })

  it('uses last trace marker when multiple present', () => {
    const text = '正文\n\n【决策痕迹】\n{"intent":"first"}\n\n后文\n\n【决策痕迹】\n{"intent":"second"}'
    const result = splitDecisionTrace(text)
    expect(result.body).toContain('后文')
    expect(result.trace.intent).toBe('second')
  })
})

describe('sourceLabels', () => {
  it('extracts source labels', () => {
    const trace = { sources: [{ source: '知识库: HashMap' }, { source: '知识库: Arrays.sort' }] }
    expect(sourceLabels(trace)).toEqual(['知识库: HashMap', '知识库: Arrays.sort'])
  })

  it('returns empty array for null/undefined/missing sources', () => {
    expect(sourceLabels(null)).toEqual([])
    expect(sourceLabels({})).toEqual([])
    expect(sourceLabels({ sources: [] })).toEqual([])
  })

  it('filters out empty or malformed entries', () => {
    const trace = { sources: [{ source: '知识库: A' }, { source: '' }, {}, null, 'plain'] }
    expect(sourceLabels(trace)).toEqual(['知识库: A', 'plain'])
  })
})
