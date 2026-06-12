# 壁纸功能优化 — Train Girl 视频壁纸 + 响应式修复 + 设计审查

> 日期: 2026-06-12

## 背景

上一版壁纸功能（2026-06-11）已实现预设壁纸选择、自定义上传、透明度基础调节。本次在此基础上做四轮优化。

## 改动内容

### 1. Train Girl 视频壁纸

- 来源：Wallpaper Engine 视频壁纸 "[UHD] Train Girl"（workshop 2263466374），1920x1080 H.264 12.6s 循环
- 用 ffmpeg 压缩：CRF 26，去音轨，21.7MB → 973KB
- 新增 `VideoBackground.vue`：`<video>` 全屏背景组件，`object-fit: cover` 自适应，通过 `provide/inject('videoSrc')` 通信
- 视频文件及预览图存放在 `frontend/public/wallpapers/` 目录，非外部依赖
- `WallpaperSelector.vue` 新增 `type: 'video'` 预设类型，预览用静态帧图

### 2. CSS 100vw 滚动条 Bug 修复

- 根因：`100vw` 包含垂直滚动条宽度（Windows 约 17px），导致 `.app-shell` 永久比可视区域宽出滚动条宽度
- 修复：全局 `100vw` → `100%`（App.vue 三处 + VideoBackground.vue 一处）
- `100%` 正确排除滚动条宽度

### 3. CSS 层叠上下文修复

- 视频壁纸 `position: fixed; z-index: 0` 在 CSS stacking layer 5，非定位卡片在 layer 2 → 卡片"全透明"
- 修复：`.main-area` 添加 `position: relative; z-index: 1`

### 4. 透明度滑块交互优化

- 滑块支持 pointer capture 拖拽，范围 0.3-1.0 映射到 track 0-100%
- 默认网格壁纸锁定 100% 不透明度（防止卡片透明后点阵背景穿透），`savedOpacity` 恢复机制

### 5. 设计审查修复（2026-06-12）

- `.section-title` 移除 `text-transform: uppercase`（DESIGN.md 禁止）
- 移除重复的 `.pagination-controls` 定义
- 透明度滑块紫色 `#6366f1`/`#8b5cf6` → 蓝色 `var(--primary)`/`var(--primary-600)`/`var(--accent-bg)`

## 涉及文件

| 文件 | 改动类型 |
|------|----------|
| `frontend/src/components/VideoBackground.vue` | 新增 |
| `frontend/public/wallpapers/train-girl.mp4` | 新增 |
| `frontend/public/wallpapers/train-girl-preview.jpg` | 新增 |
| `frontend/src/components/WallpaperSelector.vue` | 修改 |
| `frontend/src/App.vue` | 修改 |
| `frontend/src/style.css` | 修改 |
