# 2026-08-17 决策痕迹用户展示与耗时指标修复计划

> 执行仓库：`JavaTutor`（分支 `feat/decision-trace-panel`）+ `javatutor-coze`（分支 `feat/agent-architecture-improve`）
> 执行方式：交给 Claude Code 按本计划逐任务 TDD 执行。
> 依据 review：`docs/reviews/2026-08-17-integrated-followup-review.md`

## 背景

- 用户已验证前端不再出现冗余的 `a`。
- 决策痕迹仍以原始 JSON 展示，对用户无意义；用户侧应只展示可读的执行过程摘要，原始 JSON 留给开发者。
- 决策痕迹中 `latency_ms` 恒为 0，无法作为优化指标。

## 现状

- javatutor-coze 已提交 `fad3b5c`（耗时字段），但 `request_started_at` 未写入 `JavaTutorState` schema，LangGraph 未持久化该键，导致 `latency_ms` 恒为 0。
- JavaTutor `CozeService` 已记录耗时日志，但 `token_cost` 读取路径错误，恒为 `-1`。
- `DecisionTracePanel.vue` 折叠区直接渲染 `traceJson`。
- JavaTutor 侧光标修复、耗时日志、AGENTS.md 登记、devlog 均在工作区未提交。

## Task 1: 修复 `latency_ms` 恒为 0

**Files:**
- Modify: `javatutor-coze/src/graphs/javatutor/state.py`
- Modify: `javatutor-coze/src/graphs/javatutor/nodes.py`
- Modify: `javatutor-coze/tests/test_build_final.py`
- Modify: `javatutor-coze/docs/spec/2026-08-10-coze-agent-interface.md`

- [ ] **Step 1: 声明状态字段**

`state.py` 的 `JavaTutorState` 追加：

```python
request_started_at: float
"""本次请求进入图的时间戳，用于计算 latency_ms."""
```

- [ ] **Step 2: 增加测试**

`tests/test_build_final.py` 中 `build_final` 的 state 传入 `request_started_at` 为较早时间，断言 trace 的 `latency_ms > 0` 且为数值。

- [ ] **Step 3: 更新接口契约**

`docs/spec/2026-08-10-coze-agent-interface.md` 的 trace schema 补充 `latency_ms` 说明（毫秒，估算值与平台 `time_cost_ms` 不一定一致）。

- [ ] **Step 4: 回归**

`javatutor-coze`：`uv run pytest -q` 全绿。

## Task 2: 修复 CozeService `token_cost` 读取

**Files:**
- Modify: `JavaTutor/backend/src/main/java/com/javatutor/service/CozeService.java`

- [ ] **Step 1: 修正路径**

`message_end` 分支读取：

```java
JsonNode tokenCostNode = messageEnd.get("token_cost");
long totalTokens = tokenCostNode != null && !tokenCostNode.isNull()
    && tokenCostNode.has("total_tokens")
    ? tokenCostNode.get("total_tokens").asLong() : -1;
```

日志改为输出 `platformTotalTokens`。

- [ ] **Step 2: 编译**

`JavaTutor/backend`：`.\mvnw.cmd -q -DskipTests compile`。

## Task 3: 决策痕迹用户侧展示重构

**Files:**
- Modify: `JavaTutor/frontend/src/utils/decisionTrace.js`
- Modify: `JavaTutor/frontend/src/utils/decisionTrace.test.js`
- Modify: `JavaTutor/frontend/src/components/DecisionTracePanel.vue`

### Step 1: 增加 `traceSummary(trace)` 纯函数

返回结构化可读摘要：

```js
{
  intentLabel,        // data_query → 数据追问 / concept → 概念讲解 / debug → 错误诊断 / other → 通用助手
  toolLines,          // ["调用 step_facts：查询第 2 步（行 5）"]
  reviseText,         // critic_passed=false && revised=true → "评审未通过，已修订"；否则 ""
  latencyText,        // "耗时 1.2s"
  tokenText,          // "Prompt 2331 / 生成 237"
}
```

规则：`toolLines` 只渲染 `tool` 与 `args` 的关键字段；不展示完整 JSON。

### Step 2: 增加测试

`decisionTrace.test.js` 覆盖：
- 无 trace 返回空摘要。
- `tool_calls` 生成可读行。
- critic/revise 状态文案。
- 缺失字段时不报错。

### Step 3: 面板重构

`DecisionTracePanel.vue` 默认展示：

- 正文（markdown，保持现状）。
- 来源 chips（保持现状）。
- 可读执行过程摘要（`traceSummary` 渲染）。
- 原始 JSON 仅在开发者模式可见：`URL 带 ?dev=1` 或 `localStorage.getItem('jt-dev') === '1'` 时，折叠区才显示 `traceJson`。

保留现有 `role="button"`、`tabindex`、`aria-expanded`、键盘切换；折叠标签改为“执行过程”。

### Step 4: 回归

`JavaTutor/frontend`：`npm test` 与 `npm run build`。

## Task 4: 综合回归与本地验证

- [ ] `javatutor-coze`：`uv run pytest -q`。
- [ ] `JavaTutor/backend`：`.\mvnw.cmd -q -DskipTests compile`。
- [ ] `JavaTutor/frontend`：`npm test`、`npm run build`。
- [ ] 本地启动 JavaTutor，验证：阶段提示、光标对齐、无 `a`、决策痕迹只显示可读摘要、`?dev=1` 时显示原始 JSON、`latency_ms > 0`。

## Task 5: 提交

- [ ] 按用户约定：JavaTutor 侧本地验证通过后再提交；`javatutor-coze` 测试通过后提交。
- [ ] 提交前检查无硬编码密钥；更新 `AGENTS.md` 文档表。
- [ ] 完成后写 devlog：`docs/devlog/2026-08-17-decision-trace-user-display-metrics.md`。

## Self-Review

### Spec Coverage

| 需求 | 对应任务 |
|---|---|
| latency_ms 有效 | Task 1 |
| token_cost 正确采集 | Task 2 |
| 用户侧可读摘要 + 开发者原始 JSON | Task 3 |
| 回归与提交 | Task 4、Task 5 |

### Placeholder Scan

计划无 `TBD`、`TODO`；所有代码块完整。
