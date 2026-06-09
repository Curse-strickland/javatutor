# 2026-06-08 AST Bugs 修复

## 背景

依据 `docs/AST_BUGS.md` 中的 6 个未修复 bug，逐条修复。均属后端改进，不涉及前端或沙箱策略变更。

## Step 1: Bug 1 (高) — ExecutionException 线程泄漏

**文件**: `RunController.java:115-137`

**问题**: ExecutorService 在 SecurityManager try 块内创建，`future.get()` 抛 ExecutionException 时 `executor.shutdownNow()` 被跳过。`Executors.newSingleThreadExecutor()` 默认 keep-alive 60s，非 daemon 线程不自动回收。

**修复**: 将 executor 的创建/关闭拆为独立 try-finally 层，与 SM try-finally 分离。任何路径（正常返回/TimeoutException/ExecutionException）都保证 `executor.shutdownNow()` 执行。

**连带修复**: Bug 8 (SM try-finally 范围过大) 自然解决 — executor 移出后 SM 块仅包裹实际需要 SM 保护的代码。

**验证**: 
- `int[] a = null; a[0] = 1;` → 正确返回错误（不再挂起/泄漏）
- 冒泡排序正常运行

## Step 2: Bug 4 (中) — Controller 缺少 getCode() null 检查

**文件**: `RunController.java:74`

**修复**: L74 后增加 `userCode == null || userCode.isBlank()` 检查，返回"代码不能为空"。

**验证**:
- curl 发 `{}` → "代码不能为空"
- curl 发 `{"code":""}` → "代码不能为空"
- 冒泡排序正常运行

## Step 3: Bug 3 (低) — 插桩行号 null NPE

**文件**: `Instrumenter.java:85`

**修复**: `orElse(null)` → `orElse(-1)`。int 不能装 null，auto-unboxing 会 NPE。

**验证**: 编译通过，冒泡排序正常运行（JavaParser 实际始终提供位置信息，此改动纯防御）。

## Step 4: Bug 2 (低) — 字节码查找兜底死代码

**文件**: `InMemoryCompiler.java:65-69`

**修复**: 删除 `classFileMap.get(className)` 兜底行。classFileMap key 全为短名，该行永远返回 null。

**验证**: 编译通过，冒泡排序正常运行。

## Step 5: Bug 9 (中) — 编译错误英文汉化

**文件**: `InMemoryCompiler.java:80-84 + 新增 translateError()`

**修复**: 
- 错误遍历循环中调用 `translateError()` 做常见英文 → 中文映射（6 条）
- "Compilation failed" → "编译失败"
- JDK 17 在中文 Windows 下原生输出中文错误，此映射作为英文系统兜底

**验证**:
- `int x = unknownVar;` → "找不到符号"
- `int x = "hello";` → "不兼容的类型"
- 冒泡排序正常运行

## 影响范围

| 文件 | 改动行 | 类型 |
|------|--------|------|
| RunController.java | L74-76 (新增), L115-142 (重构) | 重排 executor 生命周期 + null 检查 |
| Instrumenter.java | L85 | 一行改动 |
| InMemoryCompiler.java | L65, L80-84, L96-107 | 删死代码 + 加翻译 |

全部改动均不影响沙箱策略、AST 插桩逻辑、前后端通信契约。

## 回归验证

- [x] A1 冒泡排序正常运行
- [x] 沙箱拦截（B-G 组）全部通过
- [x] 运行时异常正确返回错误信息
- [x] 空代码正确提示
- [x] 编译错误中文显示

---

## 补充修复（2026-06-08 第二轮）根据 reviews/ast-review.md

### T-1: 测试断言过时

**文件**: `InstrumenterTest.java:219-240`

Bug 1/7 修复后退出 record 已不存在，`linesWithEnter.retainAll(linesWithExit)` 交集为空，原 `assertFalse(isEmpty)` 期望 Bug 存在导致测试失败。

**修复**: 翻转断言为 `assertTrue(!isEmpty)` 验证 entry record 存在即可。

### I-1: 嵌套非块体循环内层未插桩

**文件**: `Instrumenter.java:103-172`

外层循环体不是 `{...}` 时，内层循环被包入新 BlockStmt 后未递归处理。

**修复**: ForStmt/ForEachStmt/WhileStmt/DoStmt 四个非块体分支创建 newBody 后统一加 `newBody = (BlockStmt) super.visit(newBody, null)`。

### I-2: Map.of() 10 对 KV 上限

**文件**: `Instrumenter.java:230`, `TraceEngine.java`, `RunController.java:66-70`

可见变量超过 10 个时 `Map.of(k1,v1,...,k11,v11)` 无匹配重载。

**修复**: TraceEngine 新增 `buildMap(Object... pairs)` 变长参数方法，Instrumenter 生成代码改用 `TraceEngine.buildMap(new Object[]{...})`。RunController 硬编码 TraceEngine 源码 + InstrumenterTest 独立副本同步更新。

### I-3: ++/-- 不被插桩

**文件**: `Instrumenter.java:253-258`

`i++` / `i--` 的 UnaryExpr 在 shouldInstrument 中返回 false。

**修复**: 增加 UnaryExpr PREFIX/POSTFIX_INCREMENT/DECREMENT 四类运算符检测。

### I-4: stepCounter 线程安全

**文件**: `Instrumenter.java:16, 42, 218-236`

`stepCounter` 是实例字段，Spring 单例下多请求可能互相覆盖。

**修复**: 移除实例字段，改为 `instrument()` 内局部 `int[] counter = {1}`，通过闭包传入 `buildRecordStatement(line, vars, counter)`。

### I-5: ForEach 非块体缺少 collectDirectVariables

**文件**: `Instrumenter.java:125-129`

**修复**: 随 I-1 修改时已补上，与 ForStmt/WhileStmt/DoStmt 对齐。

## 第二轮回归验证

- [x] `mvn clean test` — 3/3 通过
- [x] `test-sandbox.py` — 27/27 通过
- [x] A1 冒泡排序正常运行
