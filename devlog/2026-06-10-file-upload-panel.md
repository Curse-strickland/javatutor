# 文件上传面板 — 开发日志

日期：2026-06-10

## 概述

将右侧卡片改为双标签页（变量 / 文件），新增文件上传面板：支持拖拽 / 点击上传单文件或文件夹，批量读取后待选加载，上传历史 localStorage 持久化。

## 改动清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `stores/player.js` | 修改 | 新增 `rightTab`、`uploadHistory`（localStorage 持久化）、`addUploadRecord`（同名去重、上限 20 条）、`removeUploadRecord`、`switchRightTab` |
| `components/Editor.vue` | 修改 | 新增 `setCode(code)` 暴露方法，供面板注入代码 |
| `components/FileUploadPanel.vue` | 新建 | 拖拽上传区 + 文件夹处理 + 待加载列表 + 历史记录 |
| `App.vue` | 修改 | 右侧卡片头栏改为双标签 `[变量] [文件]`，`v-if` 互斥渲染，移除旧导入按钮 |

## 交互设计

```
标签"变量"(默认):             标签"文件":
┌──────────────────┐         ┌──────────────────┐
│ ● [变量] [文件]  │         │ ● [变量] [文件]  │
├──────────────────┤         ├──────────────────┤
│ VariablePanel    │         │  ┌ 拖拽区 ────┐  │
│ HeapStackPanel   │         │  │ ☁ .java    │  │
│ ConsoleOutput    │         │  │ [选择文件]  │  │
│                  │         │  │ [选择文件夹]│  │
│                  │         │  └────────────┘  │
│                  │         │  本次导入 (待加载) │
│                  │         │  上传记录         │
└──────────────────┘         └──────────────────┘
```

## 上传行为

| 操作 | 行为 |
|------|------|
| 点击「选择文件」| 弹出文件选择器 → 读取 → 立即加载到编辑器 + 记录历史 |
| 点击「选择文件夹」| `webkitdirectory` 选择目录 → 校验仅 .java → 全部进入待加载 |
| 拖拽单文件 | 读取 → 立即加载 |
| 拖拽文件夹 | `webkitGetAsEntry` 检测目录 → 递归读取 → 全部进入待加载 |
| 拖拽多文件 | 逐个过滤 .java → 立即加载第一个，其余待选 |
| 点击待加载条目 | 加载到编辑器 + 记录历史，从待选列表移除 |
| 点击历史条目 | 加载到编辑器 |
| X 删除历史 | 从 localStorage 移除 |

## 文件夹校验

- 仅允许 `.java` 文件，无子文件夹限制
- 包含非 `.java` 文件时弹出 alert 提示具体文件名
- 拖拽时自动过滤非 `.java` 文件

## 批量处理逻辑

```
readBatch(files, autoLoadFirst):
  ├─ autoLoadFirst=true  → 第一个 emit('loadCode') + 记历史，其余进 pendingFiles
  └─ autoLoadFirst=false → 全部进 pendingFiles，用户自行选择
```

## 待加载条目视觉效果

- `1px solid rgba(45,212,191,0.25)` 青色边框
- `background: rgba(45,212,191,0.04)` 微青底色
- `待加载` badge：10px 青字 + 青色半透明背景
- 悬停边框不变，背景加深至 `0.08`

## 历史记录

- `localStorage` 键名：`javatutor-uploads`
- 数据结构：`[{ name, code, time }]`
- 同名文件覆盖旧记录（去重），移至列表顶部
- 上限 20 条
- 显示相对时间（刚刚 / N 分钟前 / N 小时前 / N 天前 / 日期）

## 审查修复 (2026-06-10)

| 问题 | 级别 | 修复 |
|------|------|------|
| pending 项 teal 色不合 DESIGN.md | 中等 | 改为蓝色 accent → 用户要求保留 teal，已还原 |
| `localStorage.getItem` 未 try-catch | 低 | IIFE 包裹 `JSON.parse`，异常返回 `[]` |
| `traverseDir` 不递归子目录 | 低 | 添加注释说明设计要求（文件夹内不含子文件夹） |
| Editor `triggerImport` 无调用者 | 低 | 保留，预留给后续快捷键（Ctrl+O）入口 |

## Bug 修复记录

### B1 — 文件夹上传应全部待选
- **现象**: 选择文件夹后第一个文件自动加载到编辑器
- **修复**: `onFolderPicked` 调用 `readBatch(files, false)`，全部进入 `pendingFiles`

### B2 — 文件选择器不支持多选
- **现象**: 点击「选择文件」只能单选
- **修复**: 文件 input 加 `multiple` 属性；`onFilePicked` 按 `files.length === 1` 判断是否自动加载

### B3 — 拖拽多文件时仍加载第一个
- **现象**: 拖拽 3 个 .java 文件，第一个被加载而非全部待选
- **根因**: `items` 循环中无目录时文件收集数组被丢弃，回退到 `dataTransfer.files` 重新获取但逻辑分支混乱
- **修复**: 重构 `onDrop`——先 `hasDir` 检测，有目录走递归分支，纯文件拖拽直接走 `dataTransfer.files`

### B4 — 控制台输出提示文本
- **现象**: 无输出时显示 "(暂无输出)"
- **修复**: 去除括号 → 后续完全移除该提示文本

### B5 — 倍速按钮宽度跳动
- **现象**: 切换 2x/1x/0.5x 时按钮宽度变化，"▾" 箭头溢出
- **修复**: `min-width: 62px` + `padding: 6px 10px` + `gap: 4px`

### B6 — 编辑器长行被右侧面板遮挡
- **现象**: 右侧标签页横向扩展时遮住代码
- **修复**: Monaco Editor 开启 `wordWrap: 'on'`

### B7 — 编辑器第一行太贴顶
- **现象**: 第一行代码紧贴编辑器上边缘
- **修复**: 编辑区卡片加顶栏 `● 你的代码`（与右侧变量展示区头栏风格一致）+ Monaco `padding: { top: 8 }`

### B8 — 用户交互面板整体偏右
- **现象**: `#app` 使用 `margin: 0 auto` 居中，左右等距，编辑区不够靠左
- **修复**: `#app` 改为 `margin: 0 0 0 12px`，左边界仅留 12px 空隙，右侧自然留白

### B9 — 上传面板底部矩形不协调
- **修复**: `.upload-panel-wrapper` 加 `border-radius: 0 0 12px 12px`

### B10 — 关闭上传面板后待加载文件丢失
- **根因**: `pendingFiles` 是 FileUploadPanel 本地 ref，`v-if` 销毁组件时被重置
- **修复**: `pendingFiles` 移至 Pinia store；`finishBatch` 中已有待加载文件自动移入历史记录；新增删除按钮

## 功能迁移 — 上传入口移至编辑区顶栏

- 编辑区顶栏新增 `[☁ 导入]` 按钮，点击向下滑出 FileUploadPanel
- 右侧标签页保留 `[变量] [文件]` 结构，文件页改为占位"更多功能即将上线"
- 上传面板在两个入口均可使用，功能一致
