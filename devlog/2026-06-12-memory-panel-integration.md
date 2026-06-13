# MemoryPanel 一体化内存监控面板

> 日期: 2026-06-12 | 分支: `feat/heap-stack-integration`

## 背景

右侧面板原来由 VariablePanel（变量卡片横条）+ HeapStackPanel（堆&栈折叠区）两个独立组件堆叠，共享数据源却割裂展示。本次重构将它们深度合并为一体化两栏式内存监控面板，消除视觉冗余。

## 改动内容

### 1. MemoryPanel.vue — 一体化面板

**新建** (813 行)，替代 VariablePanel.vue + HeapStackPanel.vue。

**两栏式布局**：`grid-template-columns: 1fr auto 1fr`，左 STACK + 分隔线 + 右 HEAP，高度自然对齐。

**栈区左侧**：
- 按栈帧分组（`main(..)`, `quickSort(..)` 等），破折线边框包裹各方法
- 浮动标题（`position: absolute; top: -10px`）显示方法名 + 实际参数值
- 原始变量两列紧凑卡片（`flex-wrap`, `calc(50% - 3px)`）
- 引用变量全宽彩色卡片，border-left 颜色与堆对象匹配
- 排序规则：普通变量先 → 引用变量后 → `args` 数组最末

**堆区右侧**：
- 堆对象彩色左边框 + 标签（如 `[节点1]` 绿色、`[数组 arr]` 紫色）+ 类型文字
- slots（数组格子）和 fields（链表节点字段）双模式渲染
- `args` 堆对象排至底部

### 2. 色彩映射 — 8 色调色板

继承 HeapStackPanel 的 8 色语义标记系统：

| 颜色 | hex | 用途 |
|------|-----|------|
| 激光绿 | `#4ade80` | 堆对象身份 1 |
| 电光蓝 | `#60a5fa` | 堆对象身份 2 |
| 电光紫 | `#c084fc` | 堆对象身份 3 |
| 琥珀金 | `#fbbf24` | 堆对象身份 4 |
| 珊瑚粉 | `#fb7185` | 堆对象身份 5 |
| 青蓝 | `#22d3ee` | 堆对象身份 6 |
| 暖橘 | `#fdba74` | 堆对象身份 7 |
| 薄荷绿 | `#6ee7b7` | 堆对象身份 8 |

引用变量卡片继承目标堆对象颜色（border-left / 背景微染 / 文字颜色），无连线隔空视觉锁定。

DESIGN.md 已标注此为例外：功能性数据可视化色板，非 UI 装饰色。

### 3. 双向悬浮联动

- **栈卡 hover** → 自身 translateX + scale，对应堆卡 glow border + scale(1.02)
- **堆卡 hover** → 所有指向它的栈卡同步点亮（`mp-stack-lit`）
- **堆字段 hover** → 关联对象联动

### 4. 值变化荧光脉冲

跨步骤比较栈帧 locals + 堆数组 slots，变化项触发 900ms 荧光放大动画：

- `transform: scale(1) → 1.035`（栈卡）/ `→ 1.08`（堆格）
- `filter: drop-shadow(0→16px)` 颜色取自卡片对应的堆对象色（引用型）或蓝色（原始型）
- 通过 `--flash-color` CSS 变量注入每卡专属荧光色

迭代历程：
- v1: `.mp-var-value` 区域 background + box-shadow 两段跳变 — 生硬
- v2: `::after` 伪元素 radial-gradient 光晕 + 背景色脉冲 — 仅作用于值区域
- v3: 整卡 `filter: drop-shadow()` + `transform: scale()` 荧光放大 — 最终方案

### 5. 卡片进出动画

Vue `<TransitionGroup>` 三级动画：

| 级别 | name | 效果 |
|------|------|------|
| 栈帧 | `mp-frame` | 从左滑入 + 淡入 |
| 栈卡 | `mp-card` | 从下滑入 + 淡入 + scale(0.96→1) |
| 堆卡 | `mp-heap-card` | 从下滑入 + 淡入 + scale(0.97→1) |

统一 `cubic-bezier(.22,.9,.27,1)` 缓出 + `prefers-reduced-motion` 降级。

### 6. 编辑器行号间距优化

Monaco Editor 配置：`lineNumbersMinChars: 5→3`，`lineDecorationsWidth: 0→6`，`padding.left: 12`。行号列从默认 5 字符宽缩减为 3 字符，左侧内边距从默认缩减。

### 7. 后端：调用栈参数捕获

**TraceEngine.java**：
- 新增 `pushFrame(String methodName, Object... pairs)` 重载
- `frameArgs` 列表与 `callStack`/`frameLocals` 同步管理
- `record()` 中每个栈帧新增 `args` 字段
- Instrumenter 自动生成 `pushFrame("quickSort", "arr", arr, "low", low, "high", high)`

**前端渲染**：帧标题从 `quickSort(..)` 变为 `quickSort(arr, 0, 4)`，引用参数显示彩色别名。

### 8. Review 修复

| 问题 | 修复 |
|------|------|
| `--stagger` CSS 变量定义未使用 | 移除死代码 |
| 8 色调色板非 design system 颜色 | DESIGN.md 标注功能性例外 |
| 堆数组单元格数值变化无高亮 | 新增 `flashHeapCellKeys` 检测 + `mpFlashCell` 动画 |

## 涉及文件

| 文件 | 改动 |
|------|------|
| `frontend/src/components/MemoryPanel.vue` | **新建** |
| `frontend/src/components/VariablePanel.vue` | **删除** — 功能已合并 |
| `frontend/src/components/HeapStackPanel.vue` | **删除** — 功能已合并 |
| `frontend/src/App.vue` | 修改 — import/使用 MemoryPanel |
| `frontend/src/components/Editor.vue` | 修改 — lineNumbersMinChars + 缩进优化 |
| `backend/.../TraceEngine.java` | 修改 — pushFrame 参数捕获 |
| `backend/.../RunController.java` | 修改 — TRACE_ENGINE_SOURCE 同步 |
| `backend/.../Instrumenter.java` | 修改 — 生成带参数的 pushFrame 调用 |
| `DESIGN.md` | 修改 — 堆对象色板例外说明 |

## 技术要点

- CSS Grid `1fr auto 1fr` 确保分隔线不会挤占内容列（`1fr 1fr` 会把第三子项挤到下一行）
- `color-mix(in srgb, var(--ref-bg) 25%, var(--code-bg))` 实现引用变量卡片的背景微染
- `filter: drop-shadow()` 用于荧光动画而非 `box-shadow`，因为 drop-shadow 跟随元素形状且不受 border-radius 裁剪
- 荧光颜色通过 `--flash-color` CSS 变量和 inline style 动态注入，每卡独立
- 堆数组变化检测粒度到单个 `slot.index`，使用 `"heapKey:slotIndex"` 字符串键
- `refCardStyle()` 合并原有 ref 样式 + flash 颜色，避免 `:style` 属性重复
