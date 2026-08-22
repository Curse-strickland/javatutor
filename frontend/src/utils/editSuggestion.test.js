import { describe, it, expect } from 'vitest'
import { parseAssistantMessage, planEdits } from './editSuggestion'

describe('parseAssistantMessage', () => {
  it('纯正文原样返回，edits 为空', () => {
    const { body, edits } = parseAssistantMessage('这是回答。')
    expect(body).toBe('这是回答。')
    expect(edits).toEqual([])
  })

  it('剥离决策痕迹块', () => {
    const raw = '正文内容\n\n【决策痕迹】\n{"intent":"debug"}'
    const { body, edits } = parseAssistantMessage(raw)
    expect(body).toBe('正文内容')
    expect(edits).toEqual([])
  })

  it('解析编辑建议块', () => {
    const raw = '建议如下\n\n【编辑建议】\n{"edits":[{"title":"修复越界","old_string":"i <= n","new_string":"i < n","explanation":"越界"}]}\n\n【决策痕迹】\n{}'
    const { body, edits } = parseAssistantMessage(raw)
    expect(body).toBe('建议如下')
    expect(edits).toHaveLength(1)
    expect(edits[0]).toMatchObject({ title: '修复越界', old_string: 'i <= n', new_string: 'i < n', explanation: '越界' })
  })

  it('编辑建议 JSON 损坏 → 整块按正文展示', () => {
    const raw = '建议如下\n\n【编辑建议】\n{not json}\n\n【决策痕迹】\n{}'
    const { body, edits } = parseAssistantMessage(raw)
    expect(body).toContain('【编辑建议】')
    expect(body).not.toContain('【决策痕迹】')
    expect(edits).toEqual([])
  })

  it('缺字段的 edit 被过滤，title 缺省补默认', () => {
    const raw = 'x\n\n【编辑建议】\n{"edits":[{"old_string":"a","new_string":"b"},{"new_string":"c"},{"old_string":"","new_string":"d"}]}'
    const { edits } = parseAssistantMessage(raw)
    expect(edits).toHaveLength(1)
    expect(edits[0].title).toBe('代码修改')
  })

  it('空输入安全', () => {
    expect(parseAssistantMessage('')).toEqual({ body: '', edits: [] })
    expect(parseAssistantMessage(null)).toEqual({ body: '', edits: [] })
  })
})

describe('planEdits', () => {
  const src = 'int i = 0;\ni = i + 1;\nreturn i;'

  it('唯一匹配 → ok 且偏移正确', () => {
    const [r] = planEdits(src, [{ old_string: 'i + 1', new_string: 'i + 2' }])
    expect(r.status).toBe('ok')
    expect(src.slice(r.start, r.end)).toBe('i + 1')
  })

  it('0 次匹配 → not-found', () => {
    const [r] = planEdits(src, [{ old_string: '不存在', new_string: 'x' }])
    expect(r.status).toBe('not-found')
  })

  it('多次匹配 → ambiguous', () => {
    const [r] = planEdits(src, [{ old_string: 'i', new_string: 'k' }])
    expect(r.status).toBe('ambiguous')
  })

  it('与已接受区间重叠 → conflict', () => {
    const [a, b] = planEdits(src, [
      { old_string: 'i = i + 1', new_string: 'i += 1' },
      { old_string: 'i + 1', new_string: 'i + 2' },
    ])
    expect(a.status).toBe('ok')
    expect(b.status).toBe('conflict')
  })
})
