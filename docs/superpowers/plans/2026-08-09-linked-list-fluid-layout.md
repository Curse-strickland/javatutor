# Linked List Fluid Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让链表画布在步进时按语义坐标滑动重组，并支持临时拖拽；下一步强制回到语义布局。

**Architecture:** 抽出纯函数 `layoutLinkedList(nodes) -> positions`；`LinkedListCanvas` 改为绝对定位 + CSS transform transition；箭头由坐标推导（rAF 跟随）；`dragOffset` 在 `currentStep` 变化时清空。

**Tech Stack:** Vue 3、现有 Vitest、无新运行时依赖。

**Spec:** `docs/superpowers/specs/2026-08-09-linked-list-fluid-layout-design.md`

## Global Constraints

- 不引入 X6 / VueFlow / ELK。
- 不改 `linkedListExtract.js` 契约（可只读）。
- 步进重置拖拽（选项 A）。
- `prefers-reduced-motion: reduce` 时无 transition。
- Commit 仅在用户明确要求时执行。

## File Structure

| 文件 | 责任 |
|------|------|
| `frontend/src/utils/linkedListLayout.js` | 语义坐标纯函数 |
| `frontend/src/utils/linkedListLayout.test.js` | 布局单测 |
| `frontend/src/components/LinkedListCanvas.vue` | 坐标渲染、滑动、拖拽、箭头跟随 |
| `frontend/src/components/MemoryPanel.vue` | 可选：加高 `.mp-ll-wrap` |
| Spec 状态 | Approved → Implemented |

---

### Task 1: `layoutLinkedList` 纯函数 + 测试

**Files:**
- Create: `frontend/src/utils/linkedListLayout.js`
- Create: `frontend/src/utils/linkedListLayout.test.js`

**Interfaces:**
```js
/**
 * @param {Array<{id:string,_cycle?:boolean}>} nodes
 * @param {{ nodeW?:number, nodeH?:number, gapX?:number, padding?:number, baseY?:number, cycleLift?:number }} [opts]
 * @returns {{ positions: Record<string,{x:number,y:number}>, width:number, height:number }}
 */
export function layoutLinkedList(nodes, opts = {})
```

Defaults (match spec): `nodeW=72`, `nodeH=40`, `gapX=36`, `padding=16`, `baseY=48`, `cycleLift=28`.

- [x] **Step 1: 写失败测试** — 空数组；三点线性链 x 递增、y 同为 baseY；带 `_cycle` 的节点 y 上抬。
- [x] **Step 2: `npm test -- src/utils/linkedListLayout.test.js` 期望 FAIL**
- [x] **Step 3: 实现 layoutLinkedList**
- [x] **Step 4: 测试 PASS**
- [x] **Step 5: 无 commit（除非用户要求）**

---

### Task 2: LinkedListCanvas 坐标定位 + 滑动

**Files:**
- Modify: `frontend/src/components/LinkedListCanvas.vue`

**Interfaces:**
- Consumes: `layoutLinkedList(props.nodes)`
- Display position = semantic + dragOffset（本任务 dragOffset 恒 `{}`）

- [x] **Step 1: 用 layout 结果绝对定位节点**（`position:absolute; transform:translate(x,y)`），去掉依赖 flex 横排作为唯一布局（可保留节点内部结构）。
- [x] **Step 2: 画布宽高用 layout 的 width/height；箭头端点用坐标推导**（节点右锚点 → 下一节点左锚点），减少对 getBoundingClientRect 的强依赖；步进后可用 rAF 在 transition 期间重绘箭头 1–2 帧或 continuous rAF until transitionend。
- [x] **Step 3: CSS transition on transform；`@media (prefers-reduced-motion: reduce)` 关闭。
- [x] **Step 4: 手测或保持 extract 测试仍绿：`npm test`
- [x] **Step 5: 无 commit（除非用户要求）**

---

### Task 3: 拖拽 + 步进重置（选项 A）

**Files:**
- Modify: `frontend/src/components/LinkedListCanvas.vue`
- Modify: `frontend/src/components/MemoryPanel.vue`（可选：传入 `layout-reset-key="store.currentStep"` 或 canvas 内 watch 无 prop）

**Interfaces:**
- `dragOffset: Record<id,{dx,dy}>` 组件内部 state
- 显示坐标 = layout + offset
- 清空时机：`watch(() => props.nodes` 的 id 序列/拓扑 **或** 由父传入 `:step="store.currentStep"` 并 watch step

推荐父组件传：

```html
<LinkedListCanvas ... :layout-epoch="store.currentStep" />
```

`watch(layoutEpoch, () => { dragOffset = {} })`

- [x] **Step 1: 增加 prop `layoutEpoch`（Number）**
- [x] **Step 2: pointer 拖拽更新 offset；pointerup 结束**
- [x] **Step 3: watch layoutEpoch 清空 offset**
- [x] **Step 4: MemoryPanel 传入 `:layout-epoch="store.currentStep"`**
- [x] **Step 5: 可选提高 `.mp-ll-wrap` min-height（如 120px）**
- [x] **Step 6: `npm test` 全绿；手测反转滑动 + 拖后下一步复位**

---

### Task 4: Spec 收尾

**Files:**
- Modify: `docs/superpowers/specs/2026-08-09-linked-list-fluid-layout-design.md` 状态 → Approved · Implemented

- [x] **Step 1: 更新状态**
- [x] **Step 2: 确认测试与手测清单**

## Manual Test Matrix

| # | 场景 | 期望 |
|---|------|------|
| 1 | 反转链表步进 | 节点滑动换位 |
| 2 | 拖开节点再下一步 | 回到语义横排基线 |
| 3 | reduced-motion | 无滑动直接跳 |
| 4 | 无链表 | 不显示画布 |
