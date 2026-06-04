# backend 说明 — 接口与步骤 JSON 约定

本目录为后端实现位置（Spring Boot）。本文件列出与前端约定的 HTTP/SSE 接口、步骤 JSON 格式与安全建议，方便后端开发者快速对接。

API 概览

1) POST /api/run
- 描述：接收前端提交的用户 Java 源码（单一类或方法），进行 AST 插桩、内存编译与受控执行，返回步骤数组（steps）和 `runId`。
- 输入：`{ "code": "public class UserCode { ... }" }`
- 输出（成功）：
  ```json
  {
    "success": true,
    "runId": "uuid-xxx",
    "steps": [ /* Steps 数组，详见下面 */ ]
  }
  ```

2) GET /api/explain/{runId}/{step}
- 描述：基于指定 `runId` 的执行记录和具体 `step`，以 SSE 流返回 AI 解说文本片段。

Steps JSON 结构（详解）
- `steps` 是按执行顺序排列的数组，每个元素为 `Step` 对象：
  - `step` (number): 从 1 开始的序号
  - `line` (number|null): 对应原始源文件的 1-based 行号，若不对应可为 `null`
  - `variables` (object): 当前作用域的键值对快照

变量值序列化策略
- 优先返回原生 JSON 值（number/string/boolean/array/object）。
- 对于复杂引用（链表、树等），建议返回结构化描述并使用显式 id 进行引用。例如：
  ```json
  {
    "__type": "ListNode",
    "id": "n1",
    "val": 5,
    "next": "n2"
  }
  ```
- 如果某些类型无法安全或方便序列化，可以返回 `toString()` 或者 `{ "__repr": "..." }` 作为后备方案。

示例：完整响应片段
```json
{
  "success": true,
  "runId": "a1b2c3",
  "steps": [
    { "step": 1, "line": 3, "variables": { "arr": [5,3,8] } },
    { "step": 2, "line": 6, "variables": { "arr": [3,5,8], "i": 0 } }
  ]
}
```

SSE 解说流示例
- 每次事件使用 `data:` 前缀发送文本片段；最后发送 `data: [DONE]` 表示结束。

错误与部分输出策略
- 若编译失败：返回 `success: false` 和 `error` 字段，`steps` 可为空或包含已记录的步骤。
- 若运行超时或触发安全阈值：返回 `success: false`，`error` 字段说明原因（例如 `timeout`、`security_violation`）。

安全与沙盒实现要点
- 在 AST 层面过滤危险节点（`System.exit`、反射、ProcessBuilder、文件 I/O 等）。
- 在执行层面：独立线程或进程、JVM 限制（SecurityManager / classloader 白名单）、时间/内存限制。

联调提示
- 使用 `player.runMock()` 的 mock 数据进行前端开发，后端上线时保证返回格式兼容。
- 如果需要 debug 某个用户提交的代码，可在本地以 `--debug` 模式记录完整插桩后源码与步骤 JSON，便于定位插桩带来的语法问题。

配置项建议（`application.properties`）
- `javatutor.sandbox.timeoutMs=5000`
- `javatutor.sandbox.maxMemoryMb=256`
- `javatutor.llm.apiKey` — 若启用 LLM 解说

-------------------------
从前端 mock 切换到真实后端：实操步骤

当前前端在 `stores/player.js` 使用 `runMock()` 将 `steps` 填充为静态 `mockSteps`，用于离线 UI 联调。要接入真实后端，需要实现 `POST /api/run`（返回 `steps`）并可选实现 `GET /api/explain/{runId}/{step}`（SSE 解说）。下面给出建议的实现流程与示例。

1) 实现 `POST /api/run`
- 接收 JSON：`{ "code": "<用户提交的 Java 源码>" }`
- 返回 JSON：
  ```json
  {
    "success": true,
    "runId": "uuid-xxx",
    "steps": [ { "step":1, "line":3, "variables":{...} }, ... ]
  }
  ```
- 若编译/运行失败，返回：
  ```json
  { "success": false, "error": "编译错误: ...", "steps": [ /* 可选：已记录步骤 */ ] }
  ```

示例（Spring Boot 控制器伪代码）：

```java
@RestController
@RequestMapping("/api")
public class RunController {
  @PostMapping("/run")
  public ResponseEntity<?> run(@RequestBody Map<String,String> body) {
    String code = body.get("code");
    String runId = UUID.randomUUID().toString();
    // 1. 插桩（JavaParser） -> instrumentedSource
    // 2. 内存编译并执行（受控沙盒） -> 收集每步的变量快照到 List<Map>
    List<Map<String,Object>> steps = traceEngine.executeAndCollect(instrumentedSource);
    Map<String,Object> resp = Map.of("success", true, "runId", runId, "steps", steps);
    return ResponseEntity.ok(resp);
  }
}
```

2) 实现 SSE 解说端点（可选）
- 使用 Spring 的 `SseEmitter` 在后端与 LLM（或本地解释器）之间做流式转发。

示例（伪代码）：

```java
@GetMapping("/explain/{runId}/{step}")
public SseEmitter explain(@PathVariable String runId, @PathVariable int step) {
  SseEmitter emitter = new SseEmitter();
  Executors.newSingleThreadExecutor().submit(() -> {
    try {
      // 从 LLM 或本地解释器按片段拉取文本
      for (String chunk : llm.streamExplain(runId, step)) {
        emitter.send(chunk);
      }
      emitter.send("[DONE]");
      emitter.complete();
    } catch (Exception e) { emitter.completeWithError(e); }
  });
  return emitter;
}
```

3) `steps` 的生成细节
- 插桩点（建议）：变量声明、赋值、数组元素写入、循环更新、方法入口/出口、return 前。
- 每次记录应包含：`step`（自增）、`line`（源代码行数，1-based，可为 null）、`variables`（当前可序列化的变量快照）。
- 变量序列化优先返回 JSON 原生类型；复杂引用（链表/树）用结构化对象和 id 进行引用。

4) 调试与联调方法
- 使用 `curl` 或 Postman 测试 `POST /api/run`：

```bash
curl -s -X POST -H "Content-Type: application/json" -d '{"code":"public class UserCode { public static void main(String[] a){ System.out.println(1); } }"}' http://localhost:8080/api/run
```

- 在前端本地开发时，`vite.config.js` 默认会把 `/api` 代理到 `http://localhost:8080`，前端无需修改 API 基址；在生产或不同端口场景下，请同步修改代理或前端 API 基址。

5) 如何替换前端的 mock（前端要做的事）
- 前端开发者需要在 `src/stores/player.js` 中把 `runMock()` 替换为调用真实后端的 `runCode(code)`（或在 `runCode` 中实现网络调用，保留 `runMock()` 作为回退）。
- 推荐实现要点：
  - 设置 `isLoading = true`；
  - POST `/api/run`；
  - 收到成功响应后写入 `steps` 并 `currentStep = 0`；
  - 接收 `runId` 后再发起 `EventSource('/api/explain/'+runId+'/'+step)` 以获取解说。

示例：前端与后端联调流程
1. 前端点击运行，前端将 `code` POST 到 `/api/run`。
2. 后端返回 `{ success: true, runId, steps }`。
3. 前端把 `steps` 写入 store 并播放；同时可为当前或每一步调用 `/api/explain/{runId}/{step}` 获取解说文本流。

常见问题
- 若前端收不到 `steps`：检查后端响应的 JSON 结构与字段名（`steps`、`runId`、`success`）。
- 若步骤顺序错误：确认插桩记录顺序与程序实际执行顺序一致。



