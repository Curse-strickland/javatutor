# 2026-08-23 执行快照 API 开发日志

> 对应计划：`docs/superpowers/plans/2026-08-23-execution-snapshot-api-plan.md`
> 对应 spec：`docs/superpowers/specs/2026-08-23-execution-snapshot-api-design.md`
> 涉及仓库：`JavaTutor`（分支 `feat/execution-snapshot-api`）
> 状态：Task 1-5 代码完成 + 自动化回归全绿 + 本地端到端验证通过；真实 Coze 联调与浏览器验收待做

## 背景

`/api/ai/chat` 把源代码、完整 steps、当前步、当前行、编译错误一并写入 Coze 入站消息 JSON,导致入站体积大、上下文事实源与前端请求耦合。Coze 侧没有按 run 获取上下文的接口。

本改动为后端增加执行快照存储与带鉴权的内部查询接口:Coze 侧凭借 `runId` 主动拉取上下文,入站消息只需发送最小 envelope。

## 改动内容

### 新增文件

| 文件 | 职责 |
|---|---|
| `model/ExecutionSnapshot.java` | 快照 POJO:`runId / sourceCode / steps / currentStepIndex / currentLine / compileError / algorithmTags / createdAtEpochMs / expiresAtEpochMs` |
| `service/ExecutionSnapshotStore.java` | 存储接口:`save / findByRunId / updatePosition / evictExpired` |
| `service/InMemoryExecutionSnapshotStore.java` | `ConcurrentHashMap` 实现,TTL 30 分钟;`findByRunId` 遇过期先移除;每次 `save` 最多一次 `evictExpired` |
| `controller/ExecutionSnapshotController.java` | `GET /api/agent/execution-context/{runId}`,请求头 `X-Agent-Token`;401/404/500,响应含 `run_id / source_code / steps / current_step_index / current_line / compile_error / algorithm_tags / expires_at` |
| `service/ExecutionSnapshotService.java` | `saveRunSnapshot`(run 成功后建快照,初始位置取首个 step 的 line)+ `updateChatSnapshot`(chat 时更新位置/源码/steps/tags) |

### 修改文件

| 文件 | 改动 |
|---|---|
| `controller/RunController.java` | 构造器注入 `ExecutionSnapshotService`;`run()` 与 `runProject()` 成功返回前调用 `saveRunSnapshot`(多文件用入口类代码,空则回退 `request.getCode()`) |
| `service/CozeService.java` | 新增包内可见 `buildAgentPayload(...)`:有 `runId` 走最小 envelope(`run_id/session_id/user_question/intent/compile_error`),否则回退旧完整 payload;`streamExplain` 签名在 `algorithmTags` 后新增 `runId` 参数;两个 helper 调用补 `null` |
| `controller/CozeAIController.java` | 构造器注入 `ExecutionSnapshotService`;`chat()` 在 `streamExplain` 前调用 `updateChatSnapshot(request)`,并把 `request.getRunId()` 传入 |
| `resources/coze.properties` | 追加 `javatutor.agent.token=${JAVATUTOR_AGENT_TOKEN:}`(占位,无明文;真实值放 `coze-local.properties`/环境变量) |

### 计划修正(计划内部矛盾)

原计划 `InMemoryExecutionSnapshotStore.save()` 无条件把 `expiresAtEpochMs` 覆盖为 `now + TTL`(未来),而 `expiredSnapshotReturnsEmpty` / `evictExpiredRemovesOnlyExpired` 两个测试需注入**已过期**快照来验证清理。两者矛盾,导致 2 个测试必失败。

修正:仅当 `expiresAtEpochMs <= 0`(未显式设置)时才盖章默认 TTL,否则尊重传入值。真实路径(`ExecutionSnapshotService` 新建快照,expiresAt=0)仍得到 30 分钟 TTL,行为不变。

## 验证结果

| 门槛 | 命令 | 结果 |
|---|---|---|
| 后端全量测试 | `./mvnw.cmd test` | **100 tests** 全绿(新增 13:Snapshot 1 + Store 4 + Controller 4 + Service 2 + CozePayload 2) |
| 前端测试 | `npm test` | 13 文件 / **129 tests** 通过 |
| 前端构建 | `npm run build` | 通过(无改动前端,纯回归) |
| 本地端到端 | 启动后端 + curl | `POST /api/run` → runId;`GET /api/agent/execution-context/{runId}` 带正确 token → **200**,返回源码 + steps;无 token → 401;错 token → 401;不存在 runId + 正确 token → 404 |

## 遗留问题

- **真实 Coze 联调未做**:需重新部署 javatutor-coze(其 `fetch_execution_context` 节点已就位,消费 `run_id`),并保证生产环境 `JAVATUTOR_AGENT_TOKEN` 已配置、接口经 HTTPS 暴露;浏览器人工验收「自由问答正常、无冗余 source_code/steps 进入 Coze payload」。
- **提交未做**:按计划 Global Constraints「不主动 commit / push」,提交待用户明确指示。

## 与 Coze 侧契约边界

本仓库只提供端到端快照存储与查询接口。coze 侧(`../javatutor-coze`)负责调用 `GET /api/agent/execution-context/{runId}`、解析响应、更新 state、写入记忆、调用 `step_facts`。经查 coze 侧已有 `fetch_context.py`、`tools/fetch_execution_context`、`state.run_id` 等预接线,与本契约吻合。
