# 数据结构可视化打磨 · Design Spec

**日期：** 2026-08-21
**状态：** Approved（brainstorming 2026-08-21 已通过 A/B/C/D 四段确认）
**范围：** 单文件模式 · 数据结构 Tab
**背景：** 2026-08-10 spec 的 M1/M2 落地后，手测暴露三类问题（chip 重叠、视觉单调、同一数组多处渲染），合并处理以保持设计语言一致。

---

## 1. 背景与动机

数据结构 Tab 已支持链表（单向 + 双向）、数组（含矩阵）、二叉树 / 堆、图五种画布。手测发现：

1. **Chip 重叠**：快排 / 堆排的 l/r/i/j/pivot 在同格时会堆叠超出现有 28px 上 / 下 padding；当前是交替排版硬塞，没有自适应。
2. **视觉单调**：ArrayNode / MatrixCanvas / LinkedListCanvas 都用 1px 方框 + 直角边，与 TreeNode（圆 + shadow + 强调）形成观感断层。
3. **同一数组多处渲染**：堆排时 `int[] a` 既出现在排序 section（SortArrayCanvas），又出现在通用数组 section（ArrayCanvas），还附带一个合成堆树 → 同一对象在屏幕上重复 2–3 次。

---

## 2. 目标 / 非目标

### 目标（v1）

1. chip 数量变化时自动压缩 cell 宽度 / chip 字号，下限保证 10px 可读。
2. 单格 chip 超 `showLimit` 时进入「选择保留 N 个」交互流程，避免信息丢失。
3. ArrayCell / MatrixCanvas cell / LinkedListCanvas 节点统一圆角 + shadow 设计语言。
4. sortViz primary 数组与 result.arrays 中 id 相同项自动隐藏。

### 非目标（v1）


- hover 态、动画过渡（可视化不交互）。
- 用户手动切换「显示全部数组」的开关（YAGNI，需要再加）。
- chip 顺序自定义排序（沿用现有 alphabetical-by-name）。
- 跨模式共享 / 多文件（2026-08 用户整体 out-of-scope）。

---

## 3. 架构

```
frontend/src/
├── utils/
│   ├── chipOverlayLayout.js       ← 新建：纯函数，cell 宽 / 字号 / 溢出检测
│   ├── chipOverlayLayout.test.js  ← 新建
│   ├── pointerRoleColors.js       ← 增 `neutral` 色板（用于 `else` 汇总 chip）
│   └── sortVizExtract.js          ← 增 primaryArrayId
├── components/
│   ├── ArrayCell.vue              ← 新建：方框 + 高亮 + 内嵌 chip 原子
│   ├── ArrayNode.vue              ← 收敛为 <ArrayCell> 的薄壳（保持向后兼容 API）
│   ├── ChipOverflowPopover.vue    ← 新建：选择 ≤2 chip 流程
│   ├── SortArrayCanvas.vue        ← 用 ArrayCell + chipOverlayLayout + Popover
│   ├── ArrayCanvas.vue            ← 同上
│   ├── MatrixCanvas.vue           ← 改 CSS（圆角 + shadow），布局不动
│   └── LinkedListCanvas.vue       ← 改 CSS（圆角 + shadow），布局不动
└── components/right-tabs/
    └── DataStructureTab.vue       ← 增 visibleArrays 过滤 + primaryArrayId 透传
```

设计原则：
- **`ArrayCell` 是新原子**，承担 `value / index / highlight / role / pivot / pointerLabels`，由 SortArrayCanvas 与 ArrayCanvas 共用，消除两边 cell 渲染重复。
- **`chipOverlayLayout` 是纯函数**，依赖 Vue 状态，只接 `{ chipsByCell, ... }`，输出 `{ cellWidth, chipFontSize, overflowByCell, fits }`。
- **`ChipOverflowPopover` 受控组件**，父组件持 selection 状态，popover 只展示 + emit。
- **LinkedListCanvas / MatrixCanvas 改样式不动结构**。

---

## 4. 设计细节 · 段 A · 总体架构

参见 §3 树状图。要点：

- 新增 `ArrayCell.vue` 为底层原子；`ArrayNode.vue` 保留但内部改用 `<ArrayCell>` 渲染，外部 API 不变（向后兼容已有 props：`value / index / isFirst / isLast / isHighlighted / pointerLabels / role / isPivot`）。
- `chipOverlayLayout.js` 与 Vue 解耦，可独立单测。
- `ChipOverflowPopover.vue` 用 `<Teleport to="body">` 避免父容器 `overflow` 截断；位置基于 anchor 计算（默认正上方，向上空间 < 200px 时落下方）。

---

## 5. 设计细节 · 段 B · Chip 压缩 + Popover

### 5.1 压缩函数（`chipOverlayLayout.js`）

```js
computeChipLayout({
  chipsByCell,        // Map<index, [{name, color, role?}, ...]>
  baseCellWidth: 48,
  baseFontSize: 11,
  minFontSize: 10,
  fontStep: 1,
  showLimit: 2,
})
→ {
  cellWidth,
  chipFontSize,
  overflowByCell,     // Map<index, { allChips, visibleChips, hiddenCount }>
  fits,               // boolean：当前 cell 宽能否装下
}
```

算法：
- `maxC = max(chipsByCell.values().map(len)) || 0`
- `chipFontSize = clamp(minFontSize, baseFontSize - max(0, maxC-1) * fontStep, baseFontSize)`
- `cellWidth = max(baseCellWidth, maxC * (chipFontSize + 8))`（chip 横向估算）
- `overflowByCell[i] = { allChips, visibleChips: chips.slice(0, showLimit), hiddenCount: chips.length - showLimit }` 当且仅当 `chips.length > showLimit`

### 5.2 渲染策略

- 每格渲染 `≤ showLimit` 个 chip，多了就用一个**汇总 chip** 替换：
  - 未保存过选择 → `+N` chip（其中 N = hiddenCount）
  - 已保存选择 → `else` chip（中性灰色，role = `neutral`）
- 汇总 chip 仍走 `withVerticalPlacement` 与原 chip 同排版规则。
- 整行 chip 字号统一为 `chipFontSize`，cell 宽度统一为 `cellWidth`（让同 row 的 chip 视觉对齐）。

### 5.3 `ChipOverflowPopover.vue`

Props：
- `chips: Array<{ name, color, role? }>`
- `anchor: { index, cellLeft, cellWidth, containerTop }`（用于 fixed 定位）
- `selection: Set<string>`（受控）
- `max: 2`
- `open: boolean`

Emit：`update:selection`、`close`。

布局：
- `<Teleport to="body">` + `position: fixed`，根据 anchor 计算左上角：
  - 默认在 cell **正上方**（`cellLeft + cellWidth/2 - popoverWidth/2`）
  - 上方空间 < 200px 时落下方
  - 水平越界时贴边（不超出 viewport）
- `z-index: 9999`

交互：
- 头部：`选择保留的 chip（最多 {{max}} 个）` + `{{selection.size}} / {{max}}`
- Body：每行 = 颜色圆点 + label + 复选框
  - 行高 28px，选中行背景 `${accent}14`
  - 超 max 的复选框自动 disable（不可勾）
- Footer：右侧 `保存` 按钮（accent 主色）
- 关闭：`保存` / 点击外部（用 `@click.outside`）/ `Esc`

### 5.4 父组件状态（SortArrayCanvas / ArrayCanvas）

- `popoverOpenCell: number | null`
- `overflowSelections: Map<index, Set<string>>`
- `watch(() => [props.pointers, props.values, props.pivot, props.range], ...)`（任一影响 chip 集合的 prop 变更即触发）：重置 popover + selections（旧选择对当前 step 无意义）
- 每帧渲染前清理：cell chip 数 ≤ showLimit 时自动删除该 cell 的 selection

---

## 6. 设计细节 · 段 C · 视觉美化

### 6.1 设计 token（`frontend/src/style.css` 新增）

```css
:root {
  --ds-cell-radius: 8px;
  --ds-cell-radius-sm: 6px;        /* MatrixCanvas 小 cell */
  --ds-cell-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
  --ds-cell-shadow-active: 0 4px 12px rgba(0, 0, 0, 0.12);
  --ds-cell-border: 1px solid var(--border);
  --ds-popover-shadow: 0 12px 32px rgba(0, 0, 0, 0.14);
}
```

### 6.2 ArrayCell.vue

| 状态 | 圆角 | 边框 | 阴影 | 背景 |
|------|------|------|------|------|
| 默认 | `var(--ds-cell-radius)` | `var(--ds-cell-border)` | `--ds-cell-shadow` | `var(--card-bg)` |
| 指针高亮（mid/next/prev） | 同上 | role 色 1.5px | `--ds-cell-shadow-active` | `${color}26` |
| Pivot（橙色） | 同上 | `#f97316` 1.5px + inset shadow | `--ds-cell-shadow-active` | `#f9731626` |
| 首格 | 保留左上 / 左下 radius | — | — | — |
| 末格 | 保留右上 / 右下 radius | — | — | — |

### 6.3 SortArrayCanvas / ArrayCanvas · 容器层

- 外层 `.sac-strip` / `.ac-strip`：
  - `border: 0`（去掉当前 1px 实线）
  - `background: transparent`
  - `gap: 2px`（让圆角 cell 视觉清晰）
- 整行 band（range / sorted）：保留覆盖逻辑，但 band 改成 `border-radius: var(--ds-cell-radius)` 贴合圆角 cell

### 6.4 MatrixCanvas.vue

- 单元 cell：`border-radius: var(--ds-cell-radius-sm)` + `--ds-cell-shadow`
- 表头（行 / 列标签）：无圆角，无 shadow，仅浅灰边
- 高亮 cell：border + active shadow
- 整表外框：保留边框，`border-radius: 6px`

### 6.5 LinkedListCanvas.vue

- 节点主框（单向 val/next 单元）：`border-radius: var(--ds-cell-radius)` + `--ds-cell-shadow`
- 双向 prev/val/next 三格合并为一个外框（带 radius），内部细分隔线
- next 锚点空心圆：保留
- 指针箭头 SVG：颜色不变

### 6.6 ChipOverflowPopover.vue

- 容器：`background: var(--card-bg)`，border 1px，`border-radius: var(--ds-cell-radius)`，`box-shadow: var(--ds-popover-shadow)`
- 保存按钮：accent 主色（与 AiTutorPanel / ClassicCodePanel 主按钮同色）

---

## 7. 设计细节 · 段 D · 重复数组去重

### 7.1 提取层扩展（`sortVizExtract.js`）

```js
const primary = findPrimaryIntArray(heap, stackFrames)
// primary 现在返回 { values, label, id }  ← 新增 id（heap entry key 优先，obj.id 次之）
...
return {
  ...
  arrayLabel: primary.label,
  primaryArrayId: primary.id,   // ← 新增
}
```

`findPrimaryIntArray` 同步：每条候选记录 `id`（heap 字典的 key 优先，若 `obj.id` 存在则取之）。

### 7.2 DataStructureTab.vue 渲染层

```js
const resultRaw = computed(() => extractDataStructures(...))   // 原始结果（驱动徽章）
const sortViz = computed(() => extractSortViz(...))

const visibleArrays = computed(() => {
  const primaryId = sortViz.value?.primaryArrayId
  if (!primaryId) return resultRaw.value.arrays
  return resultRaw.value.arrays.filter(a => a.id !== primaryId)
})

const visibleResult = computed(() => ({ ...resultRaw.value, arrays: visibleArrays.value }))
```

模板切换 `result.arrays` → `visibleResult.arrays`。`badges` / `anyDetected` 仍用 `resultRaw`（不被过滤影响，否则徽章会骗人）。

### 7.3 行为预期

| 场景 | sortViz | 数组 section | 排序 section |
|------|---------|--------------|--------------|
| 普通 int[] 无排序 | null | 全部 | 无 |
| 归并排序 | merge-tree + primaryId=a | 隐藏 `a` | merge-tree + a 数组视图（合） |
| 快排 | array-pointers + primaryId=a | 隐藏 `a` | array + pointers |
| 堆排 | heap + primaryId=a | 隐藏 `a` | 合成堆树 + a 数组视图 |
| 同时存在多个数组（tmp 辅助） | primaryId=a | 只隐藏 `a`，`tmp` 仍显示 | 仅 a 的视图 |

### 7.4 兜底

- `sortViz.primaryArrayId == null` → 不过滤
- `result.arrays` 中无匹配 id → 过滤 no-op
- 主数组未进入 sortViz → 不过滤

---

## 8. 测试

### 8.1 单元测试

| 文件 | 覆盖 |
|------|------|
| `chipOverlayLayout.test.js` | maxC=0 / 单格单 chip / 单格 N chip / 多格不同 N / font clamp 边界 / overflow 边界（≤ showLimit 不产生 overflow） |
| `sortVizExtract.test.js`（增） | `primaryArrayId` 等于选中那条 id；纯 tmp buffer 时 primaryArrayId 为 null |
| `ArrayCell.test.js` | 占位，仅渲染冒烟（不强制，可选） |

### 8.2 集成测试（可选，v1.1）

仓库当前没有 store-mock 集成测试模式；v1 仅靠单元测试覆盖 `extractSortViz.primaryArrayId`，渲染层去重靠手测。v1.1 可补一个 DataStructureTab 渲染测试：

- 同 step 内 int[] + sortViz 引用同一 id → `visibleArrays` 不含该项
- 同 step 内 int[] + sortViz=null → `visibleArrays === result.arrays`
- 多数组场景：主数组被过滤，tmp 等保留

### 8.3 手测清单

- 快排：3 chip 同格（l/r/pivot） → 字号 / cell 宽自动压缩
- 堆排：合成堆树 + 数组同 i/j 高亮 + sorted 绿带
- LinkedListCanvas：单 / 双向节点圆角
- MatrixCanvas：二维 cell 圆角
- 普通 int[]：数组 section 正常显示
- 堆排后切到「变量」tab：原数组视图仍正常（不受去重影响）

---

## 9. 风险与权衡

| 风险 | 缓解 |
|------|------|
| popover Teleport 后 z-index 与 Live2DWidget 等重叠 | 用全局最高 z-index（9999）+ 测试场景下人工确认 |
| 整行 chip 字号统一 → 同一行不同 chip 视觉权重被拉平 | 用户能区分 chip 角色（颜色仍在），字号统一是教学权衡 |
| 去重后用户调试看不到数组 | v1 接受；后续可加「显示全部」开关 |
| ArrayCell API 与 ArrayNode 双轨 | ArrayNode 保留为壳，内部用 ArrayCell 渲染，向后兼容所有调用方 |
| LinkedListCanvas 改 shadow 可能让 SVG 箭头 z 序错乱 | shadow 仅作用于节点 DOM 盒，不影响 SVG 层；shadow 加在节点 wrapper 而非 SVG 内 |

---

## 10. 决策记录

- **架构选 B**（brainstorming 2026-08-21）：抽出 chipOverlayLayout 公共 utility + ArrayCell 原子，重构面大但语义清晰。
- **统一圆角值** `--ds-cell-radius: 8px`：与 TreeNode 设计语言一致（TreeNode 是 50% 圆，更柔和）；矩阵小 cell 6px 让密集表格不显拥挤。
- **去重选严格 id 相等**（brainstorming 2026-08-21）：误伤面最小，比 sourceVar 更稳。
- **showLimit=2**：与用户「最多选 2 个」诉求对齐；可后续按需放宽到 3。

---

## 11. 后续（v1.1+）

- 「显示全部数组」开关（数据调试模式）
- popover 内 chip 按角色色板排序（mid → next → prev → pivot → custom）
- LinkedListCanvas 流动布局 v1.1（与已有 `2026-08-09-linked-list-fluid-layout-design.md` 合并）
- 二维矩阵 char[][] 特殊处理（chars 显示为字符而非数字）
