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

前端分工按 [分工.md](分工.md) 中约定执行：
- F1（你）：播放器核心、状态管理、Monaco 编辑器集成、与后端 API 对接（负责 `src/stores/player.js` 与 `Editor.vue`）
- F2（队友）：UI 布局、变量卡片、SSE 对话组件与可视化画布（负责 `App.vue`、`VariablePanel.vue`、`ChatBox.vue`、`ArrayCanvas.vue`）

后端可简要分工建议（两人）：
- 成员 A：AST 插桩引擎（基于 JavaParser 的 ModifierVisitor/Visitor，负责在赋值/声明/循环处插入 `TraceEngine.record()` 并输出步骤 JSON）
- 成员 B：动态编译与安全沙盒（内存编译、反射加载、独立线程/超时、黑名单检查、LLM/SSE 转发）

（更详细的接口约定见 `分工.md` 中的 "后端接口约定" 部分。）

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