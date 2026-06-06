# 安全沙箱设计方案

## 设计目标

JavaTutor 允许用户在浏览器中编写任意 Java 代码并在服务器端编译执行。安全沙箱的目标是：**用户代码只能做算法计算，不能访问文件系统、网络、外部进程，也不能破坏服务器 JVM 或干扰其他用户。**

## 分层架构

三层纵深防御，前层漏了后层接：

```
用户代码
  │
  ▼
┌─────────────────────────────────────────────┐
│ 第一层：AST 静态扫描 (SandboxValidator)        │
│ 时机：插桩前，编译前                            │
│ 方式：JavaParser 解析 AST，扫描 import/调用/类型  │
│ ├─ import 白名单：java.util, java.lang, ...   │
│ ├─ 方法调用黑名单：System.exit, Runtime.exec... │
│ └─ 类型实例化黑名单：FileWriter, Socket...      │
└─────────────────────────────────────────────┘
  │ 通过
  ▼
┌─────────────────────────────────────────────┐
│ 第二层：编译阶段 (InMemoryCompiler)             │
│ 方式：javax.tools.JavaCompiler 内存编译         │
│ 天然隔离：代码只在内存中编译，不写磁盘             │
└─────────────────────────────────────────────┘
  │ 通过
  ▼
┌─────────────────────────────────────────────┐
│ 第三层：运行时 SecurityManager                │
│ 时机：main() 执行期间                         │
│ 方式：继承 SecurityManager，重写 checkXxx()     │
│ ├─ 文件：checkWrite/checkDelete 全部拒绝       │
│ ├─ 文件：checkRead 仅拦文件路径，不拦类加载       │
│ ├─ 网络：checkConnect/checkListen 全部拒绝      │
│ ├─ 进程：checkExec 全部拒绝                    │
│ └─ 退出：checkExit 仅放行 exit(0)              │
│ 恢复：finally 块保证执行完毕卸载                 │
└─────────────────────────────────────────────┘
  │ 通过
  ▼
┌─────────────────────────────────────────────┐
│ 第四层：线程隔离 + 超时 (RunController)         │
│ 方式：单线程 ExecutorService + 5 秒超时         │
│ 超时处理：强杀线程，关闭执行器                   │
└─────────────────────────────────────────────┘
```

## 第一层细节：AST 静态扫描

**文件**：`backend/src/main/java/com/javatutor/sandbox/SandboxValidator.java`

### import 白名单

只允许导入以下包：
- `java.util`（含 `java.util.concurrent`, `java.util.stream` 等子包）
- `java.lang`（含 `java.lang.reflect.Array`）
- `java.math`
- `java.text`

其余如 `java.io`, `java.net`, `java.lang.reflect`, `java.nio`, `javax` 一律拒绝。

### import 位置检查

import 的行号必须小于第一个类型声明的行号。如果 import 出现在类体内或文件末尾，返回"import 必须写在文件顶部"而非"不允许导入"，避免语法错误和沙箱拦截混淆。

### 方法调用黑名单

| 调用形态 | AST 匹配方式 | 拦截原因 |
|----------|-------------|----------|
| `System.exit(n)` | `isStaticCall("System", "exit")` | 直接终止 JVM |
| `Runtime.getRuntime().exec(cmd)` | 方法链匹配 | 执行系统命令 |
| `Class.forName(name)` | `isStaticCall("Class", "forName")` | 动态加载类 |
| `Method.invoke()`, `Field.setAccessible()` 等 6 种 | 方法名匹配 | 反射操作 |

### 类型实例化黑名单

检查所有 `new XXX()` 表达式，拒绝以下短名：

| 类别 | 类型 |
|------|------|
| 文件 I/O | `FileInputStream`, `FileOutputStream`, `FileReader`, `FileWriter`, `RandomAccessFile` |
| 网络 | `Socket`, `ServerSocket` |
| 进程 | `ProcessBuilder` |
| 线程 | `Thread`, `ThreadGroup` |

### 已知局限

- 检查短名而非全限定名。`new java.io.FileWriter(...)` 被 ASF 解析后 `getType().getNameAsString()` 返回短名 `FileWriter`，能拦截。但如果类继承自黑名单类型则无法识别。
- 不检查 import 的类是否被实际使用，只检查 import 声明本身。

## 第三层细节：运行时 SecurityManager

**文件**：`backend/src/main/java/com/javatutor/sandbox/SafeSecurityManager.java`

### 安装与卸载

```java
SecurityManager originalSM = System.getSecurityManager();
System.setSecurityManager(new SafeSecurityManager());
try {
    // 执行用户代码
} finally {
    System.setSecurityManager(originalSM);  // 保证恢复
}
```

### checkRead 的白名单策略

不搞全局阻断，用 `looksLikeFilePath()` 区分文件系统路径和类加载内部路径：

- **拦截**：Windows 盘符路径 (`C:\...`)、Unix 绝对路径 (`/home/...`)、带扩展名的相对路径
- **放行**：`java.*` 和 `jdk.*` 开头的路径、不含 `.` 的短路径

### Java 版本兼容

- Java 17 默认禁用 `System.setSecurityManager()`，需 JVM 参数 `-Djava.security.manager=allow`
- `pom.xml` 中通过 `spring-boot-maven-plugin` 的 `<jvmArguments>` 配置
- SecurityManager 在 Java 21/24 仍可工作，但已在移除路线图上。若未来 JDK 彻底删除，需替换为 Java Agent 或进程隔离方案。

## 第四层细节：线程隔离 + 超时

**位置**：`RunController.java:109-132`

- `Executors.newSingleThreadExecutor()` 创建独立线程
- `future.get(5, TimeUnit.SECONDS)` 阻塞等待，超时抛 `TimeoutException`
- 超时后 `future.cancel(true)` + `executor.shutdownNow()` 强杀线程
- 注意：`Thread.interrupt()` 不会强制终止死循环中的纯 CPU 计算，只能中断处于 `wait/sleep/IO` 的线程。对于 `while(true){}` 仍有漏网可能。

## 执行流程图（完整）

```
POST /api/run {code}
  │
  ├─ ① runId = UUID.randomUUID()
  ├─ ② SandboxValidator.validate(userCode)
  │    └─ 不通过 → RunResponse.fail(reason)
  ├─ ③ extractClassName(userCode)
  │    └─ 异常 → "代码格式错误：缺少 public class 声明"
  ├─ ④ Instrumenter.instrument(userCode)
  ├─ ⑤ removePackageDeclaration(instrumentedCode)
  ├─ ⑥ InMemoryCompiler.compile(sources)
  │    └─ 异常 → "Compilation failed: ..."
  ├─ ⑦ InMemoryClassLoader.loadClass
  ├─ ⑧ TraceEngine.reset()
  ├─ ⑨ SecurityManager 安装
  │    ├─ ExecutorService.submit(main.invoke)
  │    ├─ future.get(5s)
  │    │    └─ TimeoutException → "运行超时（超过5秒）"
  │    └─ finally: SecurityManager 卸载
  ├─ ⑩ TraceEngine.getSteps()
  └─ ⑪ RunResponse.ok(runId, steps)
```

## 维护指南

### 添加新的危险调用拦截

1. 判断能否在 AST 层拦截 → 编辑 `SandboxValidator.java`
2. 如果代码可能绕过 AST（全限定名、反射），考虑在 SecurityManager 层补一个 check
3. 更新本文档的黑名单列表

### 修改白名单

编辑 `SandboxValidator.ALLOWED_IMPORT_PREFIXES`。常见场景：
- 添加新包：`"java.time"` 或 `"java.util.stream"`（已被子包规则覆盖）
- 移除包：如果某包被发现有攻击面

### 调整超时时间

修改 `RunController.java:123` 的 `future.get(5, TimeUnit.SECONDS)` 中的 5。

### 更新测试

后端测试在 `backend/src/test/java/com/javatutor/instrumentation/InstrumenterTest.java`。目前只测冒泡排序和嵌套作用域。考虑添加沙箱拦截的专项测试。
