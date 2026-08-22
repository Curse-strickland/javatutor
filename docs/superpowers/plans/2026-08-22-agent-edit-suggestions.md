# Agent 编辑建议 harness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 agent 的回答可以携带结构化「编辑建议」，前端渲染成带 diff 对比的卡片，用户确认后一键应用到 Monaco 编辑区，并可撤销（keep / undo）。

**Architecture:** 沿用「决策痕迹」约定：coze 主 Agent 在正文后追加 `【编辑建议】` + JSON 块（old_string/new_string 锚点，不用行号）；Java 后端零改动（SSE 原样透传）；前端纯函数解析+定位（可单测），Monaco `executeEdits` + `pushUndoStop` 整批应用（天然进 undo 栈），卡片组件提供 应用/忽略/撤销。顺带修复现状 bug：决策痕迹块目前未被剥离，raw JSON 直接渲染在聊天气泡里。

**Tech Stack:** Vue 3.5 `<script setup>`、Pinia 3、Monaco Editor、Vitest 4（node 环境）、javatutor-coze（langgraph Python，仅 prompt 改动）。

## Global Constraints

- 协议（前后端与 coze 三方一致，逐字）：
  ```
  正文...

  【编辑建议】
  {"edits":[{"title":"...","old_string":"...","new_string":"...","explanation":"..."}]}

  【决策痕迹】
  {...}
  ```
  - `old_string` 必须逐字摘自用户源码（含缩进），且在源码中唯一出现。
  - 前端解析失败（坏 JSON / 缺字段）→ 整块按正文展示，绝不报错。
- 后端 Java **零改动**；coze 侧 **只改 prompt 与契约文档**，不动图结构。
- 应用编辑走 Monaco `executeEdits`（undo 栈原生支持）；一次「应用全部」= 一个 undo 单位。
- 编辑定位在**应用时刻**的源码上进行（用户可能在收到建议后改过代码）。
- 不引入新依赖；项目约束：不做多文件模式相关改动。
- 决策痕迹剥离是顺手修复（契约 `docs/spec/2026-08-10-coze-agent-interface.md` 第 7 节本就要求前端切分，现状未实现）。

---

### Task 1: 解析与定位纯函数 `editSuggestion.js`

**Files:**
- Create: `frontend/src/utils/editSuggestion.js`
- Test: `frontend/src/utils/editSuggestion.test.js`

**Interfaces:**
- Consumes: 无（纯函数）。
- Produces:
  - `parseAssistantMessage(raw: string) → { body: string, edits: Array<{title, explanation, old_string, new_string}> }` — 剥离 `【决策痕迹】` 与 `【编辑建议】` 块；任何解析失败返回 `{ body: <去痕迹后原文>, edits: [] }`。Task 3 的 AiTutorPanel 依赖。
  - `planEdits(source: string, edits: Array) → Array<edit & { status: 'ok'|'not-found'|'ambiguous'|'conflict', start?: number, end?: number }>` — 在 `source` 中定位每条 old_string：0 次→`not-found`；>1 次→`ambiguous`；与已接受区间重叠→`conflict`；唯一匹配→`ok`（带 `[start, end)` 偏移）。Task 2 的 Editor 依赖。

- [ ] **Step 1: 写失败测试**

新建 `frontend/src/utils/editSuggestion.test.js`：

```js
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
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd frontend && npx vitest run src/utils/editSuggestion.test.js`
Expected: FAIL —— 模块不存在。

- [ ] **Step 3: 实现 `frontend/src/utils/editSuggestion.js`**

```js
// Agent 编辑建议：解析 assistant 消息中的结构化块，并把编辑定位到源码
// 协议见 javatutor-coze docs/spec/2026-08-10-coze-agent-interface.md

const TRACE_MARK = '\n【决策痕迹】'
const EDIT_MARK = '\n【编辑建议】'

/**
 * 剥离【决策痕迹】/【编辑建议】块。
 * @returns {{ body: string, edits: Array<{title: string, explanation: string, old_string: string, new_string: string}> }}
 * 任何解析失败都不抛出：块按正文展示，edits 为空。
 */
export function parseAssistantMessage(raw) {
  const text = String(raw || '')
  const traceIdx = text.lastIndexOf(TRACE_MARK)
  let body = traceIdx === -1 ? text : text.slice(0, traceIdx)

  const editIdx = body.lastIndexOf(EDIT_MARK)
  if (editIdx === -1) return { body: body.trimEnd(), edits: [] }

  const jsonText = body.slice(editIdx + EDIT_MARK.length).trim()
  try {
    const parsed = JSON.parse(jsonText)
    const edits = (Array.isArray(parsed?.edits) ? parsed.edits : [])
      .filter(
        (e) =>
          e &&
          typeof e.old_string === 'string' &&
          e.old_string.length > 0 &&
          typeof e.new_string === 'string',
      )
      .map((e) => ({
        title: typeof e.title === 'string' && e.title ? e.title : '代码修改',
        explanation: typeof e.explanation === 'string' ? e.explanation : '',
        old_string: e.old_string,
        new_string: e.new_string,
      }))
    return { body: body.slice(0, editIdx).trimEnd(), edits }
  } catch {
    // JSON 解析失败 → 整块按正文展示
    return { body: body.trimEnd(), edits: [] }
  }
}

/**
 * 把编辑建议定位到源码（应用时刻的文本）。
 * status: 'ok'（唯一匹配，带 [start,end) 偏移）| 'not-found' | 'ambiguous' | 'conflict'（与已接受区间重叠）
 */
export function planEdits(source, edits) {
  const src = String(source || '')
  const accepted = []
  return (edits || []).map((edit) => {
    const positions = []
    let idx = src.indexOf(edit.old_string)
    while (idx !== -1) {
      positions.push(idx)
      idx = src.indexOf(edit.old_string, idx + 1)
    }
    if (positions.length === 0) return { ...edit, status: 'not-found' }
    if (positions.length > 1) return { ...edit, status: 'ambiguous' }
    const start = positions[0]
    const end = start + edit.old_string.length
    if (accepted.some((r) => start < r.end && end > r.start)) {
      return { ...edit, status: 'conflict', start, end }
    }
    accepted.push({ start, end })
    return { ...edit, status: 'ok', start, end }
  })
}
```

- [ ] **Step 4: 跑测试确认通过 + 全量回归**

Run: `cd frontend && npx vitest run src/utils/editSuggestion.test.js`
Expected: 10/10 PASS

Run: `cd frontend && npx vitest run`
Expected: 全绿。

- [ ] **Step 5: Commit**

```bash
git add frontend/src/utils/editSuggestion.js frontend/src/utils/editSuggestion.test.js
git commit -m "feat(agent-edit): parseAssistantMessage + planEdits utils"
```

---

### Task 2: Editor 暴露 applyAiEdits / undoAiEdits + SingleFileShell provide

**Files:**
- Modify: `frontend/src/components/Editor.vue:16-18`（import 区）
- Modify: `frontend/src/components/Editor.vue:295-305`（setCode 之后、defineExpose 之前）
- Modify: `frontend/src/components/SingleFileShell.vue:215`（vue import 加 provide）
- Modify: `frontend/src/components/SingleFileShell.vue:229-230` 附近（provide 两个函数）

**Interfaces:**
- Consumes: Task 1 的 `planEdits(source, edits)`。
- Produces:
  - `Editor` expose 新增：`applyAiEdits(edits) → null | { applied: number, planned: Array }`（无 Monaco 实例时返回 `null`）；`undoAiEdits() → void`。
  - SingleFileShell `provide('applyAiEdits', fn)` / `provide('undoAiEdits', fn)`，Task 3 的卡片组件 inject。

- [ ] **Step 1: Editor.vue —— import + 两个方法 + expose**

第 16-18 行 import 区追加：

```js
import { planEdits } from '../utils/editSuggestion'
```

在 `setCode` 方法（约 295-299 行）之后插入：

```js
/**
 * 应用 AI 编辑建议：整批一次 executeEdits（一个 undo 单位，Ctrl+Z 可回滚）。
 * @returns {null | { applied: number, planned: Array }} 无 Monaco 实例（textarea 回退）时返回 null
 */
const applyAiEdits = (edits) => {
  if (!editor) return null
  const model = editor.getModel()
  if (!model) return null
  const planned = planEdits(model.getValue(), edits)
  const applicable = planned.filter((p) => p.status === 'ok')
  if (applicable.length) {
    editor.pushUndoStop()
    editor.executeEdits(
      'ai-edit-suggestion',
      applicable.map((p) => {
        const s = model.getPositionAt(p.start)
        const e = model.getPositionAt(p.end)
        return {
          range: new monaco.Range(s.lineNumber, s.column, e.lineNumber, e.column),
          text: p.new_string,
        }
      }),
    )
    editor.pushUndoStop()
  }
  return { applied: applicable.length, planned }
}

/** 撤销最近一次应用的 AI 编辑（走 Monaco undo 栈） */
const undoAiEdits = () => {
  if (editor) editor.trigger('ai-edit-suggestion', 'undo', null)
}
```

第 305 行 `defineExpose` 改为：

```js
defineExpose({ getCode, highlightLine, clearHighlights, triggerImport, setCode, applyAiEdits, undoAiEdits })
```

- [ ] **Step 2: SingleFileShell.vue —— provide**

第 215 行 vue import 改为：

```js
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount, provide } from 'vue'
```

在 `const editorRef = ref(null)`（第 230 行）之后插入：

```js
// AI 编辑建议 → 编辑器（AiTutorPanel 里的卡片组件 inject 使用）
provide('applyAiEdits', (edits) => editorRef.value?.applyAiEdits(edits) ?? null)
provide('undoAiEdits', () => editorRef.value?.undoAiEdits())
```

- [ ] **Step 3: 验证**

Run: `cd frontend && npm run build`
Expected: 构建成功。

Run: `cd frontend && npx vitest run`
Expected: 全绿（本任务无新测试，纯函数已被 Task 1 覆盖；Monaco 交互部分走手测）。

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/Editor.vue frontend/src/components/SingleFileShell.vue
git commit -m "feat(agent-edit): Editor applyAiEdits/undoAiEdits + provide to panels"
```

---

### Task 3: EditSuggestionCard 组件 + AiTutorPanel 集成（含决策痕迹剥离）

**Files:**
- Create: `frontend/src/components/EditSuggestionCard.vue`
- Modify: `frontend/src/components/AiTutorPanel.vue:45-51`（消息气泡模板）
- Modify: `frontend/src/components/AiTutorPanel.vue:155-168`（script import 区）

**Interfaces:**
- Consumes: Task 1 的 `parseAssistantMessage`；Task 2 的 provide(`applyAiEdits`/`undoAiEdits`)。
- Produces: assistant 消息渲染 = markdown 正文 + 可选编辑建议卡片；决策痕迹不再出现在气泡里。卡片状态仅存在于组件本地（pending/applied/dismissed），不回写 store。

- [ ] **Step 1: 新建 `frontend/src/components/EditSuggestionCard.vue`**

```vue
<template>
  <div class="es-card">
    <div class="es-header">
      <span class="es-dot" />
      <span class="es-title">编辑建议（{{ edits.length }} 处）</span>
    </div>

    <div v-for="(e, i) in edits" :key="i" class="es-edit">
      <div class="es-edit-title">{{ e.title }}</div>
      <pre class="es-diff es-old"><code>{{ e.old_string }}</code></pre>
      <pre class="es-diff es-new"><code>{{ e.new_string }}</code></pre>
      <div v-if="e.explanation" class="es-expl">{{ e.explanation }}</div>
      <div v-if="skipReason(i)" class="es-skip">已跳过：{{ skipReason(i) }}</div>
    </div>

    <div v-if="status === 'pending'" class="es-actions">
      <button class="es-btn es-apply" :disabled="!applyAiEdits" @click="apply">应用全部</button>
      <button class="es-btn" @click="status = 'dismissed'">忽略</button>
      <span v-if="applyError" class="es-error">{{ applyError }}</span>
    </div>
    <div v-else-if="status === 'applied'" class="es-actions">
      <span class="es-done">已应用 {{ result?.applied ?? 0 }} 处修改</span>
      <button class="es-btn" @click="undo">撤销</button>
    </div>
    <div v-else class="es-actions">
      <span class="es-dismissed">已忽略</span>
    </div>
  </div>
</template>

<script setup>
import { inject, ref } from 'vue'

const props = defineProps({
  edits: { type: Array, required: true },
})

const applyAiEdits = inject('applyAiEdits', null)
const undoAiEdits = inject('undoAiEdits', null)

const status = ref('pending') // 'pending' | 'applied' | 'dismissed'
const result = ref(null)
const applyError = ref('')

const SKIP_LABELS = {
  'not-found': '在当前代码中找不到该片段',
  ambiguous: '该片段在代码中出现多次，无法定位',
  conflict: '与另一处修改范围重叠',
}

function skipReason(i) {
  const p = result.value?.planned?.[i]
  if (!p || p.status === 'ok') return ''
  return SKIP_LABELS[p.status] || p.status
}

function apply() {
  if (!applyAiEdits) return
  const res = applyAiEdits(props.edits)
  if (!res) {
    applyError.value = '编辑器不可用'
    return
  }
  result.value = res
  if (res.applied > 0) status.value = 'applied'
}

function undo() {
  undoAiEdits?.()
  status.value = 'pending'
  result.value = null
}
</script>

<style scoped>
.es-card {
  margin-top: 8px;
  border: 1px solid var(--border);
  border-left: 3px solid var(--accent);
  background: var(--card-bg);
  padding: 8px 10px;
}
.es-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 6px;
}
.es-dot {
  width: 6px;
  height: 6px;
  background: var(--accent);
}
.es-title {
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: var(--text-h);
}
.es-edit {
  margin-bottom: 8px;
}
.es-edit-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-h);
  margin-bottom: 4px;
}
.es-diff {
  font-family: var(--mono);
  font-size: 12px;
  line-height: 1.5;
  margin: 2px 0;
  padding: 4px 8px;
  overflow-x: auto;
  white-space: pre;
}
.es-old {
  background: rgba(220, 38, 38, 0.08);
  border-left: 2px solid #dc2626;
}
.es-new {
  background: rgba(22, 163, 74, 0.08);
  border-left: 2px solid #16a34a;
}
.es-expl {
  font-size: 11px;
  color: var(--text-muted);
  margin-top: 2px;
}
.es-skip {
  font-size: 11px;
  color: #b45309;
  margin-top: 2px;
}
.es-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}
.es-btn {
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  padding: 4px 12px;
  border: 1px solid var(--border);
  background: none;
  color: var(--text-muted);
  cursor: pointer;
}
.es-btn:hover { color: var(--text-h); background: var(--accent-bg); }
.es-apply {
  color: var(--accent);
  border-color: var(--accent);
}
.es-done { font-size: 12px; color: #16a34a; }
.es-dismissed { font-size: 12px; color: var(--text-muted); }
.es-error { font-size: 11px; color: #dc2626; }
</style>
```

- [ ] **Step 2: AiTutorPanel —— 气泡改用解析结果 + 挂卡片**

script import 区（155-158 行）追加：

```js
import { computed } from 'vue'
import EditSuggestionCard from './EditSuggestionCard.vue'
import { parseAssistantMessage } from '../utils/editSuggestion'
```

（`computed` 若已从 vue 导入则合并，不重复导入；当前文件第 156 行是 `import { ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'`，改为追加 `computed`。）

在 `const store = usePlayerStore()` 之后插入：

```js
// assistant 消息解析：剥离【决策痕迹】/【编辑建议】块（流式中途 JSON 不完整时自动按正文展示）
const parsedMessages = computed(() =>
  store.chatMessages.map((m) =>
    m.role === 'assistant' ? parseAssistantMessage(m.text) : { body: m.text, edits: [] },
  ),
)
```

模板 45-51 行的 assistant 气泡替换为：

```html
        <div v-for="(m, i) in store.chatMessages" :key="i" class="chat-msg" :class="m.role">
          <div v-if="m.role === 'user'" class="chat-bubble user">{{ m.text }}</div>
          <div v-else class="chat-bubble assistant">
            <span v-if="!m.text && i === store.chatMessages.length - 1" class="chat-typing">…</span>
            <template v-else>
              <span v-html="renderMarkdown(parsedMessages[i].body)"></span>
              <EditSuggestionCard
                v-if="parsedMessages[i].edits.length && !store.isExplaining"
                :edits="parsedMessages[i].edits"
              />
            </template>
          </div>
        </div>
```

（`!store.isExplaining`：流式未结束时不出卡片，避免半截 JSON 闪现。）

- [ ] **Step 3: 验证**

Run: `cd frontend && npm run build`
Expected: 构建成功。

Run: `cd frontend && npx vitest run`
Expected: 全绿。

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/EditSuggestionCard.vue frontend/src/components/AiTutorPanel.vue
git commit -m "feat(agent-edit): suggestion card in chat, strip decision-trace block"
```

---

### Task 4: coze 侧 prompt 协议 + 契约文档

**Files:**
- Modify: `../javatutor-coze/src/graphs/javatutor/prompts.py:111-118`（SYSTEM_PROMPT_MAIN_AGENT）
- Modify: `../javatutor-coze/docs/spec/2026-08-10-coze-agent-interface.md`（第 2 节后新增小节）

**Interfaces:**
- Consumes: Global Constraints 中的协议文本（逐字）。
- Produces: 主 Agent 在涉及具体代码修改的回答里输出 `【编辑建议】` 块；契约文档记录该块格式与前端解析规则。前端 Task 1 的解析器即按此协议实现。

注意：coze 侧**只加 prompt 段落与文档**，不改 `nodes.py` / 图结构（编辑建议块由模型作为正文一部分输出，`build_final` 追加决策痕迹的顺序天然正确）。

- [ ] **Step 1: prompts.py 新增编辑建议规则段**

在 `_MARKDOWN_RULES` 定义之后插入：

```python
_EDIT_SUGGESTION_RULES = """

## 编辑建议块（当回答包含对当前代码的具体修改时，必须输出）

在正文之后追加（与正文之间空一行）：

【编辑建议】
{"edits":[{"title":"简短标题","old_string":"被替换的源码原文","new_string":"替换后的代码","explanation":"一句话说明"}]}

硬性要求：
1. old_string 必须逐字摘自用户提交的 source_code（含缩进与空白），禁止改写、省略或臆造。
2. old_string 必须在源码中唯一出现；若目标片段不唯一，扩大片段至唯一为止。
3. 多个 edit 的 old_string 区间不得重叠；每个 edit 独立可应用。
4. 仅在确有具体修改建议时输出该块；纯解释类回答不要输出。
5. 该块单独成行，JSON 独占一行，放在【决策痕迹】之前（决策痕迹由系统自动追加，模型不要自行输出）。"""
```

`SYSTEM_PROMPT_MAIN_AGENT` 结尾（第 118 行 `禁止仅凭上下文变量快照直接断言变量值。"""`）改为：

```python
当用户询问当前步骤、变量值或数据变化（data_query）且存在当前步骤索引时，必须先调用 `step_facts` 获取真实证据再回答，禁止仅凭上下文变量快照直接断言变量值。""" + _EDIT_SUGGESTION_RULES
```

- [ ] **Step 2: 契约文档新增小节**

在 `../javatutor-coze/docs/spec/2026-08-10-coze-agent-interface.md` 第 2 节「Response」之后（第 3 节「决策痕迹 Schema」之前）插入：

```markdown
## 2.5 编辑建议块（【编辑建议】）

当回答包含对用户当前代码的具体修改建议时，模型在正文之后、`【决策痕迹】` 之前追加编辑建议块：

```text
正文回答...

【编辑建议】
{"edits":[{"title":"修复越界","old_string":"for (int i = 0; i <= n; i++)","new_string":"for (int i = 0; i < n; i++)","explanation":"i == n 时 arr[i] 越界"}]}

【决策痕迹】
{...}
```

约定：

- `old_string` 逐字摘自请求的 `source_code`（含缩进），且在源码中唯一出现；多个 edit 的区间不重叠。
- 前端解析规则：先按「最后一个 `【决策痕迹】`」剥离痕迹块，再按「最后一个 `【编辑建议】`」提取 JSON；JSON 解析失败或字段缺失时，整块按正文展示，不报错。
- 前端应用时以 `old_string` 在当前编辑器文本中重新定位（用户可能在收到建议后改过代码）：0 次匹配 / 多次匹配 / 区间重叠的 edit 跳过并标注原因。
- 该块由模型作为正文一部分输出，图侧 `build_final` 不感知、不处理。
```

- [ ] **Step 3: 验证**

Run: `cd ../javatutor-coze && python -m py_compile src/graphs/javatutor/prompts.py`
Expected: 无输出（语法通过）。

（coze 端实际效果需真实 API 联调，列入手测清单。）

- [ ] **Step 4: Commit**

```bash
cd ../javatutor-coze
git add src/graphs/javatutor/prompts.py docs/spec/2026-08-10-coze-agent-interface.md
git commit -m "feat(agent-edit): edit-suggestion block protocol in main-agent prompt + spec"
```

---

## 手测清单（交给用户）

1. 运行一段有 bug 的代码（如冒泡排序 `i <= n-1` 越界），问 agent「帮我修复这段代码」→ 回答下方出现「编辑建议」卡片，红删绿增对比正确。
2. 点「应用全部」→ 编辑区代码被修改；卡片变为「已应用 N 处修改 + 撤销」。
3. 点「撤销」→ 代码还原；也可 Ctrl+Z 在编辑器里回滚。
4. 收到建议后先手动改掉目标代码再点应用 → 对应 edit 显示「已跳过：找不到该片段」。
5. 普通问答（不涉及改代码）→ 无卡片，且聊天气泡里**不再出现** `【决策痕迹】` JSON 原文。
