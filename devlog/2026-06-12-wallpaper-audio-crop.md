# 2026-06-12 背景导入 — 视频/图片/音频 + 裁剪 + 音频库

## 目标

在壁纸选择器的基础上，支持视频和音频导入作为背景，支持图片裁剪，音频像壁纸一样可选切换。

## 前端改动

### 1. WallpaperSelector.vue — 三路导入 + 音频库 + 裁剪

**背景壁纸（图片/视频）：**

- 三路上传按钮：`+ 上传图片`、`+ 上传视频`、`+ 上传音频`
- 统一 50MB 大小限制（`maxSize = 50 * 1024 * 1024`）
- 图片导入 → 弹出裁剪对话框
- 视频导入 → 自动提取第1秒帧作为封面缩略图 (`generateVideoThumb`)
- 裁剪对话框 (`crop-overlay` + `crop-dialog`)：
  - Canvas 渲染图片，四角白色手柄（等比缩放）、四边中点蓝色手柄（单向缩放）
  - `detectAction(mx, my)` 根据鼠标位置判断是移动/缩放/无效
  - 四角缩放保持宽高比：`nw = r.w + nd; nh = nw / ratio`（用带符号的 dx/dy，向内=缩小，向外=放大）
  - 限制在画布内，最小 20×20
  - 确认后 `canvas.toDataURL('image/jpeg', 0.9)` 输出裁剪结果

**背景音乐（音频）：**

- 音频不再直接覆盖，而是存入 `customAudios[]` 列表
- 顶部 `🔇 无音乐` 选项 → `selectNoAudio()` 清空 `audioSrc`
- 音频列表项可点击切换 (`selectAudio(index)`)，当前播放项蓝色高亮
- 独立的音量滑块（0%~100%），手指拖拽 + 点击跳转
- 音频设置持久化到 `localStorage('audio-settings')`，包含 `audios` 数组 + `activeIndex`

**数据持久化：**

- `saveAudioSettings()` 存储 `{ src, volume, audios: [{name, src}], activeIndex }`
- `onMounted` 恢复音频列表和当前选中项
- 壁纸保存时携带 `type` 字段（`image`/`video`/`gradient`）

### 2. AudioBackground.vue — 新增背景音乐组件

```vue
<audio ref="audioRef" :src="src" autoplay loop :volume="volume" />
```

- 通过 `inject('audioSrc')` 和 `inject('audioVolume')` 接收信号
- `watch(src)` → `load()` + `play()`
- `watch(volume)` → 实时更新 `audio.volume`

### 3. App.vue — 集成 AudioBackground

- 模板中 `<AudioBackground />` 紧随 `<VideoBackground />`
- `provide('audioSrc', audioSrc)` + `provide('audioVolume', audioVolume)`

### 4. 视频封面缩略图

`generateVideoThumb(file, dataUrl, name, timestamp)`:
1. 创建临时 `<video>` 元素
2. `onloadeddata` → `video.currentTime = 1`
3. `onseeked` → `canvas.drawImage(video, 0, 0, 320, 180)` → `toDataURL('image/jpeg')`
4. 封面存入 `wp.thumb`，壁纸预览时优先显示封面
5. `onerror` 降级：无封面也添加壁纸

## 修复的 Bug

| Bug | 修复 |
|-----|------|
| 播放速度标签 0.5x 实际是 2x | `speedOptions` 标签交换：500ms→2x, 2000ms→0.5x |
| 裁剪框只能缩小不能放大 | 四角缩放改用带符号的 dx/dy 计算方向，`nw = r.w + nd`（可正可负） |
| 音频不能切换为无 | 添加 `🔇 无音乐` 选项 + `selectNoAudio()` |
| 视频封面显示不正确 | 视频导入时自动提取第1秒帧作为 jpeg 缩略图 |
| 裁剪框最大大小限制 | 默认裁剪区改为全图（`cropW = canvas.width, cropH = canvas.height`） |
| 壁纸面板底部被截断 | `.wallpaper-panel` 加 `max-height: 70vh; overflow-y: auto` |
| 音乐删除按钮位置 | 覆盖 `position: static`，放在音频名称右侧而非右上角 |

## 文件改动清单

| 文件 | 状态 | 说明 |
|------|------|------|
| `frontend/src/components/WallpaperSelector.vue` | 修改 | 三路上传, 音频库列表, 裁剪对话框, 视频缩略图, 面板滚动, 删除按钮定位 |
| `frontend/src/components/AudioBackground.vue` | **新增** | 背景音乐播放组件 |
| `frontend/src/App.vue` | 修改 | +AudioBackground, +provide(audioSrc/audioVolume) |
| `devlog/2026-06-12-wallpaper-audio-crop.md` | **新增** | 本次开发日志 |
