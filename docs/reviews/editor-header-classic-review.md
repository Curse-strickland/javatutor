# 编辑区顶栏 + 经典代码页审查

> 审查日期: 2026-06-10 | 覆盖: `bde8606` 提交 + 本地未提交

---

## 一、变更概览

| 变更 | 位置 | 类型 |
|------|------|------|
| 编辑区顶栏：蓝色圆点 + "你的代码" + «导入»按钮 | `App.vue:6-23` | 新功能 |
| 导入面板：点击按钮向下滑出 FileUploadPanel | `App.vue:25-28` | 新功能 |
| pendingFiles 移至 Pinia store | `player.js:27` | 重构 |
| 右侧标签改为「变量」「经典」 | `App.vue:44-53` | UI 改动 |
| ClassicCodePanel：14 个经典算法 × 5 分类 | `ClassicCodePanel.vue` | 新组件 |
| AI 按钮图标刷新 + 边框样式 | `App.vue:178-186` | UI 改动 |
| VariablePanel 滚动策略 `center` → `nearest` | `VariablePanel.vue:140` | 优化 |

---

## 二、编辑区顶栏

编辑器卡片从纯 Monaco 容器改为有 header 的结构：

```
┌─────────────────────────────┐
│ ● 你的代码          [⬆ 导入]│ ← header
│ ┌─────────────────────────┐ │
│ │ 拖拽区域 / 历史记录 ...   │ │ ← 导入面板 (向下滑出)
│ └─────────────────────────┘ │
│ ┌─────────────────────────┐ │
│ │ Monaco Editor            │ │
│ └─────────────────────────┘ │
└─────────────────────────────┘
```

| 项目 | 评估 |
|------|------|
| header 风格 | 蓝色圆点 + 标题 + 右边按钮，与 `.right-card-header` 一致 ✓ |
| «导入»按钮 | `margin-left: auto` 右对齐，hover/active 变蓝 accent ✓ |
| 面板滑出 | `<transition name="upload-slide">` + `max-height` transition ✓ |
| hover 样式 | `.upload-toggle-btn:hover` → `accent-bg` + `accent-border` ✓ |
| pendingFiles 持久化 | 从 FileUploadPanel 本地 ref 移入 Pinia store，关闭面板不丢失 ✓ |

---

## 三、ClassicCodePanel — 经典代码

**结构**: 5 个可折叠分组（排序/查找/递归与数学/数据结构/动态规划），每组含 2-4 个算法项。

| 项目 | 评估 |
|------|------|
| 分组折叠 | 蓝色圆点 + chevron SVG，统一设计模式 ✓ |
| 算法项 | 名称 + 复杂度标注（如 `O(n²)`），点击加载到编辑器 ✓ |
| 代码模板 | 全部使用正确的 `public class Name` 格式 ✓ |
| 覆盖度 | 14 个经典算法，5 个分类，典型教案全覆盖 ✓ |
| 加载行为 | `onClassicLoad({code})` → `editorRef.setCode(code)` ✓ |

**建议**: 经典代码加载后不记录到 `uploadHistory`（不同于拖拽上传）。可考虑也记录以方便回看。

---

## 四、AI 按钮视觉

图标从双星 SVG 改为聊天气泡 + 眼睛（`fill="var(--bg)"` 做镂空效果），增加了 `border` 和 `padding`。

| 项目 | 评估 |
|------|------|
| 图标语义 | 气泡更明确表达"AI 对话"含义 ✓ |
| 边框样式 | `.ai-toggle-btn` 新增 `border: 1px solid var(--border)`，hover → `accent-border` ✓ |
| 眼睛颜色 | `fill="var(--bg)"` 硬编码页面背景色 — hover 时按钮变 `accent-bg` 背景，眼睛不变 → 微不协调 |

**建议**: 眼睛颜色改为 `fill="transparent"` 或通过 CSS variable 动态匹配。

---

## 五、VariablePanel 滚动优化

`scrollIntoView({ block: 'nearest' })` — 变量卡变化时仅滚动最小距离，不强制居中。当变量卡在可视范围内时不触发滚动。比 `center` 少跳变感。

---

## 六、汇总

| 级别 | 问题 | 位置 |
|------|------|------|
| **低** | AI 按钮 hover 时眼睛颜色不变 | `App.vue` SVG circle |
| **建议** | 经典代码加载后考虑入 uploadHistory | `App.vue:328-330` |

整体实现干净。编辑区顶栏解决了导入入口隐蔽的问题，ClassicCodePanel 内容精选且分组清晰，pendingFiles 入 Store 避免了面板关闭丢状态。
