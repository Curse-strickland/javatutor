# 右侧二级菜单（Observe / Learn / Ask）Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把单文件模式右侧的 6 个平铺标签（变量/流程/数据结构/算法/问答/动画）重构为两级菜单——顶层 Observe/Learn/Ask 三组，组内再选页面；同时删除「动画」页。

**Architecture:** `store.rightTab` 保持为唯一状态源，顶层组由它派生（不改 pane 的 v-show 键）。SingleFileShell 头部换成「组行 + 子标签行」两行；AlgoTab 内部加本地子标签（算法知识/算法模板），内容原样保留，只用 v-show 切换。动画页（SvgAnimatePanel）整页删除。

**Tech Stack:** Vue 3.5 `<script setup>`、Pinia 3、Vite、Vitest 4（node 环境，无组件挂载测试——组件改动以 build + 手测验证）。

## Global Constraints

- **页面内容零改动**：只改标签的排布与层级关系，panes 内部组件（MemoryPanel / ControlFlowPanel / DataStructureTab / AlgoTab 内容 / AiTutorPanel）一行不动。
- 默认页面 = Observe 组的「数据结构」（`rightTab: 'datastructure'`）。
- 组→页面映射（标签文案逐字）：
  - Observe → `数据结构`(datastructure) / `流程`(flow) / `内存状态`(variables)
  - Learn → `算法库`(algorithm)
  - Ask → `agent`(tutor)
  - 子标签顺序即上列顺序；Observe 默认子页 = 数据结构。
- AlgoTab 内部子标签：`算法知识`（默认，原 AlgoKnowledgeHeader）/ `算法模板`（原「经典算法（预置）」ClassicCodePanel），两块内容原样保留。
- 「动画」页删除：移除标签按钮、pane、import，并 `git rm` SvgAnimatePanel.vue。store 的 `svgText` / `requestAnimation()` / 快照字段**保留不动**（快照机制仍在用，后端端点保留，无害）。
- `rightTab` 的键名（variables/flow/datastructure/algorithm/tutor）不改，只是 `animate` 从合法列表移除。
- 不引入新依赖；不改后端。
- 项目约束：不做多文件模式相关改动。

---

### Task 1: store — 默认页 datastructure + 移除 animate

**Files:**
- Modify: `frontend/src/stores/player.js:37`（`rightTab: 'variables'`）
- Modify: `frontend/src/stores/player.js:350-353`（`switchRightTab`）
- Test: `frontend/src/stores/__tests__/player-righttab.test.js`（新建）

**Interfaces:**
- Consumes: 现有 `switchRightTab(tab)` action、`rightTab` state。
- Produces: `rightTab` 默认值 `'datastructure'`；`switchRightTab` 仅接受 `['variables','flow','datastructure','algorithm','tutor']`，非法值（含 `'animate'`）静默忽略。Task 2 的 SingleFileShell 依赖此默认值。

- [ ] **Step 1: 写失败测试**

新建 `frontend/src/stores/__tests__/player-righttab.test.js`：

```js
import { setActivePinia, createPinia } from 'pinia'
import { describe, it, expect, beforeEach } from 'vitest'
import { usePlayerStore } from '../player'

// Mock localStorage for Node environment（与 player-mode.test.js 同款）
const localStorageMock = (() => {
  let store = {}
  return {
    getItem: (key) => store[key] ?? null,
    setItem: (key, value) => { store[key] = value },
    removeItem: (key) => { delete store[key] },
    clear: () => { store = {} },
  }
})()
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock })

describe('player store rightTab', () => {
  beforeEach(() => {
    localStorage.clear()
    setActivePinia(createPinia())
  })

  it('defaults to datastructure（Observe 组默认页）', () => {
    const s = usePlayerStore()
    expect(s.rightTab).toBe('datastructure')
  })

  it.each(['variables', 'flow', 'datastructure', 'algorithm', 'tutor'])(
    'switchRightTab accepts %s',
    (tab) => {
      const s = usePlayerStore()
      s.switchRightTab(tab)
      expect(s.rightTab).toBe(tab)
    }
  )

  it('rejects removed animate tab', () => {
    const s = usePlayerStore()
    s.switchRightTab('animate')
    expect(s.rightTab).toBe('datastructure')
  })

  it('rejects unknown tab', () => {
    const s = usePlayerStore()
    s.switchRightTab('bogus')
    expect(s.rightTab).toBe('datastructure')
  })
})
```

- [ ] **Step 2: 跑测试确认失败**

Run: `cd frontend && npx vitest run src/stores/__tests__/player-righttab.test.js`
Expected: FAIL —— 默认值仍是 `'variables'`，且 `'animate'` 被接受。

- [ ] **Step 3: 最小实现**

`frontend/src/stores/player.js` 第 37 行：

```js
    rightTab: 'datastructure',
```

第 350-353 行：

```js
    switchRightTab(tab) {
      const allowed = ['variables', 'flow', 'datastructure', 'algorithm', 'tutor']
      if (allowed.includes(tab)) this.rightTab = tab
    },
```

- [ ] **Step 4: 跑测试确认通过 + 全量回归**

Run: `cd frontend && npx vitest run src/stores/__tests__/player-righttab.test.js`
Expected: 8/8 PASS

Run: `cd frontend && npx vitest run`
Expected: 全绿（此前 155 + 新增 8 = 163）

- [ ] **Step 5: Commit**

```bash
git add frontend/src/stores/player.js frontend/src/stores/__tests__/player-righttab.test.js
git commit -m "feat(right-tabs): default to datastructure, drop animate from allowed tabs"
```

---

### Task 2: SingleFileShell — 两级标签行 + 移除动画 pane

**Files:**
- Modify: `frontend/src/components/SingleFileShell.vue:67-78`（头部标签行）
- Modify: `frontend/src/components/SingleFileShell.vue:97-99`（动画 pane，删除）
- Modify: `frontend/src/components/SingleFileShell.vue:227`（SvgAnimatePanel import，删除）
- Modify: `frontend/src/components/SingleFileShell.vue:229` 附近（新增组映射 computed）
- Modify: `frontend/src/components/SingleFileShell.vue:788-792` 附近（新增 `.right-subtab-row` 样式）

**Interfaces:**
- Consumes: Task 1 的 `rightTab` 默认值与 `switchRightTab` 合法列表（`animate` 已非法，本任务不得再引用它）。
- Produces: 模板内可用 `rightGroup`（`'observe'|'learn'|'ask'`）与 `switchGroup(group)`。panes 的 v-show 键不变（variables/flow/datastructure/algorithm/tutor），后续任务/手测依赖。

注意：**SvgAnimatePanel.vue 文件本身在本任务不删**（Task 4 才 `git rm`），本任务只断开它的所有引用。

- [ ] **Step 1: 替换头部标签行（模板 67-78 行）**

把现有的 6 个 `right-tab` 按钮整段替换为：

```html
      <div class="right-card-header">
        <span class="rc-dot" />
        <span class="panel-kicker">INSPECT</span>
        <button class="right-tab" :class="{ active: rightGroup === 'observe' }" @click="switchGroup('observe')">Observe</button>
        <button class="right-tab" :class="{ active: rightGroup === 'learn' }" @click="switchGroup('learn')">Learn</button>
        <button class="right-tab" :class="{ active: rightGroup === 'ask' }" @click="switchGroup('ask')">Ask</button>
        <!-- 壁纸选择器 -->
        <WallpaperSelector />
        <div class="right-subtab-row">
          <template v-if="rightGroup === 'observe'">
            <button class="right-tab" :class="{ active: store.rightTab === 'datastructure' }" @click="store.switchRightTab('datastructure')">数据结构</button>
            <button class="right-tab" :class="{ active: store.rightTab === 'flow' }" @click="store.switchRightTab('flow')">流程</button>
            <button class="right-tab" :class="{ active: store.rightTab === 'variables' }" @click="store.switchRightTab('variables')">内存状态</button>
          </template>
          <template v-else-if="rightGroup === 'learn'">
            <button class="right-tab active" @click="store.switchRightTab('algorithm')">算法库</button>
          </template>
          <template v-else>
            <button class="right-tab active" @click="store.switchRightTab('tutor')">agent</button>
          </template>
        </div>
      </div>
```

（`.right-card-header` 已有 `flex-wrap: wrap`，`.right-subtab-row` 用 `flex-basis: 100%` 自然换到第二行。）

- [ ] **Step 2: 删除动画 pane（模板 97-99 行）**

删除：

```html
        <div v-show="store.rightTab === 'animate'" class="right-pane">
          <SvgAnimatePanel />
        </div>
```

其余 5 个 pane（variables/flow/datastructure/algorithm/tutor）**一行不动**。

- [ ] **Step 3: script —— 删 import + 加组映射**

删除第 227 行：

```js
import SvgAnimatePanel from './SvgAnimatePanel.vue'
```

在 `const store = usePlayerStore()`（第 229 行）之后插入：

```js
// 右侧两级标签：store.rightTab 仍是唯一状态源，顶层组由它派生
const GROUP_OF_TAB = {
  datastructure: 'observe',
  flow: 'observe',
  variables: 'observe',
  algorithm: 'learn',
  tutor: 'ask',
}
const GROUP_DEFAULT_TAB = { observe: 'datastructure', learn: 'algorithm', ask: 'tutor' }
const rightGroup = computed(() => GROUP_OF_TAB[store.rightTab] || 'observe')
const switchGroup = (group) => {
  if (rightGroup.value !== group) store.switchRightTab(GROUP_DEFAULT_TAB[group])
}
```

（`computed` 已在第 215 行的 vue import 中，无需新增。）

- [ ] **Step 4: 样式 —— 新增 `.right-subtab-row`**

在 `.right-tab.active { ... }` 规则块（约 788-792 行）之后插入：

```css
.right-subtab-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-basis: 100%;
  padding-top: 8px;
}
```

- [ ] **Step 5: 验证**

Run: `cd frontend && npm run build`
Expected: 构建成功，无 SvgAnimatePanel 相关报错（它仍是独立文件，只是无人引用，rollup 会 tree-shake 掉或保留为未引用模块——两种都接受）。

Run: `cd frontend && npx vitest run`
Expected: 163/163 全绿。

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/SingleFileShell.vue
git commit -m "feat(right-tabs): two-level Observe/Learn/Ask menu, remove animate pane"
```

---

### Task 3: AlgoTab — 内部子标签（算法知识 / 算法模板）

**Files:**
- Modify: `frontend/src/components/right-tabs/AlgoTab.vue`（整文件 43 行，重写模板与样式，内容组件不动）

**Interfaces:**
- Consumes: 现有 `AlgoKnowledgeHeader`（单根元素 `div.algo-knowledge`，v-show 可直接挂在组件上）、`ClassicCodePanel`、`defineEmits(['loadCode'])`。
- Produces: AlgoTab 内部本地状态 `algoSubTab`（`'knowledge'|'template'`，默认 `'knowledge'`）；对外 emit `loadCode` 不变，SingleFileShell 无需改动。

约束：两块内容（AlgoKnowledgeHeader、ClassicCodePanel 及其 section 标题「经典算法（预置）」）的 DOM 与样式原样保留，只加 v-show。

- [ ] **Step 1: 重写 AlgoTab.vue**

完整新内容：

```vue
<template>
  <div class="algo-tab">
    <div class="algo-subtab-row">
      <button
        class="algo-subtab"
        :class="{ active: algoSubTab === 'knowledge' }"
        @click="algoSubTab = 'knowledge'"
      >算法知识</button>
      <button
        class="algo-subtab"
        :class="{ active: algoSubTab === 'template' }"
        @click="algoSubTab = 'template'"
      >算法模板</button>
    </div>
    <AlgoKnowledgeHeader v-show="algoSubTab === 'knowledge'" />
    <section v-show="algoSubTab === 'template'" class="algo-section algo-section-fill">
      <h4 class="algo-section-h">经典算法（预置）</h4>
      <ClassicCodePanel @loadCode="$emit('loadCode', $event)" />
    </section>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import AlgoKnowledgeHeader from '../AlgoKnowledgeHeader.vue'
import ClassicCodePanel from '../ClassicCodePanel.vue'

defineEmits(['loadCode'])

// 内部子标签：算法知识（默认）/ 算法模板，内容不卸载仅 v-show
const algoSubTab = ref('knowledge')
</script>

<style scoped>
.algo-tab {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}
.algo-subtab-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 8px 0;
  border-bottom: 1px solid var(--border);
}
.algo-subtab {
  background: none;
  border: none;
  padding: 5px 12px 6px;
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: var(--text-muted);
  cursor: pointer;
  transition: color 0.2s, background 0.15s, box-shadow 0.15s;
}
.algo-subtab:hover { color: var(--text-h); background: var(--accent-bg); }
.algo-subtab.active {
  color: var(--accent);
  box-shadow: inset 0 -2px 0 var(--accent);
}
.algo-section {
  padding: 8px;
  border-bottom: 1px solid var(--border);
}
.algo-section-fill {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  border-bottom: none;
}
.algo-section-h {
  font-family: var(--mono);
  font-size: 11px;
  letter-spacing: 0.08em;
  color: var(--text-h);
  margin: 0 0 8px;
}
</style>
```

（`.algo-tab` / `.algo-section*` / `.algo-section-h` 与旧文件逐字一致；新增的只有 `.algo-subtab-row` / `.algo-subtab`，风格复用 `.right-tab`。）

- [ ] **Step 2: 验证**

Run: `cd frontend && npm run build`
Expected: 构建成功。

Run: `cd frontend && npx vitest run`
Expected: 163/163 全绿。

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/right-tabs/AlgoTab.vue
git commit -m "feat(algo-tab): split knowledge/template into sub-tabs"
```

---

### Task 4: 删除 SvgAnimatePanel.vue

**Files:**
- Delete: `frontend/src/components/SvgAnimatePanel.vue`

**Interfaces:**
- Consumes: Task 2 已断开 SingleFileShell 对它的 import 与使用。
- Produces: 仓库中不再存在 SvgAnimatePanel；store 的 `svgText`/`requestAnimation()` 保留（快照机制仍引用 `svgText`，后端 `/api/ai/animate` 端点保留）。

- [ ] **Step 1: 确认零引用后删除**

Run: `cd frontend && grep -rn "SvgAnimatePanel" src/ --include="*.vue" --include="*.js" | grep -v "src/components/SvgAnimatePanel.vue"`
Expected: 无输出（除文件自身外零引用）。

Run: `git rm frontend/src/components/SvgAnimatePanel.vue`

- [ ] **Step 2: 验证**

Run: `cd frontend && npm run build`
Expected: 构建成功。

Run: `cd frontend && npx vitest run`
Expected: 163/163 全绿。

- [ ] **Step 3: Commit**

```bash
git commit -m "chore(animate): delete SvgAnimatePanel page component"
```

---

## 手测清单（交给用户）

1. 打开单文件模式 → 右侧默认显示 Observe 组 + 「数据结构」子页。
2. 点 Learn → 显示「算法库」子页，内部默认「算法知识」；切到「算法模板」→ 经典算法列表原样出现，点击载入代码正常。
3. 点 Ask → 显示「agent」子页，问答面板原样可用。
4. Observe 组内三子页（数据结构/流程/内存状态）切换，内容与原「数据结构/流程/变量」完全一致。
5. 「动画」标签消失；全流程无控制台报错。
