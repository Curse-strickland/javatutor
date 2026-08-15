# 控制流图优化 — 执行跟随高亮 + 全屏缩放 + SVG 下载

> 日期: 2026-06-12

## 背景

控制流图使用 Mermaid 渲染静态 SVG，缺乏与程序逐步执行的联动。本次优化实现三个目标：

1. 节点跟随执行步骤高亮（呼吸灯荧光效果）
2. 放大按钮查看大图（支持缩放）
3. SVG 下载

## 实现方案

### 1. 执行跟随高亮

- 利用 CFG 节点 `line` 字段与运行时步骤 `currentLine` 的行号匹配
- `watch(store.currentStep)` → 更新 `currentLine` → `applyHighlight()` 在 SVG DOM 中定位匹配节点
- 匹配方式：遍历 SVG `.node` 元素，`.nodeLabel` 文本前缀匹配 CFG node label（与 drill-down 点击逻辑一致）
- 呼吸灯动画 `@keyframes cfBreathe`：纯 filter 方案（`drop-shadow` 4px↔20px + `brightness` 1↔1.3），不使用 `transform: scale()` 以避免与 Mermaid 的 `transform="translate()"` 冲突

### 2. 全屏大图 Modal

- `<Teleport to="body">` 渲染全屏遮罩层（`backdrop-filter: blur(6px)`）
- 缩放方案（三件套）：
  - **wrapper 占位宽度**：reactive `zoomWrapperStyle` 设置 wrapper div `width: naturalWidth * zoomLevel + 'px'`，预留正确滚动空间
  - **SVG transform 缩放**：`applyZoom()` 设置 SVG `transform: scale(zoomLevel)` + `transform-origin: top left`
  - **margin 居中**：移除 body 的 flex 居中（避免溢出裁剪），wrapper 用 `margin: 0 auto`
- 缩放交互：工具栏 ± 按钮 + Ctrl+Wheel 缩放（0.25x–3.0x，步进 0.15）+ 重置按钮
- 关闭方式：X 按钮 / Escape 键 / 点击遮罩

### 3. SVG 下载

- `XMLSerializer` 序列化当前 SVG DOM（克隆后移除高亮 class）
- `Blob` → `URL.createObjectURL` → `<a download>` 触发下载
- 文件名：`controlflow-{方法名}.svg`

### 4. 边高亮修复（Review 反馈）

- 原逻辑：遍历所有 `.edge` 元素，有 `<marker>` 的全高亮 → 错误地高亮了所有带箭头的边
- 修复：`method.edges.filter(e => matchedIds.includes(e.to))` 找出指向高亮节点的边，通过 Mermaid edge ID 模式 `L-{from}-{to}` 定位对应 SVG 元素

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `frontend/src/components/ControlFlowPanel.vue` | 修改（Template + Script + Style 全面重构） |

## 技术要点

- Mermaid 节点的 `<g>` 元素使用 SVG `transform="translate(x,y)"` 属性定位，CSS `transform` 会覆盖它。呼吸灯动画因此只用 `filter`，不触碰 `transform`
- 全屏 Modal 缩放不单独依赖 `transform: scale()`（滚动条失效）也不单独依赖百分比 `width`（flex 循环依赖），而是用 wrapper 像素宽度 + SVG transform 双轨方案
- SVG 自然宽度从主面板已渲染的 `mermaidRef` 测量，避免 Teleported 元素刚插入 DOM 时 `getBoundingClientRect()` 返回 0 的时序问题
