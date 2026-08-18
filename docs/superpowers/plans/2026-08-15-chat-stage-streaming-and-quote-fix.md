# 2026-08-15 Coze 阶段流式 + 回答代码引用修复实施计划

> 执行仓库：`JavaTutor`（分支 `feat/decision-trace-panel`）+ `javatutor-coze`（分支 `feat/agent-architecture-improve`）
> 执行方式：交给 Claude Code 按本计划逐任务 TDD 执行。

## 背景与目标

线上自由问答存在两个问题：

1. 最终回答整块蹦出，等待期间没有任何阶段提示。
2. 回答中代码块固定出现残留：模型输出 ```` ```jav ````（`java` 截断）和代码块内多余的单字符行 `a`。

已实测 Coze `stream_run` 只推送 `message_start → answer → message_end`，`answer` 是整块返回；`thinking / tool_request / tool_response` 字段存在但为 `null`。

目标（方案 A）：保留 Coze 部署，后端转发 `stage` 事件，前端展示“正在分析代码并生成回答…”；Coze 侧通过提示词约束 + 确定性清理修掉 `a` 残留。

## 当前工作区状态（交接）

以下改动已落在工作区但未提交：

| 仓库 | 文件 | 改动 |
|---|---|---|
| javatutor-coze | `src/graphs/javatutor/prompts.py` | 新增 `line_text` 原样引用、代码块语言必须为 `java` 的硬性规则；critic 新增代码行一致性检查 |
| javatutor-coze | `src/graphs/javatutor/critic.py` | 新增 `_as_bool`，修复 `"false"` 字符串被 `bool()` 误判为通过的问题 |
| javatutor-coze | `src/graphs/javatutor/nodes.py` | 新增 `_sanitize_code_quotes` 并在 `build_final` 调用 |
| javatutor-coze | `tests/test_critic.py`、`tests/test_build_final.py` | 新增测试 |
| JavaTutor | `backend/.../service/CozeService.java` | `streamExplain` 增加 `onStage` 回调，`message_start` 时发送阶段事件 |
| JavaTutor | `backend/.../controller/CozeAIController.java` | `chat()` 转发 `stage` SSE 事件 |
| JavaTutor | `frontend/src/stores/player.js` | 新增 `explainStage` 状态与 `stage` 事件解析 |
| JavaTutor | `frontend/src/components/AiTutorPanel.vue` | 新增阶段提示 UI（蓝点 + 文案） |

当前验证结果：

- `javatutor-coze`：`uv run pytest -q` 有 2 个失败（`tests/test_build_final.py`）。
- JavaTutor 后端：`mvnw.cmd -q -DskipTests compile` 通过。
- JavaTutor 前端：`npm test`（121 passed）与 `npm run build` 通过。

失败根因：`nodes.py` 的 `_normalize_md` 规则 2 使用 `re.sub(r'(```\w*)([^\n])', ...)`，会把 ```` ```jav ```` 拆成 ```` ```ja ```` + `v`；随后 `_sanitize_code_quotes` 把 `v`、`a` 两行都当作单字符残留删除，最终留下 ```` ```ja ````。另外新测试里 `assert "```jav" not in cleaned` 断言本身错误（`"```java"` 包含子串 `"```jav"`）。

## Task 1: 修复 `_normalize_md` 围栏处理（根因）

**Files:**
- Modify: `javatutor-coze/src/graphs/javatutor/nodes.py`

- [ ] **Step 1: 写失败测试**

在 `tests/test_build_final.py` 增加：

```python
def test_normalize_md_keeps_truncated_fence_intact():
    from graphs.javatutor.nodes import _normalize_md

    raw = "```jav\na\nint n = arr.length;\n```"
    assert "```jav" in _normalize_md(raw)
```

Expected: 当前实现失败（`_normalize_md` 会把 ```` ```jav ```` 拆成 ```` ```ja ```` + `v`）。

- [ ] **Step 2: 修复实现**

将 `_normalize_md` 规则 2 改为按行处理：仅当围栏行 ```` ```lang ```` 后仍有同行内容时，才拆成围栏行 + 内容行；围栏后已是换行时保持原样。

```python
def _fix_fence_line(match):
    fence = match.group(1)
    rest = match.group(2).strip()
    if not rest:
        return match.group(0)
    return fence + "\n" + rest

text = re.sub(r'^(```\w*)(.*)$', _fix_fence_line, text, flags=re.MULTILINE)
```

- [ ] **Step 3: 运行测试确认通过**

Run（`javatutor-coze`）：`uv run pytest tests/test_build_final.py -q`

Expected: 全部通过。

## Task 2: 修正 sanitizer 测试断言

**Files:**
- Modify: `javatutor-coze/tests/test_build_final.py`

- [ ] **Step 1: 修改断言**

将：

```python
assert "```jav" not in cleaned
```

改为精确断言：

```python
assert cleaned == "```java\nint n = arr.length;\n```"
```

- [ ] **Step 2: 运行测试**

Run（`javatutor-coze`）：`uv run pytest tests/test_build_final.py -q`

Expected: 4 passed。

## Task 3: Coze 侧全量回归

- [ ] **Step 1: 全量测试**

Run（`javatutor-coze`）：`uv run pytest -q`

Expected: 106 passed（原 104 + 新增 2 修复后全绿）。

- [ ] **Step 2: 验收清理效果**

```python
from graphs.javatutor.nodes import _sanitize_code_quotes
assert _sanitize_code_quotes("```jav\na\nint n = arr.length;\n```") == "```java\nint n = arr.length;\n```"
```

Expected: 无断言错误。

## Task 4: JavaTutor 后端编译与阶段事件

- [ ] **Step 1: 编译**

Run（`JavaTutor/backend`，Windows）：`.\mvnw.cmd -q -DskipTests compile`

Expected: BUILD SUCCESS。

- [ ] **Step 2: 联调验收（可选）**

启动前后端后，在自由问答等待期间应看到“正在分析代码并生成回答…”，随后最终回答整块到达；决策痕迹面板仍正常折叠展示。

Expected: 阶段提示先出现，回答后消失。

## Task 5: 前端回归

- [ ] **Step 1: 测试与构建**

Run（`JavaTutor/frontend`）：`npm test` 与 `npm run build`

Expected: 测试全绿，构建通过。

## Task 6: 文档与提交

- [ ] **Step 1: 登记文档**

在 `AGENTS.md` 的「文档」表登记本计划。

- [ ] **Step 2: 撰写 devlog**

完成后写 `docs/devlog/2026-08-15-chat-stage-streaming-quote-fix.md`，记录改动内容、验证结果与遗留问题，并在 `AGENTS.md` 登记。

- [ ] **Step 3: 提交**

仅当用户明确指示时提交；提交前检查无硬编码密钥。

## Self-Review

### Spec Coverage

| 需求 | 对应任务 |
|---|---|
| 阶段流式提示（方案 A） | Task 4、Task 5 |
| `a` 残留确定性清理 | Task 1、Task 2、Task 3 |
| 提示词与 critic 兜底 | 工作区已改 + Task 3 回归 |
| 最终回答整块展示 | 保持不变，阶段提示补充等待体验 |

### Placeholder Scan

计划无 `TBD`、`TODO`；所有代码块完整。
