# 链表流动布局与滑动重组（v1.1）Design Spec

**日期：** 2026-08-09  
**状态：** Implemented — 实现计划见 `docs/superpowers/plans/2026-08-09-linked-list-fluid-layout.md`  
**前置：** `2026-08-09-linked-list-structure-viz-design.md`（v1 横排 + 抽取已落地）  
**决策：** 步进后 **强制回到语义布局**（选项 A）；可拖仅为临时微调，下一步播放即重置。

## 1. 动机

v1 为固定横排 DOM + SVG 箭头，步进时主要是换标签/高亮，缺乏 Staying 类「反转/插入时节点滑动重组」的流动感。  
v1.1 在**不引入 X6/VueFlow/ELK** 的前提下，用「语义坐标 + CSS/SVG transition」实现流动观感。

## 2. 目标 / 非目标

### 目标

1. 每步根据当前链拓扑计算每个节点的目标 `(x, y)`（语义布局）。  
2. `currentStep` 变化时，节点从旧坐标 **平滑滑动** 到新坐标；箭头跟着重连（可同步淡入淡出或短路径插值）。  
3. 支持有限拖拽：用户可拖节点；**下一次步进**（或点「重置布局」）清除拖拽偏移，回到语义布局。  
4. 默认视觉逻辑仍以主链从左到右为主；环、插入可有轻微纵向错位（见 §4），**不是**自由力学仿真。

### 非目标

- 通用堆引用全图箭头。  
- 力导向 / ELK 自动布局。  
- 永久记住拖拽位置跨步骤（否决选项 B）。  
- 像素级复制 Staying。

## 3. 与 v1 的关系

| 层 | v1 | v1.1 |
|----|----|------|
| 数据抽取 | `extractLinkedListView` | **复用，不改契约** |
| 渲染 | `LinkedListCanvas` 横排 flex | 改为（或演进为）**绝对定位画布** + 坐标驱动 |
| 步进 | 换 props | 换 props **并**动画位姿 |
| 拖拽 | 无 | 有，步进重置 |

## 4. 语义布局规则（v1.1）

坐标系：画布左上为原点，单位 px。

常量（可调）：

- `NODE_W`, `NODE_H`, `GAP_X`（主链水平间距）, `BASE_Y`（主链基线）  
- `CYCLE_LIFT`：成环回流时目标节点略向上偏移  
- `INSERT_LIFT`（可选）：相对上一步新增的节点，起始 y 略高再滑入 `BASE_Y`

算法（主链）：

1. 取 `nodes[]` 顺序（抽取层已定序）。  
2. 每行最多 `COLS_PER_ROW`（默认 3）：`col = i % COLS`，`row = floor(i / COLS)`；  
   `x = PADDING + col * (NODE_W + GAP_X)`，`y = BASE_Y + row * (NODE_H + GAP_Y)`。  
3. 箭头：同行相邻用直线；折行用下方曲线；环回/回指用**上方弧线**绕开中间节点（不再直线横穿）。  
4. 指针标签：仍锚在节点上方中心（随节点坐标移动）。

不在 v1.1 做：二叉树式分叉、力导向；蛇形往返排版可作为后续增强。

## 5. 动画

- 节点：`transform: translate(x,y)` + `transition: transform 280–400ms cubic-bezier(.22,.9,.27,1)`。  
- 箭头：优先每帧按锚点重算（量测或由坐标推导）；节点 transition 期间可用 `requestAnimationFrame` 更新线，或 transitionend 后重绘（实现选「rAF 跟随」更顺）。  
- `prefers-reduced-motion: reduce`：无过渡，直接跳坐标。

## 6. 拖拽与重置（选项 A）

- `pointerdown` 在节点上开始拖；拖时写 `dragOffset[id] = {dx,dy}`，显示坐标 = 语义坐标 + offset。  
- 触发重置 offset 的时机：  
  1. `currentStep` 变化；  
  2. 可选 UI：「重置布局」按钮。  
- 拖拽**不**写回 heap / 不改变 `next`（纯视觉）。

## 7. 文件预期

| 文件 | 变更 |
|------|------|
| `LinkedListCanvas.vue` | 横排 flex → 坐标定位；transition；拖拽；步进清 offset |
| `MemoryPanel.vue` | 仅当需要更大画布高度时调样式；逻辑仍吃 extract |
| `linkedListExtract.js` | 原则上不动 |
| 测试 | 布局纯函数若抽出 `layoutLinkedList(nodes) -> positions`，则单测坐标；动画/拖拽手测 |

建议：把 `layoutLinkedList(nodes, opts) -> Record<id,{x,y}>` 抽到 `utils/linkedListLayout.js`，与抽取分离，便于测。

## 8. 验收

1. 反转链表步进：节点明显滑动换位，非瞬切。  
2. 插入节点：新节点滑入空位，邻节点让位滑动。  
3. 拖开某节点后再点下一步：布局恢复语义位置。  
4. 无链表时仍不显示画布。  
5. 不新增运行时图库依赖。

## 9. 风险

| 风险 | 缓解 |
|------|------|
| 箭头与滑动不同步 | rAF 跟随锚点 |
| MemoryPanel 区域太矮 | 提高 `.mp-ll-wrap` min-height 或后续独立「结构」tab |
| 与 v1 DOM 量测冲突 | v1.1 改为坐标推导锚点，减少 getBoundingClientRect 依赖 |

## 10. 决策记录

- 流动 = 语义布局 + 滑动重组 + 有限拖拽。  
- 步进后：**A — 强制语义布局**，丢弃拖拽偏移。
