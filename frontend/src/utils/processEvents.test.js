/**
 * 过程哨兵：构造与解析（纯函数）。
 *
 * agent 侧把「已发生的事实」（阶段、工具调用）以 HTML 注释哨兵的形式随消息流出，
 * 前端在**渲染前**拦下并转为进度 UI。格式为 HTML 注释，故即使未拦截也会渲染为不可见。
 *
 * 本文件与 coze 侧 `tests/test_process_events.py` **同构**——同一格式两份实现，靠测试对齐。
 */

import { describe, it, expect } from 'vitest'
import { extractProcessEvents, applyProcessEvents, MARK_PREFIX } from './processEvents'

const STAGE = { kind: 'stage', text: '正在分析问题…' }
const TOOL = {
  kind: 'tool',
  tool: 'step_facts',
  args: { step_index: 4, line: 10 },
  status: 'ok',
  latency_ms: 120.5,
}

/** 按 agent 侧构造规则生成一条哨兵（含两侧换行）。 */
function mark(event) {
  return `\n${MARK_PREFIX}${JSON.stringify(event)}-->\n`
}

describe('extractProcessEvents', () => {
  it('往返：哨兵被剥净、事件被取出', () => {
    const result = extractProcessEvents(mark(TOOL))
    expect(result.events).toEqual([TOOL])
    expect(result.clean).toBe('')
  })

  it('混合文本：只留散文，且与原文散文部分逐字相等', () => {
    const text = `正文A${mark(STAGE)}正文B${mark(TOOL)}`
    const result = extractProcessEvents(text)
    expect(result.clean).toBe('正文A正文B')
    expect(result.events).toEqual([STAGE, TOOL])
  })

  it('负载里的 --> 转义后仍能还原', () => {
    const event = { kind: 'stage', text: '箭头 --> 与 --> 多枚' }
    // agent 侧构造规则：负载内的终止符替换成 JSON 转义形式（反斜杠 + u003e，解析后还原为 `>`），
    // 否则解析的正则会提前截断。
    const payload = JSON.stringify(event).replace(/-->/g, '--\\u003e')
    const result = extractProcessEvents(`\n${MARK_PREFIX}${payload}-->\n`)
    expect(result.events).toEqual([event])
    expect(result.clean).toBe('')
  })

  it('畸形 JSON：不抛错、不进 events，也不留在 clean 里', () => {
    const result = extractProcessEvents('前\n<!--jt:process {bad json}-->\n后')
    expect(result.events).toEqual([])
    expect(result.clean).toBe('前后')
  })

  it('负载不是对象：同样丢弃', () => {
    const result = extractProcessEvents('前\n<!--jt:process [1,2]-->\n后')
    expect(result.events).toEqual([])
    expect(result.clean).toBe('前后')
  })

  it('无哨兵：原文一字不变', () => {
    const result = extractProcessEvents('普通正文，没有哨兵')
    expect(result.clean).toBe('普通正文，没有哨兵')
    expect(result.events).toEqual([])
  })

  it('空输入与非字符串输入不抛错', () => {
    expect(extractProcessEvents('')).toEqual({ clean: '', events: [] })
    expect(extractProcessEvents(undefined)).toEqual({ clean: undefined, events: [] })
  })
})

describe('applyProcessEvents', () => {
  it('stage 覆盖：只保留最后一条', () => {
    const out = applyProcessEvents(
      {},
      [{ kind: 'stage', text: '第一' }, { kind: 'stage', text: '第二' }]
    )
    expect(out.liveStage).toBe('第二')
  })

  it('tool 追加：按序累积', () => {
    const first = applyProcessEvents({}, [STAGE, TOOL])
    const second = applyProcessEvents(first, [{ kind: 'tool', tool: 'fetch_execution_context' }])
    expect(second.liveTools.map((t) => t.tool)).toEqual(['step_facts', 'fetch_execution_context'])
    expect(second.liveStage).toBe('正在分析问题…')
  })

  it('不改原状态（纯函数）', () => {
    const prev = { liveStage: 'a', liveTools: [TOOL] }
    const out = applyProcessEvents(prev, [{ kind: 'stage', text: 'b' }])
    expect(prev.liveStage).toBe('a')
    expect(prev.liveTools).toHaveLength(1)
    expect(out.liveStage).toBe('b')
  })

  it('未知 kind 与残缺事件一律忽略（kind 是开放集合）', () => {
    const out = applyProcessEvents({}, [
      { kind: 'reasoning', text: '将来的 kind' },
      { kind: 'stage' },
      { kind: 'tool' },
      null,
    ])
    expect(out.liveStage).toBe('')
    expect(out.liveTools).toEqual([])
  })
})
