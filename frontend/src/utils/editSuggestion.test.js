import { describe, it, expect } from 'vitest'
import { GOALS, buildGoalPrompt, parseAssistantMessage, planEdits } from './editSuggestion'

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
    expect(parseAssistantMessage('')).toEqual({ body: '', edits: [], nav: { views: [] }, plan: null })
    expect(parseAssistantMessage(null)).toEqual({ body: '', edits: [], nav: { views: [] }, plan: null })
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

describe('编辑建议块扩展（kind）', () => {
  it('解析 kind=options 方案卡', () => {
    const raw = '可优化点如下\n\n【编辑建议】\n{"kind":"options","target":"Solution.java","options":[{"goal":"performance","label":"以性能为先","detail":"用哈希表"},{"goal":"readability"}]}\n\n【决策痕迹】\n{}'
    const { body, edits, plan } = parseAssistantMessage(raw)
    expect(body).toBe('可优化点如下')
    expect(edits).toHaveLength(0)
    expect(plan.kind).toBe('options')
    expect(plan.target).toBe('Solution.java')
    expect(plan.options).toHaveLength(2)
    expect(plan.options[0]).toMatchObject({ goal: 'performance', label: '以性能为先', detail: '用哈希表' })
    expect(plan.options[1].label).toBe('可读性') // label 缺省 → 中文规范名
    expect(plan.options[1].detail).toBe('')
  })

  it('解析 kind=replace 整文件覆盖', () => {
    const raw = '改动如下\n\n【编辑建议】\n{"kind":"replace","target":"Solution.java","goal":"performance","rationale":"换成哈希表","code":"public class Solution {}"}\n\n【决策痕迹】\n{}'
    const { body, edits, plan } = parseAssistantMessage(raw)
    expect(body).toBe('改动如下')
    expect(edits).toHaveLength(0)
    expect(plan).toMatchObject({ kind: 'replace', target: 'Solution.java', goal: 'performance', rationale: '换成哈希表' })
    expect(plan.code).toBe('public class Solution {}')
  })

  it('kind=replace 的 goal 非闭集 → 保留 code，goal 清空', () => {
    const raw = '前\n\n【编辑建议】\n{"kind":"replace","code":"class A {}","goal":"whatever"}\n\n【决策痕迹】\n{}'
    const { plan } = parseAssistantMessage(raw)
    expect(plan.kind).toBe('replace')
    expect(plan.goal).toBe('')
  })

  it('options 的 goal 不在闭集 → 该项丢弃；全部非法 → 整块按正文', () => {
    const bad = '前\n\n【编辑建议】\n{"kind":"options","options":[{"goal":"whatever"}]}\n\n【决策痕迹】\n{}'
    const { body, plan } = parseAssistantMessage(bad)
    expect(plan).toBeNull()
    expect(body).toContain('【编辑建议】')
  })

  it('options 部分非法 → 只保留合法项', () => {
    const raw = '前\n\n【编辑建议】\n{"kind":"options","options":[{"goal":"whatever"},{"goal":"memory","label":"以内存为先"}]}\n\n【决策痕迹】\n{}'
    const { plan } = parseAssistantMessage(raw)
    expect(plan.options).toHaveLength(1)
    expect(plan.options[0]).toMatchObject({ goal: 'memory', label: '以内存为先' })
  })

  it('options 为空数组 → 整块按正文', () => {
    const raw = '前\n\n【编辑建议】\n{"kind":"options","options":[]}\n\n【决策痕迹】\n{}'
    const { body, plan } = parseAssistantMessage(raw)
    expect(plan).toBeNull()
    expect(body).toContain('【编辑建议】')
  })

  it('replace 的 code 为空/纯空白 → 整块按正文', () => {
    for (const code of ['', '   \n  ']) {
      const raw = `前\n\n【编辑建议】\n{"kind":"replace","code":${JSON.stringify(code)}}\n\n【决策痕迹】\n{}`
      const { body, plan } = parseAssistantMessage(raw)
      expect(plan).toBeNull()
      expect(body).toContain('【编辑建议】')
    }
  })

  it('kind 非法 → 按 patch 处理（与现状一致）', () => {
    const raw = '前\n\n【编辑建议】\n{"kind":"nonsense","edits":[{"old_string":"a","new_string":"b"}]}\n\n【决策痕迹】\n{}'
    const { edits, plan } = parseAssistantMessage(raw)
    expect(edits).toHaveLength(1) // 非法 kind 回落 patch 分支
    expect(plan).toBeNull()
  })

  it('kind=patch 显式给出 → 仍走 patch（零行为变化）', () => {
    const raw = '前\n\n【编辑建议】\n{"kind":"patch","edits":[{"old_string":"a","new_string":"b"}]}\n\n【决策痕迹】\n{}'
    const { edits, plan } = parseAssistantMessage(raw)
    expect(edits).toHaveLength(1)
    expect(plan).toBeNull()
  })

  it('plan 非空时该块的 edits 必须为空（不同时走两分支）', () => {
    const raw = '前\n\n【编辑建议】\n{"kind":"options","edits":[{"old_string":"a","new_string":"b"}],"options":[{"goal":"style"}]}\n\n【决策痕迹】\n{}'
    const { edits, plan } = parseAssistantMessage(raw)
    expect(plan.kind).toBe('options')
    expect(edits).toHaveLength(0)
  })

  it('options 卡最多保留 3 项', () => {
    const opts = ['performance', 'readability', 'memory', 'style', 'correctness'].map((g) => ({ goal: g }))
    const raw = `前\n\n【编辑建议】\n${JSON.stringify({ kind: 'options', options: opts })}\n\n【决策痕迹】\n{}`
    expect(parseAssistantMessage(raw).plan.options).toHaveLength(3)
  })

  it('block 后跟正文仍能剥离并产出 plan', () => {
    const raw = '可优化点\n\n【编辑建议】\n{"kind":"options","options":[{"goal":"memory"}]}\n总结：已完成。\n\n【决策痕迹】\n{}'
    const { body, plan } = parseAssistantMessage(raw)
    expect(plan.kind).toBe('options')
    expect(body).toContain('可优化点')
    expect(body).toContain('总结：已完成。')
    expect(body).not.toContain('【编辑建议】')
  })
})

describe('buildGoalPrompt', () => {
  it('按闭集中文名拼提问', () => {
    expect(buildGoalPrompt('performance')).toBe('以「性能」为优先优化当前代码。请给出优化后的完整代码。')
  })

  it('带 detail 时追加「具体要求」', () => {
    expect(buildGoalPrompt('readability', '拆分长方法')).toBe(
      '以「可读性」为优先优化当前代码，具体要求：拆分长方法。请给出优化后的完整代码。',
    )
  })

  it('GOALS 与 spec §4.4 闭集一致', () => {
    expect(Object.keys(GOALS)).toEqual(['performance', 'readability', 'memory', 'style', 'correctness'])
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

  it('整文件覆盖（old_string = 当前全文）→ ok，覆盖区间为全文', () => {
    const [r] = planEdits(src, [{ old_string: src, new_string: 'class New {}' }])
    expect(r.status).toBe('ok')
    expect(src.slice(r.start, r.end)).toBe(src)
  })

  it('编辑器为空（source 空串）→ not-found（调用方退回 restoreCode）', () => {
    const [r] = planEdits('', [{ old_string: '', new_string: 'class New {}' }])
    expect(r.status).toBe('not-found')
  })
})
