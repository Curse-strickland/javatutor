# 2026-08-15 决策痕迹面板 Review

> 审查对象：JavaTutor `feat/decision-trace-panel`（commit `d6749d9`）
> 对应计划：`docs/superpowers/plans/2026-08-15-decision-trace-panel.md`
> 状态：**已按 Findings 整改并复验**（整改 commit：`（待提交）`）

## 结论

实现与计划一致，功能可用：`splitDecisionTrace` / `sourceLabels` 有 vitest 覆盖，`DecisionTracePanel` 已接入 `AiTutorPanel`，流式期间不闪烁，后端透传未改。前端 121 个测试、`vite build`、后端 `mvnw test` 均通过。

审查发现 1 个 P2 安全风险（从旧代码原样迁入）、1 个 P2 可访问性问题、2 个 P3 改进项和 1 个测试缺口。P2-1、P2-2、P3-1 已修复并复验，P3-2 与测试缺口为记录的改进项，未阻塞合入。

## Findings

### P2-1：链接文本未转义，存在 XSS 注入点

**位置**：`frontend/src/utils/markdown.js:15-16`

`renderer.link` 对 `token.text` 直接拼进 HTML，未做转义。实测 `marked.parse('[<img src=x onerror=alert(1)>](javascript:alert(1))')` 输出包含未转义的 `<img onerror>`，配合 `v-html` 可执行脚本。非 http(s) 链接分支（第 15 行）与 http 链接分支（第 16 行）都存在该问题。

这是从 `AiTutorPanel.vue` 原样迁入的既有风险，但本改动把它收敛成了共享渲染模块，正是修复的最佳位置。

**修复**：`renderer.link` 新增 `escapeHtml()` 对 `token.text`（及 href 属性）做 HTML 转义；`javascript:`/`data:` 等非 http(s) 链接按纯文本输出（转义后无 `href`）。已用实测复现用例验证：`[<img src=x onerror=alert(1)>](https://…)` → `<a …>&lt;img src=x onerror=alert(1)&gt;</a>`，`[点击](javascript:alert(1))` → 纯文本 `点击`，无 `href=”javascript:”`。同步新增 `markdown.test.js` 6 个 XSS 用例。

### P2-2：决策痕迹折叠开关缺少键盘与 ARIA 支持

**位置**：`frontend/src/components/DecisionTracePanel.vue:13`

折叠开关是点击型 `div.trace-toggle`，无 `role=”button”`、`tabindex`、`aria-expanded` 和键盘事件，键盘用户无法展开/收起痕迹。设计系统不使用 `details/summary` 可以理解，但建议补上 ARIA 与 `@keydown.enter/space`。

**修复**：开关补 `role=”button”`、`tabindex=”0”`、`:aria-expanded`、`:aria-controls`，并新增 `@keydown.enter.prevent` / `@keydown.space.prevent` 切换。`aria-controls` 引用唯一 id（每实例 `Math.random` 生成，避免多条消息重复 id 破坏 HTML 规范）。

### P3-1：共享 markdown 渲染模块缺少单测

**位置**：`frontend/src/utils/markdown.js`

该模块现在被 `AiTutorPanel` 与 `DecisionTracePanel` 共用且承担 XSS 防护，但没有对应测试。建议新增 `markdown.test.js`，覆盖：原始 HTML 被丢弃、http 链接允许且转义、`javascript:` 链接按纯文本输出、链接文本中的 HTML 被转义。

**修复**：新增 `frontend/src/utils/markdown.test.js`，6 个用例覆盖上述场景 + 空文本 + 常规 markdown 回归，全部通过。

### P3-2：流式期间已完成的旧消息临时退回纯 markdown

**位置**：`frontend/src/components/AiTutorPanel.vue:51`

`store.isExplaining` 是全局忙碌标志；新请求流式期间，之前已完成的消息也会临时切回 `renderMarkdown`，痕迹面板短暂消失，请求结束后恢复。功能不受影响，属体验细节。

**决定**：暂不修改。改动需给消息增加”已完成”标记并调整 store 消息结构，收益低、改动面大，留作后续改进项。若要处理，方向是仅对最后一条流式消息做特殊渲染，其余已发消息始终走 `DecisionTracePanel`。

### 测试缺口：DecisionTracePanel 无组件级测试

当前依赖中没有 `@vue/test-utils`，组件仅靠手工验收覆盖。作为 UI 组件可接受，建议后续补充渲染断言（有 trace / 无 trace / 无效 JSON 兜底）。

**决定**：暂不修改（引入 `@vue/test-utils` 属新增依赖，超出计划 Global Constraints”不新增 npm 依赖”）。解析逻辑已由 `decisionTrace.test.js` 4 个用例覆盖，组件渲染保留手工验收，留作后续改进项。

## 验证记录

| 门槛 | 命令 | 结果 |
|---|---|---|
| 前端单测 | `npm test` | 13 个文件 / **121 个测试**通过（含新增 6 个 XSS 用例） |
| 前端构建 | `npm run build` | 通过（chunk 体积告警为既有项） |
| 后端测试 | `mvnw test` | 通过 |
| 验收记录 | 计划文件 | 已填写 2026-08-15，与实测一致 |

## 遗留

- P2-1、P2-2、P3-1 已修复并复验通过，可合入 `main`。
- P3-2（流式旧消息临时退回 markdown）与组件级测试缺口为记录的改进项，不阻塞合入；后续引入 `@vue/test-utils` 后补齐组件渲染断言。

## 复验记录（Codex）

- 2026-08-15 独立复验：`npm test` 13 文件 / 121 测试通过；`npm run build` 通过。
- `markdown.js`：`escapeHtml` 已转义链接文本；`javascript:` / `data:` 链接按纯文本输出；`markdown.test.js` 6 个 XSS 用例通过。
- `DecisionTracePanel.vue`：折叠开关已补 `role="button"`、`tabindex`、`aria-expanded`、`aria-controls` 与 Enter/Space 键盘切换。
- 结论：P2-1、P2-2、P3-1 整改成立，可合入；P3-2 与组件级测试缺口按记录保留。
