import { describe, expect, it } from 'vitest'

import { sourceLabels, splitDecisionTrace, traceProcess, traceSummary, traceDebugLines } from './decisionTrace.js'

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

  it('剥掉正文末尾的【编辑建议】/【视角导航】块，避免裸 JSON 渲染', () => {
    const text = '正文\n\n【编辑建议】\n{"edits":[{"old_string":"a","new_string":"b"}]}\n\n【视角导航】\n{"views":[{"panel":"variables"}]}\n\n【决策痕迹】\n{"intent":"debug"}'
    const result = splitDecisionTrace(text)
    expect(result.body).toBe('正文')
    expect(result.trace.intent).toBe('debug')
  })

  it('无【决策痕迹】时也剥掉正文末尾的结构化块，避免裸 JSON 渲染', () => {
    const text = '正文\n\n【编辑建议】\n{"edits":[{"old_string":"a","new_string":"b"}]}'
    const result = splitDecisionTrace(text)
    expect(result.body).toBe('正文')
    expect(result.trace).toBeNull()
  })

  it('块后跟正文也剥掉结构化块，仅留正文与后续补充', () => {
    const text = '正文\n\n【视角导航】\n{"views":[{"panel":"variables"}]}\n后续补充\n\n【决策痕迹】\n{"intent":"debug"}'
    const result = splitDecisionTrace(text)
    expect(result.body).toBe('正文\n\n后续补充')
    expect(result.trace.intent).toBe('debug')
  })

  it('extracts source labels', () => {
    const trace = { sources: [{ source: '知识库: HashMap' }, { source: '知识库: Arrays.sort' }] }
    expect(sourceLabels(trace)).toEqual(['知识库: HashMap', '知识库: Arrays.sort'])
  })
})

describe('traceSummary', () => {
  const empty = {
    intentLabel: '',
    toolCards: [],
    toolEmptyText: '',
    reviseText: '',
    qualityWarnings: [],
    latencyText: '',
    tokenText: '',
  }

  it('returns empty summary for no trace', () => {
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

  it('renders tool_calls as card fields without full json', () => {
    const trace = {
      tool_calls: [
        { tool: 'step_facts', args: { step_index: 1, line: 5 } },
        { tool: 'search_kb', args: { query: 'HashMap' } },
        { tool: 'no_args' },
      ],
    }
    expect(traceSummary(trace).toolCards).toEqual([
      { tool: 'step_facts', label: '查询单步证据', argsText: '查询第 2 步，行 5', resultText: '', status: 'ok' },
      { tool: 'search_kb', label: 'search_kb', argsText: 'query=HashMap', resultText: '', status: 'ok' },
      { tool: 'no_args', label: 'no_args', argsText: '', resultText: '', status: 'ok' },
    ])
  })

  it('annotates step_facts result status on the tool card', () => {
    const trace = {
      tool_calls: [
        { tool: 'step_facts', args: { step_index: 6, line: 0 },
          result: JSON.stringify({ error: 'step_index 6 不在可用范围', steps_count: 6 }) },
        { tool: 'step_facts', args: { step_index: 0 },
          result: JSON.stringify({ error: '', evidence: { variables: { x: 1 } }, diff: [] }) },
      ],
    }
    expect(traceSummary(trace).toolCards).toEqual([
      { tool: 'step_facts', label: '查询单步证据', argsText: '查询第 7 步，行 0',
        resultText: '越界（共 6 步）', status: 'error' },
      { tool: 'step_facts', label: '查询单步证据', argsText: '查询第 1 步',
        resultText: '已获取证据', status: 'ok' },
    ])
  })

  it('annotates the fetch tool card with the file it actually read', () => {
    const trace = {
      tool_calls: [
        // 自动前置的 fetch：args 为空，只有 result 能说明它读到了哪个文件。
        // 下面这串是 coze `harness/render.py::_handle_fetch` 的**真实产物**（原样粘贴），
        // 不是手写的形状——变了就是契约变了。
        { tool: 'fetch_execution_context', args: {},
          result: '{"stored": true, "file": "Main.java", "file_source": "entry_file", "code_chars": 3160, "steps_count": 1, "current_step_index": 0, "current_line": 1, "algorithm_tags": []}' },
        // 模型显式指定文件：args 与 result 都带文件名
        { tool: 'fetch_execution_context', args: { file: 'Util.java' },
          result: JSON.stringify({ stored: true, file: 'Util.java', file_source: 'explicit',
            code_chars: 88 }) },
        // 单文件兜底：file 为空串，只报来源
        { tool: 'fetch_execution_context', args: {},
          result: JSON.stringify({ stored: true, file: '', file_source: 'source_code',
            code_chars: 20 }) },
      ],
    }
    expect(traceSummary(trace).toolCards).toEqual([
      { tool: 'fetch_execution_context', label: '获取执行上下文', argsText: '',
        resultText: 'Main.java（主入口），3160 字', status: 'ok' },
      { tool: 'fetch_execution_context', label: '获取执行上下文', argsText: 'file=Util.java',
        resultText: 'Util.java（显式指定），88 字', status: 'ok' },
      { tool: 'fetch_execution_context', label: '获取执行上下文', argsText: '',
        resultText: '单文件兜底，20 字', status: 'ok' },
    ])
  })

  it('shows the fetch failure reason on the card, not a bare one', () => {
    const trace = {
      tool_calls: [
        // 同样取自 coze 真实产物
        { tool: 'fetch_execution_context', args: {},
          result: '{"stored": false, "error": "未能取到源码（解析来源：未能解析；候选文件：[\'A.java\', \'B.java\']）。请用 file 参数指定要读的文件名。"}' },
      ],
    }
    const card = traceSummary(trace).toolCards[0]
    expect(card.status).toBe('error')
    expect(card.resultText).toBe(
      "失败：未能取到源码（解析来源：未能解析；候选文件：['A.java', 'B.java']）。请用 file 参数指定要读的文…",
    )
  })

  it('truncates a long fetch failure reason to one readable line', () => {
    const trace = {
      tool_calls: [
        { tool: 'fetch_execution_context', args: {},
          result: JSON.stringify({ error: `未能取到源码（${'文件不存在；'.repeat(20)}）` }) },
      ],
    }
    const card = traceSummary(trace).toolCards[0]
    expect(card.resultText.endsWith('…')).toBe(true)
    expect(card.resultText.length).toBeLessThan(100)
  })

  it('keeps a bare fetch card when result is absent (old agent) or unparsable', () => {
    const trace = {
      tool_calls: [
        { tool: 'fetch_execution_context', args: {} },
        { tool: 'fetch_execution_context', args: {}, result: 'not json' },
      ],
    }
    expect(traceSummary(trace).toolCards).toEqual([
      { tool: 'fetch_execution_context', label: '获取执行上下文', argsText: '', resultText: '', status: 'ok' },
      { tool: 'fetch_execution_context', label: '获取执行上下文', argsText: '', resultText: '', status: 'ok' },
    ])
  })

  it('shows revise text only when critic failed and revised', () => {
    expect(traceSummary({ critic_passed: false, revised: true }).reviseText).toBe('评审未通过，已修订')
    expect(traceSummary({ critic_passed: false, revised: false }).reviseText).toBe('评审未通过（未修订）')
    expect(traceSummary({ critic_passed: true, revised: true }).reviseText).toBe('')
  })

  it('collects degradation warnings', () => {
    expect(traceSummary({ rag_degraded: true }).qualityWarnings).toContain('知识库检索不可用，已用通用知识回答')
    expect(traceSummary({ critic_skipped: true }).qualityWarnings).toContain('评审已跳过')
    expect(traceSummary({ revise_skipped: true }).qualityWarnings).toContain('修订已跳过')
    expect(traceSummary({ fallback_reason: 'fetch_execution_context failed: 超时' }).qualityWarnings)
      .toContain('降级：fetch_execution_context failed: 超时')
    expect(traceSummary({ compaction_mode: 'windowed' }).qualityWarnings).toContain('上下文过长，已窗口化压缩')
    expect(traceSummary({ compaction_mode: 'truncated' }).qualityWarnings).toContain('上下文过长，压缩失败已截断')
    expect(traceSummary({}).qualityWarnings).toEqual([])
  })

  it('marks estimated token usage', () => {
    expect(traceSummary({ token_usage: { prompt_tokens: 100, completion_tokens: 50, estimated: true } }).tokenText)
      .toBe('Prompt 100 / 生成 50（估）')
  })

  it('formats latency and token usage', () => {
    const summary = traceSummary({ latency_ms: 1200.5, token_usage: { prompt_tokens: 2331, completion_tokens: 237 } })
    expect(summary.latencyText).toBe('耗时 1.2s')
    expect(summary.tokenText).toBe('Prompt 2331 / 生成 237')
  })

  it('does not throw on missing fields', () => {
    expect(() => traceSummary({})).not.toThrow()
    expect(traceSummary({}).toolCards).toEqual([])
    expect(traceSummary({ latency_ms: 0 }).latencyText).toBe('')
    expect(traceSummary({ token_usage: {} }).tokenText).toBe('')
  })
})

describe('traceDebugLines', () => {
  it('returns empty for no trace', () => {
    expect(traceDebugLines(null)).toEqual([])
    expect(traceDebugLines(undefined)).toEqual([])
    expect(traceDebugLines({})).toEqual([])
  })

  it('renders run_id', () => {
    expect(traceDebugLines({ run_id: 'abc-123' })).toEqual(['run_id: abc-123'])
  })

  it('renders fetch context failure', () => {
    expect(traceDebugLines({ fetch_context_failed: true, fetch_context_error: 'HTTP 500' }))
      .toEqual(['上下文拉取失败：HTTP 500'])
  })

  it('renders fetch context success latency', () => {
    expect(traceDebugLines({ fetch_context_failed: false, fetch_context_latency_ms: 12.3 }))
      .toEqual(['上下文拉取：12.3ms'])
  })
})

describe('traceProcess', () => {
  const empty = {
    reasoning: [],
    reasoningTruncated: false,
    retrieval: null,
    hasContent: false,
  }

  it('returns empty structure for no trace', () => {
    expect(traceProcess(null)).toEqual(empty)
    expect(traceProcess(undefined)).toEqual(empty)
    expect(traceProcess({})).toEqual(empty)
  })

  it('reads reasoning rounds with tool calls', () => {
    const trace = {
      reasoning: [
        { round: 0, content: '先看看上下文', tool_calls: ['fetch_execution_context'] },
        { round: 1, content: '直接作答', tool_calls: [] },
      ],
    }
    const out = traceProcess(trace)
    expect(out.reasoning).toHaveLength(2)
    expect(out.reasoning[0]).toEqual({ round: 0, content: '先看看上下文', toolsText: 'fetch_execution_context' })
    expect(out.reasoning[1].toolsText).toBe('')
    expect(out.hasContent).toBe(true)
  })

  it('surfaces truncation flag', () => {
    const trace = { reasoning: [{ round: 0, content: '很长' }], reasoning_truncated: true }
    expect(traceProcess(trace).reasoningTruncated).toBe(true)
  })

  it('summarises retrieval with candidates', () => {
    const trace = {
      retrieval: {
        query: 'HashMap 的 get 原理',
        top_k: 3,
        threshold: 0.3,
        best_score: 0.28,
        kept: 0,
        candidates: [
          { source: '知识库: HashMap.get', chunk_index: 0, score: 0.28, preview: 'HashMap.get', kept: false },
        ],
      },
    }
    const out = traceProcess(trace)
    expect(out.retrieval.summaryText).toContain('HashMap 的 get 原理')
    expect(out.retrieval.summaryText).toContain('0.28')
    expect(out.retrieval.summaryText).toContain('命中 0')
    expect(out.retrieval.candidates).toHaveLength(1)
    expect(out.retrieval.candidates[0].source).toBe('知识库: HashMap.get')
    expect(out.retrieval.candidates[0].kept).toBe(false)
    expect(out.hasContent).toBe(true)
  })

  it('keeps candidates when kept is zero (诊断的核心：召回到但被阈值滤掉)', () => {
    const trace = { retrieval: { query: 'q', candidates: [{ source: 'A', score: 0.1, kept: false }], kept: 0 } }
    const out = traceProcess(trace)
    expect(out.retrieval.candidates).toHaveLength(1)
    expect(out.hasContent).toBe(true)
  })

  it('tolerates malformed entries without throwing', () => {
    expect(() => traceProcess({ reasoning: 'nope', retrieval: 42 })).not.toThrow()
    expect(traceProcess({ reasoning: [null, { content: 'ok' }] }).reasoning).toHaveLength(1)
    expect(traceProcess({ retrieval: { candidates: 'nope' } }).retrieval.candidates).toEqual([])
  })

  it('hasContent is false when reasoning empty and no candidates', () => {
    expect(traceProcess({ reasoning: [], retrieval: { candidates: [] } }).hasContent).toBe(false)
  })
})

describe('splitDecisionTrace 剥离过程哨兵', () => {
  const mark = (event) => `\n<!--jt:process ${JSON.stringify(event)}-->\n`

  it('body 不含哨兵文本（终态不漏）', () => {
    const text =
      mark({ kind: 'stage', text: '正在分析问题…' }) +
      mark({ kind: 'tool', tool: 'step_facts', args: {}, status: 'ok', latency_ms: 1 }) +
      '正文\n\n【决策痕迹】\n' +
      JSON.stringify({ intent: 'data_query' })
    const result = splitDecisionTrace(text)
    expect(result.body).toBe('正文')
    expect(result.body).not.toContain('jt:process')
    expect(result.trace).toEqual({ intent: 'data_query' })
  })

  it('无痕迹标记时也剥掉哨兵', () => {
    const text = mark({ kind: 'stage', text: '正在分析问题…' }) + '只有正文'
    expect(splitDecisionTrace(text).body).toBe('只有正文')
  })

  it('痕迹 JSON 畸形时回退正文仍不含哨兵', () => {
    const text = mark({ kind: 'stage', text: '阶段' }) + '正文\n\n【决策痕迹】\n{坏 JSON'
    const result = splitDecisionTrace(text)
    expect(result.trace).toBeNull()
    expect(result.body).not.toContain('jt:process')
  })
})
