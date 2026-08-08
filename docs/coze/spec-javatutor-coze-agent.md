---
title: JavaTutor Coze 智能体代码化实现规格
version: 1.0
date_created: 2026-08-07
last_updated: 2026-08-07
owner: JavaTutor AI 智能体组
tags: design, architecture, process, app
---

# Introduction

本规格将原低代码方案 [docs/ai-agent-plan.md](../docs/ai-agent-plan.md) 转化为在 Coze Vibe Coding 项目内以 Python + LangGraph 代码实现的智能体规格。原方案依赖 Coze Studio 的对话流节点、知识库、长期记忆等平台能力；本规格要求这些能力以代码形式重新实现，并保持“严格流程驱动”的确定性路由。产出物将上传到 Coze 项目，由 Coze 平台的代码 Agent 按实施计划逐任务实现。

## 1. Purpose & Scope

**目的**：在 `javatutor-coze-agent` 项目中，用代码实现 JavaTutor 教学智能体的完整对话流，包括：TraceEngine 数据解析、意图路由、四个专家分支、算法动画 SVG 生成、知识检索、跨会话记忆，以及可被 JavaTutor 后端调用的 HTTP/SSE 接口。

**范围**：
- 包含：智能体运行时（`src/agents/`、`src/graphs/`、`src/learning/`）、测试、知识资产、记忆存储、HTTP 协议。
- 不包含：JavaTutor 前端与后端改造（仅定义它们需要调用的接口契约）、Coze Studio 可视化编排、登录鉴权系统。

**受众**：执行本规格的 Coze 代码 Agent、JavaTutor AI 智能体组开发人员、后端对接人员。

**假设**：
- 开发在 Coze 项目终端内完成，项目结构与本地导出模板一致。
- 模型端点通过环境变量注入，智能体只调用 OpenAI 兼容接口。
- JavaTutor 后端会把结构化数据以 JSON 字符串形式放进用户消息中发送。

## 2. Definitions

| 术语 | 定义 |
|---|---|
| TraceEngine | JavaTutor 后端的插桩执行引擎，产出逐步执行的 `steps` 数组 |
| steps | 执行步骤数组，每步含 `step`、`line`、`variables`、`heap`、`stackFrames`、`output` 等字段 |
| raw_message | JavaTutor 后端发送的原始 JSON 字符串，包含源代码、steps、用户问题等 |
| 意图（intent） | 对话流路由依据，取值为 `data_query`、`concept`、`animate`、`debug`、`other` |
| SVG/SMIL | 算法动画输出格式，SMIL 指 SVG 内嵌 `<animate>` 动画 |
| 长期记忆 | 按 `user_id` 持久化的学习画像与对话记录 |
| 用户变量 | 结构化用户画像字段：`skill_level`、`attempted_algorithms`、`completed_algorithms`、`common_mistakes`、`total_sessions` |
| LangGraph | Python 图执行框架，用于实现流程节点与条件边 |
| StateGraph | LangGraph 的图构建器，本规格统一使用 |
| checkpointer | LangGraph 会话检查点，模板中已提供 Postgres/Memory 两种实现 |
| workload identity | Coze 平台注入的身份环境变量，用于获取项目级密钥与数据库地址 |
| SSE | Server-Sent Events，`/stream_run` 的流式返回协议 |

## 3. Requirements, Constraints & Guidelines

### Requirements

- **REQ-001**: 输入消息必须兼容 JavaTutor 后端 JSON：`source_code`、`steps`、`current_step_index`、`current_line`、`user_question`、`user_id`、`compile_error`。
- **REQ-002**: 必须实现 `parse_context` 节点，把原始消息解析为统一字段：`source_code`、`steps_json`、`steps_count`、`has_steps`、`current_step_index`、`current_line`、`current_variables`、`user_question`、`user_id`、`compile_error`、`has_error`。
- **REQ-003**: 路由必须严格流程驱动：`has_error == true` 直接短路到 `debug`；否则执行意图识别。
- **REQ-004**: 必须实现五个意图分支：`data_query`、`concept`、`animate`、`debug`、`other`。
- **REQ-005**: `animate` 分支必须基于真实 `steps` 数据输出含 SMIL 动画的 SVG 字符串。
- **REQ-006**: 专家回答必须引用真实执行数据（步骤号、行号、变量值），不得凭空推理。
- **REQ-007**: 必须按 `user_id` 读写长期记忆：学习画像表与对话记录表。
- **REQ-008**: 记忆加载发生在意图路由之前，记忆写回发生在专家分支之后、最终回复之前。
- **REQ-009**: `build_agent(ctx=None)` 必须存在，返回值必须暴露 `.builder`，供 `src/main.py` 的 `base.builder.compile(...)` 调用。
- **REQ-010**: 最终输出必须追加一条 assistant 消息，内容为专家回答（`animate` 分支包含 SVG）。
- **REQ-011**: 意图识别默认使用确定性规则；命中失败时允许 LLM 兜底，但兜底必须可开关。

### Constraints

- **CON-001**: 不得修改 `.coze`、`scripts/`、`src/main.py`、`src/storage/`、`src/utils/` 中现有文件。
- **CON-002**: 新代码只能放在 `src/agents/`、`src/graphs/`、`src/tools/`、`src/learning/`、`assets/`、`config/`、`tests/`、`docs/`。
- **CON-003**: Python 版本必须为 3.12（`pyproject.toml` 要求 `>=3.12`，`.coze` 要求 `python-3.12`）。
- **CON-004**: 依赖管理只用 `uv`，新增依赖写入 `pyproject.toml` 的 `dependencies`，并更新 `uv.lock`。
- **CON-005**: 禁止 `from src.xxx import ...` 前缀，统一 `from agents.agent import ...`、`from graphs.javatutor.nodes import ...`。
- **CON-006**: 模型配置从 `config/agent_llm_config.json` 读取，API Key 与 Base URL 必须来自 `COZE_WORKLOAD_IDENTITY_API_KEY`、`COZE_INTEGRATION_MODEL_BASE_URL`。
- **CON-007**: 文件名只允许字母、数字、下划线、短横线。
- **CON-008**: 平台 SDK 版本区间（`coze-coding-utils >=0.2.8,<1`、`coze-coding-dev-sdk >0.5.0,<1` 等）不得改动。

### Security

- **SEC-001**: 禁止硬编码 API Key、Token、数据库密码。
- **SEC-002**: 用户输入必须按字符串处理，禁止直接执行 Java 代码或任意 shell。
- **SEC-003**: 对外 HTTP 服务后续必须由 JavaTutor 后端接入自有鉴权；本规格不实现鉴权，但接口必须支持在请求头透传 `user_id` 与 `x-run-id`。

### Guidelines

- **GUD-001**: 优先确定性规则，LLM 只承担“需要语义理解的分类/回答”。
- **GUD-002**: SVG 动画优先使用模板与确定性生成，LLM 不负责生成 SVG 结构。
- **GUD-003**: 每个函数都要有纯逻辑单元测试，测试数据使用固定 fixture。
- **GUD-004**: 回答风格遵循原方案：中文、友好、引用步骤号与行号、不直接给完整作业代码。
- **GUD-005**: 记忆与知识库访问失败时降级为无记忆模式，不得导致对话失败。

### Patterns

- **PAT-001**: LangGraph 节点统一为 `def node_name(state) -> dict`，返回值只包含本次更新的字段。
- **PAT-002**: 条件路由使用 `add_conditional_edges`，映射表覆盖全部意图。
- **PAT-003**: 模型可注入：节点支持 `model` 参数或 `configurable.chat_model`，测试使用 FakeModel。
- **PAT-004**: 新增包内模块保持单一职责：`state.py` 只放状态，`nodes.py` 只放节点，`graph.py` 只放构图。

## 4. Interfaces & Data Contracts

### 4.1 JavaTutor 后端输入

```json
{
  "source_code": "public class BubbleSort { ... }",
  "steps": [
    {
      "step": 0,
      "line": 3,
      "variables": { "arr": [5, 3, 8, 1] },
      "heap": {},
      "stackFrames": [],
      "output": null
    }
  ],
  "current_step_index": 0,
  "current_line": 3,
  "user_question": "为什么 arr[1] 变成了 3？",
  "user_id": "a3f2b1c4-5d6e-4f7a-8b9c-0d1e2f3a4b5c",
  "compile_error": ""
}
```

消息以 JSON 字符串形式放入用户消息 `content`，由 `parse_context` 解析。

### 4.2 状态 Schema（`src/graphs/javatutor/state.py`）

```python
from typing import Annotated, Any, TypedDict
from langgraph.graph.message import add_messages
from langchain_core.messages import AnyMessage


class JavaTutorState(TypedDict, total=False):
    messages: Annotated[list[AnyMessage], add_messages]
    raw_message: str
    source_code: str
    steps: list[dict[str, Any]]
    steps_json: str
    steps_count: int
    has_steps: bool
    current_step_index: int
    current_line: int
    current_variables: str
    user_question: str
    user_id: str
    compile_error: str
    has_error: bool
    intent: str
    answer: str
    svg_text: str
    memory_summary: str
    quickref_hits: list[str]
```

### 4.3 意图取值

| intent | 触发示例 | 处理节点 |
|---|---|---|
| `data_query` | “为什么 arr[3] 是 7”“第 N 步发生了什么” | 数据追问专家 |
| `concept` | “冒泡排序原理”“时间复杂度” | 算法讲解专家 |
| `animate` | “生成动画”“可视化演示” | 动画生成器 |
| `debug` | “报错了怎么改”“NullPointerException” | 错误诊断专家 |
| `other` | “你是谁”“工具怎么用” | 通用助手 |

### 4.4 输出协议

- `/stream_run`：SSE 流式事件由 `src/main.py` 现有 agent stream handler 组装，最终必须包含 assistant 消息。
- `/v1/chat/completions`：OpenAI 兼容返回，`choices[0].message.content` 为最终回答。
- `animate` 分支的 SVG 放入最终回答文本；前端按 `<svg` 标记提取。

### 4.5 记忆数据表

```sql
CREATE TABLE IF NOT EXISTS user_profiles (
    user_id VARCHAR(64) PRIMARY KEY,
    skill_level VARCHAR(16) NOT NULL DEFAULT 'beginner',
    attempted_algorithms JSONB NOT NULL DEFAULT '[]',
    completed_algorithms JSONB NOT NULL DEFAULT '[]',
    common_mistakes JSONB NOT NULL DEFAULT '[]',
    total_sessions INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS learning_records (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL,
    intent VARCHAR(32) NOT NULL,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

### 4.6 SVG 模板契约

- 模板文件放 `assets/svg_templates/`，命名如 `sort_bars.svg`、`search_bars.svg`。
- 生成器输出必须包含 `<svg`、`<animate`，并包含至少一个真实数值。
- 生成器签名：`build_animation_svg(steps: list[dict], algorithm_tag: str) -> str`。
- 分类签名：`classify_algorithm(source_code: str) -> str`，返回 `sort`、`search` 或 `other`。

## 5. Acceptance Criteria

- **AC-001**: 给定含 `compile_error` 非空的输入，无论问题是什么，路由结果必须为 `debug`。
- **AC-002**: 给定含真实 steps 与“为什么 arr 变化”的问题，路由结果必须为 `data_query`。
- **AC-003**: 给定“生成动画/演示”类问题，输出文本必须包含可渲染的 `<svg ...>...</svg>` 且含 `<animate`。
- **AC-004**: 给定无 steps 但问概念的问题，路由结果必须为 `concept`，回答不得引用不存在的步骤。
- **AC-005**: `build_agent(ctx=None)` 返回值 `.builder.compile()` 必须成功，且可用 `{"messages": [...]}` 调用。
- **AC-006**: 带 `user_id` 的对话结束后，`user_profiles.total_sessions` 与 `learning_records` 必须新增记录。
- **AC-007**: 记忆/知识库不可用时，对话仍能完成，最终回复不得包含异常堆栈。
- **AC-008**: 全部新增代码通过 `uv run pytest`，无跳过、无 xfail。
- **AC-009**: `/health`、`/graph_parameter`、`/v1/chat/completions` 三个接口在本地/Coze 终端可调用。

## 6. Test Automation Strategy

- **Test Levels**: 单元测试（节点纯逻辑）、图集成测试（FakeModel 注入）、HTTP 冒烟（curl）。
- **Frameworks**: `pytest`、`pytest-asyncio`，模型使用测试内 FakeModel，不依赖真实网络。
- **Test Data Management**: 固定 fixture 放 `tests/fixtures/`：`sample_payload.json`、`sample_steps.json`、`error_quickref.json`；每个测试独立构造数据，不共享可变状态。
- **CI/CD Integration**: 每次任务提交前运行 `uv run pytest tests/`；最终验证运行 HTTP 冒烟命令。
- **Coverage Requirements**: 解析、路由、动画、记忆四类核心函数的语句覆盖必须到关键分支；不设硬性百分比阈值。
- **Performance Testing**: `steps` 超过 500 条时，解析与动画生成耗时不得超过 5 秒（本地基线，不纳入 CI）。

## 7. Rationale & Context

原低代码方案把“流程”放在 Coze Studio 节点编排中，存在三方面问题：预览在导出/回传后不可用、节点逻辑无法本地测试、提示词与分支散落平台侧。改为代码实现后，流程由 LangGraph 条件边显式表达，测试可自动化，版本可管理；同时保留“严格流程驱动”的诉求：分支顺序与短路逻辑全部由代码决定，不依赖模型自主选路。

## 8. Dependencies & External Integrations

### External Systems
- **EXT-001**: JavaTutor 后端 - 通过 HTTP 调用本服务，发送结构化 JSON 并消费 SSE/OpenAI 兼容响应。

### Third-Party Services
- **SVC-001**: OpenAI 兼容模型端点 - 提供 `ChatOpenAI` 可调用的 chat completions 接口，由 `COZE_INTEGRATION_MODEL_BASE_URL` 指定。
- **SVC-002**: PostgreSQL - 提供 `user_profiles`、`learning_records` 存储；不可用时降级为无记忆模式。

### Infrastructure Dependencies
- **INF-001**: Coze Vibe Coding 运行环境 - Python 3.12、`uv`、注入 `COZE_WORKSPACE_PATH`、`PIP_TARGET`、`DEPLOY_RUN_PORT`。
- **INF-002**: 对象存储（可选）- 模板 `src/storage/s3/s3_storage.py` 已提供，产物文件默认先写 `/tmp` 再上传。

### Data Dependencies
- **DAT-001**: TraceEngine `steps` JSON - 数组格式，字段名与本规格 4.1 一致。
- **DAT-002**: Java 错误速查与标准库文档 - 以 JSON 资产形式放 `assets/knowledge/`。

### Technology Platform Dependencies
- **PLT-001**: Python 3.12 - `pyproject.toml` 与 `.coze` 均要求。
- **PLT-002**: LangGraph/LangChain 1.x - 模板锁定版本，不升级。

### Compliance Dependencies
- **COM-001**: 无 GDPR 类硬性合规要求，但 `user_id` 为匿名 UUID，记忆数据不得关联真实身份。

## 9. Examples & Edge Cases

### 示例输入

```json
{
  "source_code": "public class Main { public static void main(String[] a) { int[] arr = {5,3,1}; } }",
  "steps": [
    {"step": 0, "line": 3, "variables": {"arr": [5,3,1]}},
    {"step": 1, "line": 4, "variables": {"arr": [3,5,1]}},
    {"step": 2, "line": 4, "variables": {"arr": [3,1,5]}}
  ],
  "current_step_index": 1,
  "current_line": 4,
  "user_question": "这一步 arr 怎么变的？",
  "user_id": "u-001",
  "compile_error": ""
}
```

### 边界情况

| 场景 | 期望行为 |
|---|---|
| 消息不是合法 JSON | `parse_context` 返回全空字段，`user_question` 取原文，进入 `other` |
| `steps` 为空数组 | `has_steps=false`，`data_query` 分支提示先运行代码 |
| `compile_error` 非空 | 跳过意图识别，直接 `debug` |
| `current_step_index` 越界 | `current_variables="{}"`，不抛异常 |
| 缺 `user_id` | 记忆节点跳过写入，对话继续 |
| 动画分类无法识别 | 返回 `other` 分类，`animate` 分支给出友好说明 |
| `steps` 超过 500 条 | 解析与生成仍可完成，不截断步骤数据用于回答 |

## 10. Validation Criteria

- `uv run pytest tests/` 全部通过。
- `python -c "from agents.agent import build_agent; g = build_agent().builder.compile(); print('ok')"` 输出 `ok`。
- 本地/Coze 终端执行：`/health` 返回 `status=ok`，`/graph_parameter` 返回非空 JSON，`/v1/chat/completions` 返回 assistant 回答。
- 上传回 Coze 后，项目预览可正常发起对话（此为最终验收，由人工确认）。

## 11. Related Specifications / Further Reading

- [原方案：Coze 智能体方案](../docs/ai-agent-plan.md)
- 实施计划：`docs/superpowers/plans/2026-08-07-javatutor-coze-code-agent.md`
