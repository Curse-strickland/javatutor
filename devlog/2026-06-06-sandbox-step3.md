# 2026-06-06 安全沙箱 Step 3: 运行时 SecurityManager

## 工作概述

在 Step 1/2 的 AST 静态检查之上，增加了运行时动态拦截层。无论用户代码通过什么方式绕过 AST 检查（全限定名、反射包装等），SecurityManager 都能在 JVM 层面兜底拦截。

## 新增文件

### `backend/src/main/java/com/javatutor/sandbox/SafeSecurityManager.java`

继承 `SecurityManager`，拦截以下操作：

| 操作 | checkXxx 方法 | 行为 |
|------|--------------|------|
| 执行外部命令 | `checkExec` | 直接抛 SecurityException |
| 写入文件 | `checkWrite` | 直接抛 SecurityException |
| 删除文件 | `checkDelete` | 直接抛 SecurityException |
| 读取文件 | `checkRead` | 仅拦截文件系统路径（不拦截类加载内部路径） |
| 网络连接 | `checkConnect` | 直接抛 SecurityException |
| 监听端口 | `checkListen` | 直接抛 SecurityException |
| 接受连接 | `checkAccept` | 直接抛 SecurityException |
| System.exit(n) | `checkExit` | 仅放行 exit(0)，拒绝非零状态码 |

**文件读取白名单策略：** `checkRead` 不搞全局阻断，而是用 `looksLikeFilePath()` 判断是否像真实文件路径（盘符开头 / Unix 绝对路径 / 带扩展名的相对路径），避免影响 Java 标准库的类加载。

## RunController 改动

**关键设计：try-finally 保证安全**

```java
SecurityManager originalSM = System.getSecurityManager();
System.setSecurityManager(new SafeSecurityManager());
try {
    // 执行用户代码（5秒超时）
} finally {
    System.setSecurityManager(originalSM);  // 无论如何恢复
}
```

- SecurityManager 在 `TraceEngine.reset()` 之后安装
- 执行完毕（无论成功/超时/异常），`finally` 块保证恢复原管理器
- 初始 `originalSM` 为 `null`（Spring Boot 默认不设），恢复后就是 `null`

## pom.xml 改动

**问题：** Java 17 默认禁止安装 SecurityManager。不加参数的话 `System.setSecurityManager()` 会抛 `UnsupportedOperationException`。

**修复：** 在 `spring-boot-maven-plugin` 配置中加入：

```xml
<configuration>
    <jvmArguments>-Djava.security.manager=allow</jvmArguments>
</configuration>
```

## 当前三层防护架构

```
用户代码
  │
  ▼
① AST 静态扫描 (SandboxValidator)
  ├─ import 白名单: 只允许 java.util / java.lang / java.math / java.text
  ├─ 方法调用黑名单: System.exit, Runtime.exec, Class.forName, 反射
  └─ 类型黑名单: FileInputStream, Socket, ProcessBuilder, Thread...
  │
  ▼
② AST 插桩 + 编译 + 加载
  │
  ▼
③ 运行时 SecurityManager (SafeSecurityManager)  ← 本次新增
  ├─ 文件读写/删除 → SecurityException
  ├─ 网络连接/监听 → SecurityException
  ├─ 外部命令执行 → SecurityException
  └─ System.exit(n) → 仅允许 n=0
```

## 验证方法

| 测试用例 | 预期结果 |
|----------|----------|
| 冒泡排序默认代码 | 正常运行 |
| `new java.io.FileWriter("a.txt")` | SecurityManager 拦截（不是 AST 拦的） |
| `System.exit(1)` | SecurityException |
| `System.exit(0)` | 正常终止（放行） |

## 注意事项

- SecurityManager 在 Java 17 标记为 deprecated，但在 Java 21/24 中仍可工作。若未来 JDK 彻底移除，需改为 Java Agent 或进程级隔离。
- 该 SecurityManager 是 JVM 级单例，因此必须 try-finally 恢复。如果在多用户并发场景需加锁保护，当前单线程执行无需加锁。
- `checkRead` 的判断逻辑比较粗（文件扩展名匹配），仍可能漏掉一些绕过方式。后续可考虑直接白名单放行已知类加载路径。

## 新增/修改文件

| 文件 | 类型 | 说明 |
|------|------|------|
| `backend/src/main/java/com/javatutor/sandbox/SafeSecurityManager.java` | 新建 | 运行时 SecurityManager（102 行） |
| `backend/src/main/java/com/javatutor/controller/RunController.java` | 修改 | 安装/恢复 SecurityManager，优化超时报错 |
| `backend/pom.xml` | 修改 | 加 `-Djava.security.manager=allow` |
