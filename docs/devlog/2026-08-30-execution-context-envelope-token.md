# 2026-08-30 执行上下文 envelope 恢复 开发日志

> 对应计划：`docs/plan/2026-08-30-execution-context-envelope-token-plan.md`
> 涉及仓库：`JavaTutor`（分支 `fix/ai-tutor-panel-trace-render`）
> 状态：Task 1-2 代码完成 + 目标单测全绿；Coze 侧配套改动见 `javatutor-coze` 仓 `docs/devlog/2026-08-30-fetch-execution-context-as-tool.md`

## 背景

`javatutor-coze` 仓把 `fetch_execution_context` 从「确定性 graph 节点」改为「agent 按需调用的纯 state 读取工具」——Coze 侧不再依赖后端 30 分钟内存快照，而是**优先从入站 state 读取完整执行数据**。因此后端 `CozeService.buildAgentPayload` 需要恢复完整 envelope：即便带 `run_id`，也把 `source_code` / `steps` / `current_step_index` / `current_line`（可选 `algorithm_tags`）一并放进发给 Coze 的入站消息。

## 改动内容

### 修改文件

| 文件 | 改动 |
|---|---|
| `service/CozeService.java` | `buildAgentPayload` 的 runId 分支：在 `run_id/session_id/user_question/intent/compile_error` 基础上，**追加** `source_code/steps/current_step_index/current_line`，`algorithm_tags` 非空时一并携带；不再「只发控制字段即 return」。方法注释同步更新 |
| `service/CozeServicePayloadTest.java` | `withRunIdBuildsMinimalEnvelope` 重命名为 `withRunIdBuildsFullEnvelope`，断言从「不含 source_code/steps/…」改为「含完整执行数据」；`withoutRunIdBuildsLegacyEnvelope` 保持不变 |

### 明确不改（计划 Task 4-5 结论）

- `.github/workflows/deploy.yml`、`coze.properties`：`/api/agent/execution-context` 接口与 `X-Agent-Token`、`JAVATUTOR_AGENT_TOKEN` 注入**保留**（仍可能被评测/手工 curl 消费），本轮不改。
- `coze-local.properties`：gitignored，`git ls-files` 为空，不在仓库历史中，仅本地覆盖，本轮不改。

## 验证结果

| 门槛 | 命令 | 结果 |
|---|---|---|
| 目标单测 | `mvn test -Dtest=CozeServicePayloadTest` | **Tests run: 2, Failures: 0, Errors: 0**，BUILD SUCCESS |
| 全模块编译 | 同命令（test 阶段编译 main + test） | 通过，无其他用例断言 runId 分支「不含 source_code/steps」（已 grep 确认） |

## 遗留 / 注意事项

- **必须重新部署 JavaTutor**：后端 `buildAgentPayload` 改动生效后，Coze 侧读取工具才能从入站 state 读到 `source_code`/`steps`。
- 与 Coze 侧**一起上线**（同一改动的前后半段）：`javatutor-coze` 需在平台重新发布 agent。
- 入站消息体积回到 08-23 之前（代码 + steps 随每次提问发送）；「envelope 携带 ≠ 模型看到」，Coze 侧由 GSSC select 与 agent 主动读取决定是否展示。
