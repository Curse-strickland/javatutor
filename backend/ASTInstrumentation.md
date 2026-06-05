# JavaTutor 后端架构 & AST 插桩方案

## 一、整体流程

拿到用户代码 → AST 插桩 → 和 TraceEngine 一起编译 → 执行 → 收集步骤 → 返回 JSON

```
用户代码字符串
      │
      ▼
┌─────────────────────────┐
│  Controller 层           │  接收 HTTP 请求，返回 JSON
│  RunController.java      │  POST /api/run  —— 唯一的 API 入口
└──────────┬──────────────┘
           │ 调用
           ▼
┌─────────────────────────┐
│  Instrumentation 层      │  代码 → 代码（源码→插桩后的源码）
│  Instrumenter.java       │  用 JavaParser 解析 AST，在赋值/声明/
│                          │  循环处自动插入 TraceEngine.record()
└──────────┬──────────────┘
           │ 产出：两个字符串
           │  ① TraceEngine.java 源码（写死的）
           │  ② 用户代码插桩后源码
           ▼
┌─────────────────────────┐
│  Compiler 层             │  源码 → 字节码
│  InMemoryCompiler.java   │  用 javax.tools.JavaCompiler 在内存中
│                          │  把上面两个源码编译成 .class 字节数组
└──────────┬──────────────┘
           │ 产出：Map<类名, byte[]>
           ▼
┌─────────────────────────┐
│  Execution 层            │  字节码 → 步骤数据
│  （不单独抽类，放在       │  用自定义 ClassLoader 加载字节码
│   RunController 里就行）  │  反射调用 main，执行时 TraceEngine
│                          │  自动收集每一步的变量快照
└──────────┬──────────────┘
           │ 产出：List<Map> steps
           ▼
┌─────────────────────────┐
│  Model 层                │  数据结构
│  RunRequest.java         │  请求体 {code: "..."}
│  RunResponse.java        │  响应体 {success, runId, steps, error}
└─────────────────────────┘
```

---

## 二、各模块拆解

### 1. Model（DTO，纯数据）

| 类 | 字段 | 给谁用 |
|----|------|--------|
| `RunRequest` | `String code` | Controller 接收 POST body |
| `RunResponse` | `boolean success`, `String runId`, `List<Map> steps`, `String error` | Controller 返回给前端 |

没有 StepData（直接用 Map，因为 TraceEngine 不能依赖 model 包）。

### 2. TraceEngine（运行时收集器）

这是最特殊的一个类。它**不跑在主项目 ClassLoader 里**，而是以源码形式被 InMemoryCompiler 编译，和用户代码在一起。

对外提供三个静态方法：

| 方法 | 做什么 |
|------|--------|
| `record(int step, int line, Map<String, Object> vars)` | 追加一条步骤快照 |
| `reset()` | 每次执行前清空 |
| `getSteps()` | 返回 List<Map>，给 Controller 读取 |

每条记录长这样：
```json
{"step": 1, "line": 3, "variables": {"arr": [5,3,8]}}
```

⚠️ 这个类不要 import Spring 或项目的 model 包，因为编译后它和用户代码跑在同一个隔离的 ClassLoader 里。

### 3. Instrumenter（AST 插桩引擎，核心）

输入：用户写的 Java 代码字符串  
输出：插桩后的 Java 代码字符串

用 **JavaParser 的 ModifierVisitor** 遍历 AST 树，在以下位置自动插入 `TraceEngine.record(步号, 行号, 变量表)`：

| 插桩点 | 为什么 | 例子 |
|--------|--------|------|
| 变量声明后 | 捕获新变量 | `int n = 3;` → 后面插入 record |
| 赋值表达式后 | 捕获值变化 | `i = i + 1;` → 后面插入 record |
| for 循环体末尾 | 捕获循环变量 | `for(...) { ... }` → body 末尾加入 |
| return 前 | 捕获最终状态 | `return x;` → 前面插入 record |

难点：要知道每个插桩点当时作用域里有哪些变量。  
方法：从当前 AST 节点向上遍历到最近的 BlockStmt，收集里面所有的 `VariableDeclarator`，拿到变量名列表。

### 插桩生成的代码长什么样

原始代码：
```java
int[] arr = {5, 3, 8};
int temp = arr[j];
```

插桩后：
```java
int[] arr = {5, 3, 8};
TraceEngine.record(1, 3, java.util.Map.of("arr", arr));
int temp = arr[j];
TraceEngine.record(2, 8, java.util.Map.of("arr", arr, "j", j, "temp", temp));
```

`TraceEngine.record(stepNum, lineNum, variableMap)` 往静态 List 追加一条记录。

---

### 4. InMemoryCompiler（内存编译）

用 JDK 自带的 `javax.tools.JavaCompiler`，不需要写文件。

输入：`Map<类名, 源码字符串>`（传两个：TraceEngine + UserCode）  
输出：`Map<类名, byte[]>`（编译好的字节码）

用 `SimpleJavaFileObject` 的自定义子类来实现"从字符串读源码、往 byte[] 写 class"。

### 5. Controller（调度中心）

唯一对外入口 `POST /api/run`，做的事就是串流程：

```
1. 接收 {code: "..."}
2. Instrumenter.instrument(code)     → 插桩后源码
3. InMemoryCompiler.compile(         → 字节码
       "TraceEngine" → 写死的 TraceEngine 源码,
       "UserCode"    → 插桩后源码)
4. 自定义 ClassLoader 加载字节码
5. 新线程反射调用 UserCode.main()
6. TraceEngine.getSteps()            → 拿到步骤数据
7. 包装 RunResponse，返回 JSON
```

---

## 三、文件清单

```
backend/
├── pom.xml                                    ← Maven 依赖（Spring Boot + JavaParser 3.25.10）
├── src/main/java/com/javatutor/
│   ├── JavatutorApplication.java              ← Spring Boot 入口
│   ├── model/
│   │   ├── RunRequest.java                    ← 请求 DTO（String code）
│   │   └── RunResponse.java                   ← 响应 DTO（success, runId, steps, error）
│   ├── compiler/
│   │   ├── TraceEngine.java                   ← 运行时收集器（静态 List + record/reset/getSteps）
│   │   └── InMemoryCompiler.java              ← 内存编译（javax.tools）
│   ├── instrumentation/
│   │   └── Instrumenter.java                  ← AST 插桩（JavaParser ModifierVisitor）
│   └── controller/
│       └── RunController.java                 ← API 端点（POST /api/run，串联全流程）
└── src/main/resources/
    └── application.properties                 ← server.port=8080
```

---

## 四、开发顺序建议

| 序号 | 文件 | 说明 |
|------|------|------|
| 1 | `application.properties` | 一行 server.port=8080，先搞定 |
| 2 | `JavatutorApplication.java` | 一行 @SpringBootApplication |
| 3 | `RunRequest + RunResponse` | 纯字段，5 分钟 |
| 4 | `TraceEngine.java` | 纯 Java 静态方法，需要理解但不复杂 |
| 5 | `InMemoryCompiler.java` | 稍复杂，但网上参考多 |
| 6 | `Instrumenter.java` | 最核心最难，留最后 |
| 7 | `RunController.java` | 串联，依赖上面都写完才能测 |

---

## 五、API 契约（锁定，不可改字段名）

### POST /api/run

请求：
```json
{"code": "public class UserCode { ... }"}
```

成功响应：
```json
{
  "success": true,
  "runId": "uuid-xxx",
  "steps": [
    {"step": 1, "line": 3, "variables": {"arr": [5,3,8]}},
    {"step": 2, "line": 4, "variables": {"arr": [5,3,8], "n": 3}}
  ]
}
```

失败响应：
```json
{"success": false, "error": "编译错误: ..."}
```






实际开发步骤：
### 模块 1：application.properties
路径：backend/src/main/resources/application.properties

功能：Spring Boot 配置文件。现在只需要一行，设置后端端口为 8080（和前端 Vite 代理约定的端口一致）。

server.port=8080
为什么是 8080：vite.config.js 里配了 proxy: { '/api': 'http://localhost:8080' }，端口必须匹配。

### 模块 2：JavatutorApplication.java
路径：backend/src/main/java/com/javatutor/JavatutorApplication.java

功能：Spring Boot 启动入口，就一个 main 方法。


package com.javatutor;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class JavatutorApplication {
    public static void main(String[] args) {
        SpringApplication.run(JavatutorApplication.class, args);
    }
}
@SpringBootApplication 这个注解帮 Spring Boot 自动扫描、自动配置。

### 模块 3：Model DTO — RunRequest.java + RunResponse.java
这两个是纯数据类（DTO = Data Transfer Object），就是把 HTTP 请求和响应的 JSON 自动映射成 Java 对象。Spring Boot 用 Jackson 库自动做 JSON ↔ Java 的转换，你只需要定义字段。

RunRequest.java
路径：model/RunRequest.java

就是前端 POST 过来的 JSON body：
{"code": "public class UserCode { ... }"}
映射成 Java 对象。只有一个字段 String code，加 getter/setter。

RunResponse.java
路径：model/RunResponse.java

你的后端返回给前端的 JSON 对象，需要 4 个字段：

字段	类型	说明
success	boolean	是成功还是失败
runId	String	UUID，唯一标识一次运行
steps	List<Map<String, Object>>	步骤数组
error	String	失败时的错误信息
另外加两个便捷工厂方法：

RunResponse.ok(runId, steps) — 快速创建成功响应
RunResponse.fail(error) — 快速创建失败响应

### 模块 4：TraceEngine.java

功能
插桩后的用户代码每执行一步，都会调用：


TraceEngine.record(步号, 行号, 变量Map);
TraceEngine 把这些调用收集起来，变成一个 list，最后 Controller 来取。

需要写的内容
成员	类型	作用
steps	static List<Map<String, Object>>	存每一步快照
record(step, line, vars)	static 方法	追加一条记录
reset()	static 方法	每次执行前清空
getSteps()	static 方法	返回所有步骤
为什么要 static？
用户代码里是直接 TraceEngine.record(...) 调用的，不需要 new 对象。而且整个执行过程只有一个 TraceEngine，用静态变量保证全局唯一。

### 模块 5：InMemoryCompiler.java
写在InMemoryCompilerREADME.md中