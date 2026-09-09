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
    expect(parseAssistantMessage('')).toEqual({ body: '', edits: [], nav: { views: [] } })
    expect(parseAssistantMessage(null)).toEqual({ body: '', edits: [], nav: { views: [] } })
  })

  it('JSON 合法但 edits 为空 → 整块按正文展示（不静默丢弃）', () => {
    const raw = '建议如下\n\n【编辑建议】\n{"edits":[]}\n\n【决策痕迹】\n{}'
    const { body, edits } = parseAssistantMessage(raw)
    expect(body).toContain('【编辑建议】')
    expect(body).not.toContain('【决策痕迹】')
    expect(edits).toEqual([])
  })

  it('解析视角导航块', () => {
    const raw = '如下\n\n【视角导航】\n{"views":[{"panel":"tutor","sub":"analysis","label":"分析"}]}\n\n【决策痕迹】\n{}'
    const { body, edits, nav } = parseAssistantMessage(raw)
    expect(body).toBe('如下')
    expect(edits).toEqual([])
    expect(nav.views).toHaveLength(1)
    expect(nav.views[0]).toMatchObject({ panel: 'tutor', sub: 'analysis', label: '分析' })
  })

  it('导航块 JSON 损坏 → 整块按正文展示', () => {
    const raw = '如下\n\n【视角导航】\n{not json}\n\n【决策痕迹】\n{}'
    const { body, nav } = parseAssistantMessage(raw)
    expect(body).toContain('【视角导航】')
    expect(nav.views).toEqual([])
  })

  it('导航无有效 views（空数组）→ 整块按正文展示', () => {
    const raw = '如下\n\n【视角导航】\n{"views":[]}\n\n【决策痕迹】\n{}'
    const { body, nav } = parseAssistantMessage(raw)
    expect(body).toContain('【视角导航】')
    expect(nav.views).toEqual([])
  })

  it('最多保留 3 个 view，过滤缺 panel 项', () => {
    const raw = '如下\n\n【视角导航】\n{"views":[{"panel":"flow"},{"panel":"variables"},{"panel":"tutor","sub":"explain"},{"panel":"datastructure"},{"label":"x"}]}\n\n【决策痕迹】\n{}'
    const { nav } = parseAssistantMessage(raw)
    expect(nav.views).toHaveLength(3)
  })

  it('解析视角导航块的 algo 精确定位字段', () => {
    const raw = '如下\n\n【视角导航】\n{"views":[{"panel":"algorithm","label":"树算法知识","algo":{"subTab":"knowledge","categoryId":"tree","anchorId":"归并排序"}}]}\n\n【决策痕迹】\n{}'
    const { nav } = parseAssistantMessage(raw)
    expect(nav.views).toHaveLength(1)
    expect(nav.views[0].algo).toMatchObject({ subTab: 'knowledge', categoryId: 'tree', anchorId: '归并排序' })
  })

  it('导航 algo 非法 subTab 被过滤，仅保留合法字段', () => {
    const raw = '如下\n\n【视角导航】\n{"views":[{"panel":"algorithm","algo":{"subTab":"bogus","categoryId":"tree"}}]}\n\n【决策痕迹】\n{}'
    const { nav } = parseAssistantMessage(raw)
    expect(nav.views[0].algo.subTab).toBeUndefined()
    expect(nav.views[0].algo.categoryId).toBe('tree')
  })

  it('编辑建议 + 视角导航同时存在 → 都解析且正文干净', () => {
    const raw = '建议如下\n\n【编辑建议】\n{"edits":[{"old_string":"a","new_string":"b"}]}\n\n【视角导航】\n{"views":[{"panel":"variables"}]}\n\n【决策痕迹】\n{}'
    const { body, edits, nav } = parseAssistantMessage(raw)
    expect(body).toBe('建议如下')
    expect(edits).toHaveLength(1)
    expect(nav.views).toHaveLength(1)
    expect(nav.views[0].panel).toBe('variables')
  })

  it('块后跟正文仍能剥离并产出 nav（修裸 JSON 上屏）', () => {
    const raw = '后序遍历的知识如下\n\n【视角导航】\n{"views":[{"panel":"algorithm","algo":{"subTab":"knowledge","categoryId":"tree","anchorId":"后序遍历"}}]}\n我已经明确回答了…\n\n【决策痕迹】\n{}'
    const { body, nav } = parseAssistantMessage(raw)
    expect(nav.views).toHaveLength(1)
    expect(nav.views[0].algo).toMatchObject({ subTab: 'knowledge', categoryId: 'tree', anchorId: '后序遍历' })
    expect(body).toContain('后序遍历的知识如下')
    expect(body).toContain('我已经明确回答了')
    expect(body).not.toContain('【视角导航】')
    expect(body).not.toContain('{"views"')
  })

  it('panel=algorithm 顶层 sub/categoryId/anchorId 被回收为 algo（schema 兼容）', () => {
    const raw = '如下\n\n【视角导航】\n{"views":[{"panel":"algorithm","sub":"knowledge","categoryId":"tree","anchorId":"后序遍历","label":"树算法知识"}]}\n\n【决策痕迹】\n{}'
    const { nav } = parseAssistantMessage(raw)
    expect(nav.views).toHaveLength(1)
    expect(nav.views[0].algo).toMatchObject({ subTab: 'knowledge', categoryId: 'tree', anchorId: '后序遍历' })
  })

  it('编辑建议 + 视角导航 + 块后正文混排 → 都剥离且正文干净', () => {
    const raw = '建议如下\n\n【编辑建议】\n{"edits":[{"old_string":"a","new_string":"b"}]}\n\n【视角导航】\n{"views":[{"panel":"variables"}]}\n总结：已检查。\n\n【决策痕迹】\n{"intent":"debug"}'
    const { body, edits, nav } = parseAssistantMessage(raw)
    expect(body).toContain('建议如下')
    expect(body).toContain('总结：已检查。')
    expect(body).not.toContain('【编辑建议】')
    expect(body).not.toContain('【视角导航】')
    expect(edits).toHaveLength(1)
    expect(nav.views).toHaveLength(1)
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

  it('空 / 缺失 old_string → not-found（而非误判为 ambiguous）', () => {
    const [a, b] = planEdits(src, [
      { old_string: '', new_string: 'x' },
      { new_string: 'x' },
    ])
    expect(a.status).toBe('not-found')
    expect(b.status).toBe('not-found')
  })
})
