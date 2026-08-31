# 实施计划：多文件 envelope（后端）+ 前端发 files（Phase 2 后端/前端）

> 目的：支撑 `javatutor-coze` 仓的「多文件 / 整体项目理解」（该仓 `docs/plan/2026-08-30-multifile-whole-project-plan.md`）。后端把**项目全部文件**塞进发给 Coze 的入站消息，使 Coze 侧 `state.files` 拿到完整项目结构。
> 本计划改 **JavaTutor 后端 `backend/`** 与 **前端 `frontend/`**。不碰 deploy.yml / token（沿用 Phase 1 结论）。

## 0. 全局约束

- **不做任何 git 操作**。
- 只在 `backend/src/main/java`、`backend/src/test`、`frontend/src` 下新增/修改；不碰 `CozeAIController` 以外的非必要文件。
- `files` 字段为可选：单文件模式（前端不发 files / 为空）行为不变，Coze 侧 `normalize_files` 得空 dict。

## 1. 改动清单

| # | 文件 | 改动 |
|---|---|---|
| 1 | `backend/.../model/ExplainRequest.java` | 新增 `files` 字段 + getter/setter |
| 2 | `backend/.../service/CozeService.java` | `buildAgentPayload` / `streamExplain` 增加 `files` 参数并写入 payload |
| 3 | `backend/.../controller/CozeAIController.java` | SSE `streamExplain` 调用处传 `request.getFiles()`；两个 blocking 调用传 `null` |
| 4 | `backend/.../service/CozeService.java`（blocking 重载） | 末尾补 `null` |
| 5 | `backend/.../service/CozeServicePayloadTest.java` | 断言 payload 带 `files` |
| 6 | `frontend/src/stores/player.js` | `askQuestion` body 增加 `files` |

---

## Task 1：`ExplainRequest` 增加 `files`

`backend/src/main/java/com/javatutor/model/ExplainRequest.java` 新增（与 `steps` 同样的 `List<Map<...>>` 风格）：

```java
private List<Map<String, String>> files;
// 项目全部文件，每个元素含 name / code；多文件时由前端传入，单文件可缺省。

private String entryFile;
// 主入口文件名（可选），用于锚定行号；多文件时前端可传，缺省 null。

public List<Map<String, String>> getFiles() { return files; }
public void setFiles(List<Map<String, String>> files) { this.files = files; }

public String getEntryFile() { return entryFile; }
public void setEntryFile(String entryFile) { this.entryFile = entryFile; }
```

> 与前端 `player.js` `files: [{name, code}]` 结构一致。Coze 侧 `normalize_files` 兼容 `{name, code}` / `{path, code}`。

---

## Task 2：`CozeService` 透传 `files`

### 2.1 `buildAgentPayload` 签名加末参

`backend/src/main/java/com/javatutor/service/CozeService.java`，`buildAgentPayload(... String runId)` 末尾追加：

```java
Map<String, Object> buildAgentPayload(String sourceCode,
                                      List<Map<String, Object>> steps,
                                      int currentStepIndex,
                                      int currentLine,
                                      String userQuestion,
                                      String compileError,
                                      String sessionId,
                                      String intent,
                                      List<String> algorithmTags,
                                      String runId,
                                      List<Map<String, String>> files,
                                      String entryFile) {
```

在 **runId 分支**（方案 A）加：

```java
if (files != null && !files.isEmpty()) {
    agentPayload.put("files", files);
}
if (entryFile != null && !entryFile.isBlank()) {
    agentPayload.put("entry_file", entryFile);
}
```

在**旧分支**（无 runId）结尾同样加（可选）。

### 2.2 `streamExplain` 签名加末参

```java
public void streamExplain(... String runId,
                          Consumer<String> onChunk,
                          Consumer<String> onStage,
                          List<Map<String, String>> files,
                          String entryFile) throws Exception {
```

并把 `buildAgentPayload(... runId, files, entryFile)` 的调用改为传入 `files` 与 `entryFile`。

### 2.3 blocking 重载补 `null`

- `blockingExplain`（~219 行）调 `streamExplain(... sb::append, null)` → 末尾补 `, null, null`（files、entryFile）。
- `blockingExplainWithSteps`（~234 行）同样补 `, null, null`。

---

## Task 3：`CozeAIController` 传 `files`

`backend/src/main/java/com/javatutor/controller/CozeAIController.java` 的 SSE `streamExplain` 调用（~76-96 行）末尾追加：

```java
request.getRunId(),
chunk -> { ... },
stage -> { ... },
request.getFiles(),          // 新增：多文件项目
request.getEntryFile()       // 新增：主入口（可选）
);
```

（另两处 `blockingExplain` 调用不用改——它们走 blocking 重载，已由 Task 2.3 补 `null, null`。）

---

## Task 4：测试（`CozeServicePayloadTest`）

将 `withRunIdBuildsFullEnvelope()` 补断言 `files`：

```java
@Test
void withRunIdBuildsFullEnvelope() {
    CozeService service = new CozeService();
    Map<String, Object> payload = service.buildAgentPayload(
        "public class A {}",
        List.of(Map.of("step", 0)),
        1, 4, "x 怎么变了？", "",
        "session-1", "data_query",
        List.of("排序"), "run-1",
        List.of(Map.of("name", "A.java", "code", "public class A {}")),  // 新增 files
        "A.java"                                                          // 新增 entryFile
    );

    assertEquals("run-1", payload.get("run_id"));
    assertEquals(List.of(Map.of("name", "A.java", "code", "public class A {}")), payload.get("files"));
    assertEquals("A.java", payload.get("entry_file"));
}
```

新增一例：`files` / `entryFile` 为空时 payload **不含**对应键：

```java
@Test
void withNulFilesOmitsKeys() {
    CozeService service = new CozeService();
    Map<String, Object> payload = service.buildAgentPayload(
        "a", null, 0, 1, "q", "", "s", "data_query", null, "r", null, null);
    assertFalse(payload.containsKey("files"));
    assertFalse(payload.containsKey("entry_file"));
}
```

---

## Task 5：前端发 `files`（`frontend/src/stores/player.js`）

`askQuestion` 的 fetch body（~230-238 行）增加，并给 `stepSnapshots`（~219-226 行）补 `file`：

```javascript
// stepSnapshots 补 file：步骤快照透传每步所在文件，供 Coze 自证「当前步在哪个文件」
const stepSnapshots = (this.steps || []).map(s => ({
  step: s.step,
  line: s.line,
  file: s.file || '',              // 新增：多文件项目时确定当前步归属
  variables: s.variables || {},
  heap: s.heap || {},
  stackFrames: s.stackFrames || [],
  output: s.output
}))

body: JSON.stringify({
  code: this.code,
  runId: this.runId,
  step: this.currentStep,
  totalSteps: this.totalSteps,
  currentLine: this.currentLine,
  steps: stepSnapshots,
  variables: { ...this.currentVariables, _explainTopic: q },
  files: this.multiState.files.map(f => ({ name: f.name, code: f.code })),  // 新增：全部文件
  entryFile: this.multiState.entryFile || ''                                // 新增：主入口（可选）
}),
```

- `files` / `entryFile` 可选：单文件（`multiState.files` 空）时为空，后端为 null，Coze 归一化为空 dict。
- `step.file`：后端执行时已记录（前端 `steps[i].file`），补上即可，无需额外计算。

---

## Task 6：验证

```bash
cd backend
mvn -q test -Dtest=CozeServicePayloadTest
```

- 确认上述单测通过；无其它用例断言 runId 分支「不含 files」（新字段为可选，不影响既有断言）。
- 前端：`cd frontend && npm run build`（Vite）确认无语法错误。

## 跨仓库协同

- 前端发 `files` → 后端塞 `files` → Coze `parse_context` 归一化 `state.files`（该侧改动见 coze 计划 Task 3）。
- 后端需重新构建/部署 JavaTutor；Coze 平台需重新发布 agent。
- 建议一起上线；若先后，先后端后 coze。
