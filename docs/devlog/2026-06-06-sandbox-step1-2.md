# 2026-06-06 安全沙箱 Step 1 & 2

## 工作概述

在 `fix-ast-jump` 分支上，开始补全安全沙箱功能。原沙箱只有一个占位实现：单线程 + 5 秒超时。按计划分 4 步推进，今天完成了前两步。

## Step 1: SandboxValidator — AST 黑名单扫描

### 新增文件

`backend/src/main/java/com/javatutor/sandbox/SandboxValidator.java`

### 功能

用 JavaParser 解析用户代码的 AST，在编译前扫描危险调用，分两类拦截：

**方法调用黑名单：**
- `System.exit()` — 防止直接终止 JVM
- `Runtime.getRuntime().exec()` — 防止执行系统命令
- `Class.forName()` — 防止动态加载类
- 反射六种方法：`invoke`, `setAccessible`, `getDeclaredMethod`, `getDeclaredField`, `getDeclaredConstructor`, `newInstance`

**类型实例化黑名单（`new` 拦截）：**
- 文件 I/O：`FileInputStream`, `FileOutputStream`, `FileReader`, `FileWriter`, `RandomAccessFile`
- 网络：`Socket`, `ServerSocket`
- 进程：`ProcessBuilder`
- 线程：`Thread`, `ThreadGroup`

### 接口

```java
SandboxValidator.Result r = SandboxValidator.validate(userCode);
// r.allowed = true/false
// r.reason = 拦截原因（仅当 allowed=false）
```

### RunController 改动

- 新增 import `SandboxValidator`
- 沙箱检查插入在插桩之前，作为 `run()` 方法的第一道防线
- 如果 `!allowed`，直接返回 `RunResponse.fail(validation.reason)`

## Step 2: import 白名单

### 改动

在 `SandboxValidator` 中新增 `checkImports()` 方法，扩展 `validate()` 逻辑。

### 白名单规则

只允许导入以下包（含子包）：
- `java.util`
- `java.lang`
- `java.math`
- `java.text`

其余如 `java.io`、`java.net`、`java.lang.reflect` 等一律拒绝。

### import 位置检查

同时增加了 import 位置校验：import 必须写在类声明之前。如果 import 行号大于类声明行号，说明用户把 import 放在了类体内或文件末尾——此时返回"import 必须写在文件顶部"的语法提示，而非"不允许导入"的沙箱拦截，避免错误信息误导用户。

## 沿路修复的问题

### Bug 1: 沙箱检查顺序错误（严重）

**现象：** 用户写 `import java.io.File;` 在文件末尾时，前端显示 JavaParser 堆栈错误而非沙箱拦截信息。

**根因：** `extractClassName()` 在沙箱检查之前执行。如果代码有语法问题，JavaParser 一上来就抛异常。

**修复：** 沙箱 `validate()` 挪到 `extractClassName()` 之前，作为 `run()` 方法中第二个执行的操作（在 runId 生成之后）。

**相关文件：** `RunController.java:73-77`

### Bug 2: 语法错误抛出丑陋堆栈

**现象：** 用户语法错误时，前端显示一屏 JavaParser 堆栈。

**修复：** `extractClassName()` 加 try-catch，解析失败抛出简洁的 `RuntimeException("代码语法错误，请检查代码格式")`。

**相关文件：** `RunController.java:155-162`

### 改进 1: 错误提示语气

全部提示从生硬的"禁止"改为教学口吻：

| 旧 | 新 |
|----|-----|
| 禁止调用 System.exit() | 不能使用 System.exit() — 该操作会直接终止程序 |
| 禁止导入包: java.io.File | 不允许导入: java.io.File |
| 沙箱拦截 — ... | 代码中包含不支持的操作：\n... |
| 禁止反射调用: invoke() | 不能使用反射: invoke() — 反射操作不允许执行 |

### 改进 2: import 位置校验

见 Step 2 中说明。防止"语法错误"被误报为"沙箱拦截"。

## 验证方法

在 `localhost:5173` 浏览器中：

| 测试用例 | 预期结果 |
|----------|----------|
| 冒泡排序默认代码 | 正常运行，变量卡片出现 |
| `import java.io.File;` 第一行 | 报错：不允许导入: java.io.File |
| `import java.io.File;` 文件末尾 | 报错：import 必须写在文件顶部 |
| `System.exit(0);` 在 main 里 | 报错：不能使用 System.exit() |
| `new FileWriter("x.txt")` 在 main 里 | 报错：不能使用 FileWriter |

## 执行流程（当前状态）

```
POST /api/run
  ├─ ① runId 生成
  ├─ ② SandboxValidator.validate(userCode)  ← AST 黑名单 + import 白名单
  │    └─ 不通过 → return RunResponse.fail(reason)
  ├─ ③ extractClassName(userCode)
  ├─ ④ Instrumenter.instrument(userCode)
  ├─ ⑤ InMemoryCompiler.compile(sources)
  ├─ ⑥ InMemoryClassLoader.loadClass
  ├─ ⑦ TraceEngine.reset()
  ├─ ⑧ ExecutorService + 5秒超时 + main.invoke()
  ├─ ⑨ TraceEngine.getSteps()
  └─ ⑩ RunResponse.ok(runId, steps)
```

## 未完成

- Step 3: 运行时 SecurityManager（下一步）
- Step 4: 整合 + 开发日志 + 设计文档

## 新增/修改文件清单

| 文件 | 类型 | 说明 |
|------|------|------|
| `backend/src/main/java/com/javatutor/sandbox/SandboxValidator.java` | 新建 | AST 安全校验器（187 行） |
| `backend/src/main/java/com/javatutor/controller/RunController.java` | 修改 | 接入沙箱，调顺序，优化错误提示 |
| `devlog/2026-06-06-sandbox-step1-2.md` | 新建 | 本日志 |
