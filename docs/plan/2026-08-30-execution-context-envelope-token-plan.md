# 执行计划：恢复完整 envelope（后端）+ 执行上下文接口/token 收敛

> 目的：支撑 `javatutor-coze` 仓的「`fetch_execution_context` 改为 agent 自由调用、纯 state 读取」改动（见该仓 `docs/plan/2026-08-30-fetch-execution-context-as-tool-plan.md`）。
> 本计划只改 **JavaTutor 后端仓**（`javatutor`）。**已定方案 A**：即使带 run_id，也把完整执行数据放进发给 Coze 的入站消息，使 Coze 侧读取工具优先从 state 取，不再依赖后端 30 分钟内存快照。

## 0. 全局约束

- **不做任何 git 操作**。
- 只在 `backend/src/main/java`、`backend/src/test`、`docs/` 下新增/修改；不碰 `CozeAIController` 以外的非必要文件；不删执行上下文接口。
- Spring profile：`application.properties` 的 `spring.config.import=optional:classpath:coze.properties,optional:classpath:coze-local.properties`。

## 1. 改动清单

| # | 文件 | 改动 |
|---|---|---|
| 1 | `backend/src/main/java/com/javatutor/service/CozeService.java` | `buildAgentPayload` runId 分支改为**仍携带** `source_code`/`steps`/`current_step_index`/`current_line`（可选 `algorithm_tags`） |
| 2 | `backend/src/test/java/com/javatutor/service/CozeServicePayloadTest.java` | `withRunIdBuildsMinimalEnvelope` 改写为断言 **完整 envelope** |
| 3 | `.github/workflows/deploy.yml`、`coze.properties` | **不改**（见 §4 结论） |
| 4 | `backend/src/main/resources/coze-local.properties` | **不改**（gitignored，见 §5 卫生说明） |

---

## Task 1：buildAgentPayload 恢复完整 envelope

`backend/src/main/java/com/javatutor/service/CozeService.java` 方法 `buildAgentPayload`（约 48-83 行）。把 runId 分支从「只发控制字段 + return」改为「仍携带完整执行数据」：

```java
if (runId != null && !runId.isBlank()) {
    agentPayload.put("run_id", runId);
    agentPayload.put("session_id", sessionId != null ? sessionId : "");
    agentPayload.put("user_question", userQuestion != null ? userQuestion : "");
    agentPayload.put("intent", intent != null ? intent : "");
    agentPayload.put("compile_error", compileError != null ? compileError : "");
    // 方案 A：即便带 runId 也携带完整执行数据，使 Coze 侧读取工具优先从 state 取，不依赖后端快照
    agentPayload.put("source_code", sourceCode);
    agentPayload.put("steps", steps != null ? steps : List.of());
    agentPayload.put("current_step_index", currentStepIndex);
    agentPayload.put("current_line", currentLine);
    if (algorithmTags != null && !algorithmTags.isEmpty()) {
        agentPayload.put("algorithm_tags", algorithmTags);
    }
    return agentPayload;
}
```

- 效果：Coze 侧 `parse_context` 解析出 `source_code`/`steps`/`current_step_index`/`current_line`/`algorithm_tags`，供 `analyze_code_node`、`context_compaction`、`step_facts` 与读取工具使用。
- 不再需要 Coze 侧走 `GET {JAVATUTOR_EXECUTION_CONTEXT_URL}/{run_id}`。
- `session_id`（而非 `user_id`）在 runId 分支已提供，Coze 侧 `_parse_json_dict` 会把 `session_id` 映射为 `user_id`，无需额外加 `user_id`。

## Task 2：更新 CozeServicePayloadTest

`backend/src/test/java/com/javatutor/service/CozeServicePayloadTest.java` 将 `withRunIdBuildsMinimalEnvelope` 改为断言完整 envelope（方法名相应改）：

```java
@Test
void withRunIdBuildsFullEnvelope() {
    CozeService service = new CozeService();
    Map<String, Object> payload = service.buildAgentPayload(
        "public class A {}",
        List.of(Map.of("step", 0)),
        1,
        4,
        "x 怎么变了？",
        "",
        "session-1",
        "data_query",
        List.of("排序"),
        "run-1"
    );

    assertEquals("run-1", payload.get("run_id"));
    assertEquals("session-1", payload.get("session_id"));
    assertEquals("x 怎么变了？", payload.get("user_question"));
    assertEquals("data_query", payload.get("intent"));
    assertEquals("public class A {}", payload.get("source_code"));
    assertEquals(List.of(Map.of("step", 0)), payload.get("steps"));
    assertEquals(1, payload.get("current_step_index"));
    assertEquals(4, payload.get("current_line"));
    assertEquals(List.of("排序"), payload.get("algorithm_tags"));
}
```

`withoutRunIdBuildsLegacyEnvelope` 保持不变。

## Task 3：验证

```bash
cd backend
mvn -q test -Dtest=CozeServicePayloadTest
```

- 确认上述单测通过；确认无其他用例断言 runId 分支「不含 source_code/steps」。

## Task 4：执行上下文接口 / deploy.yml —— **不改**（结论）

`/api/agent/execution-context`（`ExecutionSnapshotController` + `InMemoryExecutionSnapshotStore` + `ExecutionSnapshotService`）与 `X-Agent-Token` 校验（`javatutor.agent.token`）**保留**，本轮不做任何改动。理由：

- 该接口仍可能被消费：后端 `ExecutionSnapshotControllerTest`、`javatutor-coze` 的 L4 冒烟 / e2e / retrieval 评测、手工 curl 排查。
- Coze agent 改读 state 后不再依赖它，但**保留无害**；若日后确认无任何调用方，再单独任务移除接口 + `deploy.yml` 的 `JAVATUTOR_AGENT_TOKEN` 注入。

因此 `.github/workflows/deploy.yml`（137-139 行注入 `JAVATUTOR_AGENT_TOKEN`）**无需更改**。`coze.properties:9` 的 `${JAVATUTOR_AGENT_TOKEN:}` 占位保持不变。

## Task 5：coze-local.properties token 卫生（不改，仅说明）

经核实：`backend/src/main/resources/coze-local.properties` 与 `backend/target/classes/coze-local.properties` **均已被 `.gitignore`**（`git ls-files` 为空、`git status` 干净），其中的 `javatutor.agent.token=9f3a7c2d...` **不在 git 仓库历史中**，不是仓库泄漏。它只是本地覆盖（`spring.config.import=optional:...`）与本地构建产物。

注意点（无需代码改动）：

- CI 从干净克隆构建时不含该文件 → 生产 jar 一般无此硬编码 token；但**本机构建再上传 jar** 会把该文件打进 classpath。为避免本地真实 token 被带进生产，建议本地改用环境变量，或确保 `coze-local.properties` 不写真实生产 token。
- 保持 `.gitignore` 第 43 行 `backend/src/main/resources/coze-local.properties` 不被移除即可。

> 该项不要求改动，仅作记录与提醒；如需彻底收紧可再单开任务（把本地 token 改为引用 `${JAVATUTOR_AGENT_TOKEN:}` 或经 `~/.m2`/环境变量注入）。

---

## 跨仓库协同

- 后端本计划完成并**重新构建/部署 JavaTutor** 后，`javatutor-coze` 的读取工具才能从 state 读到 `source_code`/`steps`。
- Coze 侧同时需在平台**重新发布 agent**。
- 两者是同一改动的前后半段，建议一起上线；若先后，先后端后 coze。
