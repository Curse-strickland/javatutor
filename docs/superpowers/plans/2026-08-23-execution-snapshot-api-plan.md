# Execution Snapshot API Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 JavaTutor 后端保存每次代码运行的执行快照，并提供带共享 token 鉴权的内部查询接口，让 Coze 侧按 `runId` 拉取上下文。

**Architecture:** 新增 `ExecutionSnapshot` 数据模型、`ExecutionSnapshotStore` 内存实现和内部 Controller；`/api/run` 与 `/api/run/project` 成功后保存快照，`/api/ai/chat` 更新快照位置并向 Coze 只发送最小 envelope。

**Tech Stack:** Java 17、Spring Boot 3.2.0、JUnit 5、MockMvc。

## Global Constraints

- 后端代码放在 `backend/src/main/java/com/javatutor/`，测试放在 `backend/src/test/java/com/javatutor/`。
- 内部 token 禁止写入 `coze.properties` 或提交 git；本地值放 `coze-local.properties`（已被 gitignore）。
- `runId` 必须由后端生成并保持 UUID 语义。
- 快照 TTL 固定为 30 分钟。
- 不修改前端，除非接口契约要求；本计划不要求前端改动。
- 不主动 commit / push；每个任务末尾的 commit 步骤仅在执行者被明确授权后执行。
- 每个任务完成后运行 `cd backend && ./mvnw test`（Windows 使用 `mvnw.cmd test`）。

---

### Task 1: `ExecutionSnapshot` 数据模型

**Files:**
- Create: `backend/src/main/java/com/javatutor/model/ExecutionSnapshot.java`
- Test: `backend/src/test/java/com/javatutor/model/ExecutionSnapshotTest.java`

**Interfaces:**
- Consumes: 无。
- Produces: `ExecutionSnapshot` POJO，包含 runId、sourceCode、steps、currentStepIndex、currentLine、compileError、algorithmTags、createdAtEpochMs、expiresAtEpochMs。

- [ ] **Step 1: Write failing test**

创建 `ExecutionSnapshotTest.java`：

```java
package com.javatutor.model;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class ExecutionSnapshotTest {

    @Test
    void allFieldsShouldBeSettable() {
        ExecutionSnapshot snapshot = new ExecutionSnapshot();
        List<Map<String, Object>> steps = List.of(Map.of("step", 0));
        List<String> tags = List.of("排序");

        snapshot.setRunId("run-1");
        snapshot.setSourceCode("public class A {}");
        snapshot.setSteps(steps);
        snapshot.setCurrentStepIndex(2);
        snapshot.setCurrentLine(5);
        snapshot.setCompileError("");
        snapshot.setAlgorithmTags(tags);
        snapshot.setCreatedAtEpochMs(1000L);
        snapshot.setExpiresAtEpochMs(2000L);

        assertEquals("run-1", snapshot.getRunId());
        assertEquals("public class A {}", snapshot.getSourceCode());
        assertEquals(steps, snapshot.getSteps());
        assertEquals(2, snapshot.getCurrentStepIndex());
        assertEquals(5, snapshot.getCurrentLine());
        assertEquals("", snapshot.getCompileError());
        assertEquals(tags, snapshot.getAlgorithmTags());
        assertEquals(1000L, snapshot.getCreatedAtEpochMs());
        assertEquals(2000L, snapshot.getExpiresAtEpochMs());
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && ./mvnw test -Dtest=ExecutionSnapshotTest`
Expected: FAIL，`ExecutionSnapshot` 不存在。

- [ ] **Step 3: Implement model**

创建 `ExecutionSnapshot.java`：

```java
package com.javatutor.model;

import java.util.List;
import java.util.Map;

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

    public String getRunId() { return runId; }
    public void setRunId(String runId) { this.runId = runId; }

    public String getSourceCode() { return sourceCode; }
    public void setSourceCode(String sourceCode) { this.sourceCode = sourceCode; }

    public List<Map<String, Object>> getSteps() { return steps; }
    public void setSteps(List<Map<String, Object>> steps) { this.steps = steps; }

    public int getCurrentStepIndex() { return currentStepIndex; }
    public void setCurrentStepIndex(int currentStepIndex) { this.currentStepIndex = currentStepIndex; }

    public int getCurrentLine() { return currentLine; }
    public void setCurrentLine(int currentLine) { this.currentLine = currentLine; }

    public String getCompileError() { return compileError; }
    public void setCompileError(String compileError) { this.compileError = compileError; }

    public List<String> getAlgorithmTags() { return algorithmTags; }
    public void setAlgorithmTags(List<String> algorithmTags) { this.algorithmTags = algorithmTags; }

    public long getCreatedAtEpochMs() { return createdAtEpochMs; }
    public void setCreatedAtEpochMs(long createdAtEpochMs) { this.createdAtEpochMs = createdAtEpochMs; }

    public long getExpiresAtEpochMs() { return expiresAtEpochMs; }
    public void setExpiresAtEpochMs(long expiresAtEpochMs) { this.expiresAtEpochMs = expiresAtEpochMs; }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && ./mvnw test -Dtest=ExecutionSnapshotTest`
Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add backend/src/main/java/com/javatutor/model/ExecutionSnapshot.java backend/src/test/java/com/javatutor/model/ExecutionSnapshotTest.java
git commit -m "feat: add execution snapshot model"
```

---

### Task 2: 内存快照存储

**Files:**
- Create: `backend/src/main/java/com/javatutor/service/ExecutionSnapshotStore.java`
- Create: `backend/src/main/java/com/javatutor/service/InMemoryExecutionSnapshotStore.java`
- Test: `backend/src/test/java/com/javatutor/service/InMemoryExecutionSnapshotStoreTest.java`

**Interfaces:**
- Consumes: `ExecutionSnapshot`。
- Produces: `ExecutionSnapshotStore` 及 `InMemoryExecutionSnapshotStore`。

- [ ] **Step 1: Write failing tests**

创建 `InMemoryExecutionSnapshotStoreTest.java`：

```java
package com.javatutor.service;

import com.javatutor.model.ExecutionSnapshot;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

class InMemoryExecutionSnapshotStoreTest {

    private ExecutionSnapshot snapshot(String runId, long expiresAt) {
        ExecutionSnapshot snapshot = new ExecutionSnapshot();
        snapshot.setRunId(runId);
        snapshot.setSourceCode("public class A {}");
        snapshot.setSteps(List.of());
        snapshot.setCreatedAtEpochMs(0L);
        snapshot.setExpiresAtEpochMs(expiresAt);
        return snapshot;
    }

    @Test
    void saveAndFindByRunId() {
        InMemoryExecutionSnapshotStore store = new InMemoryExecutionSnapshotStore();
        store.save(snapshot("run-1", Long.MAX_VALUE));
        Optional<ExecutionSnapshot> found = store.findByRunId("run-1");
        assertTrue(found.isPresent());
        assertEquals("run-1", found.get().getRunId());
    }

    @Test
    void expiredSnapshotReturnsEmpty() {
        InMemoryExecutionSnapshotStore store = new InMemoryExecutionSnapshotStore();
        store.save(snapshot("run-1", System.currentTimeMillis() - 1000L));
        assertTrue(store.findByRunId("run-1").isEmpty());
    }

    @Test
    void updatePositionChangesCurrentStepAndLine() {
        InMemoryExecutionSnapshotStore store = new InMemoryExecutionSnapshotStore();
        store.save(snapshot("run-1", Long.MAX_VALUE));
        store.updatePosition("run-1", 3, 9);
        ExecutionSnapshot found = store.findByRunId("run-1").orElseThrow();
        assertEquals(3, found.getCurrentStepIndex());
        assertEquals(9, found.getCurrentLine());
    }

    @Test
    void evictExpiredRemovesOnlyExpired() {
        InMemoryExecutionSnapshotStore store = new InMemoryExecutionSnapshotStore();
        store.save(snapshot("expired", System.currentTimeMillis() - 1000L));
        store.save(snapshot("alive", Long.MAX_VALUE));
        store.evictExpired();
        assertTrue(store.findByRunId("expired").isEmpty());
        assertTrue(store.findByRunId("alive").isPresent());
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && ./mvnw test -Dtest=InMemoryExecutionSnapshotStoreTest`
Expected: FAIL，接口或实现不存在。

- [ ] **Step 3: Implement interface**

创建 `ExecutionSnapshotStore.java`：

```java
package com.javatutor.service;

import com.javatutor.model.ExecutionSnapshot;

import java.util.Optional;

public interface ExecutionSnapshotStore {
    void save(ExecutionSnapshot snapshot);
    Optional<ExecutionSnapshot> findByRunId(String runId);
    void updatePosition(String runId, int currentStepIndex, int currentLine);
    void evictExpired();
}
```

- [ ] **Step 4: Implement in-memory store**

创建 `InMemoryExecutionSnapshotStore.java`：

```java
package com.javatutor.service;

import com.javatutor.model.ExecutionSnapshot;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class InMemoryExecutionSnapshotStore implements ExecutionSnapshotStore {
    private static final long TTL_MS = 30 * 60 * 1000L;
    private final Map<String, ExecutionSnapshot> store = new ConcurrentHashMap<>();

    @Override
    public void save(ExecutionSnapshot snapshot) {
        long now = System.currentTimeMillis();
        snapshot.setCreatedAtEpochMs(now);
        snapshot.setExpiresAtEpochMs(now + TTL_MS);
        store.put(snapshot.getRunId(), snapshot);
        evictExpired();
    }

    @Override
    public Optional<ExecutionSnapshot> findByRunId(String runId) {
        ExecutionSnapshot snapshot = store.get(runId);
        if (snapshot == null) {
            return Optional.empty();
        }
        if (snapshot.getExpiresAtEpochMs() <= System.currentTimeMillis()) {
            store.remove(runId);
            return Optional.empty();
        }
        return Optional.of(snapshot);
    }

    @Override
    public void updatePosition(String runId, int currentStepIndex, int currentLine) {
        findByRunId(runId).ifPresent(snapshot -> {
            snapshot.setCurrentStepIndex(currentStepIndex);
            snapshot.setCurrentLine(currentLine);
        });
    }

    @Override
    public void evictExpired() {
        long now = System.currentTimeMillis();
        store.entrySet().removeIf(entry -> entry.getValue().getExpiresAtEpochMs() <= now);
    }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && ./mvnw test -Dtest=InMemoryExecutionSnapshotStoreTest`
Expected: PASS。

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/com/javatutor/service/ExecutionSnapshotStore.java backend/src/main/java/com/javatutor/service/InMemoryExecutionSnapshotStore.java backend/src/test/java/com/javatutor/service/InMemoryExecutionSnapshotStoreTest.java
git commit -m "feat: add in-memory execution snapshot store"
```

---

### Task 3: 内部查询 Controller 与 token 配置

**Files:**
- Create: `backend/src/main/java/com/javatutor/controller/ExecutionSnapshotController.java`
- Modify: `backend/src/main/resources/coze.properties`
- Test: `backend/src/test/java/com/javatutor/controller/ExecutionSnapshotControllerTest.java`

**Interfaces:**
- Consumes: `ExecutionSnapshotStore`, `ExecutionSnapshot`。
- Produces: `GET /api/agent/execution-context/{runId}`，请求头 `X-Agent-Token`。

- [ ] **Step 1: Write failing test**

创建 `ExecutionSnapshotControllerTest.java`：

```java
package com.javatutor.controller;

import com.javatutor.model.ExecutionSnapshot;
import com.javatutor.service.ExecutionSnapshotStore;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Optional;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(ExecutionSnapshotController.class)
@TestPropertySource(properties = "javatutor.agent.token=secret-token")
class ExecutionSnapshotControllerTest {

    @Autowired
    private MockMvc mvc;

    @MockBean
    private ExecutionSnapshotStore store;

    @Test
    void missingTokenReturns401() throws Exception {
        mvc.perform(get("/api/agent/execution-context/run-1"))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void wrongTokenReturns401() throws Exception {
        mvc.perform(get("/api/agent/execution-context/run-1")
                .header("X-Agent-Token", "wrong"))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void missingSnapshotReturns404() throws Exception {
        when(store.findByRunId("run-1")).thenReturn(Optional.empty());
        mvc.perform(get("/api/agent/execution-context/run-1")
                .header("X-Agent-Token", "secret-token"))
            .andExpect(status().isNotFound());
    }

    @Test
    void validSnapshotReturnsJson() throws Exception {
        ExecutionSnapshot snapshot = new ExecutionSnapshot();
        snapshot.setRunId("run-1");
        snapshot.setSourceCode("public class A {}");
        snapshot.setSteps(List.of());
        snapshot.setCurrentStepIndex(2);
        snapshot.setCurrentLine(5);
        snapshot.setCompileError("");
        snapshot.setAlgorithmTags(List.of("排序"));
        snapshot.setExpiresAtEpochMs(1784736000L);

        when(store.findByRunId("run-1")).thenReturn(Optional.of(snapshot));
        mvc.perform(get("/api/agent/execution-context/run-1")
                .header("X-Agent-Token", "secret-token"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.run_id").value("run-1"))
            .andExpect(jsonPath("$.source_code").value("public class A {}"))
            .andExpect(jsonPath("$.current_step_index").value(2))
            .andExpect(jsonPath("$.current_line").value(5))
            .andExpect(jsonPath("$.algorithm_tags[0]").value("排序"));
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && ./mvnw test -Dtest=ExecutionSnapshotControllerTest`
Expected: FAIL，Controller 不存在或配置项缺失。

- [ ] **Step 3: Add configuration**

在 `coze.properties` 末尾追加：

```properties
# Coze 侧拉取执行上下文的内部共享 token；真实值放本地环境变量或 coze-local.properties
javatutor.agent.token=${JAVATUTOR_AGENT_TOKEN:}
```

本地执行时，在 `backend/src/main/resources/coze-local.properties` 中添加真实值（该文件已在 gitignore 中）：

```properties
javatutor.agent.token=<local-only-secret>
```

- [ ] **Step 4: Implement controller**

创建 `ExecutionSnapshotController.java`：

```java
package com.javatutor.controller;

import com.javatutor.model.ExecutionSnapshot;
import com.javatutor.service.ExecutionSnapshotStore;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

@RestController
@RequestMapping("/api/agent")
public class ExecutionSnapshotController {

    private final ExecutionSnapshotStore store;
    private final String token;

    public ExecutionSnapshotController(
        ExecutionSnapshotStore store,
        @Value("${javatutor.agent.token:}") String token
    ) {
        this.store = store;
        this.token = token;
    }

    @GetMapping("/execution-context/{runId}")
    public ResponseEntity<?> getExecutionContext(
        @PathVariable String runId,
        @RequestHeader(value = "X-Agent-Token", required = false) String suppliedToken
    ) {
        if (token.isBlank() || !Objects.equals(token, suppliedToken)) {
            return ResponseEntity.status(401).body(Map.of("error", "unauthorized"));
        }
        return store.findByRunId(runId)
            .map(snapshot -> ResponseEntity.ok(toMap(snapshot)))
            .orElseGet(() -> ResponseEntity.status(404).body(Map.of("error", "not_found")));
    }

    private Map<String, Object> toMap(ExecutionSnapshot snapshot) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("run_id", snapshot.getRunId());
        out.put("source_code", snapshot.getSourceCode());
        out.put("steps", snapshot.getSteps() == null ? java.util.List.of() : snapshot.getSteps());
        out.put("current_step_index", snapshot.getCurrentStepIndex());
        out.put("current_line", snapshot.getCurrentLine());
        out.put("compile_error", snapshot.getCompileError() == null ? "" : snapshot.getCompileError());
        out.put("algorithm_tags", snapshot.getAlgorithmTags() == null ? java.util.List.of() : snapshot.getAlgorithmTags());
        out.put("expires_at", snapshot.getExpiresAtEpochMs());
        return out;
    }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && ./mvnw test -Dtest=ExecutionSnapshotControllerTest`
Expected: PASS。

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/com/javatutor/controller/ExecutionSnapshotController.java backend/src/main/resources/coze.properties backend/src/test/java/com/javatutor/controller/ExecutionSnapshotControllerTest.java
git commit -m "feat: expose authenticated execution snapshot endpoint"
```

---

### Task 4: 运行成功后保存快照

**Files:**
- Create: `backend/src/main/java/com/javatutor/service/ExecutionSnapshotService.java`
- Modify: `backend/src/main/java/com/javatutor/controller/RunController.java`
- Test: `backend/src/test/java/com/javatutor/service/ExecutionSnapshotServiceTest.java`

**Interfaces:**
- Consumes: `RunResponse`, `ExecutionSnapshotStore`。
- Produces: `ExecutionSnapshotService.saveRunSnapshot`、`updateChatSnapshot`。

- [ ] **Step 1: Write failing tests**

创建 `ExecutionSnapshotServiceTest.java`：

```java
package com.javatutor.service;

import com.javatutor.model.ExecutionSnapshot;
import com.javatutor.model.ExplainRequest;
import com.javatutor.model.RunResponse;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

class ExecutionSnapshotServiceTest {

    private static class FakeStore implements ExecutionSnapshotStore {
        ExecutionSnapshot saved;
        int updateCalls;

        @Override public void save(ExecutionSnapshot snapshot) { this.saved = snapshot; }
        @Override public Optional<ExecutionSnapshot> findByRunId(String runId) { return Optional.ofNullable(saved); }
        @Override public void updatePosition(String runId, int currentStepIndex, int currentLine) { updateCalls++; }
        @Override public void evictExpired() {}
    }

    @Test
    void saveRunSnapshotUsesResponseAndSourceCode() {
        FakeStore store = new FakeStore();
        ExecutionSnapshotService service = new ExecutionSnapshotService(store);
        List<Map<String, Object>> steps = List.of(Map.of("step", 0, "line", 3));
        RunResponse response = RunResponse.ok("run-1", steps, "out");

        service.saveRunSnapshot(response, "public class A {}", List.of("排序"));

        assertEquals("run-1", store.saved.getRunId());
        assertEquals("public class A {}", store.saved.getSourceCode());
        assertEquals(steps, store.saved.getSteps());
        assertEquals(0, store.saved.getCurrentStepIndex());
        assertEquals(3, store.saved.getCurrentLine());
        assertEquals(List.of("排序"), store.saved.getAlgorithmTags());
    }

    @Test
    void updateChatSnapshotUpdatesPositionAndContent() {
        FakeStore store = new FakeStore();
        ExecutionSnapshotService service = new ExecutionSnapshotService(store);
        ExecutionSnapshot existing = new ExecutionSnapshot();
        existing.setRunId("run-1");
        existing.setSourceCode("old");
        existing.setSteps(new ArrayList<>());
        store.saved = existing;

        ExplainRequest request = new ExplainRequest();
        request.setRunId("run-1");
        request.setStep(4);
        request.setCurrentLine(8);
        request.setCode("new");
        request.setSteps(List.of(Map.of("step", 4)));
        request.setAlgorithmTags(List.of("搜索"));

        service.updateChatSnapshot(request);

        assertEquals(1, store.updateCalls);
        assertEquals("new", existing.getSourceCode());
        assertEquals(1, existing.getSteps().size());
        assertEquals(List.of("搜索"), existing.getAlgorithmTags());
    }
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && ./mvnw test -Dtest=ExecutionSnapshotServiceTest`
Expected: FAIL，服务类不存在。

- [ ] **Step 3: Implement snapshot service**

创建 `ExecutionSnapshotService.java`：

```java
package com.javatutor.service;

import com.javatutor.model.ExecutionSnapshot;
import com.javatutor.model.ExplainRequest;
import com.javatutor.model.RunResponse;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class ExecutionSnapshotService {

    private final ExecutionSnapshotStore store;

    public ExecutionSnapshotService(ExecutionSnapshotStore store) {
        this.store = store;
    }

    public void saveRunSnapshot(RunResponse response, String sourceCode, List<String> algorithmTags) {
        if (response == null || !response.isSuccess() || response.getRunId() == null || response.getRunId().isBlank()) {
            return;
        }
        ExecutionSnapshot snapshot = new ExecutionSnapshot();
        snapshot.setRunId(response.getRunId());
        snapshot.setSourceCode(sourceCode == null ? "" : sourceCode);
        snapshot.setSteps(response.getSteps() == null ? List.of() : response.getSteps());
        snapshot.setCurrentStepIndex(0);
        snapshot.setCurrentLine(firstLine(response.getSteps()));
        snapshot.setCompileError("");
        snapshot.setAlgorithmTags(algorithmTags == null ? List.of() : algorithmTags);
        store.save(snapshot);
    }

    public void updateChatSnapshot(ExplainRequest request) {
        if (request == null || request.getRunId() == null || request.getRunId().isBlank()) {
            return;
        }
        Optional<ExecutionSnapshot> found = store.findByRunId(request.getRunId());
        if (found.isEmpty()) {
            return;
        }
        ExecutionSnapshot snapshot = found.get();
        store.updatePosition(request.getRunId(), request.getStep(), request.getCurrentLine());
        if (request.getSteps() != null) {
            snapshot.setSteps(request.getSteps());
        }
        if (request.getCode() != null && !request.getCode().isBlank()) {
            snapshot.setSourceCode(request.getCode());
        }
        if (request.getAlgorithmTags() != null) {
            snapshot.setAlgorithmTags(request.getAlgorithmTags());
        }
    }

    private int firstLine(List<Map<String, Object>> steps) {
        if (steps == null || steps.isEmpty()) {
            return 0;
        }
        Object line = steps.get(0).get("line");
        return line instanceof Number number ? number.intValue() : 0;
    }
}
```

- [ ] **Step 4: Inject service into `RunController` and save after success**

在 `RunController` 的字段区新增：

```java
    private final ExecutionSnapshotService executionSnapshotService;
```

新增构造器：

```java
    public RunController(ExecutionSnapshotService executionSnapshotService) {
        this.executionSnapshotService = executionSnapshotService;
    }
```

在 `run` 方法中，将：

```java
            return compileAndRun(sources, entryClassName, runId, methodName, methodSignature);
```

替换为：

```java
            RunResponse response = compileAndRun(sources, entryClassName, runId, methodName, methodSignature);
            executionSnapshotService.saveRunSnapshot(response, userCode, List.of());
            return response;
```

在 `runProject` 方法中，将：

```java
            RunResponse response = compileAndRun(sources, entryClassName, runId, null, null);
            // 附带入口类源码，供前端「流程/算法/动画/问答」沿用单文件接口
            response.setEntryClass(entryClassName);
            response.setEntryCode(nameToCode.get(entryClassName));
            return response;
```

替换为：

```java
            RunResponse response = compileAndRun(sources, entryClassName, runId, null, null);
            // 附带入口类源码，供前端「流程/算法/动画/问答」沿用单文件接口
            response.setEntryClass(entryClassName);
            response.setEntryCode(nameToCode.get(entryClassName));
            String snapshotCode = response.getEntryCode() != null && !response.getEntryCode().isBlank()
                ? response.getEntryCode() : request.getCode();
            executionSnapshotService.saveRunSnapshot(response, snapshotCode == null ? "" : snapshotCode, List.of());
            return response;
```

补充 import：

```java
import com.javatutor.service.ExecutionSnapshotService;
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && ./mvnw test -Dtest=ExecutionSnapshotServiceTest`
Expected: PASS。

- [ ] **Step 6: Commit**

```bash
git add backend/src/main/java/com/javatutor/service/ExecutionSnapshotService.java backend/src/main/java/com/javatutor/controller/RunController.java backend/src/test/java/com/javatutor/service/ExecutionSnapshotServiceTest.java
git commit -m "feat: save execution snapshot after successful run"
```

---

### Task 5: 问答更新快照并瘦身 Coze payload

**Files:**
- Modify: `backend/src/main/java/com/javatutor/controller/CozeAIController.java`
- Modify: `backend/src/main/java/com/javatutor/service/CozeService.java`
- Test: `backend/src/test/java/com/javatutor/service/CozeServicePayloadTest.java`

**Interfaces:**
- Consumes: `ExecutionSnapshotService`、`ExplainRequest`。
- Produces: 最小 `agentPayload` 构造方法 `buildAgentPayload`。

- [ ] **Step 1: Write failing test**

创建 `CozeServicePayloadTest.java`：

```java
package com.javatutor.service;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class CozeServicePayloadTest {

    @Test
    void withRunIdBuildsMinimalEnvelope() {
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
        assertFalse(payload.containsKey("source_code"));
        assertFalse(payload.containsKey("steps"));
        assertFalse(payload.containsKey("current_step_index"));
        assertFalse(payload.containsKey("current_line"));
        assertFalse(payload.containsKey("algorithm_tags"));
    }

    @Test
    void withoutRunIdBuildsLegacyEnvelope() {
        CozeService service = new CozeService();
        Map<String, Object> payload = service.buildAgentPayload(
            "public class A {}",
            List.of(Map.of("step", 0)),
            1,
            4,
            "x 怎么变了？",
            "",
            "session-1",
            null,
            List.of("排序"),
            null
        );

        assertEquals("public class A {}", payload.get("source_code"));
        assertEquals(List.of(Map.of("step", 0)), payload.get("steps"));
        assertEquals(1, payload.get("current_step_index"));
        assertEquals(4, payload.get("current_line"));
        assertEquals("session-1", payload.get("user_id"));
        assertEquals(List.of("排序"), payload.get("algorithm_tags"));
    }
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && ./mvnw test -Dtest=CozeServicePayloadTest`
Expected: FAIL，`buildAgentPayload` 不存在。

- [ ] **Step 3: Extract payload builder in `CozeService`**

在 `CozeService` 中新增包内可访问方法：

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
                                          String runId) {
        Map<String, Object> agentPayload = new LinkedHashMap<>();
        if (runId != null && !runId.isBlank()) {
            agentPayload.put("run_id", runId);
            agentPayload.put("session_id", sessionId != null ? sessionId : "");
            agentPayload.put("user_question", userQuestion != null ? userQuestion : "");
            agentPayload.put("intent", intent != null ? intent : "");
            agentPayload.put("compile_error", compileError != null ? compileError : "");
            return agentPayload;
        }

        agentPayload.put("source_code", sourceCode);
        agentPayload.put("steps", steps != null ? steps : List.of());
        agentPayload.put("current_step_index", currentStepIndex);
        agentPayload.put("current_line", currentLine);
        agentPayload.put("user_question", userQuestion != null ? userQuestion : "");
        agentPayload.put("user_id", sessionId != null ? sessionId : "");
        agentPayload.put("compile_error", compileError != null ? compileError : "");
        if (intent != null && !intent.isBlank()) {
            agentPayload.put("intent", intent);
        }
        if (algorithmTags != null && !algorithmTags.isEmpty()) {
            agentPayload.put("algorithm_tags", algorithmTags);
        }
        return agentPayload;
    }
```

- [ ] **Step 4: Update `streamExplain` signature and payload construction**

将 `streamExplain` 签名在 `algorithmTags` 后增加 `String runId`：

```java
    public void streamExplain(String sourceCode,
                               List<Map<String, Object>> steps,
                               int currentStepIndex,
                               int currentLine,
                               String userQuestion,
                               String compileError,
                               String sessionId,
                               String intent,
                               List<String> algorithmTags,
                               String runId,
                               Consumer<String> onChunk,
                               Consumer<String> onStage) throws Exception {
```

删除原来 `Map<String, Object> agentPayload = ...` 到 `if (algorithmTags...)` 之间的旧 payload 组装，改为：

```java
        Map<String, Object> agentPayload = buildAgentPayload(
            sourceCode,
            steps,
            currentStepIndex,
            currentLine,
            userQuestion,
            compileError,
            sessionId,
            intent,
            algorithmTags,
            runId
        );
```

更新 `blockingExplain` 和 `blockingExplainWithSteps` 内部的 `streamExplain` 调用，在 `algorithmTags` 参数后传入 `null`：

```java
        streamExplain(sourceCode, null, currentStepIndex, currentLine,
            userQuestion, null, sessionId, intent, null, null, sb::append, null);
```

```java
        streamExplain(sourceCode, steps, currentStepIndex, currentLine,
            userQuestion, null, sessionId, intent, algorithmTags, null, sb::append, null);
```

- [ ] **Step 5: Update `CozeAIController.chat`**

在 `CozeAIController` 构造器注入：

```java
    private final ExecutionSnapshotService executionSnapshotService;

    public CozeAIController(CozeService cozeService, AnalyzeService analyzeService, ExecutionSnapshotService executionSnapshotService) {
        this.cozeService = cozeService;
        this.analyzeService = analyzeService;
        this.executionSnapshotService = executionSnapshotService;
    }
```

在 `chat` 方法中，调用 `cozeService.streamExplain` 之前加入：

```java
                executionSnapshotService.updateChatSnapshot(request);
```

并在 `streamExplain` 调用的 `null, // no algorithmTags for chat` 后传入：

```java
                     request.getRunId(),
```

补充 import：

```java
import com.javatutor.service.ExecutionSnapshotService;
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd backend && ./mvnw test -Dtest=CozeServicePayloadTest`
Expected: PASS。

- [ ] **Step 7: Commit**

```bash
git add backend/src/main/java/com/javatutor/controller/CozeAIController.java backend/src/main/java/com/javatutor/service/CozeService.java backend/src/test/java/com/javatutor/service/CozeServicePayloadTest.java
git commit -m "feat: slim coze payload and update snapshot on chat"
```

---

### Task 6: 全量回归与手工联调

**Files:**
- 无新增代码文件。

- [ ] **Step 1: Run backend tests**

Run: `cd backend && ./mvnw test`
Expected: 全部通过，无回归。

- [ ] **Step 2: Run frontend checks**

Run: `cd frontend && npm test && npm run build`
Expected: 前端测试与构建通过。

- [ ] **Step 3: Start local backend and verify snapshot endpoint**

```bash
cd backend && ./mvnw spring-boot:run
```

另开终端，用实际 token 查询一个不存在的 runId：

```powershell
Invoke-WebRequest -Uri http://127.0.0.1:8080/api/agent/execution-context/not-found -Headers @{ 'X-Agent-Token' = '<local-token>' }
```

Expected: `404`。

- [ ] **Step 4: Browser integration check**

打开 `http://localhost:5173`，运行冒泡排序代码，然后点击“解释当前这一步”。确认：

- Coze 回答正常。
- 前端仍能流式展示最终回答。
- 无冗余 `source_code`/`steps` 从后端日志进入 Coze payload（可通过断点或临时日志观察）。

- [ ] **Step 5: Record devlog and review**

执行完成后按 `AGENTS.md` hook 撰写：

- `docs/devlog/2026-08-23-execution-snapshot-api.md`
- `docs/reviews/2026-08-23-execution-snapshot-api-review.md`

并在 `AGENTS.md` 登记。

---

## Self-Review

- Spec 覆盖：模型、store、Controller、token 鉴权、run 保存、chat 更新、Coze 瘦身、兼容旧 payload、TTL 与安全边界均已覆盖。
- 占位扫描：无 `TBD` / `TODO` / “适当处理”等空泛步骤。
- 类型一致性：`ExecutionSnapshot` 字段与 Controller 响应字段、`ExecutionSnapshotService` 读写字段一致；`CozeService` 新增参数按调用顺序对齐。
- 额外风险：`CozeServicePayloadTest` 通过包内访问 `buildAgentPayload`，测试必须位于 `com.javatutor.service` 包。
