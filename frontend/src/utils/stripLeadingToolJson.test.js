import { describe, it, expect } from 'vitest'
import { parseAssistantMessage, stripLeadingToolJson } from './editSuggestion'
import { splitDecisionTrace } from './decisionTrace'

/** 过程哨兵（与 `processEvents.js` / coze 侧 `process_events.py` 同格式）。 */
const SENTINEL = (payload) => `\n<!--jt:process ${JSON.stringify(payload)}-->\n`

const TOOL = (tool, args) => `{"tool": "${tool}", "args": ${JSON.stringify(args)}}`

describe('stripLeadingToolJson', () => {
  it('纯正文原样返回（恒等）', () => {
    expect(stripLeadingToolJson('### 当前这一步的执行内容\n\nx 变成了 2。'))
      .toBe('### 当前这一步的执行内容\n\nx 变成了 2。')
  })

  it('空值安全', () => {
    expect(stripLeadingToolJson('')).toBe('')
    expect(stripLeadingToolJson(null)).toBe(null)
    expect(stripLeadingToolJson(undefined)).toBe(undefined)
  })

  it('剥掉单个前导工具 JSON 并保留其后正文', () => {
    expect(stripLeadingToolJson(`${TOOL('step_facts', { step_index: 1 })}\n\n正文`)).toBe('\n\n正文')
  })

  it('与正文粘连（无换行）也能剥净 —— 用户报告的症状', () => {
    // 实测产物形如 `{"tool": ...}}### 当前这一步的执行内容`：`}}###` 的粘连不是模型少打换行，
    // 是前端 `text += t` 不插分隔符（review 2026-09-13 §1.1）。
    const glued = `${TOOL('fetch_execution_context', { file: 'Main.java' })}### 当前这一步的执行内容`
    expect(stripLeadingToolJson(glued)).toBe('### 当前这一步的执行内容')
  })

  it('循环剥掉多轮提案（剥掉第一段后第二段新暴露成开头）', () => {
    const raw = TOOL('fetch_execution_context', { file: 'A.java' })
      + TOOL('step_facts', { step_index: 1 })
      + TOOL('step_facts', { line: 10 })
      + '终答正文'
    expect(stripLeadingToolJson(raw)).toBe('终答正文')
  })

  it('前导空白不影响判别', () => {
    expect(stripLeadingToolJson(`\n\n  ${TOOL('step_facts', {})} 正文`)).toBe(' 正文')
  })

  it('args 内嵌套对象不会提前截断（平衡解析）', () => {
    const raw = `${TOOL('step_facts', { step_index: 4, filter: { deep: { x: 1 } } })}正文`
    expect(stripLeadingToolJson(raw)).toBe('正文')
  })

  it('数组开头不碰', () => {
    expect(stripLeadingToolJson('[1,2,3] 正文')).toBe('[1,2,3] 正文')
  })

  it('无 tool 键的对象不碰（含【视角导航】的 views 块）', () => {
    const nav = '{"views":[{"panel":"datastructure","label":"数组"}]}'
    expect(stripLeadingToolJson(`${nav}正文`)).toBe(`${nav}正文`)
  })

  it('JSON 残缺时不剥、不抛错', () => {
    const broken = '{"tool": "step_facts", "args": {'
    expect(stripLeadingToolJson(broken)).toBe(broken)
  })

  it('正文里恰好以普通 JSON 开头（非工具）不碰', () => {
    expect(stripLeadingToolJson('{"name":"arr","len":3} 这是配置说明'))
      .toBe('{"name":"arr","len":3} 这是配置说明')
  })
})

describe('stripLeadingToolJson 接入 parseAssistantMessage', () => {
  it('剥掉前导工具 JSON 后，正文与结构化块照常解析', () => {
    const raw = TOOL('fetch_execution_context', { file: 'Main.java' })
      + '建议如下\n\n【编辑建议】\n{"edits":[{"title":"修复越界","old_string":"i <= n","new_string":"i < n","explanation":"越界"}]}'
    const { body, edits } = parseAssistantMessage(raw)
    expect(body).toBe('建议如下')
    expect(edits).toHaveLength(1)
    expect(edits[0]).toMatchObject({ title: '修复越界' })
  })

  it('【视角导航】透传契约不回归：views 块不以 tool 开头，照常解析且不入正文', () => {
    const raw = TOOL('step_facts', { step_index: 1 })
      + '看一下数组\n\n【视角导航】\n{"views":[{"panel":"datastructure","label":"数组","sub":"数组"}]}'
    const { body, nav } = parseAssistantMessage(raw)
    expect(body).toBe('看一下数组')
    expect(nav.views).toHaveLength(1)
    expect(nav.views[0]).toMatchObject({ panel: 'datastructure' })
  })
})

describe('渲染终态产物（splitDecisionTrace）', () => {
  const ANSWER = '### 当前这一步的执行内容\n\nx 从 1 变成了 2。'

  /**
   * 复刻**真实流式累积**：`main_agent` 每轮提案的原始输出 + 过程哨兵 + 终答 + `final` 的
   * 终态消息，前端的 `text += t` 把它们**无分隔符**拼起来。
   * 这正是用户报告症状的产生方式（review 2026-09-13 §1.1 全链路复现）。
   */
  const accumulated =
    TOOL('fetch_execution_context', { file: 'Main.java' })
    + SENTINEL({ kind: 'stage', text: '已检索知识库：命中 0 条' })
    + SENTINEL({ kind: 'stage', text: '正在分析问题…' })
    + TOOL('step_facts', { step_index: 1 })
    + SENTINEL({ kind: 'tool', tool: 'step_facts', args: { step_index: 1 }, status: 'ok', latency_ms: 120 })
    + SENTINEL({ kind: 'stage', text: '证据已就绪，正在生成回答…' })
    + ANSWER                                                    // main_agent 终答
    + `${ANSWER}\n\n【决策痕迹】\n${JSON.stringify({ intent: 'data_query' })}`   // final 的终态消息

  it('正文不再以裸工具 JSON 开头，也不含哨兵', () => {
    const { body, trace } = splitDecisionTrace(accumulated)
    // 用户报告的症状：回答顶端的裸 JSON 与标题粘连（`}}###`）
    expect(body.startsWith('### 当前这一步的执行内容')).toBe(true)
    expect(body).not.toContain('{"tool"')
    expect(body).not.toContain('<!--jt:process')
    expect(trace).toEqual({ intent: 'data_query' })
  })

  it('红线：被拒工具名不进渲染正文', () => {
    // 提案里出现门闩会拒掉的工具名时，剥离按「有 tool 键即剥」处理，名字不会留在正文。
    const withDenied = TOOL('no_such_tool', { x: 1 }) + ANSWER
    const { body } = splitDecisionTrace(withDenied)
    expect(body).not.toContain('no_such_tool')
    expect(body).toBe(ANSWER)
  })

  it('P2 遗留：终答在正文里仍出现两次（最小修复不覆盖，见 review §2）', () => {
    // 本条**钉住当前行为**，不是期望行为：`propose` 把终答同时写进 `state["answer"]` 与
    // `agent_messages`（propose.py），`build_final` 又下发一次；两端都转成 `answer` delta
    // 且前端纯累加，故正文里出现「草稿 + 终稿」两段。
    // 修 P2 时本条应当失败并被删除/改写——那时请一并处理 review §2。
    const { body } = splitDecisionTrace(accumulated)
    const occurrences = body.split(ANSWER).length - 1
    expect(occurrences).toBe(2)
  })
})
