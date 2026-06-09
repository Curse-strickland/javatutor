# CLAUDE.md — JavaTutor

## 项目定位

Java 算法可视化教学工具。用户在浏览器写 Java 代码 → 后端 AST 插桩 + 内存编译 + 沙箱执行 → 前端逐步播放变量快照 + 行高亮 + AI 解说。

## 技术栈

| 层 | 技术 |
|----|------|
| 后端 | Spring Boot 3.2.0, Java 17, Maven, JavaParser 3.25.10 |
| 前端 | Vue 3.5, Pinia 3, Monaco Editor 0.55, Tailwind CSS 3, Vite 8 |
| 通信 | REST (`POST /api/run`), SSE (`GET /api/explain/{runId}/{step}`) |

## 设计系统

前端设计规范见 [DESIGN.md](DESIGN.md)。核心原则：深灰调 + 蓝色单一 accent、卡片统一用 `.card p-3 mb-3`、可折叠面板用蓝色圆点+chevron SVG、不用琥珀色/绿色、不用 uppercase 标签、不用裸 border-top 分割。

## 启动/停止

### 一键启动

```bash
./start.sh          # bash 终端
# 或双击
start.bat           # Windows 资源管理器
```

浏览器自动打开 `localhost:5173`。`start.bat` 在单独窗口启动前后端，关闭启动器窗口不影响服务。

### 一键停止

```bash
./stop.bat          # 或双击 stop.bat
```

### 环境

- **JDK 17**: `C:/Users/h2624/.jdks/ms-17.0.19` (系统默认是 JDK 8，必须手动重写 JAVA_HOME)
- **Maven**: `C:/Users/h2624/apache-maven-3.9.9` (手装，无全局 PATH)
- **Node**: `C:/Program Files/nodejs` (全局可用)

### 手动启动后端

```bash
export JAVA_HOME="C:/Users/h2624/.jdks/ms-17.0.19" && export PATH="C:/Users/h2624/.jdks/ms-17.0.19/bin:$PATH" && cd "d:/CHome/Documents/EL/JavaTutor/backend" && "C:/Users/h2624/apache-maven-3.9.9/bin/mvn" clean compile && "C:/Users/h2624/apache-maven-3.9.9/bin/mvn" spring-boot:run
```

端口 8080。`pom.xml` 配置了 `-Djava.security.manager=allow`（SecurityManager 必需）。

### 手动启动前端

```bash
cd "d:/CHome/Documents/EL/JavaTutor/frontend" && npm run dev
```

端口 5173，`/api` 请求代理到 localhost:8080。

### 仅编译检查

```bash
export JAVA_HOME="C:/Users/h2624/.jdks/ms-17.0.19" && export PATH="C:/Users/h2624/.jdks/ms-17.0.19/bin:$PATH" && cd "d:/CHome/Documents/EL/JavaTutor/backend" && "C:/Users/h2624/apache-maven-3.9.9/bin/mvn" clean compile
```

## 后端核心流程 (POST /api/run)

```
① runId = UUID
② SandboxValidator.validate(userCode)    ← 沙箱：AST 黑名单 + import 白名单
③ extractClassName(userCode)              ← JavaParser 提取 public class 名
④ Instrumenter.instrument(userCode)       ← AST 插桩：插入 TraceEngine.record() 调用
⑤ removePackageDeclaration                ← 去掉 package 声明
⑥ InMemoryCompiler.compile(sources)       ← 内存编译 TraceEngine + 用户代码 → byte[]
⑦ InMemoryClassLoader.loadClass           ← 从 byte[] 加载类
⑧ TraceEngine.reset()                     ← 清空上轮步骤
⑨ SecurityManager 安装 → ExecutorService.main.invoke() → future.get(5s) → finally 卸载 SM
⑩ TraceEngine.getSteps()                  ← 取 List<Map> 步骤数据
⑪ RunResponse.ok(runId, steps)
```

## 关键文件地图

### 后端 (backend/src/main/java/com/javatutor/)

| 文件 | 职责 | 行数 |
|------|------|------|
| `JavatutorApplication.java` | Spring Boot 入口，`main()` | 26 |
| `controller/RunController.java` | `POST /api/run` 全流程编排 + InMemoryClassLoader + SecurityManager 安装/卸载 | 197 |
| `instrumentation/Instrumenter.java` | AST 插桩引擎：用 JavaParser 遍历 AST，在赋值/声明/循环/return 处插入 `TraceEngine.record()` | 427 |
| `compiler/InMemoryCompiler.java` | javax.tools 内存编译：源码 → byte[]，拦截输出到内存 | 100 |
| `compiler/SourceFileObject.java` | 包装内存字符串为编译器能读的 JavaFileObject | 39 |
| `compiler/ClassFileObject.java` | 包装 ByteArrayOutputStream 为编译器输出桶 | 33 |
| `compiler/TraceEngine.java` | 磁盘副本（运行时实际用的是 RunController 里硬编码的字符串常量） | 51 |
| `model/RunRequest.java` | 请求 DTO：`{code}` | 24 |
| `model/RunResponse.java` | 响应 DTO：`{success, runId, steps, error}` + `ok()`/`fail()` 工厂方法 | 74 |
| **`sandbox/SandboxValidator.java`** | **沙箱 AST 层**：import 白名单 + 方法黑名单 + 类型黑名单 + import 位置校验 | 187 |
| **`sandbox/SafeSecurityManager.java`** | **沙箱运行时层**：继承 SecurityManager，拦截文件写/删、外部网络、进程执行、System.exit(!=0) | 95 |

### 前端 (frontend/src/)

| 文件 | 职责 |
|------|------|
| `main.js` | Vue 入口，挂载 Pinia |
| `App.vue` | 主布局：左编辑器 + 右变量面板 + 底部控制栏（运行/步进/播放/速度） |
| `stores/player.js` | Pinia store：steps, currentStep, runId, error；actions: runCode, nextStep, prevStep |
| `components/Editor.vue` | Monaco Editor 包装：getCode(), highlightLine(line)，降级到 textarea |
| `components/VariablePanel.vue` | 变量卡片：监听 store.currentVariables，值变化时闪光动画 |

### 配置

| 文件 | 内容 |
|------|------|
| `backend/pom.xml` | Spring Boot 3.2.0 + JavaParser 3.25.10 + `-Djava.security.manager=allow` |
| `backend/src/main/resources/application.properties` | `server.port=8080` |
| `frontend/package.json` | Vue 3.5, Pinia 3, Monaco 0.55, Vite 8 |
| `frontend/vite.config.js` | `/api` → localhost:8080 代理 |

### 文档

| 文件 | 内容 |
|------|------|
| `readme.md` | 项目简介 + API 契约 + 安全约定 |
| `ROADMAP.md` | 路线图 Phase 1-5 |
| `memo.md` | 前后端联调备忘录 |
| `前端分工.md` | F1/F2 分工表 |
| `docs/sandbox-design.md` | 沙箱设计文档：四层架构图、规则表、维护指南 |
| `docs/sandbox-verification-checklist.md` | 31 条验收用例（A-G 组） |
| `devlog/2026-06-06-sandbox-step1-2.md` | Step 1-2 开发日志 |
| `devlog/2026-06-06-sandbox-step3.md` | Step 3 开发日志 |
| `devlog/2026-06-06-sandbox-step4.md` | Step 4 开发日志 |
| `java tutor.md` | 综合方案文档 |

## 当前分支与工作

### 分支: `fix-ast-jump`

HEAD 提交: `5e8f58c` — AST 高亮修复（组员做的）

### 我的沙箱工作（未提交）

**新增文件：**
- `backend/src/main/java/com/javatutor/sandbox/SandboxValidator.java` — AST 静态扫描
- `backend/src/main/java/com/javatutor/sandbox/SafeSecurityManager.java` — 运行时拦截
- `docs/sandbox-design.md`, `docs/sandbox-verification-checklist.md` — 设计文档 + 验收清单
- `devlog/2026-06-06-sandbox-step*.md` — 开发日志

**修改文件：**
- `RunController.java` — 接入三层防护
- `pom.xml` — `-Djava.security.manager=allow`

### 沙箱三层防护

```
① AST 层 (SandboxValidator)
   ├─ import 白名单: java.util, java.lang, java.math, java.text
   ├─ 方法黑名单: System.exit, Runtime.exec, Class.forName, 反射 invoke/setAccessible 等 6 种
   ├─ 类型黑名单: FileWriter, FileInputStream, Socket, ServerSocket, ProcessBuilder, Thread 等 9 种
   └─ import 位置校验: 不在类外就提示语法错误

② 编译隔离 (InMemoryCompiler) — 天然内存隔离

③ 运行时 (SafeSecurityManager)
   ├─ checkExec → 拦截外部命令
   ├─ checkWrite/checkDelete → 拦截文件写/删
   ├─ checkConnect → 只拦截非 localhost 的网络连接
   ├─ checkExit → 仅放行 exit(0)
   ├─ checkRead/checkListen/checkAccept → 完全放行（否则误伤 Tomcat）
   └─ checkPermission → 完全放行（否则 JVM 默认权限检查误伤 Tomcat/Jackson）
```

### SecurityManager 的踩坑记录

SecurityManager 是 JVM 全局单例，安装后 Tomcat 自身线程也受管。必须：
1. `checkAccept`/`checkListen` 放行（否则 Tomcat 收不到 HTTP 请求）
2. `checkRead` 完全放行（否则 Jackson 读 jar 包报错）
3. `checkPermission` 完全放行（否则 setContextClassLoader 报 AccessControlException）
4. `checkConnect` 只拦非 localhost（否则 Tomcat 内部通信被阻）

最终能在不破坏 Tomcat 的前提下拦截 `System.exit(!=0)`、文件写入、外部网络连接、外部命令执行。但文件读取/监听/接受连接必须放行，由 AST 层兜底。

### 已知局限

- AST 类型黑名单匹配短名（如 `FileWriter`），全限定名 `java.io.FileWriter` 也能匹配（JavaParser 返回短名）
- `while(true){}` 纯 CPU 死循环，Thread.interrupt() 无法终止（只有 wait/sleep/IO 能被中断）
- SecurityManager 在 Java 17 deprecated，未来需迁移到 Java Agent 或容器隔离
- 当前未限制内存（用户可 `new int[Integer.MAX_VALUE]`）

## 验证

浏览器打开 `localhost:5173`，点运行。验收清单见 `docs/sandbox-verification-checklist.md`（31 条）。
