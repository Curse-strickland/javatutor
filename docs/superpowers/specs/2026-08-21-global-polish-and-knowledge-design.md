# 全局美化 & 知识库扩充 · Design Spec

**日期：** 2026-08-21
**状态：** Approved（brainstorming 2026-08-21 已通过 12 段确认）
**范围：** 单文件模式 / 多文件模式 · 顶栏 / 算法知识库 / 树堆 canvas / 数组 canvas
**背景：** 2026-08-21 用户提出 8 项全局美化与内容扩充需求，合并处理以保证设计语言一致。

---

## 1. 背景与动机

2026-08-21 一次性提出的 8 项需求：
1. 算法知识库「搜索」分类扩充一般算法（参考 oi.wiki / 洛谷模板题）
2. 知识库代码字体过大、样式丑；算法标签改为圆角 + shadow（立体感）
3. 树 / 堆 canvas 的 chips 改为不透明且置于最顶层（不被边遮挡）
4. 数组格子高亮框与格子边框不重合（向左偏移），需修正
5. chips / 数组格子的高亮颜色需各自不同、引人注目；mid/next/prev/root 四色保留
6. runtime wire 横幅合并到 ModeBar 一行，「单文件/多文件」切换不动
7. 页面字体统一用 Google 字体（便于阅读），font-size 不动

> 上述 7 项来自用户原始输入；第 8 项为同批次的「删除控制栏 AI 问答按钮」（问答入口已迁至右侧栏）。

---

## 2. 目标 / 非目标

### 目标（v1）

1. 算法知识库「搜索」分类改名为「查找与搜索」，新增顺序查找、哈希查找、BFS、DFS 四节，原二分查找 / 边界与变体保留。
2. 知识库代码块字号与正文一致；标签全部圆角 + 立体阴影；新增 `--ak-*` 主题变量便于维护。
3. 树 / 堆 canvas 的 chip 背景改为不透明；chip z-index 高于 SVG 边。
4. SortArrayCanvas / ArrayCanvas 的 range / sorted 高亮框与格子边框完全重合（修 GAP 计算）。
5. `pointerRoleColors.js` 中 `insert` 改 magenta、`neutral` 改 amber；其余四色 hex 与 ROLE_PRIORITY 不变。
6. runtime wire 横幅（DOM + 样式）从 App.vue 迁入 ModeBar.vue；页面顶部只剩 ModeBar 一行。
7. Google Fonts 补全 Inter 备用、Archivo / Noto Sans SC 补 400 / 500 字重；Maple Mono 本地字保留不动。
8. 控制栏最右侧的 AI 问答按钮（`.ai-toggle-btn`）整块删除；问答入口只剩右侧栏 tab。

### 非目标（v1）

- hover 态 / 动效过渡（除标签悬浮抬起 1px 外其他不动）。
- 多文件模式的顶栏布局差异（单/多文件 ModeBar 复用）。
- Live2D 看板娘提示气泡与顶栏合并后的位置重排（v1 不动，注释留待后续）。
- 知识库的多媒体插入（GIF / 洛谷题目卡片）。
- chip 顺序自定义排序（沿用现有 alphabetical-by-name）。
- 跨模式共享 / 多文件联动（2026-08 用户整体 out-of-scope）。

---

## 3. 架构

```
frontend/
├── index.html                                       ← 改：补全 Google Fonts 字重 + Inter
├── src/
│   ├── App.vue                                      ← 改：删 .runtime-wire DOM 与样式
│   ├── components/
│   │   ├── ModeBar.vue                              ← 改：吸收 runtime wire 走马灯
│   │   ├── SingleFileShell.vue                      ← 改：删 AI 问答按钮 + 相关样式 + 函数
│   │   ├── MultiFileShell.vue                       ← 改：保留 .rc-dot；wire-pulse 提升到 style.css
│   │   ├── AlgoKnowledgeHeader.vue                  ← 改：引入 --ak-* 主题变量，圆角标签 + shadow
│   │   ├── TreeNode.vue                             ← 改：chip 不透明 + z-index 3
│   │   ├── SortArrayCanvas.vue                      ← 改：range / sorted 修 GAP 偏移
│   │   └── ArrayCanvas.vue                          ← 改：同上（如果有 range / sorted）
│   ├── assets/algo-knowledge/
│   │   ├── index.json                               ← 改：search-and-find 类目 + anchors
│   │   ├── search.md                                ← 重写：6 节内容
│   │   └── graph.md                                 ← 改：顶部加交叉链接
│   ├── utils/
│   │   └── pointerRoleColors.js                     ← 改：insert / neutral 改色
│   └── style.css                                    ← 改：加 --ak-* 主题变量 + 提升 wire-pulse
```

5 个 plan 一起交付（按依赖排序）：

| 计划 | 涵盖 | 依赖 |
|---|---|---|
| **P1** 知识库扩充 | #1 + #2 | 无 |
| **P2** 树 / 堆 chip 不透明 + z-index | #3 | 无 |
| **P4** 数组格子高亮对齐 | #4 | 无 |
| **P3** chip 色板扩展 | #5 | 无（与 P2/P4 并行，单独提交） |
| **P5** 顶栏重构 + 字体 + 删 AI 按钮 | #6 + #7 + #8 | 无 |

P3 与 P2/P4 互不干扰，可与 P2/P4 同批提交；P5 是结构性变更，单独提交便于回滚。

设计原则：

- **新增不动旧有**：所有现有 token（`--ds-cell-radius` / `--ds-cell-shadow` / `--ds-cell-border` 等）不动，仅扩展 `--ak-*` 主题变量服务知识库。
- **职责分离**：色板集中在 `pointerRoleColors.js`，样式变量集中在 `style.css`，组件只消费 token。
- **GAP 抽 token**：`.sac-strip` 的 `gap: 2px` 抽 `--ds-strip-gap`，JS / CSS 双轨同步。
- **keyframes 提升**：`@keyframes wire-pulse` 从 SingleFileShell.vue / MultiFileShell.vue 提升到 style.css（全局），三处统一。
- **font-size / line-height / letter-spacing 不动**（按用户要求 #7）。

---

## 4. 设计细节 · 段 A · 算法知识库扩充（#1 + #2）

### 4.1 `index.json`

```json
{
  "id": "search-and-find",
  "title": "查找与搜索",
  "file": "search.md",
  "anchors": [
    { "id": "顺序查找", "title": "顺序" },
    { "id": "哈希查找", "title": "哈希" },
    { "id": "二分查找", "title": "二分" },
    { "id": "边界与变体", "title": "变体" },
    { "id": "广度优先搜索-bfs", "title": "BFS" },
    { "id": "深度优先搜索-dfs", "title": "DFS" }
  ]
}
```

`graph` 类目保留 BFS / DFS / Dijkstra 三个 anchor；正文顶部加一行：

```
> BFS / DFS 通用版见 [查找与搜索] 分类。
```

### 4.2 `search.md` 重写大纲

1. **顺序查找**：朴素 O(n) 扫描 / 哨兵优化（少一次边界判断）。
2. **哈希查找**：哈希函数（取模 / 拉链法 / 开放定址）+ 冲突处理。
3. **二分查找**：前提、模板要点、与原版一致（保留原文）。
4. **边界与变体**：第一个 ≥x / 最后一个 ≤x / 答案二分（保留原文）。
5. **广度优先搜索（BFS）**：队列、层序、状态空间；最短路性质；模板。
6. **深度优先搜索（DFS）**：栈 / 递归、连通分量、拓扑序；模板。

每节包含：思路 / Java 模板 / 时间 / 空间 / 常见错误 / oi.wiki + 洛谷链接。

### 4.3 `--ak-*` 主题变量（`style.css` 新增）

```css
:root {
  /* 算法知识库主题 */
  --ak-font-base: 13px;       /* 与正文统一 */
  --ak-font-mono: 12px;       /* 代码块（与正文一致，不再放大） */
  --ak-code-bg: rgba(13, 158, 196, 0.06);
  --ak-tag-radius: 8px;       /* 标签圆角 */
  --ak-tag-shadow: 0 1px 3px rgba(18, 22, 29, 0.08),
    0 4px 12px -4px rgba(18, 22, 29, 0.10);
  --ak-tag-shadow-hover: 0 2px 6px rgba(18, 22, 29, 0.10),
    0 8px 20px -6px rgba(18, 22, 29, 0.16);
}
```

### 4.4 `AlgoKnowledgeHeader.vue` 改造

- `.sm-md h1/h2/h3`：字号从 14/13/12 → 全部走 `var(--ak-font-base)`；视觉一致性优先。
- `.sm-md .sm-code`：字号 `11px` → `var(--ak-font-mono)`；圆角 0 → `var(--ak-tag-radius)`；加 `box-shadow: var(--ak-tag-shadow)`；background → `var(--ak-code-bg)`。
- `.ak-cat-btn` / `.ak-anchor-btn`：
  - 去掉 `clip-path polygon(...)` / `border-radius: 0`
  - 改用 `border-radius: var(--ak-tag-radius)`
  - 加 `box-shadow: var(--ak-tag-shadow)`；hover 升级到 `--ak-tag-shadow-hover`
  - `transition` 增 `transform 160ms ease`；hover `transform: translateY(-1px)`
- `.ak-content`：`font-size: 12px` → `var(--ak-font-base)`。
- `.ak-cat-btn` / `.ak-anchor-btn` 自身的 `font-size`（10px / 9px）保留（标签字号偏小是设计语言，不算"页面字号"）。

---

## 5. 设计细节 · 段 B · 树/堆 chip 不透明 + z-index（#3）

### 5.1 `TreeNode.vue` chip 样式

`.tree-node-label`：

| 字段 | 旧 | 新 |
|---|---|---|
| `background` | `${color}18`（≈9% 不透明） | `color`（不透明） |
| `borderColor` | `${color}4d`（≈30%） | `color` |
| `box-shadow` | 无 | `0 1px 2px rgba(0,0,0,0.18)` |
| `color`（文字） | `color` | `#ffffff`（不透明底保证 WCAG AA） |

`.tree-node`：

```css
.tree-node {
  /* ... existing ... */
  z-index: 3;            /* 新增 */
}
```

### 5.2 `TreeCanvas.vue` SVG 边 z-index

```css
.tc-svg {
  /* ... existing ... */
  z-index: 1;            /* 新增（默认 0 也行，这里显式） */
}
```

### 5.3 `MergeSortTreeCanvas.vue`

复用 TreeNode，无需单独改。如有自己的 chip 样式，按 5.1 同步。

---

## 6. 设计细节 · 段 C · 数组格子高亮对齐（#4）

### 6.1 根因

`.sac-strip` 是 `display: grid; gap: 2px`，格子 i 的实际 x 坐标 = `i * (cellWidth + GAP)`。但 `.sac-range` / `.sac-sorted` 使用 `left: lo * cellWidth`，lo > 0 时向左偏 `2 * lo px`。

### 6.2 修法（`SortArrayCanvas.vue`）

抽常量：

```js
const STRIP_GAP = 2 // 必须与 .sac-strip { gap: 2px } 同步
```

修两个 computed：

```js
const rangeHighlight = computed(() => {
  const r = props.range
  if (!r || r.lo == null || r.hi == null) return null
  const lo = Math.max(0, r.lo)
  const hi = Math.min(props.values.length - 1, r.hi)
  if (lo > hi) return null
  const left = lo * (layout.value.cellWidth + STRIP_GAP)
  const width = (hi - lo + 1) * layout.value.cellWidth + (hi - lo) * STRIP_GAP
  return { left: `${left}px`, width: `${width}px` }
})
```

`sortedHighlight` 同理。

### 6.3 `ArrayCanvas.vue`

如有同模式的 range / sorted band（基于 `.ac-strip`），同样套用 6.2 算法。`.ac-strip` 的 `gap` 同步抽 `--ds-strip-gap: 2px`：

```css
.sac-strip,
.ac-strip { gap: var(--ds-strip-gap, 2px); }
```

### 6.4 边框四边对齐

`.sac-range` / `.sac-sorted` 当前只有 `border-left: 1px solid` / `border-right: 1px solid`，缺 `border-top` / `border-bottom`。补全：

```css
.sac-range,
.ac-range,
.sac-sorted,
.ac-sorted {
  /* 现有 ... */
  border-top: 1px solid color-mix(in srgb, var(--range-color, #3b82f6) 25%, transparent);
  border-bottom: 1px solid color-mix(in srgb, var(--range-color, #3b82f6) 25%, transparent);
}
```

`--range-color` 默认 `#3b82f6`（range 蓝），sorted 用 `#10b981` 通过 `style="--range-color: #10b981"` 注入。

---

## 7. 设计细节 · 段 D · chip 色板扩展（#5）

### 7.1 `pointerRoleColors.js`

```js
export const POINTER_ROLE_COLORS = {
  mid: '#eab308',     // yellow  保留（用户规定）
  next: '#3b82f6',    // blue    保留（用户规定）
  prev: '#6b7280',    // grey    保留（用户规定）
  root: '#ef476f',    // red     保留（用户规定）
  insert: '#d946ef',  // magenta 新增（区分 root）
  neutral: '#f59e0b', // amber   新增（汇总 chip）
}
```

### 7.2 `roleStyle(role)` 微调

保持现有 `color22` 透明底（数组 chip / 指针 chip 视觉协调）。树 / 堆 chip 在 #3 段独立改不透明，两段不冲突。

文字色：magenta `#d946ef` + 白字 WCAG AA pass；amber `#f59e0b` + 白字在 13px 字号下 AA pass（amber 较亮，按钮 hover 用白字，悬停标签用暗底+亮字可考虑 `--text-h`）。

如 axe 检测失败（amber 偏黄 + 白字边缘用例 AA Large pass，AA Normal fail），备选 `color: #1f2937`（深灰）保 contrast。

### 7.3 单测扩展

`pointerRoleColors.test.js` 新增：

```js
test('insert 与 root 颜色不同', () => {
  expect(colorForRole('insert')).not.toBe(colorForRole('root'))
  expect(colorForRole('insert')).toBe('#d946ef')
})
test('neutral 为 amber', () => {
  expect(colorForRole('neutral')).toBe('#f59e0b')
})
```

---

## 8. 设计细节 · 段 E · 顶栏重构（#6）

### 8.1 目标布局

```
┌─────────────────────────────────────────────────────────────────────┐
│ [单文件][多文件] │ [wire-mark] RUNTIME WIRE │ ... 走马灯跑动 ...    │
└─────────────────────────────────────────────────────────────────────┘
```

页面顶部只剩 ModeBar 一行，runtime wire 完整保留 marquee 动画。

### 8.2 `App.vue` 删除

- `<div class="runtime-wire">...</div>` 整块 DOM（`:10-36`）。
- 对应 `.runtime-wire / .wire-* / @keyframes wire-marquee / .wire-pulse-dot` CSS（`:133-235`）。
- `wireItems` 数据 + marquee 复制逻辑迁到 ModeBar.vue。

### 8.3 `ModeBar.vue` 新增内容

```html
<div class="mode-bar" role="tablist">
  <button ... >单文件</button>
  <button ... >多文件</button>

  <span class="mode-bar-divider" />

  <span class="wire-mark">
    <svg ... />            <!-- 复用原 wire-mark 28px SVG -->
  </span>
  <span class="wire-title">
    <b>RUNTIME WIRE</b>
    <span>教学终端 · HEARTBEAT</span>
  </span>

  <div class="wire-row">
    <div class="marquee-track">
      <!-- 双倍 items 实现无缝滚动 -->
    </div>
  </div>

  <span class="mode-bar-brand">JavaTutor · 教学终端</span>  <!-- 移到最右 -->
</div>
```

`mode-bar` 加 `display: flex; align-items: center; gap: 10px;`，`wire-row { flex: 1; min-width: 0; overflow: hidden; }`。

`.mode-bar::after` accent bar（`width: 88px`）保留。

### 8.4 提升 keyframes

`@keyframes wire-pulse` 从 SingleFileShell.vue:776 / MultiFileShell.vue:266 / App.vue:175 三处重复，提升到 `style.css`（全局 keyframes）。

### 8.5 兼容

- `.rc-dot` 在 SingleFileShell.vue:776 与 MultiFileShell.vue:266 都引用 `wire-pulse`；提升后两 shell 内同名 `@keyframes` 删除（重复定义 Vue scoped 编译时报警）。
- Live2D 提示脚本无 `.runtime-wire` 选择器引用，删 DOM 不影响看板娘。

---

## 9. 设计细节 · 段 F · Google 字体补充（#7）

### 9.1 `index.html` 改造

```html
<link
  href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Archivo:wght@400;500;600;700;800;900&family=Noto+Sans+SC:wght@400;500;700;900&family=JetBrains+Mono:wght@400;500;700&display=swap"
  rel="stylesheet"
/>
```

`preconnect` 行保留（已有的 googleapis / gstatic 不变）。

### 9.2 `style.css` 字体栈更新

```css
--sans: 'Inter', 'Archivo', 'Noto Sans SC', -apple-system, system-ui, sans-serif;
--heading: 'Archivo', 'Inter', 'Noto Sans SC', -apple-system, system-ui, sans-serif;
--mono: 'JetBrains Mono', 'Noto Sans SC', Menlo, monospace;
```

font-size / line-height / letter-spacing 全部不动。

### 9.3 本地 Maple Mono 保留

`@font-face` 块（style.css:5-52）不动；Monaco editor 仍走 Maple Mono，UI 文字一律 Google 字体优先。

---

## 10. 设计细节 · 段 G · 删除 AI 问答按钮（#8）

### 10.1 `SingleFileShell.vue` 删除

- `<button class="ctrl-btn ai-toggle-btn">...</button>`（`:210-237`）。
- `.ai-toggle-btn` 相关 CSS（`:1026-1048`，含 `@keyframes ai-pulse`）。
- `toggleAiPanel` 函数（`:539-541`）。
- `.ctrl-right-group` 内 AI 按钮的 `<button>` 元素整段删除；保留自动播放 + 速度选择器。

### 10.2 保留兼容

- `store.explainExpanded` / `store.toggleExplainPanel()` / `store.requestExplain()` 状态与方法全保留（未来如要恢复入口可零成本加回）。
- Live2D `waifu-tips.json` / `expression-zones.js` 中 `.ai-toggle-btn` 选择器找不到元素时无副作用（脚本用 querySelector 模式自动跳过）。
- 控制栏 width `min-width: 380px` 调整为 `min-width: 320px`（按钮少了，缩小栏宽）。

---

## 11. 测试

### 11.1 单元测试（vitest）

| 文件 | 覆盖 |
|---|---|
| `pointerRoleColors.test.js`（增） | `colorForRole('insert') === '#d946ef'`, `colorForRole('neutral') === '#f59e0b'`, insert ≠ root |
| `SortArrayCanvas` GAP 计算 utility（新增 `utils/rangeRect.js` + 单测） | `rangeRect(0, 0, 48, 2)` = `{left: 0, width: 48}`；`rangeRect(2, 4, 48, 2)` = `{left: 100, width: 146}` |
| `search.md` 渲染冒烟 | v-html 不抛错，5+ anchor 全部存在 |

### 11.2 集成测试

- 知识库「查找与搜索」类目展开 → anchor 跳转到对应章节，章节标题可点击回顶。
- ModeBar runtime wire 跑动 → marquee 不抖动；删除 runtime wire DOM 后切换 mode 不报错。
- 树 / 堆 canvas（heap sort / bst）→ chip 不透明、SVG 边在 chip 下面。
- 数组 range（快排 l..r）→ range 框与格子左 / 右边线 1px 对齐（截图比对）。
- 控制栏 → 无 AI 问答按钮；右侧栏「问答」tab 仍可打开 AiTutorPanel。

### 11.3 手测清单

- 查 / 排 / 树 / 图 / DP / 链表 六类全部展开正常，无样式回归。
- Lighthouse / axe：contrast 不退步（magenta + 白字、amber + 白字 AA pass）。
- 1280×800 / 1920×1080 / 2560×1440 三档分辨率下顶栏单行展示无溢出。
- Live2D 看板娘在删按钮后仍正常加载。
- Google 字体加载完成后中文走 Noto Sans SC，英文走 Inter / Archivo（DevTools Network 看字体下载）。

---

## 12. 风险与权衡

| 风险 | 缓解 |
|---|---|
| TreeNode chip 改不透明后视觉变"重" | chip 字号仍 10px、padding 仍 2px 6px，背景实色但 hover 不变 |
| insert / neutral 改色后老测试可能取旧值 | 旧测试覆盖 mid/next/prev/root 四色，insert/neutral 是新增断言；旧测试不受影响 |
| Runtime wire 合并后顶部高度变小，旧坐标可能错位 | `.runtime-wire` 当前 `min-height: 44px`，与 ModeBar 同高；ModeBar 加 marquee 后高度保持 44px 不变 |
| Inter 字体未在中文环境 fallback | 中文走 Noto Sans SC 优先，Inter 兜底英文 |
| 删除 AI 按钮后用户找不到入口 | 「问答」tab 顶部标签清晰；Live2D 提示中相关文案保留（无副作用） |
| 5 个 plan 一并发版，git 提交粒度差 | 实施按 P1→P2→P3→P4→P5 顺序提交，每 plan一个 commit；冲突面小（见 §3 依赖表） |
| TreeNode chip 文字改白字后浅色 chip 不可读 | mid / next / prev / root 改不透明后都加深，文字白可读；浅色 insert magenta 在白底对比足够 |

---

## 13. 决策记录

- **一次性交付**：用户 2026-08-21 明确选"按依赖分组一次性"。
- **chip 色板 hex 选择 magenta / amber**：用户已选；mid/next/prev/root 四色 hex 不变。
- **顶栏合并方式**：用户选"单文件/多文件按钮在 ModeBar 左侧，wire 走马灯占满右侧"。
- **字体策略**：用户选"保留本地字只补充 Google 链接"；增加 Inter 作为英文 fallback 字体。
- **知识库重写为单文件 search.md**：不拆多个 .md（保持与现有结构一致）。
- **GAP 抽 `--ds-strip-gap` token**：避免 JS / CSS 双轨失同步。
- **`@keyframes wire-pulse` 提升到全局**：三处重复定义收敛到 style.css。

---

## 14. 后续（v1.1+）

- 知识库多媒体插入（GIF / 洛谷题目卡片）。
- Live2D 看板娘提示气泡与顶栏合并后的位置重排。
- 树 canvas 节点阴影与 chip 不透明化的色彩微调。
- 用户 hover 算法标签触发弹出摘要（popover）。
- 全局 Light / Dark 主题色板抽象（当前仅 Light 主题）。