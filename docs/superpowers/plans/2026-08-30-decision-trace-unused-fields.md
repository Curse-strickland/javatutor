# 决策痕迹未利用字段接入 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 coze 侧决策痕迹里尚未在前端用户侧展示的字段（知识库降级、评审/修订跳过、降级原因、上下文压缩、token 估算标记、run_id、上下文拉取观测）接入 `DecisionTracePanel`，用户侧只展示可读质量提示，观测字段归入开发者模式。

**Architecture:** 纯前端改动（JavaTutor 仓库）。coze 侧 `build_final`（`javatutor-coze/src/graphs/javatutor/nodes.py:421-442`）已经把这些字段吐进 `【决策痕迹】` JSON，后端 SSE 原样透传；前端 `decisionTrace.js` 的 `traceSummary()` 纯函数扩展返回质量提示数组，`DecisionTracePanel.vue` 渲染。不改 coze、不改后端、不引入新依赖。

**Tech Stack:** Vue 3.5 `<script setup>`、Vitest 4（node 环境）。

## Global Constraints

- 只改 `JavaTutor/frontend`；coze 侧与后端 Java **零改动**（字段已存在）。
- 契约字段以 `javatutor-coze/src/graphs/javatutor/nodes.py` 的 `build_final`（421–442 行）实际输出为准，而非 `docs/spec/2026-08-10-coze-agent-interface.md`（该文档第 3 节已落后，缺少 `run_id` / `fetch_context_*`）。
- 用户可见摘要**不展示原始 JSON**；原始 JSON 仅在 devMode（URL `?dev=1` 或 `localStorage.getItem('jt-dev') === '1'`）可见。
- 设计系统（`docs/DESIGN.md`）：**不用琥珀色/绿色做 UI 强调**，质量提示用 `--text-muted` mono 文案。
- `confidence` 字段当前恒为 `0.0`（coze 侧 `intent_confidence` 全项目无写入），**本计划不展示**；coze 侧补置信度另立计划。
- 前端门槛：`npm test` 全绿、`npm run build` 成功；不新增 npm 依赖。
- 提交前写 devlog 并在 `AGENTS.md` 文档表登记（遵循仓库规约）。

---

### Task 1: `decisionTrace.js` 扩展 `traceSummary` + 新增 `traceDebugLines`

**Files:**
- Modify: `frontend/src/utils/decisionTrace.js`
- Modify: `frontend/src/utils/decisionTrace.test.js`

**Interfaces:**
- Consumes: 无（纯函数，读 `trace` 对象）。
- Produces:
  - `traceSummary(trace) → { intentLabel, toolLines, toolEmptyText, reviseText, qualityWarnings: string[], latencyText, tokenText }` —— 在现有返回值上新增 `qualityWarnings`；`reviseText` 补全「评审未通过（未修订）」分支；`tokenText` 在 `estimated===true` 时追加 `（估）`。
  - `traceDebugLines(trace) → string[]` —— 开发者模式结构化观测行（`run_id`、上下文拉取成功/失败）。Task 2 的 `DecisionTracePanel` 依赖。

- [ ] **Step 1: 更新测试（先写失败测试）**

`frontend/src/utils/decisionTrace.test.js` 整体替换为：

```js
import { describe, expect, it } from 'vitest'

import { sourceLabels, splitDecisionTrace, traceSummary, traceDebugLines } from './decisionTrace.js'

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
  const empty = {
    intentLabel: '',
    toolLines: [],
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

  it('shows revise text for all critic-failed cases', () => {
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
    expect(traceSummary({}).toolLines).toEqual([])
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
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd frontend && npx vitest run src/utils/decisionTrace.test.js`
Expected: FAIL —— `traceSummary` 缺 `qualityWarnings`、`reviseText` 分支不符、`traceDebugLines` 未导出。

- [ ] **Step 3: 实现 `frontend/src/utils/decisionTrace.js`**

`formatTokens` 替换为（追加 `（估）`）：

```js
function formatTokens(usage) {
  if (!usage || typeof usage !== 'object') return ''
  const p = usage.prompt_tokens
  const c = usage.completion_tokens
  const est = usage.estimated === true ? '（估）' : ''
  if (typeof p === 'number' && typeof c === 'number') return `Prompt ${p} / 生成 ${c}${est}`
  if (typeof p === 'number') return `Prompt ${p}${est}`
  if (typeof c === 'number') return `生成 ${c}${est}`
  return ''
}
```

`traceSummary` 替换为：

```js
export function traceSummary(trace) {
  const empty = {
    intentLabel: '',
    toolLines: [],
    toolEmptyText: '',
    reviseText: '',
    qualityWarnings: [],
    latencyText: '',
    tokenText: '',
  }
  if (!trace || typeof trace !== 'object') return empty
  const intentLabel = trace.intent
    ? `意图识别：${INTENT_LABELS[trace.intent] || INTENT_LABELS.other}（${trace.intent}）`
    : ''
  const toolLines = (Array.isArray(trace.tool_calls) ? trace.tool_calls : [])
    .filter((tc) => tc && tc.tool)
    .map(formatToolCall)
  const toolEmptyText = Array.isArray(trace.tool_calls) && trace.tool_calls.length === 0
    ? '未调用工具'
    : ''
  let reviseText = ''
  if (trace.critic_passed === false) {
    reviseText = trace.revised === true ? '评审未通过，已修订' : '评审未通过（未修订）'
  }
  const qualityWarnings = []
  if (trace.rag_degraded === true) qualityWarnings.push('知识库检索不可用，已用通用知识回答')
  if (trace.critic_skipped === true) qualityWarnings.push('评审已跳过')
  if (trace.revise_skipped === true) qualityWarnings.push('修订已跳过')
  if (typeof trace.fallback_reason === 'string' && trace.fallback_reason) {
    qualityWarnings.push(`降级：${trace.fallback_reason}`)
  }
  if (trace.compaction_mode === 'windowed') qualityWarnings.push('上下文过长，已窗口化压缩')
  else if (trace.compaction_mode === 'truncated') qualityWarnings.push('上下文过长，压缩失败已截断')
  const latencyText = typeof trace.latency_ms === 'number' && trace.latency_ms > 0
    ? `耗时 ${formatLatency(trace.latency_ms)}`
    : ''
  const tokenText = formatTokens(trace.token_usage)
  return { intentLabel, toolLines, toolEmptyText, reviseText, qualityWarnings, latencyText, tokenText }
}
```

文件末尾新增：

```js
/** 开发者模式用的结构化观测行（run_id / 上下文拉取结果）。 */
export function traceDebugLines(trace) {
  if (!trace || typeof trace !== 'object') return []
  const lines = []
  if (typeof trace.run_id === 'string' && trace.run_id) lines.push(`run_id: ${trace.run_id}`)
  if (trace.fetch_context_failed === true) {
    lines.push(`上下文拉取失败：${trace.fetch_context_error || '未知原因'}`)
  } else if (trace.fetch_context_failed === false) {
    const latency = typeof trace.fetch_context_latency_ms === 'number'
      ? `${trace.fetch_context_latency_ms}ms`
      : 'ok'
    lines.push(`上下文拉取：${latency}`)
  }
  return lines
}
```

（`splitDecisionTrace`、`sourceLabels`、`INTENT_LABELS`、`formatToolCall`、`formatLatency` 保持不变。）

- [ ] **Step 4: 跑测试确认通过 + 全量回归**

Run: `cd frontend && npx vitest run src/utils/decisionTrace.test.js`
Expected: PASS（约 19 条）。

Run: `cd frontend && npx vitest run`
Expected: 全绿。

- [ ] **Step 5: Commit**

```bash
git add frontend/src/utils/decisionTrace.js frontend/src/utils/decisionTrace.test.js
git commit -m "feat(decision-trace): surface degradation warnings + debug lines in traceSummary"
```

---

### Task 2: `DecisionTracePanel.vue` 渲染质量提示与 dev 观测行

**Files:**
- Modify: `frontend/src/components/DecisionTracePanel.vue:36-47`（摘要模板）
- Modify: `frontend/src/components/DecisionTracePanel.vue:49`（devMode 原始 JSON 上方）
- Modify: `frontend/src/components/DecisionTracePanel.vue:59`（import）
- Modify: `frontend/src/components/DecisionTracePanel.vue:75-82`（computed 区）
- Modify: `frontend/src/components/DecisionTracePanel.vue:94-220`（style 区）

**Interfaces:**
- Consumes: Task 1 的 `traceSummary(trace)`、`traceDebugLines(trace)`。
- Produces: 用户侧折叠摘要新增质量提示列表；devMode 下原始 JSON 上方新增结构化观测行。

- [ ] **Step 1: import 追加 `traceDebugLines`**

第 59 行改为：

```js
import { sourceLabels, splitDecisionTrace, traceSummary, traceDebugLines } from '../utils/decisionTrace.js'
```

- [ ] **Step 2: computed 区追加 `debugLines`，并扩展 `hasSummary`**

在第 75 行 `const summary = computed(() => traceSummary(trace.value))` 之后插入：

```js
const debugLines = computed(() => traceDebugLines(trace.value))
```

`hasSummary`（第 76–81 行）替换为：

```js
const hasSummary = computed(() =>
  summary.value.intentLabel !== '' || summary.value.reviseText !== '' ||
  summary.value.toolLines.length > 0 || summary.value.toolEmptyText !== '' ||
  summary.value.qualityWarnings.length > 0 ||
  summary.value.latencyText !== '' ||
  summary.value.tokenText !== ''
)
```

- [ ] **Step 3: 模板渲染质量提示与 dev 观测行**

摘要模板第 36–47 行中，在 `<span v-else-if="summary.toolEmptyText" ...>` 之后、`<div class="trace-metrics">` 之前插入：

```html
        <ul v-if="summary.qualityWarnings.length" class="trace-warnings">
          <li v-for="(line, i) in summary.qualityWarnings" :key="i">{{ line }}</li>
        </ul>
```

devMode 原始 JSON 区（第 48–50 行）替换为：

```html
        <ul v-if="devMode && debugLines.length" class="trace-debug">
          <li v-for="(line, i) in debugLines" :key="i">{{ line }}</li>
        </ul>
        <pre v-if="devMode" class="trace-json">{{ traceJson }}</pre>
```

- [ ] **Step 4: style 区追加 `.trace-warnings` / `.trace-debug`**

在 `.trace-tools li { ... }`（约 184–189 行）之后追加：

```css
.trace-warnings {
  margin: 2px 0 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.trace-warnings li {
  font-family: var(--mono);
  font-size: 11px;
  line-height: 1.5;
  color: var(--text-muted);
}
.trace-debug {
  margin: 4px 0 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.trace-debug li {
  font-family: var(--mono);
  font-size: 11px;
  line-height: 1.5;
  color: var(--text-muted);
}
```

- [ ] **Step 5: 验证**

Run: `cd frontend && npm run build`
Expected: 构建成功。

Run: `cd frontend && npx vitest run`
Expected: 全绿（本任务无新单测，逻辑已被 Task 1 覆盖；模板走手测）。

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/DecisionTracePanel.vue
git commit -m "feat(decision-trace): render degradation warnings + debug lines in panel"
```

---

### Task 3: 综合回归 + 文档登记 + devlog

**Files:**
- Modify: `docs/devlog/2026-08-30-decision-trace-unused-fields.md`（新建）
- Modify: `AGENTS.md`（文档表登记）

- [ ] **Step 1: 全量回归**

Run: `cd frontend && npm test`
Expected: 全绿（当前 128 tests，本计划新增约 8 条 → 136 条）。

Run: `cd frontend && npm run build`
Expected: 构建成功。

- [ ] **Step 2: 手测清单**

1. 本地启动前后端，跑一段带 bug 代码提问 → 展开「执行过程」折叠区，确认出现「意图识别 / 工具调用 / 耗时 / token」。
2. 制造一次 RAG 降级（如停掉知识库）提问 → 摘要出现「知识库检索不可用，已用通用知识回答」。
3. `?dev=1` 打开 → 折叠区出现「run_id: ...」「上下文拉取：...ms」结构行 + 原始 JSON；关闭 dev 则只显示可读摘要，不出现 raw JSON。
4. 确认质量提示为 `--text-muted` mono 文案，无琥珀/绿色。

- [ ] **Step 3: 写 devlog**

新建 `docs/devlog/2026-08-30-decision-trace-unused-fields.md`，记录：改动文件、验证结果（测试数、build 通过）、遗留项（`confidence` 恒 0.0 未展示，coze 侧补置信度另立计划）。

- [ ] **Step 4: 登记 `AGENTS.md` 文档表**

在 `AGENTS.md`「文档」表追加一行：

```markdown
| `docs/superpowers/plans/2026-08-30-decision-trace-unused-fields.md` | 决策痕迹未利用字段接入计划（质量提示 + dev 观测行） |
```

- [ ] **Step 5: Commit**

```bash
git add docs/devlog/2026-08-30-decision-trace-unused-fields.md AGENTS.md
git commit -m "docs(decision-trace): devlog + register unused-fields plan"
```

---

## 范围外 / 待决策

- **`confidence` 恒为 0.0**：coze 侧 `intent_confidence`（`javatutor-coze/src/graphs/javatutor/state.py:67`）全项目无写入，`build_final` 里 `confidence` 永远 `round(0.0, 2)`。本计划**不展示该字段**。若需真正置信度，需在 coze 侧引入 LLM 分类或给 `conservative_intent` 关键词规则加权输出，属独立 coze 计划，不在此范围。
- **`run_id` / `fetch_context_*`**：已存在于 devMode 原始 JSON 中；本计划仅追加结构化可读行（Task 2），不新增复制按钮等交互。

## Self-Review

### Spec Coverage

| 需求 | 对应任务 |
|---|---|
| 知识库降级 / 评审跳过 / 修订跳过 / 降级原因 / 上下文压缩 提示 | Task 1（qualityWarnings）+ Task 2（渲染） |
| 「评审未通过（未修订）」补全 | Task 1（reviseText 分支） |
| token 估算标记 `（估）` | Task 1（formatTokens） |
| run_id / 上下文拉取观测行 | Task 1（traceDebugLines）+ Task 2（dev 渲染） |
| confidence 假数据 | 范围外（见上） |
| 回归 / 文档 / devlog | Task 3 |

### Placeholder Scan

计划无 `TBD`/`TODO`；所有代码块完整，字段名与 `nodes.py build_final` 实际输出一致（`run_id`、`fetch_context_failed`、`fetch_context_latency_ms`、`fetch_context_error`、`rag_degraded`、`critic_skipped`、`revise_skipped`、`fallback_reason`、`compaction_mode`、`token_usage.estimated`）。

### Type Consistency

`traceSummary` 返回对象在 Task 1 定义（含 `qualityWarnings: string[]`），Task 2 模板直接读取 `summary.qualityWarnings`；`traceDebugLines` 在 Task 1 定义，Task 2 以 `debugLines` computed 引用——名称一致。
