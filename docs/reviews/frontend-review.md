# 前端审查：控制台输出 / 堆栈区 / 设计优化

> 审查日期: 2026-06-08

---

## 一、设计规范合规情况

以下是相对 DESIGN.md 反模式清理的逐项验收：

| 反模式 | 修复前 | 修复后 | 状态 |
|--------|--------|--------|------|
| `.area-label uppercase` | `text-transform: uppercase` (堆栈区标签) | `font-size: 12px; font-weight: 600` | **已修复** |
| 文字折叠开关 `▸/▾` | 堆栈区 + 数组行均用文字 | chevron SVG + `rotate(180deg)` | **已修复** |
| 绿色变量值 `#34d399` | `.si-value { color: #34d399 }` | `color: var(--text)` | **已修复** |
| 琥珀色高亮 `rgba(255,199,44)` | `.scalar-card.value-flash` 用琥珀色 | `var(--accent-border)` 蓝色 | **已修复** |
| 裸 `border-top` 分隔 | `HeapStackPanel` 用 `border-top` | 包入 `.card`，由卡片自带边框 | **已修复** |
| 无卡片包裹 | 堆栈区直接裸展示 | 统一 `class="card p-3 mb-3"` | **已修复** |
| 调试日志残留 | ConsoleOutput 有 watch 打印 raw output | 已删除 | **已修复** |

**结论：DESIGN.md 6 条反模式全部清除。**

---

## 二、ConsoleOutput.vue — 控制台输出面板

**结构**: 可折叠面板，输出有内容时才渲染 (`v-if="store.currentOutput"`)。

| 项目 | 评估 |
|------|------|
| 设计一致性 | 蓝色圆点 + chevron + card 包裹 ✓ |
| 折叠初始态 | `collapsed=false`（展开），符合用户首次运行期望 ✓ |
| enter/leave 过渡 | `translateY` + `opacity`，0.3s enter / 0.2s leave ✓ |
| 内容区 | `code-bg` + 左边线 `accent-border` 2px，`max-height: 220px` + scroll ✓ |

**功能阻塞问题**：后端目前没有捕获 stdout → `store.currentOutput` 始终返回 `""` → 面板永远不渲染。需要确认是否在后续迭代中完成。

**建议**：后端补两个改动即可打通：
1. `RunController` 执行 `main()` 前 `System.setOut(capturedStream)`
2. 每步 `TraceEngine.record()` 时附带 capture buffer 的增量 `output`

---

## 三、HeapStackPanel.vue — 堆 & 栈视区

**结构**: 左栈（标量变量） / 右堆（数组对象），按设计规范改造。

**改进点**：
- 移除了 `connector-area` SVG 连线（简化视觉，用竖分割线替代） ✓
- 栈帧从嵌套 card 改为 `.stack-frame` (code-bg + border) ✓
- 堆对象从嵌套 card 改为 `.heap-object` (code-bg + border) ✓
- 数组 cell 内联展示（直接 `.ho-cells` 而非嵌套 `.ho-body`） ✓

**小建议**：
- `hashCode` 生成的 `0xXXXX` 伪地址是教学简化，可在堆标签旁加 `(示意)` 小字避免学生误解为真实内存地址
- `stackItems` 把所有非数组变量都标为 `isRef: false`（标量），对教案场景正确但未来若引入对象引用需扩展

---

## 四、VariablePanel.vue — 变量卡片区

**变更**: 数组行折叠按钮从文字 `▸/▾` 改为 chevron SVG；高亮色从琥珀/绿色统一为蓝色 accent；移除了旧的 `value-flash` 继承 `color: inherit`。

| 项目 | 评估 |
|------|------|
| 折叠按钮 | 与 HeapStackPanel / ConsoleOutput 统一为 SVG chevron ✓ |
| `.value-flash` | 从 `rgba(99,102,241,0.12)` 改为 `var(--accent-bg)` + `color: var(--primary)` ✓ |
| `.scalar-card.value-flash` | 从琥珀色 `rgba(255,199,44)` 改为蓝色 `var(--accent-border)` ✓ |
| `.card.flash` | 统一 `accent-border` + `box-shadow` ✓ |
| 数组行 `.card.flash` | 不再单独覆盖 background（继承 `.card` 原有 bg） ✓ |

**小建议**：`compareIndicesMap` 的 watcher 硬编码变量名 `i`、`j` (L123-124)，学生若用其他循环变量名（如 `row`/`col`）则比较高亮失效。可提炼为从 `variables` 中按命名模式推断。

---

## 五、App.vue — 主布局

**改进**：
- 左侧编辑器包入 `.editor-card.card`（不再是裸 div + `border-r`） ✓
- 右侧面板有统一样式的 header（蓝色圆点 + 标题） ✓
- 控制栏改为浮动圆角条 (`border-radius: 16px` + `backdrop-filter`) ✓
- 背景增加微弱 dot grid texture (`radial-gradient`) ✓
- 响应式断点 `640px` 补充了 `main-area`/`control-bar` 的适配 ✓

**需清理**：

### 死代码：`style.css` 中全局 `.control-bar` (L75-83)

```css
.control-bar {
  padding: 12px 16px;
  border-top: 1px solid var(--border);
  /* ... */
}
```

App.vue scoped 已定义同名样式（L236-248），全局版永远不会被当前页面使用且 `border-top` 与 scoped 版冲突。建议删除。

---

## 六、Player Store

**变更**：
- `output` 字段 + `currentOutput` getter — 按当前 step 累积 output 增量
- 移除了旧的 per-step output 调试日志循环 ✓

**性能提示**：`currentOutput` 每次 step 变更都 `O(n)` 遍历 steps 叠加字符串。当前 step 数量小（< 100）无感知，若未来 step 数增长建议改为逐步拼接而非全量重算。

---

## 七、未使用的组件

`SseChat.vue` 未在 App.vue 中 import 或使用。该组件监听 `VITE_SSE_SERVER` 环境变量（默认 `localhost:3000`），推断是预留的 AI 解说 SSE 组件。确认是否计划接入，否则可标记为 fase 2 或删除。

---

## 八、汇总

| 级别 | 问题 | 位置 |
|------|------|------|
| **阻塞** | ConsoleOutput 面板无后端配套 — stdout 未捕获 | `RunController.java` + TraceEngine |
| **低** | `style.css` 全局 `.control-bar` 死代码 | `style.css:75-83` |
| **低** | SseChat.vue 未接入 | `SseChat.vue` |
| **建议** | `compareIndicesMap` 硬编码变量名 `i`/`j` | `VariablePanel.vue:123-124` |
| **建议** | 堆地址 `0xXXXX` 标注"示意"避免误导 | `HeapStackPanel.vue:91` |

设计规范合规度极高，6 条反模式全部清除，可折叠面板的 chevron SVG 统一使用。
