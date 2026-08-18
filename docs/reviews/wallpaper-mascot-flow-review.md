# 看板娘 / 壁纸 / 控制流图优化审查

> 审查日期: 2026-06-12

---

## 一、壁纸选择器 (WallpaperSelector.vue)

**功能**: 3 个预设壁纸（默认网格/深邃星空/Train Girl 视频）+ 自定义上传 + 卡片透明度滑块，localStorage 持久化。

| 项目 | 评估 |
|------|------|
| 预设壁纸 | 默认网格、深邃星空渐变、Train Girl 视频三点覆盖 ✓ |
| 自定义上传 | `FileReader.readAsDataURL` → 5MB 文件上限 + 类型校验 ✓ |
| 透明度滑块 | pointer capture 拖拽，0.3-1.0 映射到 track 0-100% ✓ |
| 默认网格锁定 100% | 防止卡片透明后点阵背景穿透，`savedOpacity` 恢复机制 ✓ |
| localStorage | `wallpaper-settings` JSON，含 current/opacity/customWallpapers ✓ |
| 分页 | 预设 2/页 + 自定义 4/页，翻页箭头 + 页码显示 ✓ |
| 视频壁纸 | `inject('videoSrc')` + `<video>` 背景，预览图为静态图 ✓ |
| 删除自定义 | `event.stopPropagation` 防止触发选择，索引自适应 ✓ |

### 问题

#### [中等] `.section-title` 使用 uppercase — DESIGN 反模式

**文件**: `WallpaperSelector.vue:630-632`

```css
.section-title {
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
```

DESIGN.md 明确禁止 `text-transform: uppercase` 标签。应改为普通大小写。

---

#### [低] `.pagination-controls` 重复定义

**文件**: `WallpaperSelector.vue:634-638` 和 `:641-645`

两条规则完全相同，删除一条。

---

#### [低] 自定义壁纸 data URL 可能超出 localStorage 配额

**文件**: `WallpaperSelector.vue:264-271, 378-413`

自定义壁纸上限 5MB/张，多张累积可超 localStorage 的 5MB 限额。当前无配额检查。

---

#### [低] 透明度滑块使用紫色 `#6366f1` / `#8b5cf6`

**文件**: `WallpaperSelector.vue:870, 882`

与进度条的紫色渐变一致（之前已标记过）。建议迁移为蓝色 accent。

---

## 二、Live2D 看板娘

**来源**: stevenjoezhang/live2d-widget，school summer-2023 模型（038-040 三个变体）。

| 项目 | 评估 |
|------|------|
| 加载方式 | `index.html` 中 `<script src="/live2d/autoload.js">` ✓ |
| 模型 | 038/039/040 三个 school_summer 变体 + 完整 motion/expression 资源 ✓ |
| 折叠切换 | 自定义 `waifu-badge` 注入：hover 显示 chevron，click 折叠/展开 ✓ |
| 折叠持久 | `waifu-folded` class toggle，badge 状态跟随 ✓ |
| 工具栏 | `tools: []` 禁用干净 ✓ |
| 拖拽 | `drag: false` 禁止 ✓ |

### 问题

#### [中等] 模型文件体积巨大

**文件**: `public/live2d/models/040_school_summer-2023/`

单个模型含 46 个 `.mtn` 动作文件 + 37 个 `.exp.json` 表情文件 + textures。估算全部 3 个模型 ≥ 15MB。增加仓库和构建体积。

**建议**: 仅保留一个模型变体（如 `040`），或使用 CDN 加载。

---

## 三、控制流图优化 (ControlFlowPanel.vue)

**新增**: 全屏 Modal(Teleport) + 缩放 + SVG 下载 + 执行跟随高亮。

| 项目 | 评估 |
|------|------|
| 全屏入口 | toolbar 中 `openFullscreen` 按钮 + `<Teleport to="body">` ✓ |
| 缩放 | Zoom ± 按钮 + Ctrl+Wheel，0.25-3.0 范围 ✓ |
| 重置 | `resetZoom` → zoomLevel=1 ✓ |
| Escape 关闭 | `onKeydown` → `closeFullscreen` ✓ |
| SVG 下载 | `XMLSerializer` 序列化，移除 highlight class 后导出 ✓ |
| 执行跟随 | `watch currentStep` → 更新 `currentLine` → `applyHighlight` ✓ |
| 呼吸动画 | `cfBreathe` keyframe，drop-shadow + brightness 脉冲 ✓ |

### 问题

#### [中等] 边高亮逻辑错误 — 高亮所有有 marker 的边，而非目标边

**文件**: `ControlFlowPanel.vue:163-173`

```js
container.querySelectorAll('.edge').forEach(edgeEl => {
    const marker = edgeEl.querySelector('marker')
    if (marker) {
        edgeEl.classList.add('cf-edge-active')
    }
})
```

这段代码检查 edge 元素是否包含 `<marker>` 子节点（所有带箭头的边都有），然后将 **所有带箭头的边** 全高亮，而不是只高亮指向当前执行节点的边。实际的 matched node 信息（`matchedIds`）已计算但未使用。

**修复**: 应遍历 `method.edges` 找到 `to` 属于 `matchedIds` 的边，然后在 SVG 中定位对应 edge 元素。

---

#### [低] 高亮色使用琥珀 `#fbbf24`

**文件**: `ControlFlowPanel.vue` — `cfBreathe` keyframe + `.cf-edge-active path`

执行节点和边的呼吸高亮使用 `rgba(251,191,36,...)` 琥珀色。控件流图内语义高亮可接受（区分于常规 UI 颜色），但需注意与蓝色设计系统的一致性。

---

## 四、汇总

| 级别 | 问题 | 位置 |
|------|------|------|
| **中等** | `.section-title` uppercase 违规 | `WallpaperSelector.vue:630` |
| **中等** | 边高亮逻辑全量应用而非按目标过滤 | `ControlFlowPanel.vue:163-173` |
| **中等** | Live2D 模型文件过大（~15MB+） | `public/live2d/models/` |
| **低** | `.pagination-controls` 重复 | `WallpaperSelector.vue:634,641` |
| **低** | 自定义壁纸可超 localStorage 5MB | `WallpaperSelector.vue:378` |
| **低** | 透明度滑块紫色渐变 | `WallpaperSelector.vue:870,882` |
| **低** | 执行高亮琥珀色 | `ControlFlowPanel.vue` |

壁纸功能完整度高，透明度锁 + 视频壁纸 + 分页均为周全设计。看板娘集成干净但模型体积偏大。控制流图执行跟随思路正确，边高亮逻辑需修正。
