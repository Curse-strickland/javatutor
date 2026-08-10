# 可视化重构 — 单/多文件双模式 Design Spec

**日期：** 2026-08-10
**状态：** Implemented（M1–M3 已落地；M4 多文件壳 + UML 静态/缓存已落地，Coze UML 与多文件合编译为增强项）  
**设计来源：** 用户提供的「可视化1.pdf」「可视化2.pdf」草图（位于仓库父目录 `../可视化1.pdf`、`../可视化2.pdf`）+ 现有 `LinkedListCanvas` / `RecursionStackCanvas` / `SvgAnimatePanel` 基础


## 1. 背景与动机

JavaTutor 现有可视化集中在「变量页 + 流程页」：堆/栈卡片、链表画布（变量页顶部嵌入）、控制流图、AI 解说、SVG 动画生成。可视化1/2.pdf 提出更系统的设想：

- **数据结构可视化要专业且对齐经典结构：** 链表带 head/slow/tail 标签；数组类带 head/tail + 索引；二叉树/堆按 layer 排列、搜索路径高亮、cur/next/prev 标签；图节点内写 val、边带权重。
- **多文件项目需要项目级视图：** 流程图、数据流图、结构图、类图、用例图五种 UML。
- **算法知识应有「前置参考」：** 从 oi.wiki 等平台收集的算法知识库文档，作为预置知识放在算法页顶部，可折叠。

历史结论（必须遵守）：

- Mermaid / AntV X6 / VueFlow+ELK 做**通用引用箭头**失败（闪烁、坐标冲突、密度问题），通用引用继续走颜色联动（MemoryPanel 现状）。
- 单文件 / 多文件应做成**完全独立**的两种 UI，而不是同一 UI 内的 tab 切换。

## 2. 目标 / 非目标

### 目标（v1）

1. 顶部新增「单文件 / 多文件」模式入口条；切换时保留运行状态与步进位置。
2. 单文件模式右侧栏从 5 个 tab 重排为 6 个 tab，新增「数据结构」与「算法」两个 tab。
3. 数据结构 Tab 支持链表（单向+双向）、数组类、二叉树/堆、图（无向/有向/网络流）五种可视化。
4. 算法 Tab 顶部引入可折叠的算法知识库文档（来自 oi.wiki 等平台）；下方保留现有复杂度分析与智能体问答。
5. 多文件模式完整实现：多文件 tab 栏 + 单编辑器；右侧 5 个 UML tab（流程/数据流/结构/类图/用例）。
6. 五种 UML 由 Coze AI 生成 + 静态模板兜底；类图优先静态生成。
7. 零破坏现有功能：测试模式、导入按钮、运行/步进/播放/速度、AI 问答、SVG 动画生成全部保留。

### 非目标（v1）

- 多文件模式下的代码编辑（v1 编辑器只读，避免多文件一致性）。
- 自定义节点类字段名识别（沿用 `val`/`next` 白名单）。
- 完整支持任意自定义数据结构（仅首期清单五种）。
- 重做 MemoryPanel 堆/栈卡片视觉。
- 红黑树特判（PDF 中提到「特判为红黑树 → 不考虑，标红黑」，v1 跳过）。
- 多条不相交链表并列展示（沿用现行 `LinkedListExtract` 选一条展示规则）。
- 跨模式共享运行状态（切换模式不跨态，运行/步进位置仅本模式内保留）。

## 3. 用户体验

### 3.1 模式入口条

```
┌───────────────────────────────────────────────────────────────┐
│  [单文件]  [多文件]                       JavaTutor · 教学终端  │  ← 模式入口条
├───────────────────────────────────────────────────────────────┤
│  RUNTIME WIRE / TRACE · STEP · HEAP · ... (banner 不变)        │
├───────────────────────────────────────────────────────────────┤
│  左：编辑器 / 多文件 tab                       右：分页/可视化    │
└───────────────────────────────────────────────────────────────┘
```

- 位置：Runtime wire banner **之上**；全宽；与现有品牌色一致（青蓝 accent + 档案纸 surface）。
- 组件：segmented control，两个 segment：`单文件` / `多文件`。当前态用 accent 描边与下划线。
- 切换行为：保留 `currentStep`、`uploadHistory`、`code`、`chatMessages`、SVG/分析结果；**重渲染**编辑器与右侧栏内容。
- 持久化：localStorage `jt-mode` 存 `single|multi`；冷启动默认 `single`。

### 3.2 单文件模式（保留 + 扩展）

**保留现有所有功能：** Monaco 编辑器、测试模式、导入按钮、运行/步进/播放/速度、AI 问答、SVG 动画生成、控制台输出。

**左侧编辑器卡片不变。**

**右侧栏 6 个 tab（左→右）：**

| Tab | 内容 | 状态 |
|-----|------|------|
| 变量 | MemoryPanel + ConsoleOutput；**移除** LinkedListCanvas 嵌入 | 改 |
| 流程 | ControlFlowPanel（复杂度分析） | 原样 |
| **数据结构** ⭐ | 链表 / 数组 / 树 / 堆 / 图 画布 | 新增 |
| **算法** ⭐ | 顶部折叠算法知识库 + 现有复杂度分析 + 智能体问答 | 重组 |
| 问答 | AiTutorPanel（独立 tab 保留） | 原样 |
| 动画 | SvgAnimatePanel | 原样 |

**算法 Tab 内部布局：**
```
┌─────────────────────────────────────────┐
│ ▸ 算法知识库（默认折叠，点标题展开）       │  ← 折叠条
├─────────────────────────────────────────┤
│ 经典算法预置列表（点击加载到编辑器）       │  ← ClassicCodePanel
└─────────────────────────────────────────┘
```
控制流图留在「流程」Tab；智能体问答留在「问答」Tab。算法页不做重复挂载。

### 3.3 多文件模式（全新 UI）

**左侧编辑器卡片：**
- 顶部：文件 tab 栏（`Main.java` / `Student.java` / `+ 上传`）；当前文件用 accent 下划线。
- 中部：当前文件的 Monaco 编辑器（**v1 只读**；编辑器 readonly，但保留语法高亮、滚动、行号）。
- 底部：项目级运行按钮（`运行整个项目` / `重置`）+ 进度显示；控制条从底栏独立出来贴在编辑器下方。
- 「+ 上传」按钮沿用现有 `FileUploadPanel`（多选模式）。

**右侧栏 5 个 tab：**
| Tab | 内容 | 生成方式 |
|-----|------|----------|
| 流程 | 流程图 | Coze AI + 静态模板兜底 |
| 数据流 | 数据流图 | Coze AI + 静态模板兜底 |
| 结构 | 项目结构图（包/类层级） | Coze AI + 静态兜底 |
| 类图 | 类图 | **静态模板优先**（类名/字段/方法已知） |
| 用例 | 用例图 | Coze AI + 静态模板兜底 |

每个 UML tab 顶部：「重新生成」按钮 + 上次生成时间戳 + 来源标签（AI / 静态）。切换 tab 保留已生成的图。

### 3.4 数据结构 Tab 交互

- **顶部识别栏：** 当前步识别到的类型徽章，如 `链表 × 1 · 数组 × 2 · 树 × 1`；点击徽章滚动到对应画布。
- **画布组织：** 每种类型一个折叠分组；识别不到则整组不渲染（`v-if`）；多个链表/数组各自独立成组（v1 不做合并）。
- **同步：** 跟随全局 `currentStep`，与底部播放条同步；不引入独立播放器。

| 类型 | 关键标注（按 PDF 草图） |
|------|------------------------|
| 单向链表 | 节点上方 `head` / `slow` / `fast` / `tail` 等程序维护的指针标签；next 锚点为空心圆+箭头 |
| 双向链表 | 节点三格 `prev \| val \| next`；prev 箭头朝左、next 朝右 |
| 数组类 | 一维方格 `val`；下方索引 `0..N-1`；上方 `head` / `tail` 标签 |
| 二叉树/堆 | 按 `layer` 分层；圆形节点内写 `val`；`cur/next/prev` 标签贴在节点头上；搜索路径高亮红色（找到后红消失） |
| 图 | 圆形节点内写 `val`；无向边带权重 `b/5/7`；有向边带箭头 + 权重；网络流 `源 e= → → → 汇` |

## 4. 架构

```
App.vue
├── ModeBar                  (新：单/多文件 segmented control)
├── BootIntro (existing)
├── RuntimeWire (existing)
└── <main-area>
    ├── single-file shell   (现有 App.vue main-area，迁移到 SingleFileShell.vue)
    │   ├── Editor card     (existing, 不变)
    │   └── RightCard tabs: 变量/流程/数据结构/算法/问答/动画
    │       ├── 数据结构 Tab
    │       │   ├── DataStructureExtract.js (新：纯函数抽取)
    │       │   ├── LinkedListCanvas (existing, 扩双向)
    │       │   ├── ArrayCanvas (新)
    │       │   ├── TreeCanvas (新)
    │       │   └── GraphCanvas (新)
    │       └── 算法 Tab
    │           ├── AlgoKnowledgeHeader (新：折叠条 + 文档渲染)
    │           ├── ControlFlowPanel (existing)
    │           └── AiTutorPanel (existing, 复用)
    └── multi-file shell     (新：MultiFileShell.vue)
        ├── FileTabsBar      (新：多文件 tab + 上传)
        ├── Editor readonly  (Monaco readonly mode)
        ├── ProjectRunBar    (新：项目级运行控件)
        └── RightCard tabs: 流程/数据流/结构/类图/用例
            ├── UmlPanel.vue (新：通用 UML 容器：生成/缓存/兜底)
            ├── coze backend (extend existing /api/ai/animate)
            └── static fallback templates
```

## 5. 关键设计决策

### 5.1 模式切换

- **位置：** 模式入口条在 `RuntimeWire` 上方；不引入新层级。
- **状态保留：** Pinia store 增加 `mode: 'single'|'multi'`、`singleState`、`multiState` 两个嵌套快照。切换时序列化/反序列化（保留 `steps / currentStep / code / chatMessages / uploadHistory / svgText`）。不保留 `testMode/testCases`（多文件不适用）。
- **持久化：** `localStorage.jt-mode`；冷启动默认 `single`。

### 5.2 数据结构抽取（运行时）

新建 `frontend/src/utils/dataStructureExtract.js`，导出纯函数：

```js
// 返回类型
{
  linkedLists: [{ nodes, pointerLabels, highlightedNodeIds }],   // 单/双向
  arrays: [{ values, headIndex, tailIndex, label }],              // 数组/栈/队列
  trees: [{ nodes, edges, highlightedPath, curLabel }],          // 二叉树/堆
  graphs: [{ nodes, edges, directed, source, sink, capacities }]  // 图
}
```

**复用：** `linkedListExtract.js` 已有的链表识别规则直接复用并扩展双向链表（`prev` 字段）。

**识别阈值：** 数组类长度 ≥ 1 即可识别；树/图需要节点数 ≥ 2 才展示（避免空画布）。堆用 `heap` 字段名启发（若识别到则画「堆」布局变体）。

### 5.3 五种 UML 生成

**后端：** 扩展现有 `animate` 链路（`src/learning/animation.py`），新增 `intent: 'uml'` 分支与五类模板；调用 Coze 的 UML 生成 prompt。

**前端：** `UmlPanel.vue` 通用容器；prop `kind: 'flow'|'dataflow'|'structure'|'class'|'usecase'`；本地缓存 `umlCache: {[kind]: {svg, ts, source}}`；切换 tab 不重生成；点「重新生成」才调 AI。

**类图静态优先：** 项目级类图在文件列表变化时（上传/删除）静态生成；AI 仅在用户主动点「重新生成」时调用。

**兜底：** 每个 UML 都有静态 SVG 模板（`frontend/src/assets/uml-fallback/*.svg`），AI 失败时直接渲染兜底。

### 5.4 算法知识库

- **内容来源：** oi.wiki 等平台，按 CC-BY-SA 注明来源；底部固定一行 `内容来源：oi.wiki 等开源平台，遵循 CC-BY-SA 协议`。
- **存放：** `frontend/src/assets/algo-knowledge/index.json` + `*.md`；构建时打包。
- **类别：** 排序（冒泡/选择/插入/希尔/归并/快排/堆排）、搜索（二分）、图（BFS/DFS/Dijkstra）、树（遍历）、DP、链表操作。
- **渲染：** Markdown → HTML（用 `marked` 或现成的 markdown-it，v1 选最轻量方案，避免新增重型依赖）。
- **交互：** 折叠条默认收起；点标题展开/收起；展开态支持类别内锚点跳转。

### 5.5 多文件模式编辑器

- **Monaco readonly 模式：** `editor.updateOptions({ readOnly: true })`；保留语法高亮、滚动、行号、折叠。
- **文件上传：** 复用 `FileUploadPanel`，改为多选模式；上传后写入 `multiState.files: [{name, code, lang}]`。
- **运行：** 项目级运行入口（`运行整个项目`），把 `multiState.files` 合并发送给后端（待后端 `/api/run` 扩展支持多文件）。
- **v1 不支持：** 跨文件依赖分析、批量编辑、多文件 diff。

## 6. 文件变更（预期）

### 6.1 单文件模式（M1）

| 文件 | 变更 |
|------|------|
| `frontend/src/App.vue` | 顶部加 `ModeBar`；按 `mode` 渲染 `SingleFileShell` 或 `MultiFileShell` |
| `frontend/src/components/ModeBar.vue` | **新建** segmented control |
| `frontend/src/components/SingleFileShell.vue` | **新建** 现有 main-area 抽出来 |
| `frontend/src/components/MultiFileShell.vue` | **新建**（M4 详化） |
| `frontend/src/components/right-tabs/DataStructureTab.vue` | **新建** |
| `frontend/src/components/right-tabs/AlgoTab.vue` | **新建**（含折叠知识库） |
| `frontend/src/stores/player.js` | 增加 `mode / singleState / multiState`；`switchMode` action；保留所有现有字段 |
| `frontend/src/utils/dataStructureExtract.js` | **新建** 纯函数 |
| `frontend/src/utils/dataStructureExtract.test.js` | **新建** 单元测试 |
| `frontend/src/components/MemoryPanel.vue` | 移除 `LinkedListCanvas` 嵌入（M1） |
| `frontend/src/components/LinkedListCanvas.vue` | 扩双向链表（prev 字段 + 双向箭头） |
| `frontend/src/components/ArrayCanvas.vue` | **新建** 数组类画布 |
| `frontend/src/components/ArrayNode.vue` | **新建** 数组节点 |
| `frontend/src/components/AlgoKnowledgeHeader.vue` | **新建** 算法知识库折叠条 |
| `frontend/src/assets/algo-knowledge/` | **新建** 文档资源（M3） |

### 6.2 数据结构扩展（M2）

| 文件 | 变更 |
|------|------|
| `frontend/src/components/TreeCanvas.vue` | **新建** 二叉树/堆画布 |
| `frontend/src/components/TreeNode.vue` | **新建** 树节点 |
| `frontend/src/components/GraphCanvas.vue` | **新建** 图画布 |
| `frontend/src/components/GraphNode.vue` | **新建** 图节点 |
| `frontend/src/utils/dataStructureExtract.js` | 扩展 tree / graph 抽取 |

### 6.3 多文件模式（M4）

| 文件 | 变更 |
|------|------|
| `frontend/src/components/MultiFileShell.vue` | 完整实现 |
| `frontend/src/components/FileTabsBar.vue` | **新建** |
| `frontend/src/components/UmlPanel.vue` | **新建** 通用 UML 容器 |
| `frontend/src/components/ProjectRunBar.vue` | **新建** 项目级运行控件 |
| `frontend/src/assets/uml-fallback/*.svg` | **新建** 五种 UML 静态兜底 |
| `backend/src/main/java/com/javatutor/service/CozeService.java` | 加 `intent=uml` 分支 |
| `backend/.../learning/animation.py` | 加 uml 模板与 Coze prompt |
| `frontend/src/stores/player.js` | `multiState.files` 维护 |

### 6.4 测试

- 数据结构抽取：纯函数单元测试覆盖线性链、环、双向链、数组、树、图（含环、无环、源汇）。
- UmlPanel：切换 tab 缓存行为、兜底渲染、AI 调用失败回退。
- ModeBar：切换时状态保留；localStorage 持久化。

## 7. 验收标准

### M1

1. 顶部出现「单文件 / 多文件」segmented control；切换保留运行状态。
2. 单文件模式右侧 tab 顺序：`变量 / 流程 / 数据结构 / 算法 / 问答 / 动画`。
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
3. 右侧 5 个 UML tab（流程/数据流/结构/类图/用例）可切换；切换保留已生成图。
4. 点击「重新生成」调用 Coze；失败时显示静态兜底。
5. 类图在文件列表变化时静态生成；其他 UML 在用户主动触发时 AI 生成。

## 8. 风险

| 风险 | 缓解 |
|------|------|
| AI 生成 UML 不稳定 | 静态兜底模板 + 类图静态优先 |
| 多文件运行后端未支持 | M4 与后端同步改造 `/api/run` 接受多文件 |
| 算法知识库文档版权 | 严格注明来源（CC-BY-SA / 原始作者）；底部固定声明 |
| 模式切换丢状态 | store 双快照 + 序列化保留关键字段 |
| 数据结构识别不到 | 整组 `v-if` 不渲染；徽章区显示「未识别」 |
| 多文件编辑器只读受限 | v1 接受；v1.1 再考虑支持编辑 |
| 双向链表识别失败 | 沿用现行白名单规则，仅识别含 `prev/val/next` 三字段且类型匹配的类 |

## 9. 决策记录

- **模式入口条位置：** 顶部 Runtime wire banner 之上（与品牌区一致风格）。
- **单文件 / 多文件完全独立 UI：** 不共享 main-area；store 用双快照隔离。
- **数据结构 Tab 与变量 Tab 分工：** 结构画布归数据结构 Tab；堆/栈卡片归变量 Tab；链表画布仅在数据结构 Tab。
- **算法 Tab 重组：** 顶部折叠知识库 + 复杂度分析 + 智能体问答；问答 tab 独立入口保留。
- **UML 生成：** AI + 静态兜底；类图静态优先。
- **里程碑：** M1 模式骨架 + 数据结构（链+数组）；M2 数据结构扩展（树+图）；M3 算法知识库；M4 多文件模式 + UML。

## 10. 后续（v1.1+，不在本规格）

- 多文件编辑器支持编辑模式 + 文件 diff。
- 跨模式共享运行状态。
- 多条不相交链表并列展示。
- 红黑树特判（PDF 中提到的「标红黑」）。
- 数据结构画布导出 PNG / SVG。
- UML 模板可由用户自定义。
