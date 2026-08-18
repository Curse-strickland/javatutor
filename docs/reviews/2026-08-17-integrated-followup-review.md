# 2026-08-17 综合接力计划执行 Review

> 审查对象：JavaTutor `feat/decision-trace-panel`（含未提交工作区）+ javatutor-coze `feat/agent-architecture-improve`
> 对应计划：`docs/superpowers/plans/2026-08-15-integrated-followup-plan.md`

## 结论

计划主体已执行：`a` 残留已消失（前端已验证）、阶段流式代码已提交、光标修复与耗时日志已落地（JavaTutor 侧未提交）、耗时指标已进入决策痕迹。

复验结果：javatutor-coze `uv run pytest -q` 107 passed；JavaTutor 后端 `mvnw.cmd -q -DskipTests compile` 通过；前端 `npm test` 121 passed。

发现 1 个 P1（`latency_ms` 恒为 0）、1 个 P2（用户侧仍展示原始 JSON）、2 个 P3。

## Findings

### P1：`latency_ms` 恒为 0

**位置**：`javatutor-coze/src/graphs/javatutor/nodes.py:147,414`

`_parse_json_dict` 写入 `request_started_at`，但 `JavaTutorState` schema 未声明该字段。LangGraph 使用 TypedDict schema 时未声明键不会持久化，`build_final` 的 `state.get("request_started_at", time.time())` 回退到当前时间，差值恒为 0。

修复：在 `state.py` 增加 `request_started_at: float`，并新增测试断言 `latency_ms > 0`；重新部署 Coze 后生效。

### P2：用户侧仍展示原始决策痕迹 JSON

**位置**：`JavaTutor/frontend/src/components/DecisionTracePanel.vue:25,44`

折叠区直接渲染 `JSON.stringify(trace, null, 2)`，对用户没有意义。按产品要求，原始 JSON 应留给开发者；用户侧只展示可读的执行过程摘要（意图、工具调用、评审/修订状态、耗时/Token 统计等）。

建议：`decisionTrace.js` 增加 `traceSummary(trace)` 纯函数并补测试；面板默认展示摘要，原始 JSON 放到“开发者数据”折叠区，默认隐藏或仅 `?dev=1` / localStorage 标记时可见。

### P3-1：CozeService 读取 `token_cost` 路径错误

**位置**：`JavaTutor/backend/src/main/java/com/javatutor/service/CozeService.java:146-150`

平台 `message_end` 里 `token_cost` 位于 `content.message_end.token_cost` 对象内，当前读的是 `/content/token_cost`，恒为 `-1`。应读取 `messageEnd.get("token_cost")` 的 `total_tokens`。

### P3-2：JavaTutor 侧改动尚未提交

`Editor.vue` 光标修复、`CozeService` 耗时日志、`AGENTS.md` 登记、devlog 均在工作区未提交。按用户约定，JavaTutor 侧本地验证通过后再提交，不视为缺陷。

## 说明

选项 A 下平台不推送 `thinking / tool_request / tool_response`（实测为 `null`），用户侧“中途思考/工具调用”目前只能呈现为等待阶段提示 + 回答后的工具调用摘要；如需逐字流式思考过程，需另行评估本地直连模型方案。

## 遗留

- P1、P2、P3-1 建议进入下一轮 CC 计划。
- JavaTutor 工作区未提交改动由用户本地验证后提交。
