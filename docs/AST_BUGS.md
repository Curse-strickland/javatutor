# AST 插桩 & 控制器 Bug 审查

> 上次审查: 2026-06-08 | 最后修复: 2026-06-08

## 审查结论

全部 9 个 Bug 已修复：

| 编号 | 简述 | 状态 |
|------|------|------|
| Bug 1 | ExecutionException 线程泄漏 | ✅ 已修复 |
| Bug 2 | 字节码兜底无效 | ✅ 已修复（删死代码） |
| Bug 3 | 行号 null NPE | ✅ 已修复（防御性 orElse(-1)） |
| Bug 4 | getCode() null 检查缺失 | ✅ 已修复 |
| Bug 5 | 插桩预知未声明变量 | ✅ 已修复 |
| Bug 6 | return 后不可达代码 | ✅ 已修复 |
| Bug 7 | 无限循环 OOM | ✅ 已修复 |
| Bug 8 | SM try-finally 范围过大 | ✅ 已修复（随 Bug 1 重构自然解决） |
| Bug 9 | 编译错误英文未汉化 | ✅ 已修复（翻译映射 + JDK 中文 locale） |

> 修复详情见 `devlog/2026-06-08-ast-bugs-fix.md`

---

## 已修复

### Bug 5: 插桩"预知"未声明变量 ✅

**根因**: `collectVisibleVariables()` 原用 `findAll` 一次性扫出整个 block 内所有变量，导致在第一条语句处就引用后面才声明的变量（如 `int a=1; int b=2; a=a+b;` 执行到第一行就引用 `b`）。

**修复**: `collectVisibleVariables` 增加 `beforeStmtIndex` 参数，只扫 ≤ 当前索引的语句。父级 BlockStmt 遍历通过 `findChildIndex()` 定位，非 BlockStmt 父级用 `collectDirectVariables` 跳过嵌套块内部变量。

**验证**: `InstrumenterTest.java` — 冒泡排序全链路 + 深层嵌套，均通过。

---

### Bug 6: return 语句后插桩导致不可达代码 ✅

**根因**: `Instrumenter.java:183-186` 原逻辑对所有非控制流语句（含 `return`）在语句**之后**插入 `TraceEngine.record()`，编译报错"无法访问的语句"。复现：A2 斐波那契 `if (n <= 1) return n;`。

**修复**: `return` 语句单独处理 — record 调用插入到 `return` **之前**（`Instrumenter.java:183-185`）。

**验证**: 脚本测试 A2 全链路通过。

---

### Bug 7: 无限循环导致 OOM ✅

**根因**: `while(true){}` 体内 `record()` 被无限调用，超过 5s 超时后 `future.cancel(true)` 无法中断纯 CPU 循环，`steps` 列表持续增长直到 OOM。

**修复**: 两处改动——
1. TraceEngine 增加 `volatile boolean disabled` 标志 + `disable()` 方法，超时后反射调用 `disable()` 停止记录
2. 移除循环（for/while/do）退出时的 record 插入（`Instrumenter.java:172-181` 整块删除），避免无限循环时退出记录成为不可达代码

**验证**: 脚本测试 F1 通过（6.4s 返回超时，不再 OOM）。

---

## 已验证 — 实际存在

### Bug 1: ExecutionException 路径线程泄漏

**文件**: `RunController.java:127-134`

**确认**: 存在。

`future.get(5, TimeUnit.SECONDS)` 抛出 `ExecutionException`（用户代码抛异常）时：
- 不被 `catch (TimeoutException e)` 捕获
- 跳过第 134 行 `executor.shutdownNow()`
- `finally` 只恢复 SecurityManager，不关 executor
- 外层 `catch (Exception e)` (L149) 捕获异常并返回错误，但 executor 线程池核心线程保持 alive

`Executors.newSingleThreadExecutor()` 创建的线程池默认 keep-alive 60s，非 daemon 线程。高频调用可能导致线程累积。

**修复方案**:
```java
// RunController.java L115-137: executor 生命周期独立出 finally
ExecutorService executor = Executors.newSingleThreadExecutor();
try {
    Future<?> future = executor.submit(...);
    try {
        future.get(5, TimeUnit.SECONDS);
    } catch (TimeoutException e) {
        traceEngineClass.getMethod("disable").invoke(null);
        future.cancel(true);
        return RunResponse.fail("运行超时（超过5秒）");
    }
} finally {
    executor.shutdownNow();
}
```

---

### Bug 2: 字节码查找兜底无效（低优先级）

**文件**: `InMemoryCompiler.java:69`

**确认**: 存在，但当前不会触发。

`classFileMap` 的 key 是短类名（"TraceEngine"、"UserCode"）。`getJavaFileForOutput` 的 `className` 参数对于默认包类就是短名，第 65 行 `classFileMap.get(shortName)` 始终能匹配。第 69 行兜底 `classFileMap.get(className)` 用全限定名查短名 key，永远返回 null。

这条路只在编译器报告了含包名的类名时才会走到，但当前所有类都在默认包。**不是 active bug，是死代码**。

**建议**: 保留兜底但把 key 改成全限定名，或直接删掉注释误导。

---

### Bug 3: 插桩行号可能为 null（低优先级）

**文件**: `Instrumenter.java:77`

**确认**: 存在，但实际几乎不触发。

```java
int line = stmt.getBegin().map(pos -> pos.line).orElse(null);
```

`int` 不能装 null，若 `getBegin()` 返回 `Optional.empty()`，`orElse(null)` 返回 null 后 auto-unboxing 抛 NPE。但 JavaParser 对解析得到的 AST 始终提供位置信息，只有程序化构造的 AST 才可能缺失。

**建议**: 防御性改为 `orElse(-1)` 或 `Integer line`。

---

### Bug 4: Controller 缺少 getCode() null 检查

**文件**: `RunController.java:74`

**确认**: 存在。前端发 `{}` 时 `request.getCode()` 返回 null，随后 `SandboxValidator.validate(null)` 抛 JavaParser 解析异常，被外层 catch 捕获后返回无意义的错误信息（如"代码格式错误：缺少 public class 声明"）。

**修复**: 在第 74 行后加：
```java
if (userCode == null || userCode.isBlank()) {
    return RunResponse.fail("代码不能为空");
}
```

---

## 补充发现（不在原始清单）

### Bug 8: SecurityManager try-finally 范围过大

**文件**: `RunController.java:114-137`

执行器的创建/超时处理被包在 SecurityManager 的 try-finally 内，职责混淆。如果未来超时处理逻辑变复杂（如重试、降级），SecurityManager 的安装/卸载窗口会随之膨胀。建议拆为两个独立的 try-finally 块，各自管各自的事。

---

### Bug 9: 编译错误信息未去噪

**文件**: `InMemoryCompiler.java:84-88`

`diagnostics.getDiagnostics()` 原始输出包含编译器内部格式（类名、位置编码），对教学用户不友好。例如 Java 语法错误 `int x = ;` 直接暴露出 `';' expected` 这种英文编译错误，中文用户可能看不懂。

**建议**: 对常见编译错误做中文映射（至少 map 3-5 个最常见的）。

---

## 汇总

| 编号 | 简述 | 状态 | 优先级 |
|------|------|------|--------|
| Bug 1 | ExecutionException 线程泄漏 | 待修复 | 高 |
| Bug 2 | 字节码兜底无效（死代码） | 待清理 | 低 |
| Bug 3 | 行号 null NPE | 待加固 | 低 |
| Bug 4 | getCode() null 检查缺失 | 待修复 | 中 |
| Bug 5 | 插桩预知未声明变量 | ✅ 已修复 | — |
| Bug 6 | return 后不可达代码 | ✅ 已修复 | — |
| Bug 7 | 无限循环 OOM | ✅ 已修复 | — |
| Bug 8 | SM try-finally 范围过大 | 待优化 | 低 |
| Bug 9 | 编译错误英文未汉化 | 待改进 | 中 |
