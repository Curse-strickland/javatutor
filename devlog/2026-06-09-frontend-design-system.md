# 2026-06-09 前端设计系统统一

## 背景

此前各组件视觉风格不一致：HeapStackPanel 使用裸 border-top + uppercase 标签 + 绿色变量值；VariablePanel 折叠按钮用文字、琥珀色高亮；ConsoleOutput 最初是绿色 retro 终端。整体布局为硬白线分割的僵硬矩形。

依据 `/impeccable critique` 的 Design Health Score (25/40) 和 PRODUCT.md 的"排版精良的教材"定位，系统性地统一了设计语言。

## 一、DESIGN.md 设计系统文档

**新建**: `DESIGN.md`

提取现有 CSS tokens + 组件模式，制定规范：
- 色板 11 个 token（蓝色单一 accent，禁用绿/琥珀色）
- 字体：系统 sans + monospace
- 组件模式：卡片 `.card p-3 mb-3`、可折叠面板标题（蓝色圆点+chevron SVG）、代码内容区（code-bg + border）
- 动效：cubic-bezier(.22,.9,.27,1)，520ms flash，prefers-reduced-motion
- 禁止项：uppercase 标签、裸 border-top 分割、文字折叠按钮、非蓝色 accent

## 二、HeapStackPanel 视觉统一

**修改**: `HeapStackPanel.vue`

| 之前 | 之后 |
|------|------|
| `border-top` 裸分隔 | 包入 `.card p-3 mb-3` |
| 文字 `▾/▸` 折叠开关 | chevron SVG + `rotate(180deg)` |
| `text-transform: uppercase` 区域标签 | 普通 12px semibold |
| 绿色 `#34d399` 变量值 | `var(--text)` |
| 独立 SVG 箭头连线 | 虚线竖分割线 |
| 栈帧/堆透明底 | `var(--code-bg)` + `var(--border)` |

## 三、VariablePanel 闪动与折叠优化

**修改**: `VariablePanel.vue`

- 折叠按钮：文字 `▸ 展开/▾ 折叠` → chevron SVG 图标
- `.card.flash`：琥珀色 `rgba(255,199,44,0.16)` → 蓝色 `var(--accent-border)` + `box-shadow: 0 6px 14px`
- `.value-flash`：`rgba(99,102,241,0.12)` → `var(--accent-bg)` + `color: var(--primary)`
- `.scalar-card.value-flash`：对齐数组 `cell.changed` 样式（可见度大幅提升）

## 四、ConsoleOutput 视觉打磨

**修改**: `ConsoleOutput.vue`

- 绿色 retro 终端 `#a8d8a8` → 项目主色 `var(--text)` + `var(--mono)`
- 纯黑底 `#1a1a20` → 毛玻璃卡片 `var(--card-bg)`
- 文字 `展开/收起` → chevron SVG
- 进/出 transition: `translateY` + `opacity`

## 五、App.vue 主布局柔化

**修改**: `App.vue`

- 移除所有硬分割线 (`border-r`、`border-b`、`border-t`)
- 编辑器区 + 变量区各包入圆角大卡片 (`.card`) 
- 控制栏改为浮动圆角条 (`rounded-2xl` + `backdrop-blur` + `box-shadow`)
- 背景增加 `radial-gradient` 微点阵纹理 (3% 透明度, 24px 间距)
- 右侧标题栏加蓝色圆点
- 删除 `style.css` 全局 `.control-bar` 死代码
- 响应式断点 640px 补充适配

## 六、审查反馈修复

依据 `reviews/frontend-review.md`：
- style.css 全局 `.control-bar` 死代码 → 已删除
- HeapStackPanel 堆地址加 `(示意图)` 标注 → 已添加
- ConsoleOutput 后端阻塞 → 已在之前迭代完成，非阻塞问题

## 验证

- 全部 6 条 DESIGN.md 反模式已清除
- 可折叠面板 chevron SVG 三处统一（ConsoleOutput / HeapStackPanel / VariablePanel）
- 蓝色 accent 全站统一（无绿/琥珀色残留）
- Vite HMR 即时生效，无需重启
