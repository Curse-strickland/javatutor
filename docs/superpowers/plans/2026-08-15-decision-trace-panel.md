# JavaTutor 决策痕迹面板实施计划（2026-08-15 修订版）

> 取代：`docs/superpowers/plans/2026-08-10-javatutor-frontend-backend-plan.md`
> 执行分支：`feat/decision-trace-panel`（JavaTutor 仓库）
> 执行方式：交给 Claude Code 按本计划逐任务 TDD 执行。

**Goal:** 让 JavaTutor 前端能解析并展示 Coze 智能体回答中的知识库来源与 `【决策痕迹】` JSON，后端透传链路保持不变。

**Architecture:** 前端新增纯函数工具 `decisionTrace.js` 与展示组件 `DecisionTracePanel.vue`，在 `AiTutorPanel.vue` 中替换助手消息渲染；后端不做功能改动，只做回归验证。

**Tech Stack:** Vue 3、vitest（`npm test`）、Spring Boot（仅回归）。

---

## Global Constraints

- 消息格式契约以 `javatutor-coze/docs/spec/2026-08-10-coze-agent-interface.md` 为准；当前决策痕迹已包含 `sources`、`tool_calls`、`token_usage` 等字段。
- 不新增 npm 依赖（`marked` 已存在于项目依赖中，用于正文 markdown 渲染）。
- 不修改后端 Java 代码。
- 前端解析规则：按最后一个 `\n【决策痕迹】\n` 切分；JSON 解析失败时整段按正文展示。
- `SseChat.vue` 未在应用中被引用，本次不接入，不修改该文件。
- 每个任务 TDD：先写失败测试 → 实现 → 通过 → 提交。

---

## File Structure

| 文件 | 责任 |
|---|---|
| `frontend/src/utils/decisionTrace.js` | 痕迹解析与来源提取纯函数 |
| `frontend/src/utils/decisionTrace.test.js` | vitest 单元测试 |
| `frontend/src/components/DecisionTracePanel.vue` | 正文 + 来源标签 + 可折叠痕迹 |
| `frontend/src/components/AiTutorPanel.vue` | 接入 DecisionTracePanel（修改） |
| `backend/` | 无代码改动，仅回归验证 |

---

### Task 1: 决策痕迹解析工具

**Files:**
- Create: `frontend/src/utils/decisionTrace.js`
- Test: `frontend/src/utils/decisionTrace.test.js`

**Interfaces:**
- Produces: `splitDecisionTrace(text) -> {body: string, trace: object|null}`、`sourceLabels(trace) -> string[]`。

- [ ] **Step 1: 写失败测试**

创建 `frontend/src/utils/decisionTrace.test.js`：

```js
import { describe, expect, it } from 'vitest'

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
```

- [ ] **Step 2: 运行测试确认失败**

Run（在 `frontend` 目录）：`npm test`
Expected: FAIL，`Cannot find module './decisionTrace.js'`。

- [ ] **Step 3: 实现工具**

创建 `frontend/src/utils/decisionTrace.js`：

```js
export function splitDecisionTrace(text) {
  if (typeof text !== 'string') return { body: text, trace: null }
  const marker = '\n【决策痕迹】\n'
  const idx = text.lastIndexOf(marker)
  if (idx < 0) return { body: text, trace: null }
  const body = text.slice(0, idx).trimEnd()
  const raw = text.slice(idx + marker.length).trim()
  try {
    return { body, trace: JSON.parse(raw) }
  } catch {
    return { body: text, trace: null }
  }
}

export function sourceLabels(trace) {
  if (!trace || !Array.isArray(trace.sources)) return []
  return trace.sources.map((s) => (s && s.source) || '').filter(Boolean)
}
```

- [ ] **Step 4: 运行测试确认通过**

Run（在 `frontend` 目录）：`npm test`
Expected: 4 passed。

- [ ] **Step 5: 提交**

```bash
git add frontend/src/utils/decisionTrace.js frontend/src/utils/decisionTrace.test.js
git commit -m "feat: add decision trace parser for Coze answers"
```

---

### Task 2: 决策痕迹展示组件

**Files:**
- Create: `frontend/src/components/DecisionTracePanel.vue`

**Interfaces:**
- Props: `content: string`。
- Renders: markdown 正文 + 知识来源标签 + 可折叠 `【决策痕迹】` JSON。

- [ ] **Step 1: 创建组件**

创建 `frontend/src/components/DecisionTracePanel.vue`：

```vue
<template>
  <div class="decision-trace">
    <div class="trace-body" v-html="bodyHtml"></div>
    <div v-if="trace" class="trace-meta">
      <div v-if="sources.length" class="trace-sources">
        <span v-for="s in sources" :key="s" class="trace-chip">{{ s }}</span>
      </div>
      <details class="trace-details">
        <summary>决策痕迹</summary>
        <pre>{{ traceJson }}</pre>
      </details>
    </div>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { marked } from 'marked'

import { sourceLabels, splitDecisionTrace } from '../utils/decisionTrace.js'

const props = defineProps({
  content: { type: String, default: '' },
})

const parts = computed(() => splitDecisionTrace(props.content))
const bodyHtml = computed(() => marked.parse(parts.value.body || ''))
const trace = computed(() => parts.value.trace)
const sources = computed(() => sourceLabels(trace.value))
const traceJson = computed(() => JSON.stringify(trace.value, null, 2))
</script>

<style scoped>
.trace-body { white-space: pre-wrap; word-break: break-word; }
.trace-meta { margin-top: 8px; border-top: 1px dashed var(--line, #d8dee4); padding-top: 6px; }
.trace-sources { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 6px; }
.trace-chip { padding: 2px 8px; background: var(--accent-bg, #eef6fb); color: var(--accent, #0d9ec4); font-size: 11px; }
.trace-details summary { cursor: pointer; font-size: 11px; color: var(--muted, #6a737d); }
.trace-details pre { font-size: 11px; white-space: pre-wrap; color: var(--muted, #6a737d); }
</style>
```

- [ ] **Step 2: 提交**

```bash
git add frontend/src/components/DecisionTracePanel.vue
git commit -m "feat: add DecisionTracePanel component"
```

---

### Task 3: 接入 AiTutorPanel

**Files:**
- Modify: `frontend/src/components/AiTutorPanel.vue`

**Interfaces:**
- 助手消息渲染从“直接渲染 markdown”改为“完整消息渲染 `<DecisionTracePanel :content="m.text"/>`”。
- 流式累积期间保持现有 `renderMarkdown(m.text)` 渲染，避免未完成 JSON 闪烁。

- [ ] **Step 1: AiTutorPanel 接入**

在 `AiTutorPanel.vue` 顶部 import 追加：

```js
import DecisionTracePanel from './DecisionTracePanel.vue'
```

找到助手消息渲染位置（当前为 `v-html="renderMarkdown(m.text)"`），改为：

```vue
<span v-if="!m.text && i === store.chatMessages.length - 1" class="chat-typing">…</span>
<span v-else-if="store.isExplaining" v-html="renderMarkdown(m.text)"></span>
<DecisionTracePanel v-else :content="m.text" />
```

说明：`store.isExplaining` 为 `true` 时继续按当前方式流式展示；回答结束后整条消息交给 `DecisionTracePanel` 解析展示。

- [ ] **Step 2: 手工验收**

用含痕迹的样例消息验证：

```text
HashMap 是基于哈希表的映射。
参考知识库：HashMap

【决策痕迹】
{"intent":"concept","confidence":0.95,"sources":[{"source":"知识库: HashMap","score":0.86}],"critic_passed":true,"revised":false,"tool_calls":[],"token_usage":{"prompt_tokens":0,"completion_tokens":0,"estimated":true}}
```

Expected: 正文以 markdown 显示、`知识库: HashMap` 显示为来源标签、`决策痕迹` 可折叠展开。

- [ ] **Step 3: 提交**

```bash
git add frontend/src/components/AiTutorPanel.vue
git commit -m "feat: render decision trace in AI panel"
```

---

### Task 4: 后端回归与跨端验收

**Files:**
- Modify: 无（后端无代码改动）

**Interfaces:**
- 后端 `/api/ai/chat` 继续透传 SSE 文本；`/api/ai/analyze` 继续返回 JSON。

- [ ] **Step 1: 运行后端现有测试**

Run（在 `backend` 目录，Windows 用 `mvnw.cmd`）：`./mvnw test`
Expected: BUILD SUCCESS。

- [ ] **Step 2: 端到端验收**

```bash
curl -N http://127.0.0.1:8080/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"code":"public class A {}","step":0,"totalSteps":1,"currentLine":1,"variables":{}}'
```

Expected: SSE `chunk` 事件最终包含完整回答与 `【决策痕迹】` JSON，且未被截断或转义。

- [ ] **Step 3: 记录验收结果**

在 `docs/superpowers/plans/2026-08-15-decision-trace-panel.md` 末尾追加：

```markdown
## 验收记录
- 日期：执行当天
- 前端痕迹解析：通过 / 失败
- 来源标签渲染：通过 / 失败
- 决策痕迹折叠展示：通过 / 失败
- 流式期间不闪烁：通过 / 失败
- 后端 SSE 透传：通过 / 失败
- 备注：
```

- [ ] **Step 4: 提交**

```bash
git add docs/superpowers/plans/2026-08-15-decision-trace-panel.md
git commit -m "docs: record decision trace panel acceptance"
```

---

## 验收记录

- 日期：2026-08-15
- 前端痕迹解析：通过（`splitDecisionTrace` 4 项 vitest 全绿，含无效 JSON 兜底）
- 来源标签渲染：通过（`sourceLabels` 提取 `trace.sources[].source`；DecisionTracePanel 以切角 chip 渲染）
- 决策痕迹折叠展示：通过（蓝色圆点 + 标题 + chevron，0.25s 旋转展开 JSON；遵循设计系统，未用 details/summary 与裸 border-top）
- 流式期间不闪烁：通过（`store.isExplaining` 为真时保持 renderMarkdown，结束后切换 DecisionTracePanel）
- 后端 SSE 透传：通过（curl `/api/ai/chat` 返回 `event:chunk` 完整回答 + `data:【决策痕迹】` + `data:{json}`，JSON 未截断/未转义，行拼接后与 `\n【决策痕迹】\n` marker 精确匹配）
- 回归：前端 115 测试 + vite build 通过；后端 `mvnw test` 83 测试 BUILD SUCCESS
- 备注：正文 markdown 渲染提炼为共享 `frontend/src/utils/markdown.js`（marked + XSS 防护 renderer），AiTutorPanel 与 DecisionTracePanel 共用，避免重复实现与安全回归；未新增 npm 依赖；后端无代码改动（仅 CozeAIController 已暂存的 `request.getSteps()` 透传）。

---

## Self-Review

### Spec Coverage

| 接口契约条目 | 对应任务 |
|---|---|
| 痕迹切分规则 | Task 1 |
| 来源标签 | Task 1 + Task 2 |
| 正文 + 痕迹展示 | Task 2 + Task 3 |
| 后端透传不变 | Task 4 |
| 无效 JSON 兜底 | Task 1 测试覆盖 |
| tool_calls / token_usage 展示 | Task 2 的 JSON 折叠展示 |

### Placeholder Scan

计划无 `TBD`、`TODO`；所有代码块完整。

### Type Consistency

- `splitDecisionTrace(text) -> {body, trace}`：Task 1 定义，Task 2 使用。
- `sourceLabels(trace) -> string[]`：Task 1 定义，Task 2 使用。
- `DecisionTracePanel` props `content: string`：Task 2 定义，Task 3 使用。
