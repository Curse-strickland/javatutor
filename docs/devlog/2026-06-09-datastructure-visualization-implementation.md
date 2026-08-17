# 2026-06-09 数据结构可视化 — 实现方案

## 现状

前端 4 个可视化组件已写好，后端数据采集跟不上：

| 组件 | 状态 | 根因 |
|------|------|------|
| ArrayCanvas | ✅ 正常 | deepCopyValue 已处理数组 |
| LinkedListCanvas | ❌ 不渲染 | 对象直接透传引用，JSON 序列化字段丢失 |
| RecursionStackCanvas | ❌ 不渲染 | 无调用栈追踪，step 无 `_recursionStack_` |
| HeapStackPanel | ❌ 不渲染 | heapObjects 未写入 step |

## 改动计划

### Step 1: TraceEngine 改造（RunController.TRACE_ENGINE_SOURCE）

- **deepSerialize(obj, visited)** — 反射递归展开对象字段为 Map，visited 防循环引用
- **isPrimitiveOrWrapper** — 基本类型/包装类/String 判断
- **record() 改用 deepSerialize** 替代 deepCopyValue
- **heapObjects 输出到 step** — `record.put("heap", ...)`
- **StackFrame + callStack** — pushFrame/popFrame/attachCallStack
- **同步到 compiler/TraceEngine.java**

### Step 2: Instrumenter 改造

- MethodDeclaration visit → 方法体首行插入 `pushFrame`
- return 语句前插入 `popFrame`

### Step 3: 编译验证 + 浏览器测试

## 三处同步

每次改 TraceEngine 必须同步：
1. `RunController.TRACE_ENGINE_SOURCE`（主副本）
2. `compiler/TraceEngine.java`（磁盘副本）

## 前端不改

VariablePanel 检测逻辑已写死 — 后端数据格式对了就自动渲染。

---

## 2026-06-10 LinkedListCanvas 教科书式重写

### 问题

旧版 `LinkedListCanvas.vue` 渲染效果不像教学材料中的链表图：

| # | 问题 | 影响 |
|---|------|------|
| 1 | 节点是单卡片，val/next/id 混在一起 | 学生看不出 "节点 = 数据域 + 指针域" |
| 2 | 节点间只是一个 `→` 小 SVG 图标 | 看不出 next 域指出去的连接关系 |
| 3 | 变量指针标签（head/curr）漂浮在节点底部 | 没有箭头指向节点，无法快速识别变量归属 |

### 方案：教科书式两格节点 + SVG 真实箭头

```
     head ▼               curr ▼
┌──────┬──────┐         ┌──────┬──────┐         ┌──────┬──────┐
│  5   │  ●   │────────→│  3   │  ●   │────────→│  8   │  ⏚   │
│ val  │ next │         │ val  │ next │         │ val  │ null  │
└──────┴──────┘         └──────┴──────┘         └──────┴──────┘
```

改动集中在 `LinkedListCanvas.vue` 一个文件，数据格式不变。

### 改动详情

#### 1. 节点结构 — 双格卡片

每个节点一个 `div.ll-node`，内部 flex 排列:

- **左格** `ll-cell-val`（56px × 52px）
  - `val` 值加粗居中: `font-size: 17px; font-weight: 700`
  - 空值时显示 `∅`

- **竖分隔线** `ll-cell-sep`（2px，`var(--border)` 色）

- **右格** `ll-cell-next`（44px × 52px）
  - 微蓝背景: `color-mix(in srgb, var(--primary) 4%, var(--card-bg))`
  - 实心圆点 ●（12px 直径，`var(--primary)` 色 + `white` 内描边 2px）— **箭头从此发射**
  - 尾节点（`node.next === null`）：底部显示 `⏚` 接地符号

- 节点圆角 10px，卡片阴影 `box-shadow: 0 2px 8px rgba(0,0,0,0.12)`
- 高亮: `border-color: var(--accent-border)` + 蓝阴影
- 比较: 黄色边框/阴影

#### 2. SVG 连接箭头

- 绝对定位 `<svg>` 覆盖层，`pointer-events: none` 不阻挡交互
- `<defs><marker id="ll-arrow-{uid}">` 三角箭头尖（9×8px，`fill="context-stroke"` 继承线条色）
- 每条 `<line>`：
  - `x1,y1` = 节点 i 右格圆点中心（`dotCx / dotCy`）
  - `x2,y2` = 节点 i+1 左边缘，同一行高
  - `stroke: var(--primary); stroke-width: 2; round caps`
  - `marker-end: url(#ll-arrow-{uid})`

- 节点间 `gap: 44px`（给箭头留视觉空间）
- 位置通过 JavaScript 测量每个节点 DOM `getBoundingClientRect()` 实时计算，`ResizeObserver` + `nextTick` 触发重测

#### 3. 变量指针标签 — 移到节点上方

- 从原来的节点底部 → 移到**节点上方**（`position: absolute; top: 4px`）
- 标签内容: 蓝色背景文字块（`background: var(--accent-bg); border-radius: 4px`）+ 下方 `▼` 三角（SVG polygon）
- `left` 通过 inline style 设置，`transform: translateX(-50%)` 居中对齐
- 同一节点多个变量名：水平展开 ±32px 偏移
- `TransitionGroup` enter/leave/move 动画保留
- 有指针标签时，节点行上方自动预留 `paddingTop: 28px`

#### 4. 布局

- 外容器: `overflow-x: auto; overflow-y: visible`
- 内层: `display: inline-block; min-width: 100%`（内容不足撑满，超出撑开滚动）
- 无数据时显示 "链表为空"

### 不变的部分

- **Props 接口不变** — `nodes`, `highlightedNodeIds`, `compareNodeIds`, `pointerLabels`
- **VariablePanel 集成不变** — `linkedListGroups` → `liveLLGroups` → `<LinkedListCanvas>`
- **数据格式不变** — 后端 TraceEngine / RunController 无需改动

### 构建验证

```bash
cd frontend && npm run build
# ✅ built in 5.54s — 无编译错误
```
