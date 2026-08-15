# 安全沙箱代码审查

## [致命] java.lang.System.exit(0) 可绕过 AST 检测并终止 JVM

**文件**: `backend/src/main/java/com/javatutor/sandbox/SandboxValidator.java`
**行号**: 154-155, 177-181
**文件**: `backend/src/main/java/com/javatutor/sandbox/SafeSecurityManager.java`
**行号**: 92-95

**原因**: `isStaticCall` 仅匹配作用域名 `"System"`（短名），全限定名 `java.lang.System.exit(0)` 被解析为作用域名 `"java.lang.System"`，匹配失败 → 绕过 AST 层。`SafeSecurityManager.checkExit` 放行 status=0 → JVM 进程终止。

**修复**: 二选一（推荐同时做）——

方案 A — 修改 `SafeSecurityManager.java`，`checkExit` 一律拒绝：
```java
// SafeSecurityManager.java L92-95: 改为
@Override
public void checkExit(int status) {
    throw new SecurityException("沙箱: 不允许调用 System.exit(" + status + ")");
}
```

方案 B — 修改 `SandboxValidator.java`，`isStaticCall` 增加全限定名结尾匹配：
```java
// SandboxValidator.java L177-181: 改为
private static boolean isStaticCall(MethodCallExpr call, String className, String methodName) {
    if (!methodName.equals(call.getNameAsString())) return false;
    return call.getScope()
        .filter(scope -> scope.isNameExpr() &&
            (className.equals(scope.asNameExpr().getNameAsString()) ||
             scope.asNameExpr().getNameAsString().endsWith("." + className)))
        .isPresent();
}
```

---

## [重要] 反射方法名黑名单过于宽泛，误拦用户自定义方法

**文件**: `backend/src/main/java/com/javatutor/sandbox/SandboxValidator.java`
**行号**: 169-173

**原因**: 在不检查目标对象类型的情况下，拦截所有名为 `invoke`、`setAccessible`、`getDeclaredMethod`、`getDeclaredField`、`getDeclaredConstructor`、`newInstance` 的方法调用。用户若自定义同名方法会被误拦，且错误提示误导为"反射操作"。

**修复**: 缩小匹配范围，仅当调用目标为反射相关类型时才拦截：
```java
// SandboxValidator.java L168-173: 改为
if ("invoke".equals(methodName) && isCallOnReflectType(call)) {
    violations.add("不能使用反射: invoke() — 反射操作不允许执行");
}
if ("setAccessible".equals(methodName) && isCallOnReflectType(call)) {
    violations.add("不能使用反射: setAccessible() — 反射操作不允许执行");
}
if ("getDeclaredMethod".equals(methodName) || "getDeclaredField".equals(methodName)
    || "getDeclaredConstructor".equals(methodName)) {
    violations.add("不能使用反射: " + methodName + "() — 反射操作不允许执行");
}
if ("newInstance".equals(methodName) && isCallOnClassType(call)) {
    violations.add("不能使用反射: newInstance() — 反射操作不允许执行");
}
```

新增辅助方法（加在 `SandboxValidator.java` 末尾）：
```java
/** 检查调用目标是否为反射相关类型 (Method/Field/Constructor) */
private static boolean isCallOnReflectType(MethodCallExpr call) {
    return call.getScope()
        .filter(scope -> scope.isNameExpr())
        .map(scope -> scope.asNameExpr().getNameAsString())
        .filter(name -> name.equals("m") || name.equals("method") || name.equals("f") || name.equals("field")
            || name.equals("c") || name.equals("constructor") || name.equals("getDeclaredMethod")
            || name.equals("getDeclaredField") || name.equals("getDeclaredConstructor")
            || name.equals("getMethod") || name.equals("getField") || name.equals("getConstructor"))
        .isPresent() || call.getScope()
        .filter(scope -> scope instanceof MethodCallExpr)
        .map(scope -> {
            MethodCallExpr s = (MethodCallExpr) scope;
            String n = s.getNameAsString();
            return n.equals("getDeclaredMethod") || n.equals("getDeclaredField")
                || n.equals("getDeclaredConstructor") || n.equals("getMethod")
                || n.equals("getField") || n.equals("getConstructor");
        })
        .orElse(false);
}

/** 检查调用目标是否为 Class 类型（用于 newInstance） */
private static boolean isCallOnClassType(MethodCallExpr call) {
    return call.getScope()
        .filter(scope -> scope.isNameExpr() && scope.asNameExpr().getNameAsString().endsWith(".class"))
        .isPresent();
}
```

---

## [中等] 多个 AST 检测存在全限定名绕过（通用问题）

**文件**: `backend/src/main/java/com/javatutor/sandbox/SandboxValidator.java`
**行号**: 184-192

**原因**: `isCallOnRuntime` 也只匹配短名 `"Runtime"`，`java.lang.Runtime.getRuntime().exec(...)` 可绕过 AST 检测。

**修复**: `isCallOnRuntime` 增加全限定名结尾匹配：
```java
// SandboxValidator.java L184-192: 改为
private static boolean isCallOnRuntime(MethodCallExpr call) {
    Expression scope = call.getScope().orElse(null);
    if (!(scope instanceof MethodCallExpr)) return false;
    MethodCallExpr scopeCall = (MethodCallExpr) scope;
    if (!"getRuntime".equals(scopeCall.getNameAsString())) return false;
    return scopeCall.getScope().isPresent()
        && scopeCall.getScope().get().isNameExpr()
        && (scopeCall.getScope().get().asNameExpr().getNameAsString().equals("Runtime")
            || scopeCall.getScope().get().asNameExpr().getNameAsString().endsWith(".Runtime"));
}
```

---

## [中等] java.nio.file.Files 未加入类型黑名单

**文件**: `backend/src/main/java/com/javatutor/sandbox/SandboxValidator.java`
**行号**: 36-46

**原因**: 类型黑名单仅覆盖旧式 `java.io.*` 类，遗漏现代 NIO 文件 API（`Files`、`Path`、`Paths`）。`Files.readAllBytes()` 可穿透 AST 层且 SecurityManager 的 `checkRead` 完全放行。

**修复**: FORBIDDEN_TYPES 追加：
```java
// SandboxValidator.java L36-46: FORBIDDEN_TYPES 追加以下类型
"Files", "Path", "Paths",
```

---

## [中等] ExecutorService / ForkJoinPool 绕过线程创建限制

**文件**: `backend/src/main/java/com/javatutor/sandbox/SandboxValidator.java`
**行号**: 26-28, 36-46

**原因**: `java.util.concurrent` 作为 `java.util` 子包通过 import 白名单，`ExecutorService`、`ForkJoinPool`、`Executors` 均未在黑名单，可自由创建线程池。

**修复**: FORBIDDEN_TYPES 追加线程池类型：
```java
// SandboxValidator.java: FORBIDDEN_TYPES 追加
"ExecutorService", "ScheduledExecutorService", "ForkJoinPool", "Executors",
```

---

## [低] 注释位置错位

**文件**: `backend/src/main/java/com/javatutor/sandbox/SandboxValidator.java`
**行号**: 24

**当前**:
```java
    // 禁止实例化的危险类型（检查 new XXX() 调用）
    // 只允许导入这些包（含子包，如 java.util.concurrent 也放行）
    private static final Set<String> ALLOWED_IMPORT_PREFIXES = Set.of(
```

**修复**: 将 `// 禁止实例化的危险类型...` 移至 `FORBIDDEN_TYPES` 定义前（约 L36）：
```java
    private static final Set<String> BLOCKED_IMPORT_PREFIXES = Set.of(
        "java.lang.reflect", "java.lang.invoke", "java.lang.management",
        "java.lang.ref", "java.lang.module"
    );

    // 禁止实例化的危险类型（检查 new XXX() 调用）
    private static final Set<String> FORBIDDEN_TYPES = Set.of(
```

---

## 修复优先级建议

1. **立即修复**: `java.lang.System.exit(0)` 绕过（方案 A 最简，1 行改动）
2. **尽快修复**: 全限定名绕过通用问题（改 `isStaticCall` + `isCallOnRuntime`）
3. **可在下一轮**: 反射误拦、NIO 黑名单补全、线程池限制
4. **可选**: 注释位置调整
