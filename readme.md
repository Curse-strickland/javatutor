# JavaTutor — Java 算法可视化工具

一个面向算法与数据结构初学者的教学辅助工具：用户在浏览器中编辑 Java 代码，后端通过 AST 插桩与内存编译逐步执行并返回每一步的变量快照，前端以可视化动画与 AI 解说的方式呈现执行过程。

## 主要特性

- 交互式代码编辑：基于 Monaco Editor，支持 Java 语法高亮与行高亮
- 逐步执行与播放控制：单步、上一步/下一步、自动播放与速度调节
- 变量卡片与结构画布：响应式渲染变量、数组与链表可视化
- AST 插桩引擎：在赋值/声明/循环/返回点记录执行快照
- 安全沙盒运行：动态编译 + 超时与黑名单保护
- AI 实时解说：SSE 流式返回解说文本（支持 mock 与多模型）

## 技术栈

- 前端：Vue 3、Pinia、Monaco Editor、Tailwind CSS、Vite
- 后端：Spring Boot、JavaParser（AST 插桩）、内存编译（javax.tools）、SSE
- 构建：Maven（后端）、npm / pnpm（前端）

## 项目结构（概要）

javatutor/
- frontend/ — Vite + Vue 前端项目（`src/components`、`src/stores/player.js`）
- backend/ — Spring Boot 后端（`instrumentation` 插桩、`compiler` 动态编译、`sandbox` 安全执行、`llm` 解说转发）
- ROADMAP.md — 路线图与阶段计划
- 分工.md — 前端/后端分工说明与协作约定

完整结构见仓库目录。

## 快速开始（开发环境）

前提：安装 Node.js 18+、JDK 17、Maven、Git

1) 启动后端（在 `backend/` 目录）

```bash
cd backend
mvn spring-boot:run
```

2) 启动前端（在 `frontend/` 目录）

```bash
cd frontend
npm install
npm run dev
```

前端开发时可在 `vite.config.js` 中配置 `proxy` 将 `/api` 转发到本地 `localhost:8080`，避免跨域。

## 分工（摘要）

前端分工按 [前端分工.md](前端分工.md) 中约定执行：
- F1：播放器核心、状态管理、Monaco 编辑器集成、与后端 API 对接（负责 `src/stores/player.js` 与 `Editor.vue`）
- F2：UI 布局、变量卡片、SSE 对话组件与可视化画布（负责 `App.vue`、`VariablePanel.vue`、`ChatBox.vue`、`ArrayCanvas.vue`）

后端可简要分工建议（两人）：
- 成员 A：AST 插桩引擎（基于 JavaParser 的 ModifierVisitor/Visitor，负责在赋值/声明/循环处插入 `TraceEngine.record()` 并输出步骤 JSON）
- 成员 B：动态编译与安全沙盒（内存编译、反射加载、独立线程/超时、黑名单检查、LLM/SSE 转发）

（更详细的接口约定见 `前端分工.md` 中的 "后端接口约定" 部分。）

## 贡献指南

- Fork → 新分支 → 功能完成后发起 PR
- 代码风格：前端遵循 ESLint（推荐），后端遵循 Checkstyle/Google Java Style
- 在提交 PR 前请确保：前端能本地 `npm run dev`，后端能通过 `mvn test`（如有测试）

## 常见问题与调试

- 如果编译失败，检查插桩是否破坏代码语法；最好先用 `LexicalPreservingPrinter` 保持格式。
- 出现死循环时，后端有 5s 超时保护，可在 `application.properties` 配置调整（仅开发时谨慎放宽）。

## 许可与联系方式

开源许可：MIT（建议）

项目负责人：见仓库 README 与 `分工.md`

---
更新：补充了开发启动步骤与简明分工，新增 `.gitignore` 文件以忽略构建/IDE 临时文件。

## 详细 API 与数据契约

为了前后端以及多个前端组件（F2）能可靠互操作，下面给出约定的 HTTP / SSE 接口与 JSON 格式示例：

1) POST /api/run — 执行用户代码并返回步骤
- 请求体：
	```json
	{ "code": "public class UserCode { ... }" }
	```
- 成功响应：
	```json
	{
		"success": true,
		"runId": "uuid-xxx",
		"steps": [
			{ "step": 1, "line": 3, "variables": { "arr": [5,3,8] } },
			{ "step": 2, "line": 4, "variables": { "arr": [5,3,8], "n": 3 } }
		]
	}
	```
- 失败响应：
	```json
	{ "success": false, "error": "编译错误: ..." }
	```

2) GET /api/explain/{runId}/{step} — SSE 解说流
- 返回 Server-Sent Events，逐段发送文本片段：
	```text
	data: 这是第1步的解释...

	data: 这是第1步的补充...

	data: [DONE]

	```
- 前端应将收到的片段按到达顺序拼接，并在接收到 `[DONE]` 后关闭 EventSource。

3) Steps 数组中每一项的 `Step` 对象约定：
- `step` (number) — 从 1 开始的步序号
- `line` (number|null) — 对应源代码 1-based 行号（若该步骤未对应源码行可为 null）
- `variables` (object) — 当前作用域的变量快照，键为变量名，值为可序列化的 JSON 值（见后文变量序列化约定）

变量序列化约定（建议）
- 基本类型：`number` / `string` / `boolean` 原样返回
- 一维数组：返回为数组，例如 `[1,2,3]`
- 二维/多维数组：返回嵌套数组，例如 `[[1,2],[3,4]]`
- 对象/引用类型：推荐以结构化对象表示，优先返回浅度可读格式。例如链表节点可以表示为 `{ "__type": "ListNode", "id": "n1", "val": 5, "next": "n2" }`，并在 `variables` 中用引用 id 连接。复杂对象也可以返回字符串化快照作为最后手段。

示例完整 `steps`（片段）：
```json
[{
	"step": 1,
	"line": 3,
	"variables": { "arr": [5,3,8] }
},
{
	"step": 2,
	"line": 6,
	"variables": { "arr": [3,5,8], "i": 0, "j": 1 }
}]
```

错误与超时处理
- 若用户代码触发运行时异常，`/api/run` 应返回 `success: false` 并包含错误信息；若后端能返回部分步骤（比如在异常前已记录步骤），可在响应中包含 `steps` 字段并标记 `error`。
- 后端应实现执行超时（MVP 为 5s），超时同样返回 `success: false` 和 `error: "timeout"`。

安全与沙盒约定（后端实现须遵守）
- AST 黑名单：拒绝 `System.exit`、`Runtime.getRuntime().exec`、本地文件写入与反射危险用法
- 独立线程与超时：在单独线程或进程中运行用户代码并在超时后强制中断
- 限制 imports：仅允许白名单内的包（例如 `java.util.*`）

后端配置（建议）
- `application.properties`:
	- `javatutor.sandbox.timeoutMs=5000`
	- `javatutor.llm.apiKey`（如需要）

联调建议
- 在前期使用 mock 数据（`player.runMock()`）作为前后端契约的“活文档”，后端准备真实接口后逐步替换。
- 任何变更 `steps` 字段结构需在 `分工.md` 中书面确认。

