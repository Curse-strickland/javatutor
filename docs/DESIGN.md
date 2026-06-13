# Design System — JavaTutor

> 专业、清晰、沉浸。像一本排版精良的教材，而非功能密集的 IDE。

---

## Color Palette

统一深灰色调，蓝色为唯一 accent。无第二强调色。

| Token | Value | Usage |
|-------|-------|-------|
| `--bg` | `#2b2b32` | 页面背景 |
| `--card-bg` | `rgba(55,55,63,0.88)` | 卡片表面 |
| `--code-bg` | `#33333b` | 代码区 / 栈帧 / 堆对象 / 控制台内容区 |
| `--text` | `#d4d4d8` | 正文 |
| `--text-h` | `#f0f0f4` | 标题 / 强调 |
| `--text-muted` | `#909098` | 辅助信息 / 占位 |
| `--border` | `rgba(255,255,255,0.10)` | 卡片边框、分割线 |
| `--primary` | `#0a84ff` | 主按钮渐变、accent 色 |
| `--accent-bg` | `rgba(10,132,255,0.10)` | 蓝底标签 / value-flash 背景 |
| `--accent-border` | `rgba(10,132,255,0.20)` | 聚焦边框 / 变更高亮边框 |
| `--shadow` | `0 8px 30px rgba(0,0,0,0.5)` | 卡片投影 |

**原则**: 只用蓝色 accent，不用绿/黄/紫等第二强调色。值变化高亮用蓝色 border + shadow，不用琥珀色。

**例外 — 堆对象语义色板**: MemoryPanel 的堆对象识别使用 8 色调色板（绿/蓝/紫/琥珀/红/青/橙/薄荷）作为**功能性标记色**，用于区分最多 8 个不同的堆对象身份（数组、链表节点等），帮助用户隔空追踪引用关系。这是数据可视化的语义需求，不是 UI chrome 的装饰色。

---

## Typography

| Token | Stack | Usage |
|-------|-------|-------|
| `--sans` | `-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, ...` | 正文、UI 标签 |
| `--mono` | `ui-monospace, SFMono-Regular, Menlo, Monaco, ...` | 代码、变量值 |

**字号层级**:
- 标题: `font-semibold text-lg` (18px)
- 卡片标题: `font-semibold text-sm` (14px) + 蓝色圆点
- 变量名: `12px` / `13px`, color `--text-muted` 或 `--text`
- 变量值: `16px semibold`, color `--text-h`, font `--mono`
- 控制台输出: `13px`, line-height `1.6`, font `--mono`
- 区域标签 (栈/堆): `12px semibold`, color `--text-muted`, **无 uppercase**

---

## Component Patterns

### 卡片 (`card`)
```css
background: var(--card-bg);
border-radius: 12px;
border: 1px solid var(--border);
box-shadow: var(--shadow);
```
所有面板必须包裹在 `.card` 中，不使用裸 `border-top` 分隔。

使用时搭配 Tailwind: `class="card p-3 mb-3"`

### 可折叠面板标题
统一模式：蓝色圆点 (7px) + 标题文字 + chevron SVG 图标。

```html
<div class="hs-header" @click="isOpen = !isOpen">
  <div class="flex items-center gap-2">
    <span class="hs-dot" />  <!-- 7x7px, rounded-full, bg: var(--primary), opacity: 0.8 -->
    <span class="text-sm font-semibold" style="color: var(--text-h)">标题</span>
  </div>
  <svg class="hs-chevron" :class="{ rotated: isOpen }" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
    <polyline points="6 9 12 15 18 9" />
  </svg>
</div>
```

Chevron 旋转过渡: `transform 0.25s ease`。展开时 `rotate(180deg)`。

### 按钮
Apple 风格圆角按钮。主按钮蓝渐变，次要按钮透明边框。

- 圆角: `12px`
- padding: `8px 14px`
- 按压: `translateY(1px) scale(0.997)`
- transition: `transform 160ms cubic-bezier(.22,.9,.27,1)`

### 变量卡片 (scalar-card)
- `min-width: 100px; max-width: 220px`
- `border-radius: 10px`
- Flex column, gap: 6px
- 值变化高亮: `.value-flash` → `background: var(--accent-bg); color: var(--primary); font-weight: 700`
- 卡片边框高亮: `.card.flash` / `.scalar-card.value-flash` → `border-color: var(--accent-border); box-shadow: 0 6px 14px rgba(37,99,235,0.10)`

### 代码内容区
所有展示代码/变量值的区域使用统一样式：
```css
background: var(--code-bg);
border: 1px solid var(--border);
border-radius: 8px;
```
用于：控制台输出 body、栈帧 frame、堆对象

---

## Motion

- **缓动曲线**: `cubic-bezier(.22,.9,.27,1)` — 温和的 ease-out，无弹跳
- **闪动时长**: `520ms`
- **展开/折叠**: `0.25s ease`
- **按钮按压**: `160ms`
- **卡片进出**: `320ms enter / 280ms leave`

所有动画必须支持 `@media (prefers-reduced-motion: reduce) { transition: none !important }`

---

## Spacing

- 卡片间距: `mb-3` (12px)
- 卡片内边距: `p-3` (12px)
- 元素间隙: `gap-3` (12px) / `gap-2` (8px)
- 不使用非标准间距

---

## Layout

- 全高三区: 顶部状态栏 → 左右分栏 (编辑器 | 变量+堆栈+控制台) → 底部控制栏
- 右侧面板: `flex flex-col`，内容区 `flex-1 overflow-auto`
- 控制台嵌入滚动流，无输出时自动隐藏 (`v-if`)
- 移动端 (<640px): 堆栈区纵向排列，分割线隐藏

---

## Anti-Patterns (禁止)

- 不使用绿色 `#34d399` 或琥珀色 — 统一蓝色 accent
- 不写 `text-transform: uppercase` + `letter-spacing` 的区域标签
- 不写 `border-top` 裸分割 — 用卡片包裹
- 不用文字 "▸ 展开/▾ 折叠" — 用 chevron SVG
- 不用 `glassmorphism` 做装饰性默认背景
