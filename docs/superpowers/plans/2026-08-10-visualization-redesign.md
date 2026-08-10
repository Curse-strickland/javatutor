# 可视化重构（单/多文件双模式）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不破坏现有功能的前提下，把 JavaTutor 重构为「单文件 / 多文件」两种独立 UI 模式；单文件右侧新增「数据结构」「算法」两个 tab（数据结构做链表/数组/树/堆/图可视化；算法 tab 顶部挂折叠算法知识库）；多文件模式右侧展示 5 种 UML 图。

**Architecture:** 单/多文件共享 ModeBar 与 Pinia store 顶层；store 用 `singleState`/`multiState` 双快照隔离；main-area 拆为 `SingleFileShell.vue` 与 `MultiFileShell.vue` 两种独立 UI。新增 `dataStructureExtract.js` 纯函数层，遵循现有 `linkedListExtract.js` 模式。UML 由 Coze 扩展 `intent=uml` 链路 + 静态 SVG 兜底。

**Tech Stack:** Vue 3 (Composition API + `<script setup>`)、Pinia、Monaco Editor（多文件 readonly 模式）、SVG + CSS、Vitest（前端单测）。后端：Spring Boot + Coze（Java + Python learning 模块）。

---

## Global Constraints

- 不得修改 `javatutor/backend/src/main/java/com/javatutor/sandbox/**` 现有文件（除非规格显式允许）。
- 后端改造仅允许落在 `backend/src/main/java/com/javatutor/service/CozeService.java` 与 `backend/src/main/java/com/javatutor/learning/animation.py`（M4）。
- 前端零新增重型 npm 依赖（marked/markdown-it 等 M3 才引入，且 ≤ 30KB gzip）。
- 不得修改 Monaco 编辑器现有功能（多文件模式仅切 readonly，不改主题/快捷键）。
- 严格遵守规格 §3 的 tab 顺序：单文件 `变量 / 流程 / 数据结构 / 算法 / 问答 / 动画`；多文件 `流程 / 数据流 / 结构 / 类图 / 用例`。
- 不得引入 Mermaid / AntV X6 / VueFlow / ELK（历史结论：通用引用箭头失败）。
- 所有前端纯函数必须有 Vitest 单元测试；Vue 组件至少手测一次（见 §验收标准）。
- 文件命名遵循现有 `PascalCase + 类型后缀`（如 `LinkedListCanvas.vue`）。
- 测试模式、导入按钮、运行/步进/播放/速度、AI 问答、SVG 动画生成**全部保留**，禁止回归。
- 提交粒度：每个 task 末尾 commit 一次。

---

## File Structure

| 文件 | 责任 | 里程碑 |
|------|------|--------|
| `frontend/src/components/ModeBar.vue` | 顶部单/多文件 segmented control + localStorage 持久化 | M1 |
| `frontend/src/components/SingleFileShell.vue` | 单文件 main-area（含编辑器 + 6 tab 右侧栏） | M1 |
| `frontend/src/components/right-tabs/DataStructureTab.vue` | 数据结构 Tab（识别徽章 + 画布分组 + 折叠） | M1 |
| `frontend/src/components/right-tabs/AlgoTab.vue` | 算法 Tab（M3 后顶部加知识库折叠条） | M1 |
| `frontend/src/components/ArrayCanvas.vue` | 数组类画布（head/tail + 索引） | M1 |
| `frontend/src/components/ArrayNode.vue` | 数组节点（val 格子） | M1 |
| `frontend/src/components/LinkedListCanvas.vue` | 扩双向链表（prev + 双向箭头） | M1 |
| `frontend/src/utils/dataStructureExtract.js` | 纯函数抽取（链/数组；M2 扩树/图） | M1→M2 |
| `frontend/src/utils/dataStructureExtract.test.js` | Vitest 单测 | M1→M2 |
| `frontend/src/stores/player.js` | 加 `mode`/`singleState`/`multiState`/`switchMode` | M1→M4 |
| `frontend/src/App.vue` | 顶部挂 ModeBar；按 mode 渲染对应 Shell | M1 |
| `frontend/src/components/MemoryPanel.vue` | 移除 LinkedListCanvas 嵌入 | M1 |
| `frontend/src/components/TreeCanvas.vue` | 二叉树/堆画布（layer + 搜索高亮） | M2 |
| `frontend/src/components/TreeNode.vue` | 树节点（圆形 + val） | M2 |
| `frontend/src/components/GraphCanvas.vue` | 图画布（无向/有向/网络流） | M2 |
| `frontend/src/components/GraphNode.vue` | 图节点 | M2 |
| `frontend/src/components/AlgoKnowledgeHeader.vue` | 算法知识库折叠条（M3 接入） | M3 |
| `frontend/src/assets/algo-knowledge/index.json` | 知识库索引 | M3 |
| `frontend/src/assets/algo-knowledge/*.md` | 知识库文档（按类别） | M3 |
| `frontend/src/components/MultiFileShell.vue` | 多文件 main-area | M4 |
| `frontend/src/components/FileTabsBar.vue` | 多文件 tab + 上传 | M4 |
| `frontend/src/components/UmlPanel.vue` | 通用 UML 容器（生成/缓存/兜底） | M4 |
| `frontend/src/components/ProjectRunBar.vue` | 项目级运行控件 | M4 |
| `frontend/src/assets/uml-fallback/*.svg` | 5 种 UML 静态兜底 | M4 |
| `backend/src/main/java/com/javatutor/service/CozeService.java` | 加 `intent=uml` | M4 |
| `backend/src/main/java/com/javatutor/learning/animation.py` | UML 模板与 Coze prompt | M4 |

---

# Milestone 1: 模式入口 + 单文件 6 Tab + 数据结构（链表 + 数组）

**目标：** 顶部出现 ModeBar；单文件 main-area 抽到 `SingleFileShell.vue`；右侧重排为 6 tab；新增「数据结构」Tab 支持链表（单向+双向）与数组画布。

**拆分为 8 个 task：**

---

### Task 1.1: store 增加 mode / singleState / multiState / switchMode

**Files:**
- Modify: `frontend/src/stores/player.js`

**Interfaces:**
- Adds: `state.mode: 'single'|'multi'`、`state.singleState: {...}`、`state.multiState: {files: [], currentFileIndex: 0, ...}`、`actions.switchMode(mode)`、`actions.persistMode()`、`actions.restoreMode()`
- 双快照包含：`steps, currentStep, code, chatMessages, svgText, controlFlowData, uploadHistory`；不含 `testMode/testCases`（多文件不适用）。

- [ ] **Step 1: 编写失败测试**

新建 `frontend/src/stores/__tests__/player-mode.test.js`：

```js
import { setActivePinia, createPinia } from 'pinia'
import { describe, it, expect, beforeEach } from 'vitest'
import { usePlayerStore } from '../player'

describe('player store mode', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('starts in single mode by default', () => {
    const s = usePlayerStore()
    expect(s.mode).toBe('single')
  })

  it('switchMode to multi updates state and persists', () => {
    const s = usePlayerStore()
    s.switchMode('multi')
    expect(s.mode).toBe('multi')
    expect(localStorage.getItem('jt-mode')).toBe('multi')
  })

  it('restoreMode reads from localStorage', async () => {
    localStorage.setItem('jt-mode', 'multi')
    const s = usePlayerStore()
    s.restoreMode()
    expect(s.mode).toBe('multi')
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd frontend && npx vitest run src/stores/__tests__/player-mode.test.js`
Expected: FAIL（`mode is not defined`）

- [ ] **Step 3: 在 store state 增加字段**

修改 `frontend/src/stores/player.js` 的 `state()`：

```js
state: () => ({
  // ... 现有字段保留 ...
  mode: 'single',
  singleState: null,    // null 表示未存过；非 null 时存快照对象
  multiState: {
    files: [],             // [{name, code, lang}]
    currentFileIndex: 0,
    umlCache: {},          // {kind: {svg, ts, source}}
  },
}),
```

- [ ] **Step 4: 增加 switchMode / persistMode / restoreMode actions**

在 `actions` 内增加：

```js
persistMode() {
  try { localStorage.setItem('jt-mode', this.mode) } catch {}
},

restoreMode() {
  try {
    const m = localStorage.getItem('jt-mode')
    if (m === 'multi' || m === 'single') this.mode = m
  } catch {}
},

captureSingleSnapshot() {
  return {
    steps: this.steps,
    currentStep: this.currentStep,
    code: this.code,
    chatMessages: this.chatMessages,
    svgText: this.svgText,
    controlFlowData: this.controlFlowData,
    uploadHistory: this.uploadHistory,
  }
},

restoreSingleSnapshot(snap) {
  if (!snap) return
  this.steps = snap.steps || []
  this.currentStep = snap.currentStep || 0
  this.code = snap.code || ''
  this.chatMessages = snap.chatMessages || []
  this.svgText = snap.svgText || null
  this.controlFlowData = snap.controlFlowData || null
  this.uploadHistory = snap.uploadHistory || []
},

switchMode(mode) {
  if (mode !== 'single' && mode !== 'multi') return
  if (mode === this.mode) return
  // 捕获当前模式快照
  if (this.mode === 'single') {
    this.singleState = this.captureSingleSnapshot()
  }
  // 切换
  this.mode = mode
  // 恢复目标模式快照（如有）
  if (mode === 'single' && this.singleState) {
    this.restoreSingleSnapshot(this.singleState)
  }
  // multiState 用现有默认值；首次切到 multi 时不强加空快照
  this.persistMode()
},
```

- [ ] **Step 5: 跑测试确认通过**

Run: `cd frontend && npx vitest run src/stores/__tests__/player-mode.test.js`
Expected: PASS（3 tests）

- [ ] **Step 6: 手动验证冷启动**

Run: `cd frontend && npm run dev`，打开浏览器，刷新 3 次：
- 期望：始终进入单文件模式（默认）。
- 改 localStorage `jt-mode` 为 `multi`，刷新 → 期望进入多文件模式（多文件 shell 占位即可，后续 task 实现）。

- [ ] **Step 7: Commit**

```bash
git add frontend/src/stores/player.js frontend/src/stores/__tests__/player-mode.test.js
git commit -m "feat(store): 增加单/多文件模式状态与切换 action"
```

---

### Task 1.2: 新建 ModeBar.vue

**Files:**
- Create: `frontend/src/components/ModeBar.vue`

**Interfaces:**
- Props: 无
- Reads: `store.mode`、`store.switchMode`
- Emits: 无（直接调 store）

- [ ] **Step 1: 创建组件骨架**

`frontend/src/components/ModeBar.vue`：

```vue
<template>
  <div class="mode-bar" role="tablist" aria-label="文件模式">
    <button
      v-for="opt in options"
      :key="opt.value"
      class="mode-bar-btn"
      :class="{ active: store.mode === opt.value }"
      role="tab"
      :aria-selected="store.mode === opt.value"
      @click="store.switchMode(opt.value)"
    >{{ opt.label }}</button>
    <span class="mode-bar-brand">JavaTutor · 教学终端</span>
  </div>
</template>

<script setup>
import { usePlayerStore } from '../stores/player'
const store = usePlayerStore()
const options = [
  { label: '单文件', value: 'single' },
  { label: '多文件', value: 'multi' },
]
</script>

<style scoped>
.mode-bar {
  position: relative;
  z-index: 3;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  margin: 8px 12px 0;
  background: var(--card-bg);
  border: 1px solid var(--border);
  clip-path: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px);
  box-shadow: var(--shadow);
  min-height: 40px;
}
.mode-bar::after {
  content: '';
  position: absolute;
  left: 0;
  bottom: -1px;
  width: 88px;
  height: 2px;
  background: var(--accent);
}
.mode-bar-btn {
  background: transparent;
  border: 1px solid var(--line-strong);
  padding: 6px 16px;
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-muted);
  cursor: pointer;
  clip-path: polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px);
  transition: color 0.15s, background 0.15s, border-color 0.15s;
}
.mode-bar-btn:hover { color: var(--text-h); background: var(--accent-bg); }
.mode-bar-btn.active {
  color: var(--accent);
  border-color: var(--accent);
  background: var(--accent-bg);
  box-shadow: inset 0 -2px 0 var(--accent);
}
.mode-bar-brand {
  margin-left: auto;
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--text-muted);
}
</style>
```

- [ ] **Step 2: 在 App.vue 临时挂上（用于视觉验证）**

在 `frontend/src/App.vue` 顶部 `<BootIntro>` **之后**、`<VideoBackground>` **之前**插入：

```vue
<ModeBar />
```

并在 `<script setup>` 增加：

```js
import ModeBar from './components/ModeBar.vue'
```

- [ ] **Step 3: 启动 dev 服务器目视确认**

Run: `cd frontend && npm run dev`
- 期望：顶部出现「单文件/多文件」segmented control；切换有 accent 描边效果。
- 期望：与下方 RuntimeWire banner 风格协调（青蓝 + 切角 + 档案纸）。

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ModeBar.vue frontend/src/App.vue
git commit -m "feat(ui): 新增 ModeBar 单/多文件 segmented control"
```

---

### Task 1.3: 抽出 SingleFileShell.vue（含 6 tab 右侧栏）

**Files:**
- Create: `frontend/src/components/SingleFileShell.vue`
- Modify: `frontend/src/App.vue`（替换现有 main-area 为 ModeBar + SingleFileShell）

**Interfaces:**
- Props: 无
- Reads: `store.mode === 'single'` 才渲染（由 App 控制）
- 渲染：左侧编辑器卡片 + 右侧 6 tab 卡

- [ ] **Step 1: 把现有 main-area 内容搬到 SingleFileShell.vue**

新建 `frontend/src/components/SingleFileShell.vue`，**完整复制** `frontend/src/App.vue` 中 `<div ref="containerRef" class="main-area">` 及其内部全部内容（包括左右两栏、splitter、control-bar 等）。同时把所有与之相关的 `<script setup>` 逻辑（拖拽、进度条、自动播放、AI tab 切换、运行/上一步/下一步 等）一并搬过去。

> 注意：原 App.vue 的 `<style scoped>` 中所有 `.main-area / .editor-card / .right-card / .control-bar / .splitter / .right-tab` 等样式都搬入 `SingleFileShell.vue` 的 `<style scoped>`。App.vue 的 `<style scoped>` 移除这些规则但保留 `.app-shell / .runtime-wire / .site-disclaimer / .app-shell::before` 等外壳样式。

- [ ] **Step 2: 在 SingleFileShell.vue 把 rightTab 顺序改为 6 个**

修改 `SingleFileShell.vue` 中右侧栏 header 与 body：

```vue
<button class="right-tab" :class="{ active: store.rightTab === 'variables' }" @click="store.switchRightTab('variables')">变量</button>
<button class="right-tab" :class="{ active: store.rightTab === 'flow' }" @click="store.switchRightTab('flow')">流程</button>
<button class="right-tab" :class="{ active: store.rightTab === 'datastructure' }" @click="store.switchRightTab('datastructure')">数据结构</button>
<button class="right-tab" :class="{ active: store.rightTab === 'algorithm' }" @click="store.switchRightTab('algorithm')">算法</button>
<button class="right-tab" :class="{ active: store.rightTab === 'tutor' }" @click="store.switchRightTab('tutor')">问答</button>
<button class="right-tab" :class="{ active: store.rightTab === 'animate' }" @click="store.switchRightTab('animate')">动画</button>
```

body 内增加 `datastructure` 与 `algorithm` 两个 pane（先用 placeholder）：

```vue
<div v-show="store.rightTab === 'datastructure'" class="right-pane">
  <DataStructureTab />
</div>
<div v-show="store.rightTab === 'algorithm'" class="right-pane">
  <AlgoTab />
</div>
```

并在 `<script setup>` import：

```js
import DataStructureTab from './right-tabs/DataStructureTab.vue'
import AlgoTab from './right-tabs/AlgoTab.vue'
```

- [ ] **Step 3: 在 store 增加 `switchRightTab` 接受新 tab 值**

修改 `frontend/src/stores/player.js` 的 `switchRightTab` action（已存在），让白名单覆盖新值：

```js
switchRightTab(tab) {
  const allowed = ['variables', 'flow', 'datastructure', 'algorithm', 'tutor', 'animate']
  if (allowed.includes(tab)) this.rightTab = tab
},
```

- [ ] **Step 4: 创建占位 Tab 组件（Task 1.4 之前先用空壳）**

新建 `frontend/src/components/right-tabs/DataStructureTab.vue`：

```vue
<template>
  <div class="placeholder-tab">
    <h3>数据结构 Tab</h3>
    <p>M1 占位 — 后续 task 接入链表 / 数组画布</p>
  </div>
</template>

<style scoped>
.placeholder-tab { padding: 16px; color: var(--text-muted); font-family: var(--mono); font-size: 12px; }
.placeholder-tab h3 { color: var(--text-h); margin-bottom: 8px; }
</style>
```

新建 `frontend/src/components/right-tabs/AlgoTab.vue`：

```vue
<template>
  <div class="placeholder-tab">
    <h3>算法 Tab</h3>
    <p>M1 占位 — M3 接算法知识库；现有 ControlFlowPanel 与 AiTutorPanel 在此 tab 内组装</p>
  </div>
</template>

<style scoped>
.placeholder-tab { padding: 16px; color: var(--text-muted); font-family: var(--mono); font-size: 12px; }
.placeholder-tab h3 { color: var(--text-h); margin-bottom: 8px; }
</style>
```

- [ ] **Step 5: 在 App.vue 用 ModeBar + SingleFileShell 替换现有 main-area**

修改 `frontend/src/App.vue`：

- 删除 `<div ref="containerRef" class="main-area">...</div>` 整段
- 在 `<RuntimeWire>` 与 `<footer>` 之间插入：

```vue
<SingleFileShell v-if="store.mode === 'single'" />
```

- 删除 App.vue 内已搬走的所有相关 `<script setup>` 变量、函数与样式
- import 增加：

```js
import SingleFileShell from './components/SingleFileShell.vue'
```

- [ ] **Step 6: 启动 dev 服务器端到端验证**

Run: `cd frontend && npm run dev`

检查清单：
- 顶部 ModeBar 出现；右侧 6 tab 顺序正确。
- 点击各 tab：变量/流程/问答/动画/数据结构/算法 都能切换（后两个显示占位文案）。
- 运行代码 → 步进 → 进度条 → AI 问答 → SVG 动画 → 测试模式 → 导入按钮 全部正常工作。
- 控制栏拖动、splitter 拖动正常。

- [ ] **Step 7: Commit**

```bash
git add frontend/src/App.vue frontend/src/components/SingleFileShell.vue \
  frontend/src/components/right-tabs/DataStructureTab.vue \
  frontend/src/components/right-tabs/AlgoTab.vue \
  frontend/src/stores/player.js
git commit -m "refactor: 抽出 SingleFileShell 与 6 tab 右侧栏（含占位）"
```

---

### Task 1.4: MemoryPanel 移除 LinkedListCanvas 嵌入

**Files:**
- Modify: `frontend/src/components/MemoryPanel.vue`

**Interfaces:**
- Removes: `<LinkedListCanvas>` block、import、`onMounted`/`watch` 中相关逻辑（若有）

- [ ] **Step 1: 阅读现有 LinkedListCanvas 嵌入位置**

```bash
grep -n "LinkedListCanvas" frontend/src/components/MemoryPanel.vue
```

- [ ] **Step 2: 移除 import**

删除 `import LinkedListCanvas from './LinkedListCanvas.vue'`

- [ ] **Step 3: 移除 template 中的嵌入块**

删除 `MemoryPanel.vue` 中 `<LinkedListCanvas ... />` 相关 `<template>` 内容（保留其余堆/栈卡片）。

- [ ] **Step 4: 移除任何相关 computed / props**

若 `MemoryPanel.vue` 中存在 `linkedListView` / `extractLinkedListView` 等仅服务于画布的计算属性，删除。

- [ ] **Step 5: 启动 dev 验证**

- 期望：变量 Tab 不再出现链图画布；堆/栈卡片正常。
- 数据结构 Tab（占位）暂未接，链表画布整体消失是预期；M1 后续 task 接入。

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/MemoryPanel.vue
git commit -m "refactor(memory): 移除 LinkedListCanvas 嵌入（迁到数据结构 Tab）"
```

---

### Task 1.5: LinkedListCanvas 扩双向链表

**Files:**
- Modify: `frontend/src/components/LinkedListCanvas.vue`

**Interfaces:**
- 现有 props 保持兼容；新增识别双向链表的视觉表现（节点三格 + prev 箭头）
- 节点对象约定新增 `prev: string|null`（向后兼容：缺失时按单向渲染）

- [ ] **Step 1: 阅读现有 LinkedListCanvas.vue 与 linkedListLayout.js**

确认 `layoutLinkedList` 与 `buildLinkedListArrowPaths` 的输入。

- [ ] **Step 2: 编写失败测试（节点布局支持 prev）**

新建 `frontend/src/utils/__tests__/linkedListDoubly.test.js`：

```js
import { describe, it, expect } from 'vitest'
import { layoutLinkedList } from '../linkedListLayout.js'

describe('doubly linked list layout', () => {
  it('positions prev arrow anchor on left cell', () => {
    const nodes = [
      { id: 'a', val: 1, prev: null, next: 'b' },
      { id: 'b', val: 2, prev: 'a', next: 'c' },
      { id: 'c', val: 3, prev: 'b', next: null },
    ]
    const layout = layoutLinkedList(nodes, { nodeW: 100, nodeH: 50 })
    expect(layout.nodes.b.prevAnchor).toBeDefined()
    expect(layout.nodes.b.nextAnchor).toBeDefined()
    expect(layout.nodes.b.prevAnchor.x).toBeLessThan(layout.nodes.b.nextAnchor.x)
  })
})
```

- [ ] **Step 3: 跑测试确认失败**

Run: `cd frontend && npx vitest run src/utils/__tests__/linkedListDoubly.test.js`
Expected: FAIL（`prevAnchor` undefined）

- [ ] **Step 4: 扩展 linkedListLayout.js 输出 prevAnchor**

修改 `layoutLinkedList` 函数输出结构，每个节点除现有 `anchor`（next 锚点）外增加 `prevAnchor`（仅当 `prev !== undefined` 时）：

```js
const layout = { width, height, nodes: {} }
for (let i = 0; i < nodes.length; i++) {
  const n = nodes[i]
  const x = padding + col * (nodeW + gapX)
  const y = padding + row * (nodeH + gapY)
  const nodeLayout = {
    x, y, w: nodeW, h: nodeH,
    anchor: { x: x + nodeW, y: y + nodeH / 2 },
  }
  if ('prev' in n) {
    nodeLayout.prevAnchor = { x: x, y: y + nodeH / 2 }
  }
  layout.nodes[n.id] = nodeLayout
}
return layout
```

- [ ] **Step 5: 跑测试确认通过**

Run: `cd frontend && npx vitest run src/utils/__tests__/linkedListDoubly.test.js`
Expected: PASS

- [ ] **Step 6: 修改 LinkedListCanvas.vue 渲染 prev 箭头**

在 `<svg class="ll-svg-overlay">` 内、`<path>` 循环中增加 prev 路径渲染（与 next 镜像）：

```vue
<path
  v-for="p in prevArrowLines"
  :key="p.key"
  :d="p.d"
  fill="none"
  stroke="var(--primary)"
  stroke-width="2"
  stroke-linecap="round"
  stroke-dasharray="4 3"
  :style="p.style"
/>
```

`<script setup>` 增加 computed：

```js
const prevArrowLines = computed(() => buildPrevArrowPaths(props.nodes, layout.value, ...))
```

实现 `buildPrevArrowPaths`（在 `linkedListLayout.js` 中提供，与 `buildLinkedListArrowPaths` 同结构），使用虚线区分 prev。

- [ ] **Step 7: 修改 LinkedListCanvas 节点结构支持三格**

把当前两格（val/next）改为条件三格：

```vue
<div class="ll-cell ll-cell-val"><span>{{ formatValue(node.val) }}</span></div>
<div v-if="'prev' in node" class="ll-cell-sep ll-cell-sep-left"></div>
<div v-if="'prev' in node" class="ll-cell ll-cell-prev">
  <div class="ll-dot ll-dot-prev" :data-dot-id="node.id + '-prev'"></div>
</div>
<div class="ll-cell-sep"></div>
<div class="ll-cell ll-cell-next">
  <div class="ll-dot" :data-dot-id="node.id"></div>
  <span v-if="!node.next" class="ll-null-mark">�</span>
  <span v-if="node._cycle && node.next" class="ll-cycle-mark">⟳</span>
</div>
```

CSS 增加 `.ll-cell-prev { ... }`（与 next 镜像；宽度 50%；左半部分）。

- [ ] **Step 8: 手动验证（双向链表示例代码）**

新建 `frontend/src/__manual_doubly__.java`（不入库）：

```java
public class Main {
  static class Node { int val; Node prev, next; Node(int v){val=v;} }
  public static void main(String[] a) {
    Node head = new Node(1);
    Node n2 = new Node(2);
    n2.prev = head; head.next = n2;
    System.out.println(head.val + " " + n2.val);
  }
}
```

粘贴到编辑器 → 运行 → 切到数据结构 Tab（占位）→ 手动验证 LinkedListCanvas 在 DataStructureTab 接入后能渲染三格节点（此 task 不接 DataStructureTab，只保证 LinkedListCanvas 自身可承载双向数据；后续 task 1.7 接入）。

- [ ] **Step 9: Commit**

```bash
git add frontend/src/components/LinkedListCanvas.vue \
  frontend/src/utils/linkedListLayout.js \
  frontend/src/utils/__tests__/linkedListDoubly.test.js
git commit -m "feat(linkedlist): LinkedListCanvas 支持双向链表（三格 + prev 虚线）"
```

---

### Task 1.6: dataStructureExtract.js（链表 + 数组抽取）

**Files:**
- Create: `frontend/src/utils/dataStructureExtract.js`
- Create: `frontend/src/utils/dataStructureExtract.test.js`

**Interfaces:**
- Exported: `extractDataStructures(heap, stackFrames, prevHeap?, prevStackFrames?) => { linkedLists: [], arrays: [], trees: [], graphs: [] }`
- 链表：复用 `linkedListExtract.js` 的 `extractLinkedListView`；扩展双向识别（`prev` 字段存在 → 节点对象保留 `prev`）。
- 数组：识别堆中 `type` 命中 `/ArrayList|Stack|Queue|ArrayDeque|LinkedList/` 且 `fields` 含数值数组（或 `items` 字段为 `{ref}[]`）；返回 `{label, values, headIndex, tailIndex, sourceVar}`。

- [ ] **Step 1: 写失败测试**

新建 `frontend/src/utils/dataStructureExtract.test.js`：

```js
import { describe, it, expect } from 'vitest'
import { extractDataStructures } from '../dataStructureExtract.js'

describe('extractDataStructures — linked list', () => {
  it('returns singly nodes when prev is absent', () => {
    const heap = { 'n1': { id: 'n1', type: 'Node', fields: { val: 1, next: { ref: 'n2' } } }, 'n2': { id: 'n2', type: 'Node', fields: { val: 2, next: null } } }
    const frames = [{ args: {}, locals: { head: { ref: 'n1' } } }]
    const { linkedLists, arrays } = extractDataStructures(heap, frames)
    expect(linkedLists[0].nodes).toHaveLength(2)
    expect(linkedLists[0].nodes[0].prev).toBeUndefined()
    expect(arrays).toEqual([])
  })

  it('returns doubly nodes when prev is present', () => {
    const heap = {
      'n1': { id: 'n1', type: 'Node', fields: { val: 1, prev: null, next: { ref: 'n2' } } },
      'n2': { id: 'n2', type: 'Node', fields: { val: 2, prev: { ref: 'n1' }, next: null } },
    }
    const frames = [{ args: {}, locals: { head: { ref: 'n1' } } }]
    const { linkedLists } = extractDataStructures(heap, frames)
    expect(linkedLists[0].nodes[1].prev).toBe('n1')
  })
})

describe('extractDataStructures — array', () => {
  it('identifies ArrayList-like with elementData field', () => {
    const heap = {
      'arr': {
        id: 'arr', type: 'ArrayList', fields: {
          elementData: [
            { ref: 'e0' }, { ref: 'e1' }, null, null,
          ],
        },
      },
      'e0': { id: 'e0', type: 'Integer', fields: { value: 10 } },
      'e1': { id: 'e1', type: 'Integer', fields: { value: 20 } },
    }
    const frames = [{ args: {}, locals: { list: { ref: 'arr' } } }]
    const { arrays, linkedLists } = extractDataStructures(heap, frames)
    expect(arrays).toHaveLength(1)
    expect(arrays[0].values).toEqual([10, 20])
    expect(linkedLists).toEqual([])
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd frontend && npx vitest run src/utils/dataStructureExtract.test.js`
Expected: FAIL（`extractDataStructures is not a function`）

- [ ] **Step 3: 实现 extractDataStructures（仅链+数组）**

新建 `frontend/src/utils/dataStructureExtract.js`：

```js
import { extractLinkedListView } from './linkedListExtract.js'

const ARRAY_TYPE_PATTERN = /ArrayList|Stack|Queue|ArrayDeque/i

function getArrayValues(heap, entryField) {
  // entryField: 'elementData' | 'items' | 'array'
  const arr = []
  for (const slot of entryField) {
    if (slot && typeof slot === 'object' && slot.ref) {
      const obj = heap[slot.ref]
      const v = obj?.fields?.value ?? obj?.fields?.val ?? obj?.fields?.item ?? null
      arr.push(v)
    } else if (slot == null) {
      arr.push(null)
    } else {
      arr.push(slot)
    }
  }
  return arr
}

function extractArrays(heap, stackFrames) {
  const arrays = []
  for (const [key, obj] of Object.entries(heap || {})) {
    if (!obj || typeof obj !== 'object') continue
    const type = obj.type || ''
    const fields = obj.fields || {}
    const sourceVar = findVarByRef(stackFrames, obj.id || key)
    if (ARRAY_TYPE_PATTERN.test(type) && Array.isArray(fields.elementData)) {
      arrays.push({
        id: obj.id || key,
        label: type,
        values: getArrayValues(heap, fields.elementData),
        headIndex: 0,
        tailIndex: fields.elementData.length - 1,
        sourceVar,
      })
    }
  }
  return arrays
}

function findVarByRef(stackFrames, refId) {
  for (let i = (stackFrames || []).length - 1; i >= 0; i--) {
    const f = stackFrames[i]
    for (const bucket of [f.args || {}, f.locals || {}]) {
      for (const [name, val] of Object.entries(bucket)) {
        if (val && typeof val === 'object' && val.ref === refId) return name
      }
    }
  }
  return null
}

export function extractDataStructures(heap, stackFrames, prevHeap = null, prevStackFrames = null) {
  // 链表：复用 linkedListExtract，但若节点有 prev 则保留 prev
  const ll = extractLinkedListView(heap, stackFrames, prevHeap, prevStackFrames)
  const linkedLists = ll.nodes.length ? [{ ...ll, doubly: ll.nodes.some(n => 'prev' in n) }] : []
  // 数组
  const arrays = extractArrays(heap, stackFrames)
  return { linkedLists, arrays, trees: [], graphs: [] }
}
```

- [ ] **Step 4: 跑测试确认通过**

Run: `cd frontend && npx vitest run src/utils/dataStructureExtract.test.js`
Expected: PASS（3 tests）

- [ ] **Step 5: Commit**

```bash
git add frontend/src/utils/dataStructureExtract.js frontend/src/utils/dataStructureExtract.test.js
git commit -m "feat(extract): dataStructureExtract 支持链（单/双）与数组"
```

---

### Task 1.7: ArrayCanvas / ArrayNode 组件

**Files:**
- Create: `frontend/src/components/ArrayCanvas.vue`
- Create: `frontend/src/components/ArrayNode.vue`

**Interfaces:**
- `ArrayCanvas.vue` props:
  - `arrays: Array<{id, label, values, headIndex, tailIndex, sourceVar}>`
  - `highlightedIndex: number`（默认 -1）
- `ArrayNode.vue` props: `value`、`index`、`isHead`、`isTail`、`isHighlighted`

- [ ] **Step 1: 创建 ArrayNode.vue**

```vue
<template>
  <div class="array-node" :class="{ head: isHead, tail: isTail, highlighted: isHighlighted }">
    <div class="array-node-val">{{ value == null ? '∅' : value }}</div>
    <div class="array-node-idx">{{ index }}</div>
  </div>
</template>

<script setup>
defineProps({
  value: { type: [Number, String, Object, Boolean], default: null },
  index: { type: Number, required: true },
  isHead: { type: Boolean, default: false },
  isTail: { type: Boolean, default: false },
  isHighlighted: { type: Boolean, default: false },
})
</script>

<style scoped>
.array-node {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  min-width: 56px;
  margin: 0 2px;
  border: 1px solid var(--border);
  background: var(--card-bg);
  font-family: var(--mono);
  font-size: 12px;
  color: var(--text-h);
  clip-path: polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px);
  transition: background 0.15s, border-color 0.15s;
}
.array-node-val { padding: 6px 10px; min-width: 44px; text-align: center; }
.array-node-idx { padding: 2px 6px; font-size: 10px; color: var(--text-muted); border-top: 1px dashed var(--border); width: 100%; box-sizing: border-box; }
.array-node.head { border-color: var(--accent); }
.array-node.tail { border-color: var(--accent); }
.array-node.head .array-node-val::before { content: 'head ▲ '; font-size: 9px; color: var(--accent); }
.array-node.tail .array-node-val::after { content: ' ▲tail'; font-size: 9px; color: var(--accent); }
.array-node.highlighted { background: rgba(239, 71, 111, 0.15); border-color: #ef476f; }
</style>
```

- [ ] **Step 2: 创建 ArrayCanvas.vue**

```vue
<template>
  <div class="array-canvas">
    <div v-if="!arrays.length" class="ac-empty">未识别到数组类结构</div>
    <div v-for="arr in arrays" :key="arr.id" class="ac-group">
      <div class="ac-group-header">
        <span class="ac-label">{{ arr.label }}</span>
        <span v-if="arr.sourceVar" class="ac-var">{{ arr.sourceVar }}</span>
      </div>
      <div class="ac-row">
        <ArrayNode
          v-for="(v, i) in arr.values"
          :key="i"
          :value="v"
          :index="i"
          :is-head="i === arr.headIndex"
          :is-tail="i === arr.tailIndex"
          :is-highlighted="i === highlightedIndex"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import ArrayNode from './ArrayNode.vue'
defineProps({
  arrays: { type: Array, required: true },
  highlightedIndex: { type: Number, default: -1 },
})
</script>

<style scoped>
.array-canvas { padding: 8px; }
.ac-empty { color: var(--text-muted); font-family: var(--mono); font-size: 12px; padding: 12px; }
.ac-group { margin-bottom: 14px; }
.ac-group-header { display: flex; gap: 10px; align-items: baseline; margin-bottom: 6px; font-family: var(--mono); font-size: 11px; }
.ac-label { color: var(--text-h); font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; }
.ac-var { color: var(--accent); }
.ac-row { display: flex; flex-wrap: wrap; gap: 4px; }
</style>
```

- [ ] **Step 3: 启动 dev 临时验证**

临时在 `DataStructureTab.vue`（占位）替换为：

```vue
<template>
  <div class="dst">
    <ArrayCanvas :arrays="[{ id:'t', label:'ArrayList', values:[10,20,30], headIndex:0, tailIndex:2, sourceVar:'list' }]" :highlighted-index="1" />
  </div>
</template>
<script setup>
import ArrayCanvas from '../ArrayCanvas.vue'
</script>
```

打开 → 期望：3 个方格 `10/20/30`，索引 0/1/2，head 在 0 标"head ▲"，tail 在 2 标"▲tail"，中间一个红色高亮。

- [ ] **Step 4: 还原占位 Tab（Task 1.7 收尾）**

把 `DataStructureTab.vue` 还原为占位（等 Task 1.8 接入完整逻辑）。

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ArrayCanvas.vue frontend/src/components/ArrayNode.vue
git commit -m "feat(canvas): ArrayCanvas / ArrayNode 数组类画布"
```

---

### Task 1.8: DataStructureTab.vue 完整接入（识别徽章 + 链+数组分组）

**Files:**
- Modify: `frontend/src/components/right-tabs/DataStructureTab.vue`

**Interfaces:**
- Reads: `store.currentHeap`、`store.activeStackFrames`、`store.steps[store.currentStep - 1]`
- Renders: 顶部识别徽章 + 链表画布分组 + 数组画布分组

- [ ] **Step 1: 实现 DataStructureTab.vue**

```vue
<template>
  <div class="dst">
    <div class="dst-header">
      <span class="dst-h">数据结构</span>
      <div class="dst-badges">
        <span v-for="b in badges" :key="b.key" class="dst-badge" :class="{ active: b.count > 0 }">
          {{ b.label }} × {{ b.count }}
        </span>
        <span v-if="!anyDetected" class="dst-empty">未识别</span>
      </div>
    </div>

    <section v-if="result.linkedLists.length" class="dst-section">
      <h4 class="dst-section-h">链表</h4>
      <LinkedListCanvas
        :nodes="result.linkedLists[0].nodes"
        :pointer-labels="result.linkedLists[0].pointerLabels"
        :highlighted-node-ids="result.linkedLists[0].highlightedNodeIds"
      />
    </section>

    <section v-if="result.arrays.length" class="dst-section">
      <h4 class="dst-section-h">数组 / 栈 / 队列</h4>
      <ArrayCanvas :arrays="result.arrays" :highlighted-index="-1" />
    </section>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { usePlayerStore } from '../../stores/player'
import { extractDataStructures } from '../../utils/dataStructureExtract.js'
import LinkedListCanvas from '../LinkedListCanvas.vue'
import ArrayCanvas from '../ArrayCanvas.vue'

const store = usePlayerStore()

const result = computed(() => {
  const step = store.steps[store.currentStep]
  if (!step) return { linkedLists: [], arrays: [], trees: [], graphs: [] }
  const prev = store.steps[store.currentStep - 1] || null
  return extractDataStructures(
    step.heap || {},
    step.stackFrames || [],
    prev?.heap || null,
    prev?.stackFrames || null,
  )
})

const anyDetected = computed(() =>
  result.value.linkedLists.length > 0 || result.value.arrays.length > 0
)

const badges = computed(() => [
  { key: 'll', label: '链表', count: result.value.linkedLists.length },
  { key: 'arr', label: '数组', count: result.value.arrays.length },
  { key: 'tree', label: '树', count: result.value.trees.length },
  { key: 'graph', label: '图', count: result.value.graphs.length },
])
</script>

<style scoped>
.dst { padding: 8px; }
.dst-header { display: flex; align-items: center; gap: 10px; padding: 6px 8px; border-bottom: 1px solid var(--border); margin-bottom: 10px; }
.dst-h { font-family: var(--mono); font-size: 12px; font-weight: 700; letter-spacing: 0.1em; color: var(--text-h); }
.dst-badges { display: flex; gap: 6px; flex-wrap: wrap; }
.dst-badge { font-family: var(--mono); font-size: 10px; padding: 3px 8px; border: 1px solid var(--border); color: var(--text-muted); clip-path: polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px); }
.dst-badge.active { color: var(--accent); border-color: var(--accent); background: var(--accent-bg); }
.dst-empty { font-family: var(--mono); font-size: 10px; color: var(--text-muted); }
.dst-section { margin-bottom: 14px; }
.dst-section-h { font-family: var(--mono); font-size: 11px; letter-spacing: 0.08em; color: var(--text-h); margin: 8px 0; }
</style>
```

- [ ] **Step 2: 启动 dev 端到端验证**

- 单向链表示例（反转链表）→ 运行 → 步进 → 数据结构 Tab：链表画布出现；head 标签在第一个节点；步进时 curr 标签移动。
- 数组示例（ArrayList add/remove）→ 数组画布出现；head/tail 标记正确；索引正确。
- 非链表/数组代码（纯排序）→ 数据结构 Tab 整体不出现画布，仅徽章。

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/right-tabs/DataStructureTab.vue
git commit -m "feat(tab): DataStructureTab 完整接入链表 + 数组画布"
```

---

### Task 1.9: AlgoTab.vue 重组（复用现有 ControlFlowPanel + AiTutorPanel）

**Files:**
- Modify: `frontend/src/components/right-tabs/AlgoTab.vue`

**Interfaces:**
- Reads: `store.code`、`store.isExplaining`
- Renders: 复杂度分析 + 智能体问答；M3 在此基础上加顶部折叠知识库

- [ ] **Step 1: 实现 AlgoTab.vue**

```vue
<template>
  <div class="algo-tab">
    <!-- M3 占位：算法知识库折叠条将在此位置插入 -->
    <section class="algo-section">
      <h4 class="algo-section-h">复杂度分析</h4>
      <ControlFlowPanel />
    </section>
    <section class="algo-section algo-section-fill">
      <h4 class="algo-section-h">智能体问答</h4>
      <AiTutorPanel embedded />
    </section>
  </div>
</template>

<script setup>
import ControlFlowPanel from '../ControlFlowPanel.vue'
import AiTutorPanel from '../AiTutorPanel.vue'
</script>

<style scoped>
.algo-tab { display: flex; flex-direction: column; height: 100%; }
.algo-section { padding: 8px; border-bottom: 1px solid var(--border); }
.algo-section-fill { flex: 1; min-height: 0; overflow-y: auto; }
.algo-section-h { font-family: var(--mono); font-size: 11px; letter-spacing: 0.08em; color: var(--text-h); margin-bottom: 8px; }
</style>
```

- [ ] **Step 2: 启动 dev 验证**

- 算法 Tab 切到 → 顶部复杂度分析（ControlFlowPanel）+ 下方智能体问答（AiTutorPanel）均显示。
- 「问答」独立 tab 仍保留（不重复）：切到问答 tab 仍显示 AiTutorPanel。
- 现有功能：运行代码 → 单步解说 → SVG 动画 → 整体解说 全部正常。

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/right-tabs/AlgoTab.vue
git commit -m "feat(tab): AlgoTab 重组为复杂度分析 + 智能体问答"
```

---

# Milestone 2: 数据结构 Tab 扩展（树/堆 + 图）

**目标：** 数据结构 Tab 支持二叉树/堆与无向/有向/网络流图。

**任务概览（详细 task 在后续规划中展开）：**

- **Task 2.1** `dataStructureExtract.js` 扩展 tree 识别
- **Task 2.2** `TreeNode.vue` + `TreeCanvas.vue`（layer 分层 + 搜索高亮红色）
- **Task 2.3** `dataStructureExtract.js` 扩展 graph 识别（无向/有向/网络流）
- **Task 2.4** `GraphNode.vue` + `GraphCanvas.vue`（节点 + 加权边；网络流 `源 e= → 汇`）
- **Task 2.5** `DataStructureTab.vue` 接入树 + 图分组
- **Task 2.6** 单元测试与端到端验收

**关键接口（preview）：**

```js
// dataStructureExtract.js 增加：
extractTree(heap, stackFrames) -> { nodes, edges, highlightedPath, curLabel }
extractGraph(heap, stackFrames) -> { nodes, edges, directed, source, sink, capacities }

// TreeNode.vue props：
{ id, val, x, y, layer, isHighlighted, curLabel }
// GraphNode.vue props：
{ id, val, x, y }
```

---

# Milestone 3: 算法知识库（折叠文档）

**目标：** 算法 Tab 顶部新增折叠条，点开展示从 oi.wiki 等收集的算法知识库文档。

**任务概览：**

- **Task 3.1** 收集/撰写 `frontend/src/assets/algo-knowledge/*.md`（按类别：排序 / 搜索 / 图 / 树 / DP / 链表）
- **Task 3.2** `algo-knowledge/index.json`（类别索引 + 锚点）
- **Task 3.3** 选择轻量 markdown 渲染方案（marked / markdown-it，v1 选最轻量；评估 ≤30KB gzip）
- **Task 3.4** `AlgoKnowledgeHeader.vue`（折叠条 + 文档渲染）
- **Task 3.5** `AlgoTab.vue` 顶部插入 `AlgoKnowledgeHeader`
- **Task 3.6** 底部固定一行 CC-BY-SA 来源声明
- **Task 3.7** 单元测试与手动验收

**版权注意：** 文档需按 CC-BY-SA 注明来源；底部固定 `内容来源：oi.wiki 等开源平台，遵循 CC-BY-SA 协议`。

---

# Milestone 4: 多文件模式 + 5 种 UML 图

**目标：** 多文件模式独立 UI；右侧 5 个 UML tab；AI + 静态兜底；类图静态优先。

**任务概览：**

- **Task 4.1** `MultiFileShell.vue` 骨架（多文件 tab 栏 + 只读编辑器 + 项目级运行条）
- **Task 4.2** `FileTabsBar.vue`（多文件 tab + 上传）
- **Task 4.3** `ProjectRunBar.vue`（项目级运行/重置）
- **Task 4.4** FileUploadPanel 扩展多选模式
- **Task 4.5** 5 种 UML 静态兜底 SVG（`assets/uml-fallback/*.svg`）
- **Task 4.6** `UmlPanel.vue` 通用容器（生成/缓存/兜底）
- **Task 4.7** 后端 `intent=uml` 分支（CozeService.java + learning/animation.py）
- **Task 4.8** 前端 `UmlPanel` 接入 Coze 调用；类图静态优先
- **Task 4.9** 后端 `/api/run` 扩展支持多文件（M4 与后端同步改造）
- **Task 4.10** 端到端验收

**关键接口（preview）：**

```js
// UmlPanel.vue props：
{ kind: 'flow'|'dataflow'|'structure'|'class'|'usecase', files: Array<{name, code}> }
// Emits：
'regenerate'  // 用户点重新生成
// Coze 入参：
POST /api/ai/uml { intent: 'uml', kind, files }
// Coze 出参：
{ svg: string, source: 'ai'|'static', ts: number }
```

---

## 验收标准（汇总）

### M1

1. 顶部出现「单文件 / 多文件」segmented control；切换保留运行状态。
2. 单文件右侧 tab 顺序：`变量 / 流程 / 数据结构 / 算法 / 问答 / 动画`。
3. 链表反转示例运行后，数据结构 Tab 出现单向链表画布，head/slow 标签随步进移动。
4. 数组示例运行后，数组画布显示 head/tail + 索引。
5. 双向链表识别到则渲染三格节点 + 双向箭头。
6. 变量 Tab 不再嵌入 LinkedListCanvas（堆/栈卡片保留）。
7. 现有测试模式、导入、运行/步进/播放/速度、AI 问答、SVG 动画生成全部正常。

### M2

1. 二叉树/堆示例运行后，树画布按 layer 分层显示，搜索路径高亮红色。
2. 无向图示例运行后，图画布节点 + 加权边显示。
3. 有向图与网络流示例识别到则渲染对应样式。

### M3

1. 算法 Tab 顶部出现折叠条「算法知识库」。
2. 点击展开渲染 markdown 文档；带类别内锚点。
3. 文档底部显示来源与版权声明。

### M4

1. 多文件模式可上传多个 .java 文件；文件 tab 栏正确显示。
2. 切换文件 tab 在只读编辑器中渲染对应文件。
3. 右侧 5 个 UML tab 可切换；切换保留已生成图。
4. 点击「重新生成」调用 Coze；失败时显示静态兜底。
5. 类图在文件列表变化时静态生成；其他 UML 在用户主动触发时 AI 生成。

---

## 风险与缓解

| 风险 | 缓解 |
|------|------|
| 单文件 main-area 迁移丢功能 | Task 1.3 端到端验证清单覆盖所有现有功能；逐项打勾 |
| 双向链表 prev 字段缺失导致误识别 | 仅当节点 `prev !== undefined` 时才走三格布局；单向保持不变 |
| 数组识别不到 ArrayList 私有字段 | elementData / items / array 三个候选字段；任一命中即识别 |
| 算法知识库版权问题 | 严格注明 oi.wiki 等来源；底部固定 CC-BY-SA 声明 |
| 多文件运行后端未支持 | M4 与后端同步改造 `/api/run` 接受多文件 |
| AI UML 不稳定 | 类图静态优先 + 静态兜底模板 |
| ModeBar 切换丢状态 | store 双快照 + localStorage 持久化 |

---

## 后续（v1.1+，不在本规格）

- 多文件编辑器支持编辑模式 + 文件 diff
- 跨模式共享运行状态
- 多条不相交链表并列展示
- 红黑树特判（PDF 中提到的「标红黑」）
- 数据结构画布导出 PNG / SVG
- UML 模板可由用户自定义

---

## 执行检查清单（每个 task 末尾 commit 前自检）

- [ ] 所有 step 的代码块完整（无 TODO / TBD）
- [ ] 跑过对应测试命令并确认 PASS
- [ ] 启动 dev 手动验证视觉与交互
- [ ] commit 信息遵循 `feat: / refactor: / docs: / fix:` 前缀
- [ ] 与现有功能无回归
