# 2026-08-15 Coze 阶段流式 + 回答代码引用修复开发日志

> 对应计划：`docs/superpowers/plans/2026-08-15-chat-stage-streaming-and-quote-fix.md`
> 涉及仓库：`JavaTutor`（分支 `feat/decision-trace-panel`）+ `javatutor-coze`（分支 `feat/agent-architecture-improve`）
> 状态：Task 1-5 完成并验证，Task 6 Step 2 本日志

## 背景

线上自由问答存在两个体验问题：

1. **回答整块蹦出**：等待期间没有任何阶段提示，用户不知道 AI 是否在工作。已实测 Coze `stream_run` 只推送 `message_start → answer → message_end`，`answer` 整块返回；`thinking / tool_request / tool_response` 字段存在但为 `null`，无法利用。
2. **回答中代码块固定残留**：模型输出 ```` ```jav ````（`java` 截断）和代码块内多余的单字符行 `a`，污染渲染。

## 根因

`nodes.py` 的 `_normalize_md` 规则 2 使用 `re.sub(r'(```\w*)([^\n])', ...)`，会把 ```` ```jav ```` 拆成 ```` ```ja ```` + `v`；随后 `_sanitize_code_quotes` 把 `v`、`a` 两行都当作单字符残留删除，最终留下 ```` ```ja ````——语言标签仍然截断。

另外原新测试 `assert "```jav" not in cleaned` 断言本身错误：`"```java"` 包含子串 `"```jav"`，该断言永远通过，测不到截断问题。

## 改动内容

### Coze 侧（javatutor-coze）

| 文件 | 改动 |
|---|---|
| `src/graphs/javatutor/nodes.py` | `_normalize_md` 规则 2 改为 `re.MULTILINE` + `_fix_fence_line` 回调，仅拆「围栏行后仍有同行内容」的情况；围栏后已是换行（含 ```` ```jav ```` 截断）保持原样。`_sanitize_code_quotes`（既有）负责归一 ```` ```jav → ```java ```` 并删除代码块开头单字符残留行 |
| `tests/test_build_final.py` | 新增 `test_normalize_md_keeps_truncated_fence_intact`；`test_sanitize_normalizes_truncated_java_language` 改为精确相等断言 |

清理链路（`build_final`）：`_normalize_md` → `_sanitize_code_quotes` → `_strip_leaked_json`。

### JavaTutor 侧（后端 + 前端）

阶段流式链路（方案 A，保留 Coze 部署）：

```
Coze stream_run
  → message_start 事件
    → CozeService.streamExplain(..., onStage) 调用 onStage.accept("正在分析代码并生成回答…")
      → CozeAIController.chat() 发送 SSE stage 事件
        → player.js 解析 stage 事件 → explainStage 状态
          → AiTutorPanel chat-stage UI（蓝点 + mono 文案）
  → answer 整块到达 → 阶段提示消失，最终回答渲染
```

| 文件 | 改动 |
|---|---|
| `backend/.../service/CozeService.java` | `streamExplain` 新增 `onStage: Consumer<String>` 回调；`message_start` 类型事件时推送阶段文案；两个阻塞方法补齐 `null` 参数 |
| `backend/.../controller/CozeAIController.java` | `chat()` 的 `onStage` 回调发送 `SseEmitter.event().name("stage").data(stage)` |
| `frontend/src/stores/player.js` | 新增 `explainStage` 状态；`askQuestion` 发起时重置；SSE 解析新增 `stage` 事件分支 |
| `frontend/src/components/AiTutorPanel.vue` | 新增阶段提示 UI：`.chat-stage` inline-flex mono 11px text-muted + 蓝色圆点 |

## 验证结果

| 门槛 | 仓库 | 命令 | 结果 |
|---|---|---|---|
| Coze 全量测试 | javatutor-coze | `uv run pytest -q` | **107 passed**（原 104 + 新增 2 + 验收 1） |
| Coze 验收 | javatutor-coze | 断言 `_sanitize_code_quotes("```jav\na\nint n = arr.length;\n```") == "```java\nint n = arr.length;\n```"` | 通过 |
| 后端编译 | JavaTutor/backend | `./mvnw -q -DskipTests compile` | exit 0 |
| 前端单测 | JavaTutor/frontend | `npm test` | 13 文件 / 121 测试通过 |
| 前端构建 | JavaTutor/frontend | `npm run build` | 通过 |

## 遗留问题

- **Task 4 Step 2 联调验收（可选）未做**：需启动前后端 + 真实 Coze 调用，在浏览器观察「正在分析代码并生成回答…」先出现、回答整块到达后消失。依赖浏览器人工观察，未在本轮执行。
- 两个仓库均有未提交改动，提交待用户明确指示（计划 Task 6 Step 3）。
