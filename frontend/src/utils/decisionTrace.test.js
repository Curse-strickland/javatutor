import { describe, expect, it } from 'vitest'

import { sourceLabels, splitDecisionTrace, traceSummary } from './decisionTrace.js'

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
  })

  it('invalid trace json falls back to full text body', () => {
    const text = '正文\n\n【决策痕迹】\nnot-json'
    const result = splitDecisionTrace(text)
    expect(result.body).toBe(text)
    expect(result.trace).toBeNull()
  })

  it('extracts source labels', () => {
    const trace = { sources: [{ source: '知识库: HashMap' }, { source: '知识库: Arrays.sort' }] }
    expect(sourceLabels(trace)).toEqual(['知识库: HashMap', '知识库: Arrays.sort'])
  })
})

describe('traceSummary', () => {
  it('returns empty summary for no trace', () => {
    const empty = { intentLabel: '', toolLines: [], toolEmptyText: '', reviseText: '', latencyText: '', tokenText: '' }
    expect(traceSummary(null)).toEqual(empty)
    expect(traceSummary(undefined)).toEqual(empty)
  })

  it('maps intent to readable label', () => {
    expect(traceSummary({ intent: 'data_query' }).intentLabel).toBe('意图识别：数据追问（data_query）')
    expect(traceSummary({ intent: 'concept' }).intentLabel).toBe('意图识别：概念讲解（concept）')
    expect(traceSummary({ intent: 'debug' }).intentLabel).toBe('意图识别：错误诊断（debug）')
    expect(traceSummary({ intent: 'analyze' }).intentLabel).toBe('意图识别：代码分析（analyze）')
    expect(traceSummary({ intent: 'unknown-x' }).intentLabel).toBe('意图识别：通用助手（unknown-x）')
  })

  it('shows explicit hint when tool_calls is empty', () => {
    expect(traceSummary({ tool_calls: [] }).toolEmptyText).toBe('未调用工具')
    expect(traceSummary({}).toolEmptyText).toBe('')
  })

  it('renders tool_calls as readable lines without full json', () => {
    const trace = {
      tool_calls: [
        { tool: 'step_facts', args: { step_index: 1, line: 5 } },
        { tool: 'search_kb', args: { query: 'HashMap' } },
        { tool: 'no_args' },
      ],
    }
    expect(traceSummary(trace).toolLines).toEqual([
      '调用 step_facts：查询第 2 步，行 5',
      '调用 search_kb：query=HashMap',
      '调用 no_args',
    ])
  })

  it('shows revise text only when critic failed and revised', () => {
    expect(traceSummary({ critic_passed: false, revised: true }).reviseText).toBe('评审未通过，已修订')
    expect(traceSummary({ critic_passed: false, revised: false }).reviseText).toBe('')
    expect(traceSummary({ critic_passed: true, revised: true }).reviseText).toBe('')
  })

  it('formats latency and token usage', () => {
    const summary = traceSummary({ latency_ms: 1200.5, token_usage: { prompt_tokens: 2331, completion_tokens: 237 } })
    expect(summary.latencyText).toBe('耗时 1.2s')
    expect(summary.tokenText).toBe('Prompt 2331 / 生成 237')
  })

  it('does not throw on missing fields', () => {
    expect(() => traceSummary({})).not.toThrow()
    expect(traceSummary({}).toolLines).toEqual([])
    expect(traceSummary({ latency_ms: 0 }).latencyText).toBe('')
    expect(traceSummary({ token_usage: {} }).tokenText).toBe('')
  })
})
