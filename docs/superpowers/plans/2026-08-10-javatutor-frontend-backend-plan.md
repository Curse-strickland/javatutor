# JavaTutor 前后端接入 Coze 深化能力实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 JavaTutor 前端能解析并展示 Coze 智能体回答中的“参考知识库”来源与 `【决策痕迹】` JSON，同时确认后端透传链路不变。

**Architecture:** 前端新增纯函数工具 `decisionTrace.mjs` 与展示组件 `DecisionTracePanel.vue`，在 `AiTutorPanel.vue` 和 `SseChat.vue` 中替换助手消息渲染；后端不做功能改动，只做回归验证。

**Tech Stack:** Vue 3、Node 内置 test runner（`node --test`）、Spring Boot（仅回归）。

---

## Global Constraints

- 消息格式契约以 `docs/superpowers/specs/2026-08-10-coze-agent-interface.md` 为准。
- 不新增 npm 依赖；不修改后端 Java 代码。
- 前端解析规则：按最后一个 `\n【决策痕迹】\n` 切分；JSON 解析失败时整段按正文展示。
- 正文渲染方式与现有助手消息一致（保留 `v-html` 行为，不引入额外转义差异）。
- 每个任务 TDD：先写失败测试 → 实现 → 通过 → 提交。

---

## File Structure

| 文件 | 责任 |
|---|---|
| `frontend/src/utils/decisionTrace.mjs` | 痕迹解析与来源提取纯函数 |
| `frontend/src/utils/decisionTrace.test.mjs` | `node --test` 单元测试 |
| `frontend/src/components/DecisionTracePanel.vue` | 正文 + 来源标签 + 可折叠痕迹 |
| `frontend/src/components/AiTutorPanel.vue` | 接入 DecisionTracePanel（修改） |
| `frontend/src/components/SseChat.vue` | 接入 DecisionTracePanel（修改） |
| `backend/` | 无代码改动，仅回归验证 |

---

### Task 1: 决策痕迹解析工具

**Files:**
- Create: `frontend/src/utils/decisionTrace.mjs`
- Test: `frontend/src/utils/decisionTrace.test.mjs`

**Interfaces:**
- Produces: `splitDecisionTrace(text: string) -> {body: string, trace: object|null}`、`sourceLabels(trace: object|null) -> string[]`。

- [ ] **Step 1: 写失败测试**

创建 `frontend/src/utils/decisionTrace.test.mjs`：

```js
import test from 'node:test'
import assert from 'node:assert/strict'

import { sourceLabels, splitDecisionTrace } from './decisionTrace.mjs'

test('returns body unchanged when no trace marker', () => {
  const result = splitDecisionTrace('普通回答')
  assert.equal(result.body, '普通回答')
  assert.equal(result.trace, null)
})

test('splits body and parses trace', () => {
  const text = '正文\n\n【决策痕迹】\n{"intent":"concept","confidence":0.9,"sources":[]}'
  const result = splitDecisionTrace(text)
  assert.equal(result.body, '正文')
  assert.equal(result.trace.intent, 'concept')
})

test('invalid trace json falls back to full text body', () => {
  const text = '正文\n\n【决策痕迹】\nnot-json'
  const result = splitDecisionTrace(text)
  assert.equal(result.body, text)
  assert.equal(result.trace, null)
})

test('extracts source labels', () => {
  const trace = { sources: [{ source: '知识库: HashMap' }, { source: '知识库: Arrays.sort' }] }
  assert.deepEqual(sourceLabels(trace), ['知识库: HashMap', '知识库: Arrays.sort'])
})
```

- [ ] **Step 2: 运行测试确认失败**

Run（在 `frontend` 目录）：`node --test src/utils/decisionTrace.test.mjs`
Expected: FAIL，`Cannot find module './decisionTrace.mjs'`。

- [ ] **Step 3: 实现工具**

创建 `frontend/src/utils/decisionTrace.mjs`：

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

Run（在 `frontend` 目录）：`node --test src/utils/decisionTrace.test.mjs`
Expected: 4 passed。

- [ ] **Step 5: 提交**

```bash
git add frontend/src/utils/decisionTrace.mjs frontend/src/utils/decisionTrace.test.mjs
git commit -m "feat: add decision trace parser for Coze answers"
```

---

### Task 2: 决策痕迹展示组件

**Files:**
- Create: `frontend/src/components/DecisionTracePanel.vue`

**Interfaces:**
- Props: `content: string`。
- Renders: 正文 + 知识来源标签 + 可折叠 `【决策痕迹】` JSON。

- [ ] **Step 1: 创建组件**

创建 `frontend/src/components/DecisionTracePanel.vue`：

```vue
<template>
  <div class="decision-trace">
    <div class="trace-body" v-html="body"></div>
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

import { sourceLabels, splitDecisionTrace } from '../utils/decisionTrace.mjs'

const props = defineProps({
  content: { type: String, default: '' },
})

const parts = computed(() => splitDecisionTrace(props.content))
const body = computed(() => parts.value.body)
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

### Task 3: 接入 AiTutorPanel 与 SseChat

**Files:**
- Modify: `frontend/src/components/AiTutorPanel.vue`
- Modify: `frontend/src/components/SseChat.vue`

**Interfaces:**
- 助手消息渲染从“直接渲染 content”改为“渲染 `<DecisionTracePanel :content="..."/>`”。

- [ ] **Step 1: AiTutorPanel 接入**

在 `AiTutorPanel.vue` 顶部 import 追加：

```js
import DecisionTracePanel from './DecisionTracePanel.vue'
```

找到助手消息渲染位置（当前用 `v-html` 输出 `msg.content` 的地方），替换为：

```vue
<DecisionTracePanel :content="msg.content" />
```

如该组件同时负责流式累积，保持原有累积逻辑不变，只在最终完整消息上渲染。

- [ ] **Step 2: SseChat 接入**

在 `SseChat.vue` 顶部 import 追加：

```js
import DecisionTracePanel from './DecisionTracePanel.vue'
```

将助手消息的渲染块替换为：

```vue
<DecisionTracePanel :content="m.content" />
```

保留 `updateLastAssistant` 的流式累积逻辑；完整消息到达后再渲染。

- [ ] **Step 3: 手工验收**

用含痕迹的样例消息验证：

```text
HashMap 是基于哈希表的映射。
参考知识库：HashMap

【决策痕迹】
{"intent":"concept","confidence":0.95,"sources":[{"source":"知识库: HashMap","score":0.86}],"critic_passed":true,"revised":false}
```

Expected: 正文显示、`知识库: HashMap` 显示为来源标签、`决策痕迹` 可折叠展开。

- [ ] **Step 4: 提交**

```bash
git add frontend/src/components/AiTutorPanel.vue frontend/src/components/SseChat.vue
git commit -m "feat: render decision trace in AI panels"
```

---

### Task 4: 后端回归与跨端验收

**Files:**
- Modify: 无（后端无代码改动）

**Interfaces:**
- 后端 `/api/ai/chat` 继续透传 SSE 文本；`/api/ai/analyze` 继续返回 JSON。

- [ ] **Step 1: 运行后端现有测试**

Run（在 `backend` 目录）：`./mvnw test`
Expected: BUILD SUCCESS。

- [ ] **Step 2: 端到端验收**

```bash
curl -N http://127.0.0.1:8080/api/ai/chat \
  -H "Content-Type: application/json" \
  -d '{"code":"public class A {}","step":0,"totalSteps":1,"currentLine":1,"variables":{}}'
```

Expected: SSE `chunk` 事件最终包含完整回答、`参考知识库：...` 与 `【决策痕迹】` JSON，且未被截断或转义。

- [ ] **Step 3: 记录验收结果**

在 `docs/superpowers/plans/2026-08-10-javatutor-frontend-backend-plan.md` 末尾追加：

```markdown
## 验收记录
- 日期：执行当天
- 前端痕迹解析：通过 / 失败
- 来源标签渲染：通过 / 失败
- 决策痕迹折叠展示：通过 / 失败
- 后端 SSE 透传：通过 / 失败
- 备注：
```

- [ ] **Step 4: 提交**

```bash
git add docs/superpowers/plans/2026-08-10-javatutor-frontend-backend-plan.md
git commit -m "docs: record frontend-backend acceptance for decision trace"
```

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

### Placeholder Scan

计划无 `TBD`、`TODO`；所有代码块完整。

### Type Consistency

- `splitDecisionTrace(text) -> {body, trace}`：Task 1 定义，Task 2 使用。
- `sourceLabels(trace) -> string[]`：Task 1 定义，Task 2 使用。
- `DecisionTracePanel` props `content: string`：Task 2 定义，Task 3 使用。
