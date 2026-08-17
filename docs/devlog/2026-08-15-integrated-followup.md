# 2026-08-15 综合接力开发日志（流式验收 + 光标修复 + 耗时指标）

> 对应计划：`docs/superpowers/plans/2026-08-15-integrated-followup-plan.md`
> 涉及仓库：`JavaTutor`（分支 `feat/decision-trace-panel`）+ `javatutor-coze`（分支 `feat/agent-architecture-improve`）
> 状态：Task 2/3/4 完成并验证，Task 1 与浏览器人工验收待做，提交待用户指示

## 背景

上轮工作（阶段流式 `539b57d`、前端 bug 修复 `0325d88`、Coze 思考过程 `de118a8`）已提交后，用户复测发现三个遗留问题：

1. **前端输出“没有任何变化”**：阶段流式代码已落库但未重新部署，用户看不到变化。
2. **编辑区光标再次错位**：光标修复在 `feat/multi-file-project-run` 的 `98f44d4`，不是当前分支祖先，未生效。
3. **无耗时数据**：`latency / time_cost_ms` 均无记录，`message_end` 的 `time_cost_ms` 被丢弃，无法作为优化指标。

## 改动内容

### Task 2：移植光标修复（`frontend/src/components/Editor.vue`）

从 `98f44d4` 移植，当前分支 diff 与源提交逐字节一致（index `05994b0..bc3ab1d`）：

| 改动 | 说明 |
|---|---|
| 顶层 `recalibrate()` | 抽出 `editor.layout()` + `remeasureFonts()`，供事件监听复用 |
| `initMonaco` 提取 | 原 `document.fonts.ready.then(() => {...})` 主体改为具名函数 |
| 显式字体加载 | `document.fonts.load("16px 'Maple Mono'").catch(() => {}).then(initMonaco)`，不再依赖 `document.fonts.ready`（会被无关 Google Fonts 拖慢/干扰时序） |
| 延迟校准 50/300/800/2000ms | 覆盖字体初始化后仍未就绪、随后 swap 的场景 |
| `loadingdone` / `loadingerror` 监听 | 字体晚到/swap 后强制重新测宽，修复光标累积偏左 |
| `onBeforeUnmount` 清理 | 移除两个字体监听，避免泄漏 |

### Task 3：增加耗时指标

**Coze 侧（决策痕迹 `latency_ms`）**

- `src/graphs/javatutor/nodes.py`：`import time`；`_parse_json_dict` 返回 `"request_started_at": time.time()`；`build_final` 的 trace 追加 `"latency_ms": round((time.time() - float(state.get("request_started_at", time.time()))) * 1000, 1)`。
- `tests/test_build_final.py`：现有 trace 测试追加断言 `latency_ms` 为数值且 ≥ 0。
- `docs/spec/2026-08-10-coze-agent-interface.md`：trace schema 与字段表补充 `latency_ms` 说明，两个示例同步更新。

**JavaTutor 后端（请求耗时日志）**

- `backend/.../service/CozeService.java`：新增 SLF4J logger；`streamExplain` 入口记录 `startMs`；SSE 循环新增 `message_end` 分支，读取平台 `time_cost_ms` 与 `token_cost`，输出 `wallLatencyMs / platformTimeCostMs / tokenCost` 日志；异常路径（Coze 错误与非 Coze 解析错误）均记录失败耗时。

**评测侧（`avg_latency`）**

- 检查结论：**无需改动**。`eval/runner/e2e_remote.py` 已记录每请求墙钟 `latency`，`eval/runner/report.py` 的 `compute_extended_metrics` 已汇总 `avg_latency`，经 `cmd_report` 写入 `summary.json`。`tools/eval_cli.py` 链路已完整输出该指标。

## 验证结果

| 门槛 | 命令 | 结果 |
|---|---|---|
| Coze 全量测试 | `uv run pytest -q` | **107 passed** |
| 后端编译 | `./mvnw.cmd -q -DskipTests compile` | exit 0 |
| 前端单测 | `npm test` | 13 文件 / **121 测试**通过 |
| 前端构建 | `npm run build` | 通过（chunk 体积告警为既有项） |

## 工作区清理

- `javatutor-coze`：AGENT.md 改动与 `docs/devlog/2026-08-15-chat-step-context-fix.md` 删除已由用户随 `de118a8` 等提交；本计划仅剩本次三处改动（`nodes.py`、`test_build_final.py`、接口契约）。
- 确认 JavaTutor 侧已有同名 devlog 镜像，coze 侧删除无内容丢失。

## 遗留问题

- **Task 1 部署与验收未做**：需重新部署 Coze 项目（含 `de118a8`）、JavaTutor 后端（含 `539b57d` 与本次后端改动）、前端（含最新分支），然后在浏览器观察：① 提问等待期出现“正在分析代码并生成回答…”；② 回答代码块无 ```` ```jav ````/`a` 残留；③ 决策痕迹面板含 `latency_ms`。若部署后仍无阶段提示，按计划检查 Network 中 `/api/ai/chat` 是否出现 `event: stage`。
- **光标人工验证未做**（Task 2 Step 2）：需浏览器验证快速输入、切换文件、窗口缩放后光标与字符对齐。
- 两个仓库均有未提交改动，提交待用户明确指示（计划 Task 5 Step 3）。
