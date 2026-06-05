# 未修复 Bug

## Bug 1: 线程泄漏 — `ExecutionException` 路径
**文件**: `src/main/java/com/javatutor/controller/RunController.java:94-101`

用户代码抛异常时，`future.get()` 抛出 `ExecutionException`，未被 `catch (TimeoutException)` 捕获，跳过了 `executor.shutdownNow()`，线程泄漏。

## Bug 2: 字节码查找兜底无效
**文件**: `src/main/java/com/javatutor/compiler/InMemoryCompiler.java:69`

`classFileMap` 的 key 全是短类名（`className` 不含包名），但第 69 行兜底用全限定名 `classFileMap.get(className)` 去查，永远返回 `null`。

## Bug 3: 插桩行号可能为 `null`
**文件**: `src/main/java/com/javatutor/instrumentation/Instrumenter.java:82`

`stmt.getBegin().map(pos -> pos.line).orElse(null)` — 位置信息缺失时 `line` 为 `null`，生成 `TraceEngine.record(1, null, ...)` 会导致编译失败。

## Bug 4: Controller 缺少 null 检查
**文件**: `src/main/java/com/javatutor/controller/RunController.java:46`

`request.getCode()` 未做 null 检查，空 body 会触发 `NullPointerException`。

## Bug 5: 插桩 "预知" 未声明变量 — ✅ 已修复（有单元测试验证）
**文件**: `src/main/java/com/javatutor/instrumentation/Instrumenter.java:148-213`

`collectVisibleVariables()` 在循环外一次性 `findAll`，把整个 block 里所有变量（含后面才声明的）全扫出来。多变量代码如 `int a=1; int b=2; a=a+b;` 执行到第一条语句时就会生成引用 `b` 的 record 调用，但 `b` 还没声明，编译失败。

**修复（两处改动）**：
1. `collectVisibleVariables` 增加 `beforeStmtIndex` 参数，当前 block 只扫描索引 ≤ 当前语句的变量声明
2. 父级 BlockStmt 遍历不再用 `findAll` 全量扫，改为通过 `findChildIndex()` 定位当前子节点在父级中的位置，只扫描 ≤ 该索引的语句中的变量。对于非 BlockStmt 父级（ForStmt 等），用 `collectDirectVariables` 跳过嵌套 BlockStmt 内部变量

**测试**: `InstrumenterTest.java` — 冒泡排序全链路 + 深层嵌套不泄露，两个场景均通过

---

# TODO

## 多文件支持 — 前后端联动

**现状**：`InMemoryCompiler.compile(Map<String, String>)` 支持多文件编译（TraceEngine + 用户代码），但 API 只接收单个 `code` 字段，前端也只有一个编辑器框。

**方案**：
- **后端**：`RunRequest` 中 `String code` → `Map<String, String> files`，`RunController` 遍历 entries 送入 compiler
- **前端**：多 tab 切换编辑器，每个 tab 对应一个 `.java` 文件，运行前合并成一个 `files` JSON 发请求
