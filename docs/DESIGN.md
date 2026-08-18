# Design System — JavaTutor

> 档案工业风（Rhodes Archive / HUD）。浅色冷灰底 + 切角轮廓 + 单一蓝青 accent。像一份排版严谨的技术档案，而非圆润的消费级 IDE。
>
> 实现源：`frontend/src/style.css` 的 `:root` tokens 与 `.card`/`.btn`/滚动条/Monaco 覆盖；组件样式见 `SingleFileShell.vue`、`MultiFileShell.vue`、`ModeBar.vue`、`AiTutorPanel.vue`。本文件是这些实现的规约，改动组件前先对照本文件。

---

## Color Palette

浅色冷灰基调，`#0d9ec4` 蓝青为唯一 accent。无第二强调色（琥珀/绿仅作语义警告或功能色，见下）。

### 基础 Tokens（style.css `:root`）

| Token | Value | Usage |
|-------|-------|-------|
| `--bg` | `#e9ebef` | 页面背景（冷灰） |
| `--bg-2` | `#f4f5f8` | 卡片/面板表面 |
| `--bg-3` | `#dde0e6` | 更深的灰底 |
| `--fg` | `#12161d` | 主文字（近黑） |
| `--muted` | `#4d5665` | 次级文字 |
| `--faint` | `#8b93a1` | 辅助信息/占位/水印 |
| `--line` | `#c9ced8` | 卡片边框、分割线 |
| `--line-strong` | `#9aa2b0` | 强调边框、splitter handle、滚动条 thumb |
| `--accent` | `#0d9ec4` | **唯一强调色**（蓝青） |
| `--accent-ink` | `#ffffff` | accent 上的文字/图标 |
| `--accent-bg` | `rgba(13,158,196,0.08)` | 蓝底标签、选中态背景、value-flash 背景 |
| `--accent-border` | `rgba(13,158,196,0.35)` | 聚焦边框、选中态边框 |
| `--warn` | `#d97b1e` | 警告（仅语义用途） |
| `--danger` | `#c4433b` | 错误 |
| `--success` | `#17a34a` | 成功（仅语义用途） |
| `--cut` | `12px` | 卡片切角尺寸 |
| `--shadow` | `0 14px 34px -18px rgba(18,22,29,0.35)` | 卡片投影 |

### App 别名（组件沿用旧变量名，勿在组件里改用新名）

| Alias | Value | 说明 |
|-------|-------|------|
| `--text` | `var(--muted)` | 正文 |
| `--text-h` | `var(--fg)` | 标题/强调文字 |
| `--text-muted` | `var(--faint)` | 辅助文字 |
| `--card-bg` | `rgba(244,245,248,0.88)` | 卡片表面 |
| `--border` | `var(--line)` | 边框 |
| `--code-bg` | `rgba(255,255,255,0.88)` | 代码区/输入区/内容区表面 |
| `--editor-bg` | `transparent` | 编辑器透明，透出卡片底 |
| `--editor-header-bg` | `rgba(255,255,255,0.66)` | 编辑器卡头 |
| `--btn-bg` | `rgba(255,255,255,0.88)` | 次要按钮 |
| `--primary` | `var(--accent)` | accent 的组件别名 |
| `--primary-600` | `#0b89aa` | hover/按压加深 |

**原则**: UI chrome 只用蓝青 accent，不用绿/黄做装饰强调。值变化高亮用 `--accent-bg` + `--accent-border`，不用琥珀色。

**例外 — 功能性语义色板**:
1. **堆对象识别 8 色板**（MemoryPanel）: 用于区分最多 8 个不同的堆对象身份（数组、链表节点等），帮助隔空追踪引用关系。
2. **算法/数据结构标签分类色**（AiTutorPanel `tag-*`）: 排序/搜索/递归等 11 类功能色，点击触发解说。这些是数据分类语义色，不是 UI chrome 装饰。

---

## Typography

| Token | Stack | Usage |
|-------|-------|-------|
| `--sans` | `'Archivo', 'Noto Sans SC', -apple-system, system-ui, sans-serif` | 正文、UI 标签 |
| `--heading` | 同 `--sans` | 大标题（h1/h2） |
| `--mono` | `'JetBrains Mono', 'Noto Sans SC', Menlo, monospace` | 代码、变量值、kicker、按钮 |
| 编辑器字体 | `'Maple Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace` | Monaco 渲染与输入框（本地 @font-face） |

**字号层级**:
- 区域标签 `.panel-kicker`: `--mono` 9.5px / 700 / `letter-spacing: 0.18em` / **uppercase** / `--text-muted`
- 卡片标题: `--sans` 14px semibold, color `--text-h`
- 按钮 `.btn`: `--mono` 12px / 700 / `letter-spacing: 0.08em` / **uppercase**
- 变量名/标签: 12px, `--text-muted`
- 变量值: 16px semibold mono, `--text-h`
- 正文/聊天: 13–15px, line-height 1.55–1.65
- 代码: mono, 12–16px

**关键**: **uppercase + letter-spacing 是当前风格的既定语言**（kicker、按钮都用）。老规约"不用 uppercase 标签"已废除。

---

## 切角（核心形态）

**直角 + clip-path 切角**是本设计系统最标志性的形态特征。所有卡片、按钮、面板头统一 `border-radius: 0`，用 clip-path 切角，绝不使用圆角。

### 卡片 `.card`
```css
background: var(--card-bg);
border-radius: 0;
border: 1px solid var(--border);
box-shadow: var(--shadow);
clip-path: polygon(
  var(--cut) 0, 100% 0,
  100% calc(100% - var(--cut)), calc(100% - var(--cut)) 100%,
  0 100%, 0 var(--cut)
);
```
所有面板必须包裹在 `.card` 中。使用时搭配 `class="card p-3 mb-3"`。

### 面板容器（ModeBar / runtime-wire / control-bar）
切角 10px：
```css
clip-path: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px);
```

### 按钮 `.btn`
```css
border-radius: 0;
clip-path: polygon(8px 0, 100% 0, 100% calc(100% - 8px), calc(100% - 8px) 100%, 0 100%, 0 8px);
padding: 8px 14px;
font-family: var(--mono);
font-weight: 700;
font-size: 12px;
letter-spacing: 0.08em;
text-transform: uppercase;
transition: transform 160ms cubic-bezier(.22,.9,.27,1), box-shadow 160ms, opacity 160ms;
```
`.btn-primary`：`background: var(--accent); color: var(--accent-ink);` + 蓝青投影。按压态 `translateY(1px) scale(0.997)`。禁用态 `opacity: 0.6`。

### 小标签/小切角（4px）
小 chip（如 `multi-readonly-hint`）：`clip-path: polygon(4px 0, ...)`。

### 蓝色圆点 `.rc-dot` / `.ai-dot`
7px 方形（`border-radius: 0`），`background: var(--accent)`，单角切：
```css
clip-path: polygon(0 0, 100% 0, 100% 70%, 70% 100%, 0 100%);
animation: wire-pulse 2s steps(2) infinite;  /* 50% { opacity: 0.28 } */
```

---

## Component Patterns

### 卡头（editor-card-header）
```css
display: flex; align-items: center; gap: 8px;
padding: 12px 16px;
border-bottom: 1px solid var(--border);
position: relative;
background: var(--editor-header-bg);
```
卡头底部一条 88px×2px 的 accent 下划线（`::after`）作为品牌强调，置于左 16px：
```css
.editor-card-header::after {
  content: ''; position: absolute;
  left: 16px; bottom: -1px;
  width: 88px; height: 2px;
  background: var(--accent);
}
```
卡头内左侧用 `.panel-kicker`（uppercase mono 小字）+ 标题。

### 可折叠面板标题
统一模式：蓝色圆点（`.rc-dot`，7px 切角）+ 标题 + chevron SVG。
```html
<div class="hs-header" @click="isOpen = !isOpen">
  <div class="flex items-center gap-2">
    <span class="rc-dot" />
    <span class="text-sm font-semibold" style="color: var(--text-h)">标题</span>
  </div>
  <svg class="hs-chevron" :class="{ rotated: isOpen }" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <polyline points="6 9 12 15 18 9" />
  </svg>
</div>
```
Chevron 旋转 `transform 0.25s ease`，展开时 `rotate(180deg)`。

### 代码内容区
```css
background: var(--code-bg);
border: 1px solid var(--border);
border-radius: 0;
```
用于：控制台输出 body、栈帧、堆对象、聊天 body、输入框、代码区。

### 聊天气泡（AiTutorPanel）
- 用户 `.chat-bubble.user`: `--accent-bg` + `1px solid var(--accent-border)`，靠右
- 助手 `.chat-bubble.assistant`: `--code-bg` + `1px solid var(--border)`，靠左
- `max-width: 88%`, `border-radius: 0`, 13px, line-height 1.6
- 内联 `code` 用 mono 12px + `--primary` 色；`pre` 用 code-bg + 边框
- 引用知识库/来源的标签（如 trace-chip）: `--accent-bg` 底 + `--primary` 字 + 小号

### 滚动条
```css
::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-thumb { background: var(--line-strong); border-radius: 0; }
::-webkit-scrollbar-thumb:hover { background: var(--muted); }
```

### Monaco 字体一致性（重要）
Monaco 隐藏输入框与渲染字体必须一致，否则光标错位：
```css
.monaco-editor textarea.inputarea,
.monaco-editor,
.monaco-editor .view-lines {
  font-family: 'Maple Mono', ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important;
  letter-spacing: 0 !important;
}
```

---

## Motion

- **缓动曲线**: `cubic-bezier(.22,.9,.27,1)` — 温和的 ease-out，无弹跳
- **展开/折叠**: `0.25s ease`（chevron rotate 180deg）
- **按钮按压**: `160ms`（translateY(1px) scale(0.997)）
- **圆点脉冲**: `wire-pulse 2s steps(2)`（`50% { opacity: 0.28 }`）— 指示"运行中"状态
- **ai-dot / rc-dot 呼吸**: `2s steps(2)`，闪烁而非平滑渐隐
- **输入框 hover**: `border-color 0.2s`

所有动画必须支持 `@media (prefers-reduced-motion: reduce) { animation: none; transition: none }`。

---

## Spacing

- 卡片间距: `mb-3` (12px)
- 卡片内边距: `p-3` (12px)
- 元素间隙: `gap-2` (8px) / `gap-3` (12px)
- 卡头内边距: `padding: 12px 16px`
- 不使用非标准间距

---

## Layout

- 全高 `100vh` flex column：`ModeBar`（模式切换）→ `runtime-wire`（状态横幅）→ 主区（编辑器 | 右侧面板）
- 单文件/多文件模式由 `SingleFileShell` / `MultiFileShell` 切换，共用同一套面板风格
- 右侧面板: `flex flex-col`，内容区 `flex-1 overflow-auto`
- 底部控制栏 `.control-bar`: `position: fixed` / `z-index: 5000`，可拖动，`backdrop-filter: blur(12px)`（浮层允许毛玻璃）
- 滚动区域隐藏整页滚动（`html, body { overflow: hidden }`），禁止整页滚动条闪现导致布局抖动
- 移动端 (<720px): 分栏纵向排列，分割线隐藏

---

## Anti-Patterns (禁止)

- 不使用圆角（`border-radius: 0` + clip-path 切角是唯一形态）
- 不用绿色 `#34d399` 或琥珀色做 UI 强调 — 统一蓝青 accent（例外仅限功能语义色板）
- 不写裸 `border-top` 分割 — 用卡片包裹或用 `.editor-card-header` 的 accent 下划线
- 不用文字 "▸ 展开/▾ 折叠" — 用 chevron SVG
- 不用 `glassmorphism` 做装饰性默认背景 — 仅浮层（控制栏）允许 `backdrop-filter`
- 不用旧深色风格变量（`#2b2b32`、`#0a84ff`、12px 圆角、Apple 渐变按钮）— 已迁移到浅色 Rhodes tokens
- 不把 `--code-bg`/`--card-bg` 写成不透明纯色 — 保留透明度让切角叠层有层次
