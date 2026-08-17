# 2026-08-17 决策痕迹用户展示与耗时指标修复开发日志

> 对应计划：`docs/superpowers/plans/2026-08-17-decision-trace-user-display-metrics-plan.md`
> 依据 review：`docs/reviews/2026-08-17-integrated-followup-review.md`（P1 / P2 / P3-1）
> 涉及仓库：`JavaTutor`（分支 `feat/decision-trace-panel`）+ `javatutor-coze`（分支 `feat/agent-architecture-improve`）
> 状态：Task 1-3 代码完成 + Task 4 自动化回归全绿，本地浏览器验证与提交待确认

## 背景

上轮综合接力计划执行后 review 发现三个问题：

- **P1（`latency_ms` 恒为 0）**：`_parse_json_dict` 写入 `request_started_at`，但 `JavaTutorState` schema 未声明该键，LangGraph 不持久化，`build_final` 回退到当前时间 → 差值恒为 0。
- **P2（用户侧仍展示原始 JSON）**：`DecisionTracePanel` 折叠区直接渲染 `JSON.stringify(trace)`，对用户无意义。
- **P3-1（`token_cost` 读取路径错误）**：`message_end` 里 `token_cost` 位于 `content.message_end.token_cost` 对象内，后端读的是 `/content/token_cost`，恒为 `-1`。

## 改动内容

### Task 1：修复 `latency_ms` 恒为 0（javatutor-coze）

| 文件 | 改动 |
|---|---|
| `src/graphs/javatutor/state.py` | `JavaTutorState` 追加 `request_started_at: float` 字段（parse_context 写入时间戳） |
| `tests/test_build_final.py` | 新增 `test_latency_ms_uses_request_started_at`：传 `time.time() - 1.5` 断言 `latency_ms > 0` |
| `docs/spec/2026-08-10-coze-agent-interface.md` | `latency_ms` 说明补充：图内墙钟估算值，与平台 `message_end.time_cost_ms` 不一定一致（后者含网络/平台调度开销） |

### Task 2：修复 `token_cost` 读取（JavaTutor 后端）

`backend/.../service/CozeService.java` 的 `message_end` 分支：`token_cost` 改为从 `messageEnd.get("token_cost")` 读取其 `total_tokens`，日志字段改名 `platformTotalTokens`。

### Task 3：决策痕迹用户侧展示重构（JavaTutor 前端）

| 文件 | 改动 |
|---|---|
| `frontend/src/utils/decisionTrace.js` | 新增 `traceSummary(trace)` 纯函数：返回 `{ intentLabel, toolLines, reviseText, latencyText, tokenText }`。意图映射 data_query→数据追问 / concept→概念讲解 / debug→错误诊断 / analyze→代码分析 / animate(·_guide)→动画解说 / other→通用助手；`step_facts` 格式化为「调用 step_facts：查询第 N 步，行 L」；其余工具只渲染标量 args；`reviseText` 仅在 `critic_passed=false && revised=true` 时输出「评审未通过，已修订」；`latency_ms > 0` 时输出「耗时 X.Xs」；`token_usage` 输出「Prompt P / 生成 C」 |
| `frontend/src/utils/decisionTrace.test.js` | 新增 6 个用例：无 trace 空摘要、意图映射、工具行格式化、评审/修订文案、耗时/Token 格式化、缺失字段不抛错 |
| `frontend/src/components/DecisionTracePanel.vue` | 折叠标签「决策痕迹」→「执行过程」；折叠区默认展开（`open=true`），内容为可读摘要（意图标签 + 工具行 + 评审状态 + 耗时/Token）；原始 JSON 仅开发者模式可见（URL 带 `?dev=1` 或 `localStorage.jt-dev === '1'`）；保留 `role="button"` / `tabindex` / `aria-expanded` / `aria-controls` / Enter+Space 键盘切换 |

## 验证结果

| 门槛 | 命令 | 结果 |
|---|---|---|
| Coze 全量测试 | `uv run pytest -q` | **108 passed**（107 + 新增 latency 测试） |
| 后端编译 | `./mvnw.cmd -q -DskipTests compile` | exit 0 |
| 前端单测 | `npm test` | 13 文件 / **127 测试**通过（121 + 6 traceSummary） |
| 前端构建 | `npm run build` | 通过（chunk 体积告警为既有项） |

## 遗留问题

- **本地浏览器验证未做**（计划 Task 4 Step 4）：需本地启动前后端 + 线上 Coze 部署（含本次 `state.py` 修复重新部署）后，浏览器观察阶段提示、光标对齐、无 `a`、决策痕迹只显示可读摘要、`?dev=1` 时显示原始 JSON、`latency_ms > 0`。
- **提交待确认**：JavaTutor 工作区含上轮（光标修复/耗时日志/AGENTS.md/devlog）与本轮改动；coze 侧含本轮 `state.py`/测试/契约改动。按计划「JavaTutor 侧本地验证通过后再提交；javatutor-coze 测试通过后提交」，coze 测试已通过。

## 二次修订（2026-08-17）

用户反馈两点后补充：

- `decisionTrace.js`：意图标签改为「意图识别：数据追问（data_query）」格式，明确标注这是意图识别结果；`tool_calls` 为空时输出「未调用工具」。
- `DecisionTracePanel.vue`：渲染「未调用工具」提示。
- `javatutor-coze/src/graphs/javatutor/prompts.py`：要求 `data_query` 且存在当前步骤索引时，必须先调用 `step_facts` 获取真实证据再回答。
- 验证：前端 `npm test` **128 passed**、`npm run build` 通过；coze `uv run pytest -q` **108 passed**。
- 未提交；JavaTutor 侧待本地验证后提交，coze 侧需重新部署生效。
