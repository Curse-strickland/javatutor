# 决策痕迹未利用字段接入 开发日志

## 背景

coze 侧 `build_final`（`javatutor-coze/src/graphs/javatutor/nodes.py:421-442`）在 `【决策痕迹】` JSON 里已输出十几个字段，但前端 `decisionTrace.js` 的用户侧摘要只消费了 `intent`/`sources`/`tool_calls`/`latency_ms`/`token_usage`/单一 `critic_passed+revised` 组合，其余字段（知识库降级、评审/修订跳过、降级原因、上下文压缩、token 估算标记、run_id、上下文拉取观测）未接上。

## 改动内容

### `frontend/src/utils/decisionTrace.js`

- `traceSummary(trace)` 返回值新增 `qualityWarnings: string[]`，收集：
  - `rag_degraded` → 「知识库检索不可用，已用通用知识回答」
  - `critic_skipped` → 「评审已跳过」
  - `revise_skipped` → 「修订已跳过」
  - `fallback_reason` → 「降级：<reason>」
  - `compaction_mode`（windowed/truncated）→ 上下文压缩提示
- `reviseText` 补全「评审未通过（未修订）」分支（原仅覆盖 `critic_passed===false && revised===true`）。
- `formatTokens` 在 `token_usage.estimated===true` 时追加「（估）」。
- 新增 `traceDebugLines(trace)`，返回开发者模式结构化观测行（`run_id`、上下文拉取成功/失败）。

### `frontend/src/components/DecisionTracePanel.vue`

- 用户侧「执行过程」折叠摘要新增质量提示列表（`.trace-warnings`，`--text-muted` mono，遵守 DESIGN.md 不上琥珀/绿）。
- devMode 原始 JSON 上方新增结构化观测行（`.trace-debug`）。
- `hasSummary` 扩展纳入 `qualityWarnings.length`。

## 验证结果

- `npm test`：22 files / **215 tests 全绿**（`decisionTrace.test.js` 由 11 条增至 17 条，新增 `traceSummary` 质量提示 6 条断言）。
- `npm run build`：构建成功（Vite 4.50s）。
- 未改动 coze 侧与后端；纯前端。

## 遗留项

- `confidence` 字段当前恒为 `0.0`：coze 侧 `intent_confidence`（`javatutor-coze/src/graphs/javatutor/state.py:67`）全项目无写入，`build_final` 里 `confidence` 永远 `round(0.0, 2)`。本改动**未展示**该字段；若需真正置信度，需在 coze 侧引入 LLM 分类或给 `conservative_intent` 关键词规则加权输出，属独立 coze 计划。
- `run_id` / `fetch_context_*` 已存在于 devMode 原始 JSON 中，本改动仅追加结构化可读行，未新增复制等交互。
