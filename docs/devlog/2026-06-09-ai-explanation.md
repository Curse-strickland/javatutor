# AI 流式解说 — 开发日志

日期：2026-06-09

## 概述

接入 DeepSeek API 实现 AI 流式代码解说功能。用户运行算法代码后，点击控制栏 ✨ 按钮展开 AI Tutor 面板，可选择手动解说或自动解说模式。后端通过 SseEmitter 中转 DeepSeek 的 SSE 流式响应，前端用 fetch + ReadableStream 逐行解析并渲染。

## 技术选型

| 层 | 选择 | 理由 |
|----|------|------|
| LLM | DeepSeek `deepseek-chat` | 国产，便宜，中文效果好，支持 SSE 流式 |
| HTTP 客户端 | Java 17 `HttpClient` | 内置，无需加 Maven 依赖 |
| SSE 中转 | Spring `SseEmitter` | 已有 Spring Web，零额外依赖 |
| 前端流接收 | `fetch` + `ReadableStream` | 比 EventSource 灵活，支持 POST body + AbortController |

## 改动清单

### 后端 (3 新文件)

| 文件 | 说明 |
|------|------|
| `model/ExplainRequest.java` | DTO：code, runId, step, totalSteps, currentLine, variables |
| `service/DeepSeekService.java` | `@Service`：构建 System/User Prompt → HttpClient 流式调用 DeepSeek → BufferedReader 逐行解析 → onChunk 回调 |
| `controller/ExplainController.java` | `POST /api/explain`：SseEmitter 120s 超时，CompletableFuture.runAsync() 中调用 DeepSeekService，token 通过 emitter.send() 流式发出 |

**Prompt 设计：**
- System：中文教学助手，2-3句话，初学者友好，提及变量值和算法作用
- User：嵌入完整代码 + 当前步骤进度 + 高亮行号 + 变量状态 JSON

### 前端 (2 修改 + 1 新文件)

| 文件 | 操作 | 说明 |
|------|------|------|
| `stores/player.js` | 修改 | 新增 8 个 state：code, explainText, isExplaining, autoExplain, explainExpanded, explainError, explainAbortController；新增 requestExplain()（fetch + ReadableStream）、toggleExplainPanel()、toggleAutoExplain() |
| `components/AiTutorPanel.vue` | 新建 | AI 解说面板组件：蓝点标题栏 + 文本区 + 解说按钮，三态覆盖（空提示/加载/流式文本），自动/手动双模式 |
| `App.vue` | 修改 | 控制栏重构为纵向 flex（面板上方滑出 + 控件行下方），新增 ✨ AI 按钮，控制栏默认位置改为左下角编辑区 |

### 配置修改

`application.properties` 追加 3 行：
```properties
deepseek.api.key=<你的 DeepSeek API Key>
deepseek.api.url=https://api.deepseek.com/v1/chat/completions
deepseek.api.model=deepseek-chat
```

## 交互设计

```
折叠态：[drag][⏮][◀][▶][⏭]──progress──[▶️][1x][✨]
展开态：
┌─────────────────────────────────────────┐
│ ● AI 解说 3/14              [自动 ☐] [✕]│ ← 向上滑出
│ ┌───────────────────────────────────┐   │
│ │ 这里比较 arr[0] 和 arr[1]...      │   │
│ └───────────────────────────────────┘   │
│                              [🔄 解说]   │
├─────────────────────────────────────────┤
│ [drag][⏮][◀][▶][⏭]──progress──[▶️][1x][✨] │
└─────────────────────────────────────────┘
```

- 手动模式（默认）：点「解说」按钮获取当前步解说
- 自动模式：勾选「自动」后每次切步骤自动请求，旧请求自动 Abort
- 面板折叠时中止进行中的请求，清空文本
- 控制栏默认位于编辑区左下角（x: 20），不遮挡右侧变量卡片

## 验证结果

| # | 场景 | 结果 |
|---|------|------|
| 1 | `mvn compile` | ✅ BUILD SUCCESS |
| 2 | `npm run build` | ✅ built in 3.01s |
| 3 | `curl POST /api/explain` 直接调用 | ✅ event:chunk + data: 流式返回 |
| 4 | Vite proxy `/api/explain` 链路 | ✅ 代理正常 |
| 5 | DeepSeek API 联通性 | ✅ 流式返回中文解说内容 |

## 设计一致性

严格遵循 DESIGN.md：
- 蓝点标题（`.ai-dot`：7px, `var(--primary)`, opacity 0.8）
- 文本区：`var(--code-bg)` + `var(--border)`
- 解说按钮：`var(--accent-bg)` + `var(--accent-border)` + `var(--primary)`
- 动画：`cubic-bezier(.22,.9,.27,1)` 缓出
- 支持 `prefers-reduced-motion: reduce`

## Bug 修复记录

### B1 — UTF-8 中文乱码
- **现象**: AI 解说中文字符在浏览器中显示为乱码
- **根因**: `DeepSeekService.java` 中 `InputStreamReader(response.body())` 在 Windows 上默认使用 GBK 编码读取 UTF-8 响应
- **修复**: 显式指定 `StandardCharsets.UTF_8`

### B2 — 控制栏位置偏左
- **现象**: 控制栏默认位置在编辑区左侧边缘，不在编辑区正下方居中
- **根因**: 初始化计算 `editorLeft` 硬编码为 `12`，未考虑页面实际偏移
- **修复**: 改用 `containerRef.value.getBoundingClientRect().left` 获取真实左边界，`editorCenter = editorLeft + leftWidth / 2`

### B3 — AI 面板向下展开
- **现象**: 面板从控制栏下方展开，导致控制栏溢出屏幕底部
- **根因**: 面板在 flex 流中，max-height 增加时向下推控制栏
- **修复**: 面板改为 `position: absolute; bottom: 100%`，向上生长；面板与控制栏之间 8px 间隙，独立圆角卡片

### B4 — Markdown `**{...}**` 解析失效
- **现象**: `marked` v14 解析 `**{5,3,8}**` 时花括号导致粗体失败
- **根因**: 第三方解析器的边界兼容性问题
- **修复**: 替换为自研轻量渲染器，正则处理 `**bold**` 和 `` `code` ``

### B5 — 自动播放打断解说
- **现象**: 自动模式 + 自动播放时，定时器不等解说完成就切下一步
- **根因**: `setInterval` 无解说状态感知
- **修复**: 定时器 tick 检查 `autoExplain && isExplaining` → 跳过本次步进

### B6 — Prompt 不包含当前行源码
- **现象**: 在 `System.out.println` 行点解说，AI 仍描述上一步的 swap 操作
- **根因**: Prompt 只传行号"第12行"，AI 无法准确判断该行内容
- **修复**: `extractLine()` 提取行源码嵌入 Prompt：`` `System.out.println("hello");` ``；System Prompt 新增"必须优先基于当前高亮行的源代码来解释"

### B7 — 手动模式解说过期
- **现象**: 手动模式下切到新步骤，旧解说文本不清理，看起来像解说跟丢
- **根因**: 无步骤变化时的文本管理机制
- **修复**: `watch(currentStep)` 中手动模式自动清空 `explainText`；新增 `explainHistory` 缓存，回退步骤时从历史恢复

### B8 — 删代码后残留高亮 / 粘贴后全行高亮
- **现象**: (1) 运行后删除所有代码，空行仍显示黄色高亮 (2) 粘贴新代码后出现异常高亮
- **根因**: 旧装饰在 Monaco 中残留，编辑代码时未清理
- **修复**: `highlightLine` 加越界/空行检查 + `try/catch`；暴露 `clearHighlights()`；`editor.onDidChangeModelContent` 自动清除；`currentLine` 变 null 时清除

### B9 — 速度选择下拉样式不协调
- **现象**: 原生 `<select>` 弹窗是 OS 控件（白/黑矩形），与暗色主题冲突
- **修复**: 替换为自定义按钮 + `.card` 弹出菜单，与设计系统一致

### B10 — 滚动条白灰色违和
- **现象**: 变量卡片区浏览器默认滚动条（白/灰）与暗色主题冲突
- **修复**: `style.css` 添加全局 `::-webkit-scrollbar` 暗色样式

## 审查修复

### R1 — API Key 硬编码 (致命)
- **位置**: `application.properties`
- **修复**: 改为 `${DEEPSEEK_API_KEY:}` 环境变量占位符；Key 存入 gitignored `.env`；`start.bat` 自动加载

### R2 — SSE 解析逻辑重复 (中等)
- **位置**: `player.js:99` vs `AiTutorPanel.vue:185`（50 行重复 fetch + ReadableStream 实现）
- **修复**: `requestExplain()` 新增 `topic` 可选参数，`explainTag()` 缩减为 `store.requestExplain(tagName)` 一行调用

## 已知局限

- DeepSeek API 偶有网络波动，前端已处理 AbortError
- 首步解说有时较慢（2-4s），取决于 DeepSeek 响应速度
- 未做多轮对话（Phase 3 规划中）
