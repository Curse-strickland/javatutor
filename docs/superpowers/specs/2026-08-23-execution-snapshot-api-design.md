# Execution Snapshot API 设计

## 1. 背景与目标

当前 JavaTutor 在 `/api/ai/chat` 时，将源代码、完整 steps、当前步、当前行、编译错误一并写入 Coze 消息 JSON。Coze 侧没有按 run 获取上下文的接口，导致入站消息体积大，且上下文事实源与前端请求耦合。

本设计为 JavaTutor 后端增加执行快照存储与内部查询接口：

- `/api/run` 成功后，按 `runId` 保存执行快照。
- `/api/ai/chat` 时，用请求中的最新代码、steps、当前步更新快照位置。
- Coze 侧通过 `runId` 查询快照，不再依赖入站消息携带完整执行数据。

## 2. 设计原则

1. `runId` 是执行快照的唯一业务键。
2. 后端是执行上下文的唯一事实源。
3. 快照只保留短 TTL，避免长期保存用户代码。
4. 内部查询接口必须鉴权，且不暴露给普通前端路由。
5. 新增存储先采用进程内实现，接口边界允许后续替换为 Redis 或数据库。

## 3. 新增数据模型

新增 `ExecutionSnapshot`：

```java
public class ExecutionSnapshot {
    private String runId;
    private String sourceCode;
    private List<Map<String, Object>> steps;
    private int currentStepIndex;
    private int currentLine;
    private String compileError;
    private List<String> algorithmTags;
    private long createdAtEpochMs;
    private long expiresAtEpochMs;
}
```

字段规则：

- `steps` 允许为空列表。
- `currentStepIndex` 为 0-based。
- `currentLine` 允许为 0。
- `algorithmTags` 允许为空。

## 4. ExecutionSnapshotStore

新增：

```java
public interface ExecutionSnapshotStore {
    void save(ExecutionSnapshot snapshot);
    Optional<ExecutionSnapshot> findByRunId(String runId);
    void updatePosition(String runId, int currentStepIndex, int currentLine);
    void evictExpired();
}
```

默认实现：

```java
@Service
public class InMemoryExecutionSnapshotStore implements ExecutionSnapshotStore {
    private final Map<String, ExecutionSnapshot> store = new ConcurrentHashMap<>();
    private static final long TTL_MS = 30 * 60 * 1000L;
}
```

规则：

- 保存前设置 `createdAtEpochMs = System.currentTimeMillis()`。
- `expiresAtEpochMs = createdAtEpochMs + TTL_MS`。
- `findByRunId` 遇到已过期记录时先移除并返回 `Optional.empty()`。
- 每次写入最多执行一次 `evictExpired`，避免无限增长。

## 5. 内部查询接口

新增 Controller 或方法：

```http
GET /api/agent/execution-context/{runId}
```

请求头：

```http
X-Agent-Token: {JAVATUTOR_AGENT_TOKEN}
```

响应：

```json
{
  "run_id": "3f8a2c0d-...",
  "source_code": "public class UserCode { ... }",
  "steps": [],
  "current_step_index": 2,
  "current_line": 5,
  "compile_error": "",
  "algorithm_tags": ["冒泡排序"],
  "expires_at": 1784736000
}
```

错误码：

- `401`：token 缺失或不匹配。
- `404`：快照不存在或已过期。
- `500`：查询异常。

配置项：

```properties
javatutor.agent.token=${JAVATUTOR_AGENT_TOKEN:}
```

禁止把真实 token 写入 `coze.properties` 或提交到 git；本地值放 `coze-local.properties`。

## 6. Run 写入快照

在 `/api/run` 和 `/api/runProject` 成功返回 `RunResponse` 后：

- 使用 `RunResponse.getRunId()` 作为 `runId`。
- 单文件使用 `RunRequest.getCode()`。
- 多文件使用入口类代码 `RunResponse.getEntryCode()`，为空时回退为 `RunRequest.getCode()`。
- steps 使用 `RunResponse.getSteps()`。
- 初始 `currentStepIndex = 0`，`currentLine` 取 steps 首个元素的 `line` 字段，缺失时为 0。

## 7. Chat 更新快照位置

`CozeAIController.chat` 收到 `ExplainRequest` 后：

- 若 `request.getRunId()` 非空且快照存在，则调用：

```java
executionSnapshotStore.updatePosition(
    request.getRunId(),
    request.getStep(),
    request.getCurrentLine()
);
```

- 若请求携带 `steps`，同步更新快照中的 steps。
- 若请求携带 `code` 或 `compileError`，同步更新对应字段。

然后 `CozeService.streamExplain` 只向 Coze 发送最小 envelope。

## 8. Coze 消息瘦身

`CozeService.streamExplain` 的 `agentPayload` 改为：

```java
Map<String, Object> agentPayload = new LinkedHashMap<>();
agentPayload.put("run_id", runId);
agentPayload.put("session_id", sessionId);
agentPayload.put("user_question", userQuestion);
agentPayload.put("intent", intent);
agentPayload.put("compile_error", compileError);
```

不再发送：

- `source_code`
- `steps`
- `current_step_index`
- `current_line`
- `algorithm_tags`

如果 `runId` 为空，暂回退旧 payload，保证本地旧链路仍可运行。

## 9. 安全与降级

- 内部接口使用共享 token，生产环境必须通过 HTTPS 暴露。
- `runId` 必须为 UUID，避免遍历。
- TTL 默认 30 分钟，用户代码不长期保存。
- Coze 侧请求失败时，Coze 自己负责固定降级文案，后端不改变 `/api/ai/chat` 的 SSE 主流程。

## 10. 测试策略

### 单元测试

- 保存后可按 `runId` 查询。
- 过期快照查询返回空。
- `updatePosition` 更新当前步与当前行。
- token 缺失、token 错误、runId 不存在时返回正确状态码。

### 集成测试

- `/api/run` 成功后，内部接口能查到对应快照。
- `/api/ai/chat` 更新位置后，内部接口返回新位置。

### 兼容性测试

- 无 `runId` 时 Coze 消息仍回退旧 payload。

## 11. 接口契约边界

本仓库只负责提供执行快照与查询接口。Coze 侧负责调用该接口、解析响应、更新 state、写入记忆、调用 `step_facts`。
