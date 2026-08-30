# AGENTS.md — JavaTutor

## 项目定位

Java 算法可视化教学工具 + Coze 智能体辅助教学。用户在浏览器写 Java 代码 → 后端 AST 插桩 + 内存编译 + 沙箱执行 → 前端逐步播放变量快照 + 行高亮 + AI 解说。支持单文件运行模式、多文件项目静态分析与 UML 图、Coze 智能体自由问答与决策痕迹展示。

## 仓库结构

- `JavaTutor`：前后端主仓库（本文件所在仓库）。
- `javatutor-coze`：Coze 侧智能体项目（LangGraph 代码项目，部署在 Coze 平台）；JavaTutor 通过 `/api/ai/*` 调用其 API。

## 技术栈

| 层 | 技术 |
|----|------|
| 后端 | Spring Boot 3.2.0, Java 17, Maven, JavaParser 3.25.10 |
| 前端 | Vue 3.5, Pinia 3, Monaco Editor 0.55, Tailwind CSS 3, Vite 8, marked, mermaid |
| 测试 | 前端 vitest（`npm test`）；后端 JUnit（`mvnw test`） |
| AI | Coze API（SSE 流式）、DeepSeek API（备用分析）、OpenAI 兼容接口（ExplainController 旧链路） |
| 通信 | REST `/api/run`、`/api/ai/analyze`、`/api/ai/uml`、`/api/ai/animate`、`/api/controlflow`；SSE `/api/ai/chat`、`/api/explain` |

## 设计系统

前端设计规范见 [DESIGN.md](docs/DESIGN.md)。核心原则：浅色冷灰档案风（Rhodes Archive/HUD）+ 蓝青单一 accent（#0d9ec4）+ clip-path 切角（border-radius: 0）、卡片统一用 `.card p-3 mb-3`、可折叠面板用蓝色圆点+chevron SVG、uppercase mono 标签（kicker 9.5px/0.18em、按钮 12px/0.08em）、不用琥珀色/绿色做 UI 强调（堆对象/算法标签功能色除外）、不用裸 border-top 分割。

## 启动/停止

本地前提：JDK 17+、Maven、Node.js 18+。

```bash
# 终端 1 — 后端 (8080)
cd backend && ./mvnw spring-boot:run    # Windows: mvnw.cmd

# 终端 2 — 前端 (5173)
cd frontend && npm install && npm run dev
```

停止：`Ctrl+C` 两个终端。`pom.xml` 已配置 `-Djava.security.manager=allow`，无需手动指定。

Coze 密钥配置：`backend/src/main/resources/coze.properties` 只放非敏感配置；本地密钥写在 `coze-local.properties`（已被 gitignore，禁止提交）。

## 后端核心流程

### 单文件运行 `POST /api/run`

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

### Coze 问答链路 `/api/ai/chat`

```
① 前端 stores/player.js 发送 code + steps + currentStep/currentLine + variables（含 _explainTopic）
② CozeAIController.chat() 组装 payload（source_code/steps/current_step_index/user_question/...）转发 Coze /stream_run
③ Coze 侧 javatutor-coze LangGraph：parse_context → analyze_code → GSSC 上下文 → main_agent（step_facts 工具）→ critic/revise → final
④ SSE chunk 事件回传；最终回答包含 【决策痕迹】\n{json}
⑤ 前端 AiTutorPanel / DecisionTracePanel 解析展示
```

## 关键文件地图

### 后端 `backend/src/main/java/com/javatutor/`

| 文件 | 职责 |
|------|------|
| `controller/RunController.java` | `POST /api/run` 全流程编排 + 沙箱安装/卸载 |
| `controller/CozeAIController.java` | `/api/ai/chat`（SSE）、`/analyze`、`/uml`、`/animate` |
| `controller/ExplainController.java` | 旧 AI 链路 `/explain`、`/analyze`、`/controlflow` |
| `service/CozeService.java` | Coze API 转发（payload 组装、SSE 解析） |
| `service/AnalyzeService.java` / `DeepSeekService.java` / `ControlFlowService.java` | 复杂度分析 / DeepSeek 备用 / 控制流图 |
| `instrumentation/Instrumenter.java` | AST 插桩，插入 `TraceEngine.record()` |
| `compiler/*` | 内存编译（`InMemoryCompiler` / `SourceFileObject` / `ClassFileObject`） |
| `sandbox/SandboxValidator.java` | AST 静态沙箱：import 白名单 + 方法/类型黑名单 |
| `sandbox/SafeSecurityManager.java` | 运行时沙箱：拦截文件写/删、外部网络、进程执行、`exit(≠0)` |
| `model/ExplainRequest.java` | AI 请求体：`code` / `steps` / `step` / `currentLine` / `algorithmTags` 等 |

### 前端 `frontend/src/`

| 文件 | 职责 |
|------|------|
| `stores/player.js` | 运行状态 + 聊天/分析/动画/多文件状态；`askQuestion` / `requestAnalysis` 等 |
| `components/SingleFileShell.vue` / `MultiFileShell.vue` | 单/多文件主外壳 |
| `components/AiTutorPanel.vue` | 自由问答面板（流式渲染、快捷解说） |
| `components/DecisionTracePanel.vue` | 决策痕迹展示：正文 + 来源标签 + 可折叠 JSON |
| `components/UmlPanel.vue` | 多文件 UML：flow / dataflow / structure / class / usecase |
| `components/MemoryPanel.vue` / `ControlFlowPanel.vue` | 堆栈 / 控制流可视化 |
| `utils/decisionTrace.js` | 切分 `【决策痕迹】` JSON + 来源标签 |
| `utils/markdown.js` | 共享 markdown 渲染（XSS 防护），AiTutorPanel / DecisionTracePanel 共用 |
| `utils/dataStructureExtract.js` / `linkedListExtract.js` / `sortVizExtract.js` 等 | 数据结构 / 链表 / 排序可视化提取 |

### 配置

| 文件 | 内容 |
|------|------|
| `backend/src/main/resources/coze.properties` | Coze API url / project-id / enabled（无 token） |
| `backend/src/main/resources/coze-local.properties` | 本地密钥覆盖（gitignored，禁止提交） |
| `backend/src/main/resources/application.properties` | `server.port=8080` |
| `frontend/package.json` | scripts：`dev` / `build` / `test`（vitest）/ `test:watch` |
| `frontend/vite.config.js` | `/api` → localhost:8080 代理 |

### 文档

| 文件 | 内容 |
|------|------|
| `docs/DESIGN.md` | 设计系统规约（颜色/字体/切角/折叠模式） |
| `docs/coze/` | Coze 侧接口、部署、数据流说明 |
| `docs/superpowers/specs/` | 设计 spec |
| `docs/superpowers/plans/` | 实施计划（含 `2026-08-15-decision-trace-panel.md`） |
| `docs/superpowers/plans/2026-08-15-chat-stage-streaming-and-quote-fix.md` | Coze 阶段流式 + 回答代码引用修复计划 |
| `docs/superpowers/plans/2026-08-15-integrated-followup-plan.md` | 综合接力计划：流式验收 + 光标修复 + 耗时指标 |
| `docs/superpowers/plans/2026-08-17-decision-trace-user-display-metrics-plan.md` | 决策痕迹用户展示与耗时指标修复计划 |
| `docs/superpowers/specs/2026-08-23-execution-snapshot-api-design.md` | 执行快照 API 设计（后端按 `run_id` 提供执行上下文） |
| `docs/superpowers/plans/2026-08-23-execution-snapshot-api-plan.md` | 执行快照 API TDD 实施计划 |
| `docs/superpowers/plans/2026-08-30-decision-trace-unused-fields.md` | 决策痕迹未利用字段接入计划（质量提示 + dev 观测行） |
| `docs/reviews/2026-08-17-integrated-followup-review.md` | 综合接力计划执行 review（latency=0 / JSON 展示 / token_cost） |
| `docs/devlog/2026-08-15-chat-step-context-fix.md` | 单步问答 steps 链路修复开发日志 |
| `docs/devlog/2026-08-15-chat-stage-streaming-quote-fix.md` | Coze 阶段流式 + 回答代码引用修复开发日志 |
| `docs/devlog/2026-08-15-integrated-followup.md` | 综合接力开发日志：流式验收 + 光标修复 + 耗时指标 |
| `docs/devlog/2026-08-17-decision-trace-user-display-metrics.md` | 决策痕迹用户展示与耗时指标修复开发日志 |
| `docs/devlog/2026-08-18-multi-file-project-run-merge.md` | 多文件项目运行分支合入 main：测试签名同步 + 合并冲突解决开发日志 |
| `docs/devlog/2026-08-23-execution-snapshot-api.md` | 执行快照 API 开发日志（run 保存快照 + 带 token 查询 + Coze payload 瘦身） |
| `docs/reviews/2026-08-23-execution-snapshot-api-review.md` | 执行快照 API 实现 review |
| `docs/devlog/2026-08-25-code-editor-theme-and-controlbar-resize.md` | 代码区蓝黑配色 + 运行栏左右拖拽调宽开发日志 |
| `docs/devlog/2026-08-30-decision-trace-unused-fields.md` | 决策痕迹未利用字段接入开发日志 |
| `docs/reviews/2026-08-15-decision-trace-panel-review.md` | 决策痕迹面板实现 review（含整改复验） |
| `docs/reviews/2026-08-15-javatutor-branch-audit-review.md` | 旧分支整合审查 review |
| `docs/old/` | 归档的旧文档（`sandbox-design` 等，仅历史参考） |

## 开发与审查 Hook（强制）

| 触发点 | 必须动作 |
|--------|----------|
| 完成完整新功能 | 写 `docs/devlog/YYYY-MM-DD-<topic>.md`，记录改动/验证/遗留，并在本文档登记 |
| 修复重大 bug | 同上，写 devlog |
| 代码/分支/设计 review | 除非结论过短（少于一条有效结论），写 `docs/reviews/YYYY-MM-DD-<topic>-review.md` 并在本文档登记；随被审代码提交 git |
| 新增 spec/plan | 放入 `docs/superpowers/specs|plans/YYYY-MM-DD-<topic>(-design|-plan).md` 并登记 |
| 提交前 | 前端跑 `npm test` + `npm run build`；后端跑 `mvnw test`；确认无硬编码密钥 |
| 文档变更 | 更新本文档「文档」表；文件名只允许字母/数字/下划线/短横线；统一 UTF-8；不得出现 `TBD` / `TODO` |
| git 操作 | 除非用户明确指示，不主动 commit / push |

## 当前状态

- 当前分支：`feat/multi-file-project-run`（已合并到 `main`，PR #34）
- 已完成：决策痕迹面板（`DecisionTracePanel` + `decisionTrace.js` + 共享 `markdown.js` XSS 防护）已合入 main（PR #33）；单步问答 steps 链路修复；多文件项目整体运行 + 共享控制栏（`ControlBar.vue`）已合入 main（PR #34）
- 进行中：多文件项目运行本地 `main` 待同步远程最新
- Coze 侧：`javatutor-coze` 分支 `feat/agent-architecture-improve`，多工具架构 + 评估系统

## 沙箱实现要点

```
① AST 层 (SandboxValidator)
   ├─ import 白名单: java.util, java.lang, java.math, java.text
   ├─ 方法黑名单: System.exit, Runtime.exec, Class.forName, 反射 invoke/setAccessible 等
   ├─ 类型黑名单: FileWriter, FileInputStream, Socket, ServerSocket, ProcessBuilder, Thread 等
   └─ import 位置校验
② 编译隔离 (InMemoryCompiler) — 天然内存隔离
③ 运行时 (SafeSecurityManager)
   ├─ checkExec → 拦截外部命令
   ├─ checkWrite/checkDelete → 拦截文件写/删
   ├─ checkConnect → 只拦截非 localhost 的网络连接
   ├─ checkExit → 仅放行 exit(0)
   └─ checkRead/checkListen/checkAccept/checkPermission → 完全放行（否则误伤 Tomcat）
```

已知局限：AST 黑名单匹配短名；`while(true){}` 纯 CPU 死循环无法被 interrupt 终止；SecurityManager 在 Java 17 已 deprecated；当前未限制内存上限。

## 验证

- 前端：`cd frontend && npm test`（当前 128 tests）、`npm run build`
- 后端：`cd backend && ./mvnw test`（当前 83 tests）
- 浏览器联调：`localhost:5173` 运行代码 → 提问 → 校验回答含 `【决策痕迹】` 且面板正常
