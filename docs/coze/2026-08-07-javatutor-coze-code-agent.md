# JavaTutor Coze Code Agent Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Coze Vibe Coding 项目内用 Python + LangGraph 实现 JavaTutor 教学智能体：解析 TraceEngine 数据、严格意图路由、专家回答、SVG 动画、知识检索与跨会话记忆。

**Architecture:** 使用自定义 `StateGraph` 表达严格流程：`parse_context -> load_memory -> route_intent -> 五个分支 -> write_memory -> final`。`build_agent(ctx=None)` 返回暴露 `.builder` 的 `AgentBundle`，保持 `src/main.py` 外壳契约不变；模型通过 `configurable.chat_model` 注入以便测试。

**Tech Stack:** Python 3.12、LangGraph 1.0、LangChain 1.0、FastAPI（外壳）、pytest、SQLAlchemy（记忆）、Jinja2 风格字符串模板（SVG 生成，不引入新依赖）。

## Global Constraints

- 不得修改 `.coze`、`scripts/`、`src/main.py`、`src/storage/`、`src/utils/` 中现有文件。
- 新代码只允许放在 `src/agents/`、`src/graphs/`、`src/tools/`、`src/learning/`、`assets/`、`config/`、`tests/`、`docs/`。
- Python 版本 3.12；依赖管理只用 `uv`；新增依赖必须写入 `pyproject.toml` 并更新 `uv.lock`。
- 禁止 `from src.xxx import ...`；测试与代码统一使用顶层包名，如 `from graphs.javatutor.nodes import ...`、`from learning.memory import ...`。
- 模型配置从 `config/agent_llm_config.json` 读取；API Key / Base URL 来自 `COZE_WORKLOAD_IDENTITY_API_KEY` / `COZE_INTEGRATION_MODEL_BASE_URL`。
- 平台 SDK 版本区间不得改动；`pyproject.toml` 已配置 `pythonpath = ["src"]`，测试可直接 import 顶层包。
- 所有任务按 TDD 执行：先写失败测试，再实现，再提交。
- 文件名只允许字母、数字、下划线、短横线；禁止提交 `.env` 与密钥。

---

## File Structure

| 文件 | 责任 |
|---|---|
| `src/graphs/javatutor/__init__.py` | 包标记 |
| `src/graphs/javatutor/state.py` | `JavaTutorState` 状态 Schema |
| `src/graphs/javatutor/prompts.py` | 四个专家的 `SYSTEM_PROMPTS` |
| `src/graphs/javatutor/nodes.py` | 全部流程节点：解析、路由、专家、动画、记忆、收尾 |
| `src/graphs/javatutor/graph.py` | `build_flow_graph()` 构图与条件边 |
| `src/agents/agent.py` | `build_agent(ctx=None)` 返回 `AgentBundle`（修改） |
| `src/learning/animation.py` | 算法分类与 SVG 生成器 |
| `src/learning/knowledge.py` | 错误速查与 Java 文档检索 |
| `src/learning/memory.py` | 用户画像与对话记录存储 |
| `assets/knowledge/error_quickref.json` | 编译错误速查数据 |
| `assets/knowledge/java_std.json` | Java 标准库速查数据 |
| `tests/fixtures/sample_payload.json` | 完整输入样例 |
| `tests/fixtures/sample_steps.json` | 动画测试用 steps 样例 |
| `tests/test_parse_context.py` | 解析节点测试 |
| `tests/test_route_intent.py` | 路由测试 |
| `tests/test_expert_nodes.py` | 专家节点测试（FakeModel） |
| `tests/test_animation.py` | 动画生成测试 |
| `tests/test_knowledge.py` | 知识检索测试 |
| `tests/test_memory.py` | 记忆存储测试（SQLite） |
| `tests/test_graph.py` | 全流程图测试 |

---

### Task 1: 状态 Schema 与 parse_context 节点

**Files:**
- Create: `src/graphs/javatutor/__init__.py`
- Create: `src/graphs/javatutor/state.py`
- Create: `src/graphs/javatutor/nodes.py`
- Create: `tests/fixtures/sample_payload.json`
- Test: `tests/test_parse_context.py`

**Interfaces:**
- Consumes: 输入消息 `messages[-1].content` 为 JavaTutor JSON 字符串。
- Produces: `parse_context(state: dict) -> dict`，输出 `raw_message`、`source_code`、`steps`、`steps_json`、`steps_count`、`has_steps`、`current_step_index`、`current_line`、`current_variables`、`user_question`、`user_id`、`compile_error`、`has_error`。

- [ ] **Step 1: 创建测试 fixture**

创建 `tests/fixtures/sample_payload.json`：

```json
{
  "source_code": "public class Main { public static void main(String[] a) { int[] arr = {5,3,1}; } }",
  "steps": [
    {"step": 0, "line": 3, "variables": {"arr": [5, 3, 1]}},
    {"step": 1, "line": 4, "variables": {"arr": [3, 5, 1]}}
  ],
  "current_step_index": 1,
  "current_line": 4,
  "user_question": "这一步 arr 怎么变的？",
  "user_id": "u-001",
  "compile_error": ""
}
```

- [ ] **Step 2: 写失败测试**

创建 `tests/test_parse_context.py`：

```python
import json
from pathlib import Path

from langchain_core.messages import HumanMessage

from graphs.javatutor.nodes import parse_context

FIXTURES = Path(__file__).parent / "fixtures"


def _state_from_payload(payload: dict) -> dict:
    return {"messages": [HumanMessage(content=json.dumps(payload, ensure_ascii=False))]}


def test_parse_context_full_payload():
    payload = json.loads((FIXTURES / "sample_payload.json").read_text(encoding="utf-8"))
    out = parse_context(_state_from_payload(payload))
    assert out["source_code"].startswith("public class Main")
    assert out["steps_count"] == 2
    assert out["has_steps"] is True
    assert out["has_error"] is False
    assert out["current_step_index"] == 1
    assert out["current_variables"] == '{"arr": [3, 5, 1]}'
    assert out["user_question"] == "这一步 arr 怎么变的？"
    assert out["user_id"] == "u-001"


def test_parse_context_invalid_json():
    state = {"messages": [HumanMessage(content="not json at all")]}
    out = parse_context(state)
    assert out["steps_count"] == 0
    assert out["has_steps"] is False
    assert out["has_error"] is False
    assert out["user_question"] == "not json at all"
```

- [ ] **Step 3: 运行测试确认失败**

Run: `uv run pytest tests/test_parse_context.py -v`
Expected: FAIL，`ModuleNotFoundError: graphs.javatutor.nodes`。

- [ ] **Step 4: 实现状态与解析节点**

创建 `src/graphs/javatutor/__init__.py`（空文件）。

创建 `src/graphs/javatutor/state.py`：

```python
from typing import Annotated, Any, TypedDict

from langchain_core.messages import AnyMessage
from langgraph.graph.message import add_messages


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

创建 `src/graphs/javatutor/nodes.py`（本任务只含 `parse_context`）：

```python
import json
from typing import Any


def _extract_raw_message(state: dict[str, Any]) -> str:
    messages = state.get("messages") or []
    for message in reversed(messages):
        if getattr(message, "type", "") == "human":
            content = message.content
            if isinstance(content, str):
                return content
            return json.dumps(content, ensure_ascii=False)
    return state.get("raw_message", "")


def parse_context(state: dict[str, Any]) -> dict[str, Any]:
    raw = _extract_raw_message(state)
    data: dict[str, Any] = {}
    if isinstance(raw, str) and raw.strip().startswith(("{", "[")):
        try:
            parsed = json.loads(raw)
            if isinstance(parsed, dict):
                data = parsed
        except json.JSONDecodeError:
            data = {}

    steps = data.get("steps", [])
    steps = steps if isinstance(steps, list) else []
    current_step_index = data.get("current_step_index", -1)
    current_step_index = current_step_index if isinstance(current_step_index, int) else -1
    current_line = data.get("current_line", -1)
    current_line = current_line if isinstance(current_line, int) else -1
    compile_error = data.get("compile_error", "") or ""
    steps_count = len(steps)
    has_error = bool(compile_error.strip())

    current_variables = "{}"
    if steps and 0 <= current_step_index < steps_count:
        step = steps[current_step_index]
        if isinstance(step, dict):
            current_variables = json.dumps(step.get("variables", {}), ensure_ascii=False)

    return {
        "raw_message": raw,
        "source_code": data.get("source_code", ""),
        "steps": steps,
        "steps_json": json.dumps(steps, ensure_ascii=False),
        "steps_count": steps_count,
        "has_steps": steps_count > 0,
        "current_step_index": current_step_index,
        "current_line": current_line,
        "current_variables": current_variables,
        "user_question": data.get("user_question", "") or (raw if not data else ""),
        "user_id": data.get("user_id", ""),
        "compile_error": compile_error,
        "has_error": has_error,
    }
```

- [ ] **Step 5: 运行测试确认通过**

Run: `uv run pytest tests/test_parse_context.py -v`
Expected: 2 passed。

- [ ] **Step 6: 提交**

```bash
git add src/graphs/javatutor tests/fixtures/sample_payload.json tests/test_parse_context.py
git commit -m "feat: add JavaTutor state and parse_context node"
```

---

### Task 2: 确定性意图路由

**Files:**
- Modify: `src/graphs/javatutor/nodes.py`
- Test: `tests/test_route_intent.py`

**Interfaces:**
- Consumes: `state["user_question"]`、`state["compile_error"]`、`state["has_steps"]`。
- Produces: `route_intent(state: dict) -> dict`，返回 `{"intent": "data_query" | "concept" | "animate" | "debug" | "other"}`。

- [ ] **Step 1: 写失败测试**

创建 `tests/test_route_intent.py`：

```python
import pytest

from graphs.javatutor.nodes import route_intent


@pytest.mark.parametrize(
    ("user_question", "compile_error", "has_steps", "expected"),
    [
        ("为什么 arr[3] 是 7？", "", True, "data_query"),
        ("冒泡排序的原理是什么？", "", True, "concept"),
        ("帮我生成一个排序动画", "", True, "animate"),
        ("这段代码编译报错了怎么改？", "", True, "debug"),
        ("数组越界异常怎么解决？", "", True, "debug"),
        ("你是谁？", "", False, "other"),
        ("为什么变量变了？", "cannot find symbol", False, "debug"),
    ],
)
def test_route_intent(user_question, compile_error, has_steps, expected):
    state = {
        "user_question": user_question,
        "compile_error": compile_error,
        "has_steps": has_steps,
    }
    assert route_intent(state)["intent"] == expected
```

- [ ] **Step 2: 运行测试确认失败**

Run: `uv run pytest tests/test_route_intent.py -v`
Expected: FAIL，`AttributeError: route_intent`。

- [ ] **Step 3: 实现路由节点**

在 `src/graphs/javatutor/nodes.py` 追加：

```python
def route_intent(state: dict[str, Any]) -> dict[str, str]:
    if (state.get("compile_error") or "").strip():
        return {"intent": "debug"}

    question = (state.get("user_question") or "").strip().lower()
    if any(k in question for k in ("动画", "演示", "可视化", "播放")):
        return {"intent": "animate"}
    if any(
        k in question
        for k in ("报错", "编译", "异常", "错误", "怎么改", "怎么解决", "修复", "nullpointer", "outofbounds", "exception")
    ):
        return {"intent": "debug"}
    if any(
        k in question
        for k in ("为什么", "第", "步", "变量", "变成", "此时", "当前", "数组", "值", "怎么变")
    ):
        return {"intent": "data_query"}
    if any(
        k in question
        for k in ("原理", "复杂度", "区别", "概念", "是什么", "算法", "递归", "hashmap", "arraylist", "linkedlist", "排序", "查找")
    ):
        return {"intent": "concept"}
    return {"intent": "other"}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `uv run pytest tests/test_route_intent.py -v`
Expected: 7 passed。

- [ ] **Step 5: 提交**

```bash
git add src/graphs/javatutor/nodes.py tests/test_route_intent.py
git commit -m "feat: add deterministic intent router"
```

---

### Task 3: 专家提示词与回答节点

**Files:**
- Create: `src/graphs/javatutor/prompts.py`
- Modify: `src/graphs/javatutor/nodes.py`
- Test: `tests/test_expert_nodes.py`

**Interfaces:**
- Consumes: `state["user_question"]`、`state["source_code"]`、`state["steps_json"]`、`state["steps_count"]`、`state["current_step_index"]`、`state["current_line"]`、`state["current_variables"]`、`state["compile_error"]`。
- Produces: `data_query_node(state, model=None)`、`concept_node(state, model=None)`、`debug_node(state, model=None)`、`other_node(state, model=None)`，均返回 `{"answer": str}`；`debug_node` 额外返回 `{"quickref_hits": list[str]}`。
- 测试注入：`model` 参数或 `configurable.chat_model`，必须是带 `invoke(messages)` 方法的对象。

- [ ] **Step 1: 写失败测试**

创建 `tests/test_expert_nodes.py`：

```python
from langchain_core.messages import AIMessage

from graphs.javatutor.nodes import data_query_node


class FakeModel:
    def __init__(self, answer: str):
        self.answer = answer

    def invoke(self, messages):
        assert messages[0].type == "system"
        assert "学生问题" in messages[1].content
        assert "全部执行步骤" in messages[1].content
        return AIMessage(content=self.answer)


def test_data_query_node_injects_context_and_returns_answer():
    state = {
        "source_code": "public class Main {}",
        "steps_json": '[{"step": 0, "variables": {"arr": [5, 3, 1]}}]',
        "steps_count": 1,
        "current_step_index": 0,
        "current_line": 3,
        "current_variables": '{"arr": [5, 3, 1]}',
        "user_question": "为什么 arr[1] 是 3？",
    }
    out = data_query_node(state, model=FakeModel("根据第 1 步..."))
    assert out["answer"] == "根据第 1 步..."
```

- [ ] **Step 2: 运行测试确认失败**

Run: `uv run pytest tests/test_expert_nodes.py -v`
Expected: FAIL，`TypeError: data_query_node() missing required positional argument: 'state'` 或 import 错误。

- [ ] **Step 3: 创建提示词模块**

创建 `src/graphs/javatutor/prompts.py`：

```python
SYSTEM_PROMPTS = {
    "data_query": (
        "你是 JavaTutor 的数据追问助手。你的任务是对照 TraceEngine 执行数据，回答学生关于代码执行过程的问题。"
        "回答必须引用具体步骤号、行号和变量值，不要凭空推理。如果根本没有执行步骤，友好提示学生先点击运行。"
        "使用中文，3-5 句话，像老师在辅导学生。"
    ),
    "concept": (
        "你是 JavaTutor 的算法讲解助手。用通俗易懂的方式向学生解释算法和数据结构概念。"
        "用生活化比喻，苏格拉底式引导，不要直接给完整作业答案。如果已运行代码，结合真实执行数据举例。"
        "如果学生是新手，少用术语。"
    ),
    "debug": (
        "你是 JavaTutor 的错误诊断助手。用中文解释 Java 编译错误：先说明错误是什么，再指出在哪一行，"
        "最后给出具体修改建议，但不要直接给完整代码。如果编译错误为空，告诉学生当前没有编译错误。"
    ),
    "other": (
        "你是 JavaTutor 的通用助手。回答学生与 Java 学习或本工具使用相关的任何问题。"
        "如果问题与 Java 学习完全无关，礼貌说明你的职责范围。保持友好、简洁。"
    ),
}
```

- [ ] **Step 4: 实现专家节点**

在 `src/graphs/javatutor/nodes.py` 顶部追加 import：

```python
import os

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_core.runnables import get_runnable_config
from langchain_openai import ChatOpenAI

from coze_coding_utils.runtime_ctx.context import default_headers
from graphs.javatutor.prompts import SYSTEM_PROMPTS
```

在 `parse_context` 之后追加：

```python
def _chat_model():
    workspace_path = os.getenv("COZE_WORKSPACE_PATH", "/workspace/projects")
    with open(os.path.join(workspace_path, "config/agent_llm_config.json"), encoding="utf-8") as f:
        cfg = json.load(f)
    return ChatOpenAI(
        model=cfg["config"].get("model"),
        api_key=os.getenv("COZE_WORKLOAD_IDENTITY_API_KEY"),
        base_url=os.getenv("COZE_INTEGRATION_MODEL_BASE_URL"),
        temperature=cfg["config"].get("temperature", 0.7),
        streaming=True,
        timeout=cfg["config"].get("timeout", 600),
        extra_body={"thinking": {"type": cfg["config"].get("thinking", "disabled")}},
        default_headers=default_headers(None),
    )


def _build_expert_messages(state, expert):
    if expert == "data_query":
        context = [
            f"全部执行步骤：\n{state.get('steps_json', '[]')}",
            f"当前步骤：第 {state.get('current_step_index', -1)} 步，行 {state.get('current_line', -1)}",
            f"当前变量：\n{state.get('current_variables', '{}')}",
        ]
    elif expert == "concept":
        context = [
            f"源代码如下：\n{state.get('source_code', '')}",
            f"执行步骤数：{state.get('steps_count', 0)}",
        ]
    elif expert == "debug":
        from learning.knowledge import search_error_quickref

        quickref = search_error_quickref(state.get("compile_error", ""))
        context = [
            f"源代码如下：\n{state.get('source_code', '')}",
            f"编译错误：\n{state.get('compile_error', '')}",
        ]
        if quickref:
            context.append("错误速查：\n" + "\n".join(quickref))
    else:
        context = [
            f"源代码如下：\n{state.get('source_code', '')}",
            f"执行步骤数：{state.get('steps_count', 0)}，当前步骤：第 {state.get('current_step_index', -1)} 步",
        ]
    user_content = f"学生问题：{state.get('user_question', '')}\n\n" + "\n\n".join(context)
    return [SystemMessage(content=SYSTEM_PROMPTS[expert]), HumanMessage(content=user_content)]


def _run_expert(state, expert, model=None):
    if model is None:
        config = get_runnable_config()
        model = config.get("configurable", {}).get("chat_model") or _chat_model()
    response = model.invoke(_build_expert_messages(state, expert))
    return {"answer": response.content}


def data_query_node(state, model=None):
    return _run_expert(state, "data_query", model)


def concept_node(state, model=None):
    return _run_expert(state, "concept", model)


def debug_node(state, model=None):
    from learning.knowledge import search_error_quickref

    hits = search_error_quickref(state.get("compile_error", ""))
    result = _run_expert(state, "debug", model)
    result["quickref_hits"] = hits
    return result


def other_node(state, model=None):
    return _run_expert(state, "other", model)
```

注意：`_build_expert_messages` 的 debug 分支在 `learning.knowledge` 存在前会 import 失败，但本任务只运行 `tests/test_expert_nodes.py`，该测试不触发 debug 分支，可安全先实现本任务。

- [ ] **Step 5: 运行测试确认通过**

Run: `uv run pytest tests/test_expert_nodes.py -v`
Expected: 1 passed。

- [ ] **Step 6: 提交**

```bash
git add src/graphs/javatutor/prompts.py src/graphs/javatutor/nodes.py tests/test_expert_nodes.py
git commit -m "feat: add expert answer nodes with injectable chat model"
```

---

### Task 4: SVG 动画生成器

**Files:**
- Create: `src/learning/__init__.py`
- Create: `src/learning/animation.py`
- Create: `tests/fixtures/sample_steps.json`
- Test: `tests/test_animation.py`

**Interfaces:**
- Consumes: `steps: list[dict]`（字段含 `variables`，其中数组变量名可为 `arr`/`array`/`nums`/`list`）。
- Produces: `classify_algorithm(source_code: str) -> str`（`sort`/`search`/`other`）、`build_animation_svg(steps: list[dict], algorithm_tag: str) -> str`。

- [ ] **Step 1: 创建 fixture**

创建 `tests/fixtures/sample_steps.json`：

```json
[
  {"step": 0, "line": 3, "variables": {"arr": [5, 3, 1]}},
  {"step": 1, "line": 4, "variables": {"arr": [3, 5, 1]}},
  {"step": 2, "line": 4, "variables": {"arr": [3, 1, 5]}}
]
```

- [ ] **Step 2: 写失败测试**

创建 `tests/test_animation.py`：

```python
import json
from pathlib import Path

from learning.animation import build_animation_svg, classify_algorithm

FIXTURES = Path(__file__).parent / "fixtures"


def test_classify_sort():
    assert classify_algorithm("public class BubbleSort { ... }") == "sort"


def test_classify_search():
    assert classify_algorithm("int idx = binarySearch(arr, 7);") == "search"


def test_build_animation_svg_contains_animate_and_values():
    steps = json.loads((FIXTURES / "sample_steps.json").read_text(encoding="utf-8"))
    svg = build_animation_svg(steps, "sort")
    assert svg.startswith("<svg")
    assert "<animate" in svg
    assert "5" in svg
```

- [ ] **Step 3: 运行测试确认失败**

Run: `uv run pytest tests/test_animation.py -v`
Expected: FAIL，`ModuleNotFoundError: learning.animation`。

- [ ] **Step 4: 实现生成器**

创建 `src/learning/__init__.py`（空文件）。

创建 `src/learning/animation.py`：

```python
from typing import Any


def classify_algorithm(source_code: str) -> str:
    code = (source_code or "").lower()
    if any(k in code for k in ("bubble", "冒泡", "sort", "选择", "insert", "quick")):
        return "sort"
    if any(k in code for k in ("binary", "二分", "search", "查找", "linear")):
        return "search"
    return "other"


def _extract_series(steps: list[dict[str, Any]]) -> list[list[int]]:
    series: list[list[int]] = []
    for step in steps:
        variables = step.get("variables") or {}
        for key in ("arr", "array", "nums", "list"):
            value = variables.get(key)
            if isinstance(value, list) and value and all(isinstance(v, int) for v in value):
                series.append([int(v) for v in value])
                break
    return series


def build_animation_svg(steps: list[dict[str, Any]], algorithm_tag: str = "sort") -> str:
    series = _extract_series(steps)
    if not series:
        return (
            "<svg xmlns='http://www.w3.org/2000/svg' width='600' height='400'>"
            "<text x='20' y='30'>暂无执行数据</text></svg>"
        )

    width, height, margin = 600, 400, 40
    values = series[0]
    n = max(1, len(values))
    max_value = max(max(s) for s in series)
    bar_width = (width - 2 * margin) / n

    bars: list[str] = []
    for index, value in enumerate(values):
        bar_height = (height - 2 * margin) * value / max_value
        x = margin + index * bar_width
        y = height - margin - bar_height
        bars.append(
            f"<rect id='bar-{index}' x='{x:.1f}' y='{y:.1f}' width='{bar_width - 4:.1f}' "
            f"height='{bar_height:.1f}' fill='#4f8cff'><title>{value}</title></rect>"
        )

    overlays: list[str] = []
    for step_index in range(len(series)):
        overlays.append(
            f"<rect x='{margin:.1f}' y='{margin:.1f}' width='{width - 2 * margin:.1f}' "
            f"height='{height - 2 * margin:.1f}' fill='none'>"
            f"<animate attributeName='fill' values='#4f8cff;#ffd166;#4f8cff' dur='1.2s' "
            f"begin='{step_index * 1.2:.1f}s' repeatCount='1'/></rect>"
        )

    return (
        f"<svg xmlns='http://www.w3.org/2000/svg' width='{width}' height='{height}' "
        f"viewBox='0 0 {width} {height}'><title>{algorithm_tag}</title>"
        + "".join(bars)
        + "".join(overlays)
        + "</svg>"
    )
```

- [ ] **Step 5: 运行测试确认通过**

Run: `uv run pytest tests/test_animation.py -v`
Expected: 3 passed。

- [ ] **Step 6: 提交**

```bash
git add src/learning tests/fixtures/sample_steps.json tests/test_animation.py
git commit -m "feat: add deterministic SVG animation generator"
```

---

### Task 5: 知识检索

**Files:**
- Create: `assets/knowledge/error_quickref.json`
- Create: `assets/knowledge/java_std.json`
- Create: `src/learning/knowledge.py`
- Test: `tests/test_knowledge.py`

**Interfaces:**
- Produces: `search_error_quickref(compile_error: str, top_k: int = 3) -> list[str]`、`search_java_docs(query: str, top_k: int = 3) -> list[str]`。

- [ ] **Step 1: 创建数据资产**

创建 `assets/knowledge/error_quickref.json`：

```json
{
  "entries": [
    {"keywords": ["cannot find symbol"], "title": "cannot find symbol", "explanation": "变量名或方法名不存在，检查拼写或是否声明。"},
    {"keywords": ["incompatible types"], "title": "incompatible types", "explanation": "类型不匹配，例如把字符串赋给了 int。"},
    {"keywords": ["missing return statement"], "title": "missing return statement", "explanation": "方法声明了返回值，但某个分支没有 return。"},
    {"keywords": ["nullpointerexception", "null pointer"], "title": "NullPointerException", "explanation": "对 null 对象调用了方法或访问了字段。"},
    {"keywords": ["arrayindexoutofboundsexception", "array index out of bounds"], "title": "ArrayIndexOutOfBoundsException", "explanation": "访问数组时下标越界。"}
  ]
}
```

创建 `assets/knowledge/java_std.json`：

```json
{
  "entries": [
    {"title": "Arrays.sort", "content": "对数组原地排序，默认升序。", "keywords": ["arrays", "sort", "排序"]},
    {"title": "Arrays.binarySearch", "content": "在已排序数组中二分查找，返回下标或负数。", "keywords": ["binarysearch", "二分", "查找"]},
    {"title": "HashMap", "content": "基于哈希表的键值映射，平均 O(1) 查询。", "keywords": ["hashmap", "哈希", "映射"]},
    {"title": "ArrayList", "content": "动态数组，支持随机访问，扩容时复制元素。", "keywords": ["arraylist", "动态数组"]},
    {"title": "String.substring", "content": "返回 [beginIndex, endIndex) 的子串。", "keywords": ["substring", "子串"]}
  ]
}
```

- [ ] **Step 2: 写失败测试**

创建 `tests/test_knowledge.py`：

```python
from learning.knowledge import search_error_quickref, search_java_docs


def test_search_error_quickref():
    hits = search_error_quickref("cannot find symbol: variable x")
    assert hits
    assert "cannot find symbol" in hits[0]


def test_search_java_docs():
    hits = search_java_docs("HashMap 的原理是什么")
    assert hits
    assert "HashMap" in hits[0]
```

- [ ] **Step 3: 运行测试确认失败**

Run: `uv run pytest tests/test_knowledge.py -v`
Expected: FAIL，`ModuleNotFoundError: learning.knowledge`。

- [ ] **Step 4: 实现检索函数**

创建 `src/learning/knowledge.py`：

```python
import json
from pathlib import Path
from typing import Any

ASSETS = Path(__file__).resolve().parents[2] / "assets" / "knowledge"


def _load_entries(name: str) -> list[dict[str, Any]]:
    path = ASSETS / name
    if not path.exists():
        return []
    with open(path, encoding="utf-8") as f:
        return json.load(f)["entries"]


def _score(entry: dict[str, Any], query: str) -> int:
    query_lower = query.lower()
    score = 0
    for keyword in entry.get("keywords", []):
        if keyword.lower() in query_lower:
            score += 1
    if entry.get("title", "").lower() in query_lower:
        score += 2
    return score


def search_error_quickref(compile_error: str, top_k: int = 3) -> list[str]:
    entries = _load_entries("error_quickref.json")
    ranked = sorted(entries, key=lambda e: _score(e, compile_error), reverse=True)
    return [f"{e['title']}: {e['explanation']}" for e in ranked if _score(e, compile_error) > 0][:top_k]


def search_java_docs(query: str, top_k: int = 3) -> list[str]:
    entries = _load_entries("java_std.json")
    ranked = sorted(entries, key=lambda e: _score(e, query), reverse=True)
    return [f"{e['title']}: {e['content']}" for e in ranked if _score(e, query) > 0][:top_k]
```

- [ ] **Step 5: 运行测试确认通过**

Run: `uv run pytest tests/test_knowledge.py -v`
Expected: 2 passed。

- [ ] **Step 6: 提交**

```bash
git add assets/knowledge src/learning/knowledge.py tests/test_knowledge.py
git commit -m "feat: add knowledge retrieval for errors and Java docs"
```

---

### Task 6: 用户记忆存储

**Files:**
- Create: `src/learning/memory.py`
- Test: `tests/test_memory.py`

**Interfaces:**
- Produces: `make_session_factory(engine=None)`、`load_user_profile(session_factory, user_id) -> dict`、`save_user_profile(session_factory, user_id, updates: dict) -> dict`、`append_learning_record(session_factory, user_id, intent, question, answer) -> None`。
- 导出 ORM 类：`UserProfile`、`LearningRecord`。

- [ ] **Step 1: 写失败测试**

创建 `tests/test_memory.py`：

```python
from sqlalchemy import create_engine

from learning.memory import (
    LearningRecord,
    append_learning_record,
    load_user_profile,
    make_session_factory,
    save_user_profile,
)


def test_memory_profile_roundtrip():
    engine = create_engine("sqlite:///:memory:")
    factory = make_session_factory(engine)
    assert load_user_profile(factory, "u-001")["total_sessions"] == 0
    updated = save_user_profile(factory, "u-001", {"skill_level": "intermediate", "total_sessions": 1})
    assert updated["skill_level"] == "intermediate"
    assert updated["total_sessions"] == 1
    assert load_user_profile(factory, "u-001")["skill_level"] == "intermediate"


def test_append_learning_record():
    engine = create_engine("sqlite:///:memory:")
    factory = make_session_factory(engine)
    append_learning_record(factory, "u-001", "data_query", "为什么 arr 变了？", "根据第 1 步...")
    session = factory()
    try:
        records = session.query(LearningRecord).filter_by(user_id="u-001").all()
        assert len(records) == 1
        assert records[0].intent == "data_query"
    finally:
        session.close()
```

- [ ] **Step 2: 运行测试确认失败**

Run: `uv run pytest tests/test_memory.py -v`
Expected: FAIL，`ModuleNotFoundError: learning.memory`。

- [ ] **Step 3: 实现存储模块**

创建 `src/learning/memory.py`：

```python
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import JSON, Column, DateTime, Integer, String, Text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import declarative_base, sessionmaker

Base = declarative_base()


class UserProfile(Base):
    __tablename__ = "user_profiles"

    user_id = Column(String(64), primary_key=True)
    skill_level = Column(String(16), nullable=False, default="beginner")
    attempted_algorithms = Column(JSON, nullable=False, default=list)
    completed_algorithms = Column(JSON, nullable=False, default=list)
    common_mistakes = Column(JSON, nullable=False, default=list)
    total_sessions = Column(Integer, nullable=False, default=0)
    updated_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))


class LearningRecord(Base):
    __tablename__ = "learning_records"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(64), nullable=False, index=True)
    intent = Column(String(32), nullable=False)
    question = Column(Text, nullable=False)
    answer = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))


def make_session_factory(engine: Engine | None = None):
    if engine is None:
        from storage.database.db import get_engine

        engine = get_engine()
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine)


def load_user_profile(session_factory, user_id: str) -> dict[str, Any]:
    session = session_factory()
    try:
        row = session.get(UserProfile, user_id)
        if row is None:
            return {
                "user_id": user_id,
                "skill_level": "beginner",
                "attempted_algorithms": [],
                "completed_algorithms": [],
                "common_mistakes": [],
                "total_sessions": 0,
            }
        return {
            "user_id": row.user_id,
            "skill_level": row.skill_level,
            "attempted_algorithms": row.attempted_algorithms or [],
            "completed_algorithms": row.completed_algorithms or [],
            "common_mistakes": row.common_mistakes or [],
            "total_sessions": row.total_sessions or 0,
        }
    finally:
        session.close()


def save_user_profile(session_factory, user_id: str, updates: dict[str, Any]) -> dict[str, Any]:
    session = session_factory()
    try:
        row = session.get(UserProfile, user_id)
        if row is None:
            row = UserProfile(user_id=user_id)
            session.add(row)
        for key, value in updates.items():
            if hasattr(row, key):
                setattr(row, key, value)
        row.updated_at = datetime.now(timezone.utc)
        session.commit()
        return load_user_profile(session_factory, user_id)
    finally:
        session.close()


def append_learning_record(session_factory, user_id: str, intent: str, question: str, answer: str) -> None:
    session = session_factory()
    try:
        session.add(LearningRecord(user_id=user_id, intent=intent, question=question, answer=answer))
        session.commit()
    finally:
        session.close()
```

- [ ] **Step 4: 运行测试确认通过**

Run: `uv run pytest tests/test_memory.py -v`
Expected: 2 passed。

- [ ] **Step 5: 提交**

```bash
git add src/learning/memory.py tests/test_memory.py
git commit -m "feat: add user memory store backed by SQLAlchemy"
```

---

### Task 7: 全流程图与 build_agent 装配

**Files:**
- Modify: `src/graphs/javatutor/nodes.py`
- Create: `src/graphs/javatutor/graph.py`
- Modify: `src/agents/agent.py`
- Test: `tests/test_graph.py`

**Interfaces:**
- Consumes: Task 1-6 的所有节点与函数。
- Produces: `build_flow_graph() -> StateGraph`、`build_agent(ctx=None) -> AgentBundle`，`AgentBundle.builder` 可被 `src/main.py` 编译。

- [ ] **Step 1: 在 nodes.py 追加记忆、动画与收尾节点**

在 `src/graphs/javatutor/nodes.py` 末尾追加：

```python
def load_memory(state):
    user_id = state.get("user_id", "")
    if not user_id:
        return {"memory_summary": ""}
    try:
        from learning.memory import load_user_profile, make_session_factory

        factory = make_session_factory()
        profile = load_user_profile(factory, user_id)
        summary = (
            f"技能等级：{profile['skill_level']}；"
            f"尝试过的算法：{json.dumps(profile['attempted_algorithms'], ensure_ascii=False)}；"
            f"常见错误：{json.dumps(profile['common_mistakes'], ensure_ascii=False)}"
        )
        return {"memory_summary": summary}
    except Exception:
        return {"memory_summary": ""}


def animate_node(state):
    from learning.animation import build_animation_svg, classify_algorithm

    algorithm_tag = classify_algorithm(state.get("source_code", ""))
    svg_text = build_animation_svg(state.get("steps", []), algorithm_tag)
    if algorithm_tag == "other":
        return {"svg_text": svg_text, "answer": "暂未识别该算法类别，已生成基础动画。"}
    return {
        "svg_text": svg_text,
        "answer": f"已基于 {state.get('steps_count', 0)} 步执行数据生成 {algorithm_tag} 动画。\n\n{svg_text}",
    }


def write_memory(state):
    user_id = state.get("user_id", "")
    answer = state.get("answer", "")
    if not user_id or not answer:
        return {}
    try:
        from learning.memory import (
            append_learning_record,
            load_user_profile,
            make_session_factory,
            save_user_profile,
        )

        factory = make_session_factory()
        profile = load_user_profile(factory, user_id)
        save_user_profile(factory, user_id, {"total_sessions": profile["total_sessions"] + 1})
        append_learning_record(
            factory,
            user_id,
            state.get("intent", "other"),
            state.get("user_question", ""),
            answer,
        )
    except Exception:
        pass
    return {}


def build_final(state):
    from langchain_core.messages import AIMessage

    answer = state.get("answer", "") or "抱歉，我暂时无法回答这个问题。"
    return {"messages": [AIMessage(content=answer)]}
```

- [ ] **Step 2: 创建构图模块**

创建 `src/graphs/javatutor/graph.py`：

```python
from langgraph.graph import END, StateGraph

from graphs.javatutor.nodes import (
    animate_node,
    build_final,
    concept_node,
    data_query_node,
    debug_node,
    load_memory,
    other_node,
    parse_context,
    route_intent,
    write_memory,
)
from graphs.javatutor.state import JavaTutorState


def build_flow_graph() -> StateGraph:
    graph = StateGraph(JavaTutorState)
    graph.add_node("parse_context", parse_context)
    graph.add_node("load_memory", load_memory)
    graph.add_node("route_intent", route_intent)
    graph.add_node("data_query", data_query_node)
    graph.add_node("concept", concept_node)
    graph.add_node("debug", debug_node)
    graph.add_node("other", other_node)
    graph.add_node("animate", animate_node)
    graph.add_node("write_memory", write_memory)
    graph.add_node("final", build_final)

    graph.set_entry_point("parse_context")
    graph.add_edge("parse_context", "load_memory")
    graph.add_edge("load_memory", "route_intent")
    graph.add_conditional_edges(
        "route_intent",
        lambda state: state["intent"],
        {
            "data_query": "data_query",
            "concept": "concept",
            "animate": "animate",
            "debug": "debug",
            "other": "other",
        },
    )
    for branch in ("data_query", "concept", "debug", "other", "animate"):
        graph.add_edge(branch, "write_memory")
    graph.add_edge("write_memory", "final")
    graph.add_edge("final", END)
    return graph
```

- [ ] **Step 3: 修改 build_agent**

将 `src/agents/agent.py` 整体替换为：

```python
from typing import Any

from graphs.javatutor.graph import build_flow_graph


class AgentBundle:
    def __init__(self, builder: Any):
        self.builder = builder


def build_agent(ctx=None):
    return AgentBundle(build_flow_graph())
```

- [ ] **Step 4: 写全流程测试**

创建 `tests/test_graph.py`：

```python
import json
from pathlib import Path

from langchain_core.messages import AIMessage, HumanMessage

from agents.agent import build_agent

FIXTURES = Path(__file__).parent / "fixtures"


class FakeModel:
    def invoke(self, messages):
        return AIMessage(content="根据第 1 步，arr[1] 从 5 变成了 3。")


def test_build_agent_compiles_and_runs_flow():
    payload = json.loads((FIXTURES / "sample_payload.json").read_text(encoding="utf-8"))
    agent = build_agent()
    graph = agent.builder.compile()
    state = {
        "messages": [HumanMessage(content=json.dumps(payload, ensure_ascii=False))],
        "user_question": payload["user_question"],
        "user_id": payload["user_id"],
    }
    result = graph.invoke(state, config={"configurable": {"chat_model": FakeModel()}})
    final = result["messages"][-1]
    assert isinstance(final, AIMessage)
    assert "arr" in final.content
    assert result["intent"] == "data_query"
```

- [ ] **Step 5: 运行测试确认通过**

Run: `uv run pytest tests/test_graph.py -v`
Expected: 1 passed。

- [ ] **Step 6: 运行全部测试**

Run: `uv run pytest tests/ -v`
Expected: 全部通过。

- [ ] **Step 7: 提交**

```bash
git add src/graphs/javatutor/graph.py src/graphs/javatutor/nodes.py src/agents/agent.py tests/test_graph.py
git commit -m "feat: wire full JavaTutor flow graph into build_agent"
```

---

### Task 8: HTTP 冒烟验证

**Files:**
- Modify: `docs/coze-local-dev-checklist.md`（追加“冒烟结果记录”小节）

**Interfaces:**
- Consumes: 整个项目（`src/main.py` 外壳 + 新图）。
- Produces: 已验证的 HTTP 冒烟命令与结果记录。

- [ ] **Step 1: 在 Coze 终端启动服务**

```bash
export COZE_WORKSPACE_PATH="${COZE_WORKSPACE_PATH:-/workspace/projects}"
bash scripts/http_run.sh -p "${DEPLOY_RUN_PORT:-5000}" &
SERVER_PID=$!
sleep 15
```

说明：本模板的 `src/main.py` lifespan 会调用 `get_engine()`，Coze 部署环境会注入 `PGDATABASE_URL` 或 workload identity 变量；若本地执行则需自行提供可用 PostgreSQL 地址。本地 Windows 还需先设置 `COZE_LOG_DIR` 指向可写目录（如 `$PWD/.logs`）。

- [ ] **Step 2: 验证基础接口**

```bash
curl -fsS http://127.0.0.1:5000/health
curl -fsS http://127.0.0.1:5000/graph_parameter
```

Expected: `/health` 返回包含 `"status":"ok"`，`/graph_parameter` 返回 JSON。

- [ ] **Step 3: 验证对话接口**

```bash
MODEL=$(python -c "import json;print(json.load(open('config/agent_llm_config.json',encoding='utf-8'))['config']['model'])")
curl -fsS -X POST http://127.0.0.1:5000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d "{\"model\":\"$MODEL\",\"messages\":[{\"role\":\"user\",\"content\":\"你好\"}]}"
```

Expected: 返回 `choices[0].message.content` 非空。若模型端点未配置，此步骤返回连接错误，说明服务本身可用但环境变量缺失。

- [ ] **Step 4: 验证流式接口**

```bash
MODEL=$(python -c "import json;print(json.load(open('config/agent_llm_config.json',encoding='utf-8'))['config']['model'])")
curl -N -fsS -X POST http://127.0.0.1:5000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d "{\"model\":\"$MODEL\",\"stream\":true,\"messages\":[{\"role\":\"user\",\"content\":\"你好\"}]}"
```

Expected: 输出 `data:` 分片并以 `data: [DONE]` 结束。

- [ ] **Step 5: 关闭服务并记录结果**

```bash
kill "$SERVER_PID"
```

在 `docs/coze-local-dev-checklist.md` 末尾追加：

```markdown
## 冒烟结果记录

- 日期：2026-08-07（如后续执行请改为实际日期）
- 执行环境：Coze 终端 / 本地
- /health：通过 / 失败
- /graph_parameter：通过 / 失败
- /v1/chat/completions：通过 / 失败
- 流式输出：通过 / 失败
- 备注：
```

把占位日期替换为实际执行日期，并在备注中填写失败详情。

- [ ] **Step 6: 提交**

```bash
git add docs/coze-local-dev-checklist.md
git commit -m "docs: record HTTP smoke verification"
```

---

## Self-Review

### Spec Coverage

| Spec 条目 | 对应任务 |
|---|---|
| REQ-001 / REQ-002 | Task 1 |
| REQ-003 / REQ-004 / REQ-011 | Task 2 |
| REQ-006 / REQ-010 | Task 3 + Task 7 |
| REQ-005 | Task 4 + Task 7 |
| REQ-007 / REQ-008 | Task 6 + Task 7 |
| REQ-009 | Task 7 |
| AC-001 / AC-002 / AC-003 / AC-004 | Task 2 / Task 4 / Task 7 |
| AC-005 / AC-006 / AC-007 / AC-008 | Task 7 / Task 6 / Task 7 / Task 7 |
| AC-009 | Task 8 |
| CON-001 至 CON-008 | Global Constraints |

### Placeholder Scan

计划中无 `TBD`、`TODO`、`implement later`；Task 8 的日期占位属于文档记录模板，实施时替换为真实日期。

### Type Consistency

- `parse_context(state) -> dict`：Task 1 定义，Task 7 使用。
- `route_intent(state) -> dict`：Task 2 定义，Task 7 使用。
- `data_query_node/concept_node/debug_node/other_node(state, model=None)`：Task 3 定义，Task 7 使用。
- `classify_algorithm(source_code) -> str`、`build_animation_svg(steps, algorithm_tag) -> str`：Task 4 定义，Task 7 使用。
- `search_error_quickref/compile_error, top_k`、`search_java_docs`：Task 5 定义，Task 3 使用。
- `make_session_factory/load_user_profile/save_user_profile/append_learning_record`：Task 6 定义，Task 7 使用。
- `build_flow_graph() -> StateGraph`、`AgentBundle.builder`：Task 7 定义并装配。
