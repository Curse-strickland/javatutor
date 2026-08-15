# 2026-08-15 综合接力计划（流式验收 + 光标修复 + 耗时指标）

> 执行仓库：`JavaTutor`（分支 `feat/decision-trace-panel`）+ `javatutor-coze`（分支 `feat/agent-architecture-improve`）
> 执行方式：交给 Claude Code 按本计划逐任务执行。

## 背景

昨天到今天的相关工作已完成并提交：

- JavaTutor `539b57d feat:流式面板`：后端转发 `stage` 事件，前端阶段提示 UI。
- JavaTutor `0325d88 fix:some frontend bugs`：markdown XSS、DecisionTracePanel ARIA、`markdown.test.js`。
- javatutor-coze `de118a8 feat:流式展现思考过程`：提示词约束、critic 布尔修复、`_sanitize_code_quotes`、相关测试。

用户复测后仍有两个未满足点和一个新回归：

1. 前端输出“没有任何变化”，也没有思考过程。
2. 编辑区光标再次错位（昨天在 `feat/multi-file-project-run` 修过）。
3. 需要时间数据作为后续优化指标，当前没有记录。

## 现状核实（已做）

- 阶段流式代码已落在两个仓库并提交；用户看不到变化的原因极可能是前后端/Coze 未重新部署。
- 实测 Coze `stream_run`：`thinking / tool_request / tool_response` 字段为 `null`，`answer` 整块返回；选项 A 只能提供“正在分析代码并生成回答…”阶段提示，无法逐字流式展示思考/工具调用。
- 光标修复提交为 `feat/multi-file-project-run` 的 `98f44d4`（`Editor.vue`：显式加载 Maple Mono、`recalibrate()`、50/300/800/2000ms 延迟校准、字体事件监听）；该提交不是 `feat/decision-trace-panel` 的祖先，修复未随当前分支生效。
- 时间数据：代码中无 `latency` / `time_cost_ms` 记录；平台 `message_end` 返回 `time_cost_ms`（实测约 14 秒）但后端当前只处理 `answer / error / message_start`，该字段被丢弃。

## Task 1: 部署与阶段流式验收

- [ ] **Step 1: 重新部署**

部署顺序：`javatutor-coze` → JavaTutor 后端 → JavaTutor 前端。确认线上 Coze 项目已包含 `de118a8`，后端包含 `539b57d`，前端包含最新 `feat/decision-trace-panel`。

- [ ] **Step 2: 验收阶段提示**

运行代码后提问“请解释当前这一步在做什么”，等待期间应看到“正在分析代码并生成回答…”，回答到达后提示消失，决策痕迹仍以可折叠面板展示。

Expected: 阶段提示先出现，最终回答整块到达。

- [ ] **Step 3: 验收 `a` 残留修复**

Expected: 回答中的代码块语言为 ```` ```java ````，代码行前不再出现单独的 `a`。

- [ ] **Step 4: 记录结论**

若部署后仍无变化，检查浏览器 Network 中 `/api/ai/chat` 是否出现 `event: stage`；无则排查后端 SSE 转发，有则排查前端 `explainStage` 渲染。

## Task 2: 移植光标修复

**Files:**
- Modify: `JavaTutor/frontend/src/components/Editor.vue`

- [ ] **Step 1: 移植**

把 `feat/multi-file-project-run` 提交 `98f44d4` 中 `frontend/src/components/Editor.vue` 的改动移植到当前分支：

```bash
git -C "D:\Chome\Documents\Projects\EL\JavaTutor" show 98f44d4 -- frontend/src/components/Editor.vue
```

要点：
- 抽出顶层 `recalibrate()`（`editor.layout()` + `remeasureFonts()`）。
- 不再依赖 `document.fonts.ready`；改为显式 `document.fonts.load("16px 'Maple Mono'")` 后再 `initMonaco()`。
- 注册 `loadingdone` / `loadingerror` 监听并校准；`onBeforeUnmount` 移除监听。
- 保留 50 / 300 / 800 / 2000ms 延迟校准。

- [ ] **Step 2: 验证**

前端启动后：快速输入、切换文件、窗口缩放后光标与字符对齐；连续输入 50 字符不出现光标偏左/偏右。

Expected: 光标不再错位。

- [ ] **Step 3: 回归**

`cd frontend && npm test && npm run build`。

## Task 3: 增加耗时指标

### Coze 侧（决策痕迹增加 `latency_ms`）

- [ ] **Step 1: 记录请求起点**

`javatutor-coze/src/graphs/javatutor/nodes.py` 的 `_parse_json_dict` 返回值追加 `"request_started_at": time.time()`。

- [ ] **Step 2: trace 增加 `latency_ms`**

`build_final` 的 trace 追加：

```python
"latency_ms": round((time.time() - float(state.get("request_started_at", time.time()))) * 1000, 1),
```

确保 `nodes.py` 顶部已 `import time`。

- [ ] **Step 3: 更新接口契约**

`javatutor-coze/docs/spec/2026-08-10-coze-agent-interface.md` 的 trace schema 补充 `latency_ms` 字段说明。

- [ ] **Step 4: 测试**

`uv run pytest -q`；在 `tests/test_build_final.py` 增加断言 `latency_ms` 为数值。

### JavaTutor 侧（后端记录与转发）

- [ ] **Step 5: 后端记录请求耗时**

`CozeService` 记录 `System.currentTimeMillis()` 起始时间，`answer` 完成或异常时输出 `latencyMs` 日志（SLF4J）。

- [ ] **Step 6: 解析平台耗时**

SSE 循环增加 `message_end` 分支，读取 `content.message_end.time_cost_ms` 与 `token_cost` 写入日志。

- [ ] **Step 7: 编译**

`cd backend && .\mvnw.cmd -q -DskipTests compile`。

### 评测侧（指标落库）

- [ ] **Step 8: 评测报告记录 latency**

检查 `javatutor-coze/tools/eval_cli.py` 是否已输出 `avg_latency`；未输出则按请求墙钟时间补充，并写入报告 JSON。

## Task 4: 综合回归

- [ ] **Step 1: Coze 侧**

`javatutor-coze`：`uv run pytest -q` 全绿。

- [ ] **Step 2: JavaTutor 后端**

`JavaTutor/backend`：`.\mvnw.cmd -q -DskipTests compile`。

- [ ] **Step 3: JavaTutor 前端**

`JavaTutor/frontend`：`npm test` 与 `npm run build`。

- [ ] **Step 4: 端到端**

部署后复测：阶段提示、`a` 残留、光标、决策痕迹折叠、`latency_ms` 出现在决策痕迹中。

## Task 5: 文档与提交

- [ ] **Step 1: 文档登记**

本计划已在 `AGENTS.md` 登记；完成后写 `docs/devlog/2026-08-15-integrated-followup.md`，记录改动、验证与遗留。

- [ ] **Step 2: 清理 coze 仓库工作区**

`javatutor-coze` 当前仍有未提交的 `AGENT.md` 修改与 `docs/devlog/2026-08-15-chat-step-context-fix.md` 删除（文档已迁往 JavaTutor）；确认无重复内容后一并提交或还原。

- [ ] **Step 3: 提交**

仅当用户明确指示时提交；提交前检查无硬编码密钥。

## Self-Review

### Spec Coverage

| 需求 | 对应任务 |
|---|---|
| 阶段流式可见 | Task 1 |
| 光标错位修复 | Task 2 |
| 耗时指标 | Task 3 |
| 回归与文档 | Task 4、Task 5 |

### Placeholder Scan

计划无 `TBD`、`TODO`；所有代码块完整。
