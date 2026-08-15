# 2026-08-15 单步问答链路修复记录

> 对应架构改进实现：`docs/devlog/2026-08-15-agent-architecture-improvement.md`

## 背景

前端提问“请解释当前这一步在做什么”时，Agent 回复“缺少具体要解释的执行步骤索引”，要求用户补充步骤号；决策痕迹中 `fallback_reason` 出现旧文案“用户输入内容不明确，不属于分类规则中定义的其他四类意图”，且部分请求 `tool_calls` 为空。

## 根因

1. 前端 `player.js` 的自由问答请求未携带执行步骤快照 `steps`。
2. 后端 `CozeAIController.chat()` 调用 `streamExplain` 时把 `steps` 传成 `null`，Agent 实际收到 `steps=[]`、`current_step_index` 无对应数据。
3. Agent 的 GSSC 上下文仅在 `has_steps=True` 时注入“当前执行位置”，步骤缺失时模型无法获知当前步骤索引/行号，只能向用户索要步骤号；即便调用 `step_facts` 也会因无步骤数据返回范围错误。
4. 当前代码从不写入 `fallback_reason` 文案，线上 trace 出现该文案说明运行的是旧构建或旧会话 checkpointer 残留。

## 改动清单

### JavaTutor（前后端）

- `frontend/src/stores/player.js`：`askQuestion` 请求体新增 `steps`，发送裁剪后的执行快照（`step` / `line` / `variables` / `heap` / `stackFrames` / `output`），与 animate 请求的瘦身方式一致。
- `backend/src/main/java/com/javatutor/controller/CozeAIController.java`：`/api/ai/chat` 将 `request.getSteps()` 转发给 `streamExplain`，不再传 `null`。

### javatutor-coze（Coze 侧）

- `src/graphs/javatutor/context_builder.py`：`gather` 的“当前执行位置”包改为 `has_steps` 或已知步骤索引/行号时都注入；步骤数据缺失时总步骤数标注“未提供”，避免模型误以为没有当前位置。
- `src/graphs/javatutor/nodes.py`：`_parse_json_dict` 将 `fallback_reason` 重置为空字符串，防止旧会话/旧构建的状态字段残留进决策痕迹。

## 验证结果

| 门槛 | 命令 | 结果 |
|---|---|---|
| Coze 侧全量测试 | `uv run pytest -q` | 101 passed |
| 单步链路模拟 | `parse_context → gather → step_facts` | 上下文含“当前执行位置 / 第 2 步 / 总步骤数 2”，`step_facts(step_index=1, line=6)` 返回变量证据与 diff，输出 `AGENT PATH OK` |
| JavaTutor 后端编译 | `mvnw -q -DskipTests compile` | 通过 |
| 前端语法检查 | `node --check frontend/src/stores/player.js` | 通过 |
| 改动范围 | `git diff --stat` | JavaTutor 2 个文件，javatutor-coze 2 个文件 |

## 遗留与下一步

- 改动未提交，遵循“不主动做 git 相关操作”的约定。
- 需要重新部署 JavaTutor 前端+后端与 Coze 项目；部署后建议使用新会话或清理旧会话再验证“请解释当前这一步在做什么”，预期输出“第 N 步 ……”并带 `step_facts` 的 `tool_calls`。
- 若线上仍出现旧 `fallback_reason` 文案，优先检查 Coze 平台是否拉到最新代码、会话是否复用旧状态。
