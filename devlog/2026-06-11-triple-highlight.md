# Devlog: 2026-06-11 — 三色高亮 + 灰色/蓝色箭头 + 图例提示

## 背景

之前只有单色黄色高亮（当前执行行）。用户需要更完整的"过去→现在→未来"时间线：灰色标记上一步、黄色标记当前步、蓝色标记下一步，并配有对应颜色的箭头和图例说明。

## 改动清单

### 前端

| 文件 | 改动 |
|------|------|
| `Editor.vue` | `highlightLine(lineNumber, prevLineNumber, nextLineNumber)` 三参数；新增 `highlight-next-line`（蓝色底色）、`exec-prev-arrow`（灰色箭头）、`exec-next-arrow`（蓝色箭头）CSS 类 |
| `App.vue` | `watch(store.currentStep)` 替代 `watch(store.currentLine)` 避免同值不触发；`prevLine`/`nextLine` 始终取 `step-1`/`step+1` 行号；`runCode()` 显式调 `highlightLine` 刷新第一步；新增高亮图例栏（`▶ 上一步 / ▶ 当前 / ▶ 下一步`）位于编辑器标题右侧，使用 Maple Mono 字体 11px |
| `VariablePanel.vue` | 数组折叠按钮样式 `.collapse-btn`（蓝色 hover 效果） |

## 验证

- 点击运行 → 黄色高亮 step0 + 蓝色高亮 step1
- 点击下一步 → 灰色高亮 step0 + 黄色高亮 step1 + 蓝色高亮 step2
- 拖进度条 → 三条高亮始终指向正确位置
- 最后一步 → 无蓝色高亮
- 重新运行 → 高亮正确刷新
