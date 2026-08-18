# 文件上传 & 右侧标签页模式审查

> 审查日期: 2026-06-09 | 基准提交: `05ec4b4` + 本地未提交

---

## 一、架构评估

**数据流**: FileUploadPanel 拖拽/选择 → FileReader 批量读取 → emit(`loadCode`, {name, code}) → App.vue `onFileLoad` → `editorRef.setCode(code)` + `store.addUploadRecord(name, code)` → localStorage 持久化。

**右侧面板**: `right-card-header` 从固定标题改为「变量」/「文件」两 Tab，`store.rightTab` 切换内容区。

| 层 | 关键逻辑 | 状态 |
|----|----------|------|
| Editor | `setCode()` 暴露、`triggerImport()` 隐藏 input、`onDidChangeModelContent` 自动清高亮 | ✓ |
| Editor | Maple Mono 字体 + `glyphMargin:true` + exec-arrow | ✓ |
| FileUploadPanel | 拖拽 + 单文件 + 文件夹三种入口，`webkitGetAsEntry` 遍历 | ✓ |
| FileUploadPanel | 批量读取：首文件自动加载，其余进入 `pendingFiles` 待点击 | ✓ |
| FileUploadPanel | 上传历史 `localStorage` 去重持久化（按名覆盖、最大 20 条） | ✓ |
| Store | `rightTab` 默认 `'variables'`、`switchRightTab`/`addUploadRecord`/`removeUploadRecord` | ✓ |
| App.vue | `onFileLoad` 钩子串联 Editor + Store、Tab 切换 UI 与 AiTutorPanel 风格统一 | ✓ |

---

## 二、需修复

### [中等] FileUploadPanel 使用非设计系统颜色

| 位置 | 当前色 | 问题 |
|------|--------|------|
| `.pending-item` L303-310 | `rgba(45,212,191,0.25)` 边框 + `#5eead4` 徽章 + teal 背景 | teal 不在 DESIGN 调色板 |
| `.history-delete:hover` L384 | `color: #e57373` (红色) | 删除按钮用红色可接受（破坏性操作） |

teal pending 样式应统一为蓝色 accent：
```css
.pending-item {
  border: 1px solid var(--accent-border);
  background: var(--accent-bg);
}
.pending-badge {
  color: var(--primary);
  background: var(--accent-bg);
}
```

---

### [低] `localStorage.getItem` 未 try-catch

**文件**: `player.js:26`

```js
uploadHistory: JSON.parse(localStorage.getItem('javatutor-uploads') || '[]'),
```

若 localStorage 被禁用或数据损坏，`JSON.parse` 会抛异常，导致 Pinia store 初始化失败（页面白屏）。建议包裹：
```js
uploadHistory: (() => {
  try { return JSON.parse(localStorage.getItem('javatutor-uploads')) || [] }
  catch { return [] }
})(),
```

---

### [低] `traverseDir` 不递归子目录

**文件**: `FileUploadPanel.vue:151-159`

只遍历入口目录的一级子文件，子目录内的 `.java` 文件被静默忽略。对拖入多层级 Java 项目的场景，只会读取最外层文件。可显式标注限制或增加递归。

---

### [低] `triggerImport` 暴露但未被外部调用

**文件**: `Editor.vue:29-31, 186`

Editor 内置了独立的隐藏 file input + `triggerImport()` 入口，但 App.vue 不触发它 —— 文件导入完全由 FileUploadPanel 托盘。两个入口可以共存但需明确各自的触发方式（比如未来加 Ctrl+O 快捷键）。

---

## 三、已验证合理

| 设计决策 | 说明 |
|----------|------|
| Tab 复用 AiTutorPanel `.ai-tab` 样式 | `.right-tab` 与 `.ai-tab` 完全一致的尺寸/padding/圆角/active 态 ✓ |
| `addUploadRecord` 同名覆盖 | `filter(r => r.name !== name)` 去重后再 `unshift` ✓ |
| `readBatch` 首文件自动加载 | `autoLoadFirst=true` 时 emit 首个结果，其余 pending ✓ |
| `onDrop` 兼容 items + files 双 API | 优先 `webkitGetAsEntry` 文件夹遍历，回退 `dataTransfer.files` ✓ |
| `editor.onDidChangeModelContent` → `clearHighlights` | 用户编辑代码后旧步骤高亮自动清除 ✓ |
| `event.target.value = ''` | 重置 input 后相同文件可再次触发 change ✓ |
| `.history-delete` hover 才显示 | `opacity: 0 → 1` transition ✓ |

---

## 四、汇总

| 级别 | 问题 | 位置 |
|------|------|------|
| **中等** | pending 项 teal 色不合设计系统 | `FileUploadPanel.vue:303-310` |
| **低** | localStorage 未 try-catch | `player.js:26` |
| **低** | `traverseDir` 不递归子目录 | `FileUploadPanel.vue:151-159` |
| **低** | Editor `triggerImport` 无调用者 | `Editor.vue:29` |

功能完整度高，三种导入入口（拖拽/文件/文件夹）覆盖到位。Tab 切换与 AiTutorPanel 风格统一。修复优先级：teal → localStorage → 其他。
