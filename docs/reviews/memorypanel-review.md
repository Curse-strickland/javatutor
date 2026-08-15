# MemoryPanel 整合 + 三色高亮 + 调用栈参数审查

> 审查日期: 2026-06-12 | 基准提交: `e419ff9`

---

## 一、变更概览

| 变更 | 说明 |
|------|------|
| MemoryPanel.vue (813 行) | **新建** — 合并 VariablePanel + HeapStackPanel 为统一内存视图 |
| TraceEngine.java | **修改** — 新增 `frameArgs` 调用栈参数追踪、`pushFrame(method, pairs...)` 重载 |
| Instrumenter.java | **修改** — `pushFrame` 调用包含参数名和值 |
| Editor.vue | **修改** — 三色高亮：灰色(上一步) → 黄色(当前) → 蓝色(下一步) |
| App.vue | **修改** — 布局改为 splitRatio、MemoryPanel 替换旧面板、WallpaperSelector 入 header、VideoBackground |

---

## 二、MemoryPanel.vue — 核心审查

**布局**: 可折叠卡片 → 左右双栏 (栈区 | 分隔线 | 堆区)，`display: grid; grid-template-columns: 1fr auto 1fr`。

| 项目 | 评估 |
|------|------|
| 栈帧 | 破折线边框 + 浮动标题（方法名+参数显示） ✓ |
| 原始变量 | 2 列紧凑卡片 `mp-var-card-sm` ✓ |
| 引用变量 | 全宽彩色左边框卡片 `is-ref`，颜色与堆对象匹配 ✓ |
| 堆对象 | 彩色左边框 + 标签 + 类型，slots/fields 双模式 ✓ |
| hover 联动 | 栈 hover → 堆高亮，堆 hover → 栈高亮，field hover → 关联对象 ✓ |
| 值变化闪烁 | `mpFlash` keyframe 520ms，蓝色 `accent-bg` ✓ |
| 动画 | TransitionGroup enter/leave + move，栈卡/堆卡/帧三级动画 ✓ |
| 响应式 | 640px 断点切换单列，divider 隐藏 ✓ |
| reduced-motion | 全局覆盖 ✓ |

### 问题

#### [中等] 8 色调色板使用非 design system 颜色

**文件**: `MemoryPanel.vue:150-159`

```js
const PALETTE = [
  { text: '#4ade80', ... },  // 绿
  { text: '#60a5fa', ... },  // 蓝
  { text: '#c084fc', ... },  // 紫
  { text: '#fbbf24', ... },  // 琥珀
  { text: '#fb7185', ... },  // 红
  { text: '#22d3ee', ... },  // 青
  { text: '#fdba74', ... },  // 橙
  { text: '#6ee7b7', ... },  // 绿
]
```

DESIGN.md 规定"只用蓝色 accent"。此处是**功能性**颜色（区分 8 个堆对象身份），非装饰色。属于合理的功能例外，但需在 DESIGN.md 中标注此例外。

---

#### [低] `--stagger` CSS 变量定义但未使用

**文件**: `MemoryPanel.vue:20`

```html
<div ... :style="{ '--stagger': gi }">
```

CSS 中无任何规则引用 `--stagger`，纯死代码。

---

## 三、三色高亮 (Editor.vue)

| 颜色 | class | 语义 | glyph |
|------|-------|------|-------|
| `rgba(128,128,128,0.50)` | `highlight-prev-line` | 上一步 | `exec-prev-arrow` |
| `rgba(255,255,0,0.25)` | `highlight-line` | 当前 | `exec-arrow` |
| `rgba(59,130,246,0.55)` | `highlight-next-line` | 下一步 | `exec-next-arrow` |

`highlightLine(line, prevLine, nextLine)` 重构为三参数，`makeDeco` 内联工厂去重。Editor header 新增 legend 提示（灰 ▶ 上一步 / 黄 ▶ 当前 / 蓝 ▶ 下一步）。✓

---

## 四、调用栈参数 (Backend)

`TraceEngine.pushFrame(methodName, "param1", val1, "param2", val2, ...)` 新增重载，`frameArgs` 列表与 `callStack`/`frameLocals` 严格同步（push/pop/reset 三位一体）。Instrumenter 生成 `pushFrame("quickSort", "a", a, "low", low, "high", high)`。

前端 MemoryPanel 读取 `frame.args` 渲染帧标题中的参数值，引用参数显示堆标签+颜色，原始参数显示字面值。✓

---

## 五、布局变化 (App.vue)

| 变更 | 旧 | 新 |
|------|----|----|
| 左侧宽度 | `leftWidth` (拖拽) | `leftWidth = containerWidth * splitRatio` (55%) |
| 右侧宽度 | `flex-1` | `rightWidth = containerWidth - leftWidth - 12` |
| 分割条拖动 | 拖动修改 `leftWidth` px | 拖动修改 `splitRatio` 百分比 |
| 壁纸按钮 | 独立 control-bar 内 | 移入 right-card-header |

`onMouseMove` 改用比例计算而非绝对像素，窗口 resize 时右侧自适应。✓

---

## 六、汇总

| 级别 | 问题 | 位置 |
|------|------|------|
| **中等** | 8 色调色板使用非 design system 颜色（功能性例外） | `MemoryPanel.vue:150` |
| **低** | `--stagger` CSS 变量定义未使用 | `MemoryPanel.vue:20` |

整合干净。MemoryPanel 的 hover 联动 + 颜色配对是本次最大亮点——栈引用卡片的彩色左边框与堆对象一致，hover 任意一方双向高亮。三色高亮直观展示执行流。调用栈参数支持为多方法代码铺路。
