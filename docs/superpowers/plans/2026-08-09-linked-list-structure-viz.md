# Linked List Structure Viz Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在变量页顶部接入确定性链表画布（方块 + next 箭头 + 指针标签），与 `currentStep` 同步；不恢复通用栈→堆箭头图。

**Architecture:** 纯前端从 `currentHeap` + `activeStackFrames`（及上一步）抽取视图模型，喂给已有 `LinkedListCanvas`；抽取逻辑放在可单测的 `linkedListExtract.js`；MemoryPanel 顶部条件渲染。

**Tech Stack:** Vue 3、Pinia（现有 player store）、Vitest（新建，仅测纯函数）、现有 `LinkedListCanvas.vue`。

**Spec:** `docs/superpowers/specs/2026-08-09-linked-list-structure-viz-design.md`

## Global Constraints

- 零新增运行时 npm 依赖；允许新增 **devDependency** `vitest` 测抽取函数。
- 不修改 TraceEngine / 后端 API；不依赖 Coze。
- 不引入 X6 / VueFlow / ELK / Mermaid 画链表。
- 通用 MemoryPanel 颜色联动行为保持不变。
- v1 只画一条链（节点数最多；并列优先 `head` 根）。
- 节点字段：`val`|`value` + `next`（`null` 或 `{ref}`）。

## File Structure

| 文件 | 责任 |
|------|------|
| `frontend/src/utils/linkedListExtract.js` | 建链、指针标签、步进高亮（纯函数） |
| `frontend/src/utils/linkedListExtract.test.js` | 单元测试 |
| `frontend/vitest.config.js` | Vitest + Vite 配置 |
| `frontend/package.json` | 增加 `test` script + vitest |
| `frontend/src/components/MemoryPanel.vue` | 顶部嵌入画布 + computed |
| `frontend/src/components/LinkedListCanvas.vue` | 默认不动；仅 API 缺口时小改 |
| Spec 状态字段 | 标为 Approved |

---

### Task 1: Vitest 脚手架

**Files:**
- Create: `frontend/vitest.config.js`
- Modify: `frontend/package.json`

**Interfaces:**
- Produces: `npm test` 可运行 Vitest

- [ ] **Step 1: 添加 vitest 依赖与脚本**

在 `frontend` 目录：

```bash
npm install -D vitest
```

`package.json` scripts 增加：

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 2: 写 vitest.config.js**

```js
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.js'],
  },
})
```

- [ ] **Step 3: 跑空测试确认命令可用**

Run: `cd frontend && npm test`  
Expected: 无测试文件或 0 tests（不报 config 错即可）

- [ ] **Step 4: Commit**（若用户要求提交）

```bash
git add frontend/package.json frontend/package-lock.json frontend/vitest.config.js
git commit -m "chore(frontend): add vitest for linked-list extract unit tests"
```

---

### Task 2: `extractLinkedListView` — 线性链 + 空堆

**Files:**
- Create: `frontend/src/utils/linkedListExtract.js`
- Create: `frontend/src/utils/linkedListExtract.test.js`

**Interfaces:**
- Produces:
  ```js
  /**
   * @param {object} heap - currentHeap map (id/name keys → heap objects)
   * @param {Array} stackFrames - activeStackFrames (deepest last or as store provides)
   * @param {object|null} prevHeap
   * @param {Array|null} prevStackFrames
   * @returns {{ nodes: Array<{id,val,next,_cycle?}>, pointerLabels: Record<string,string[]>, highlightedNodeIds: string[] }}
   */
  export function extractLinkedListView(heap, stackFrames, prevHeap = null, prevStackFrames = null)
  ```
- `nodes[].next` = 下一节点 id 字符串或 `null`
- 无链时返回 `{ nodes: [], pointerLabels: {}, highlightedNodeIds: [] }`

- [ ] **Step 1: 写失败测试**

```js
import { describe, it, expect } from 'vitest'
import { extractLinkedListView } from './linkedListExtract.js'

describe('extractLinkedListView', () => {
  it('returns empty when heap has no list nodes', () => {
    const heap = {
      arr0: { id: 'H1', type: 'int[]', fields: {}, slots: [1, 2] },
    }
    expect(extractLinkedListView(heap, [])).toEqual({
      nodes: [],
      pointerLabels: {},
      highlightedNodeIds: [],
    })
  })

  it('builds a linear chain from head', () => {
    const heap = {
      n1: {
        id: 'N1', type: 'ListNode',
        fields: { val: 1, next: { ref: 'N2' } },
      },
      n2: {
        id: 'N2', type: 'ListNode',
        fields: { val: 2, next: null },
      },
    }
    const frames = [{
      method: 'reverse',
      locals: { head: { ref: 'N1' } },
      args: {},
    }]
    const view = extractLinkedListView(heap, frames)
    expect(view.nodes.map(n => n.id)).toEqual(['N1', 'N2'])
    expect(view.nodes[0]).toMatchObject({ id: 'N1', val: 1, next: 'N2' })
    expect(view.nodes[1]).toMatchObject({ id: 'N2', val: 2, next: null })
    expect(view.pointerLabels.N1).toContain('head')
  })
})
```

- [ ] **Step 2: Run — 期望 FAIL**

Run: `cd frontend && npm test -- src/utils/linkedListExtract.test.js`  
Expected: FAIL（模块不存在）

- [ ] **Step 3: 最小实现**

实现识别（`ListNode`/`Node` 或 `val|value`+`next`）、沿 `next` 建链、指针标签；高亮可先返回 `[]` 或根节点。

注意：heap map 的 key 可能是 name 而 `id` 在对象内；建索引时同时按 `obj.id` 与 map key 查找 `{ref}`。

- [ ] **Step 4: Run — 期望 PASS**

Run: `cd frontend && npm test -- src/utils/linkedListExtract.test.js`  
Expected: PASS

- [ ] **Step 5: Commit**（若用户要求）

```bash
git add frontend/src/utils/linkedListExtract.js frontend/src/utils/linkedListExtract.test.js
git commit -m "feat(frontend): extract linear linked-list view from heap snapshots"
```

---

### Task 3: 环检测、多链择优、`value` 字段、步进高亮

**Files:**
- Modify: `frontend/src/utils/linkedListExtract.js`
- Modify: `frontend/src/utils/linkedListExtract.test.js`

**Interfaces:**
- Consumes / Produces: 同 Task 2；补充 `_cycle`、多根择链、`highlightedNodeIds`

- [ ] **Step 1: 追加失败测试**

```js
  it('marks cycle and stops', () => {
    const heap = {
      a: { id: 'A', type: 'ListNode', fields: { val: 1, next: { ref: 'B' } } },
      b: { id: 'B', type: 'ListNode', fields: { val: 2, next: { ref: 'A' } } },
    }
    const frames = [{ method: 'f', locals: { head: { ref: 'A' } }, args: {} }]
    const view = extractLinkedListView(heap, frames)
    expect(view.nodes.some(n => n._cycle)).toBe(true)
    expect(view.nodes.length).toBeLessThanOrEqual(2)
  })

  it('prefers longer chain when multiple roots', () => {
    const heap = {
      a: { id: 'A', type: 'ListNode', fields: { val: 1, next: null } },
      b: { id: 'B', type: 'ListNode', fields: { val: 1, next: { ref: 'C' } } },
      c: { id: 'C', type: 'ListNode', fields: { val: 2, next: null } },
    }
    const frames = [{
      method: 'f',
      locals: { shortHead: { ref: 'A' }, head: { ref: 'B' } },
      args: {},
    }]
    const view = extractLinkedListView(heap, frames)
    expect(view.nodes.map(n => n.id)).toEqual(['B', 'C'])
  })

  it('highlights nodes whose pointer target changed', () => {
    const heap = {
      a: { id: 'A', type: 'ListNode', fields: { val: 1, next: { ref: 'B' } } },
      b: { id: 'B', type: 'ListNode', fields: { val: 2, next: null } },
    }
    const prevFrames = [{ method: 'f', locals: { curr: { ref: 'A' } }, args: {} }]
    const frames = [{ method: 'f', locals: { curr: { ref: 'B' } }, args: {} }]
    const view = extractLinkedListView(heap, frames, heap, prevFrames)
    expect(view.highlightedNodeIds).toContain('B')
  })

  it('accepts value field alias', () => {
    const heap = {
      n: { id: 'N', type: 'Node', fields: { value: 9, next: null } },
    }
    const frames = [{ method: 'f', locals: { head: { ref: 'N' } }, args: {} }]
    const view = extractLinkedListView(heap, frames)
    expect(view.nodes[0].val).toBe(9)
  })
```

- [ ] **Step 2: Run — 期望部分 FAIL**

- [ ] **Step 3: 补全实现**（环、多链评分、prev 对比高亮、`value`）

多链评分：链长度为主；并列时根变量名含 `head`（大小写不敏感）优先。

- [ ] **Step 4: Run — 期望 PASS**

- [ ] **Step 5: Commit**（若用户要求）

```bash
git commit -am "feat(frontend): linked-list extract cycle, chain pick, step highlight"
```

---

### Task 4: MemoryPanel 嵌入画布

**Files:**
- Modify: `frontend/src/components/MemoryPanel.vue`（template 顶部 `mp-body` 内、栈区之前）
- Verify: `frontend/src/components/LinkedListCanvas.vue` props 对齐

**Interfaces:**
- Consumes: `extractLinkedListView(heap, frames, prevHeap, prevFrames)`
- 从 store：`currentHeap`、`activeStackFrames`、`steps`、`currentStep`

- [ ] **Step 1: import 组件与抽取函数**

```js
import LinkedListCanvas from './LinkedListCanvas.vue'
import { extractLinkedListView } from '../utils/linkedListExtract.js'
```

- [ ] **Step 2: 增加 computed**

```js
const linkedListView = computed(() => {
  const heap = store.currentHeap || {}
  const frames = store.activeStackFrames || []
  const prev = store.currentStep > 0 ? store.steps[store.currentStep - 1] : null
  const prevHeap = prev?.heap || null
  const prevFrames = prev?.stackFrames || null
  return extractLinkedListView(heap, frames, prevHeap, prevFrames)
})
```

确认 `steps[i]` 上堆/栈字段名与 store 一致（若为 `heap` / `stackFrames` 或其它，以 `player.js` / Trace 实际字段为准；不一致时在 computed 内适配，**不改后端**）。

- [ ] **Step 3: 模板嵌入**

在 `mp-body` 内、栈区之前：

```html
<div v-if="linkedListView.nodes.length" class="mp-ll-wrap">
  <div class="mp-ll-title">链表结构</div>
  <LinkedListCanvas
    :nodes="linkedListView.nodes"
    :pointer-labels="linkedListView.pointerLabels"
    :highlighted-node-ids="linkedListView.highlightedNodeIds"
  />
</div>
```

- [ ] **Step 4: 最小样式**

```css
.mp-ll-wrap {
  margin-bottom: 10px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border);
}
.mp-ll-title {
  font-family: var(--mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-muted);
  margin-bottom: 6px;
}
```

- [ ] **Step 5: 手动验收**

1. `npm run dev` + 后端；打开经典链表反转或手写 `ListNode`。  
2. 运行 → 变量页顶部出现链。  
3. 步进 → `curr`/`prev` 标签移动，高亮变化。  
4. 跑纯数组排序 → **无**链表区域。  
5. 颜色悬浮联动仍正常。

- [ ] **Step 6: Commit**（若用户要求）

```bash
git add frontend/src/components/MemoryPanel.vue
git commit -m "feat(frontend): show linked-list canvas atop memory panel"
```

---

### Task 5: Spec 收尾 + 文档状态

**Files:**
- Modify: `docs/superpowers/specs/2026-08-09-linked-list-structure-viz-design.md`  
  `状态：Draft` → `状态：Approved / Implemented`（实现完成后）

- [ ] **Step 1: 更新 spec 状态**

- [ ] **Step 2: 确认 `npm test` 与手动验收清单全部通过**

- [ ] **Step 3: Commit**（若用户要求）

```bash
git commit -am "docs: mark linked-list structure viz spec implemented"
```

---

## Manual Test Matrix（执行者勾选）

| # | 场景 | 期望 |
|---|------|------|
| 1 | `ListNode` 反转链表 | 顶部链图；步进指针移动 |
| 2 | 环链表（若有例） | `_cycle` 标记，不崩 |
| 3 | 仅 `int[]` 排序 | 无链图 |
| 4 | 快速连点步进 | 无明显整页闪 |

## Out of Scope Reminder

独立「结构」tab、多链并列、`compareNodeIds` 双指针配色 → v1.1（见 spec §8）。
