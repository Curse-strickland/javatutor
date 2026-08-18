# Coze 侧智能体深化实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Coze 侧 JavaTutor 智能体从“规则路由 + 单次回答”深化为“LLM 意图分类 + 上下文压缩 + RAG 检索 + 专家生成 + 评审修订 + 决策痕迹”的完整链路。

**Architecture:** 保留 `AgentBundle`/`build_agent` 外壳契约；在 `src/graphs/javatutor/` 内新增 `intent.py`、`compaction.py`、`critic.py`，在 `src/learning/knowledge.py` 实现 pgvector RAG；修改 `nodes.py`/`graph.py`/`state.py`/`prompts.py`，把自由问答改为“生成 → 评审 → 修订 → 痕迹”，analyze/animate/animate_guide 仍走确定性直达。

**Tech Stack:** Python 3.12、LangGraph 1.x、Coze SDK（LLMClient）、pgvector 0.8.2、Doubao-embedding-vision、pytest、httpx、psycopg。

---

## Global Constraints

- 不得修改 `.coze`、`scripts/`、`src/main.py`、`src/storage/`、`src/utils/` 中现有文件；新增脚本可放 `scripts/` 之外的自定义目录（本计划放 `scripts/` 仅新增 `seed_knowledge.py` 例外，需遵守现有脚本风格）。
- Python 3.12；只用 `uv`；本计划不新增第三方依赖（httpx、psycopg 已在依赖树）。
- 禁止 `from src.xxx import ...`；统一 `from graphs.javatutor.intent import ...`、`from learning.knowledge import ...`。
- 显式 `intent` 与 `compile_error` 短路必须保留在 `route_intent` 最前面。
- 自由问答四个文本专家必须走 `retrieve_knowledge → 专家 → critic → revise → build_final`。
- 评审-修订只跑一轮：修订后直接输出，不再二次评审。
- 低置信度（< 0.6）或非法分类输出降级 `other`，并写入 `fallback_reason`。
- 检索/评审/修订失败均降级放行，不阻塞回答。
- 决策痕迹固定格式见 `docs/superpowers/specs/2026-08-10-coze-agent-interface.md`。
- 每个任务按 TDD 执行：先写失败测试 → 实现 → 通过 → 提交。

---

## File Structure

| 文件 | 责任 |
|---|---|
| `src/graphs/javatutor/intent.py` | LLM 意图分类器 |
| `src/graphs/javatutor/compaction.py` | steps 上下文压缩 |
| `src/graphs/javatutor/critic.py` | 评审与修订 |
| `src/learning/knowledge.py` | 分块、embedding、pgvector 检索、语料灌入 |
| `src/graphs/javatutor/state.py` | 新增深化状态字段（修改） |
| `src/graphs/javatutor/prompts.py` | 新增分类/评审/修订提示词（修改） |
| `src/graphs/javatutor/nodes.py` | 路由改造、检索/压缩/最终节点（修改） |
| `src/graphs/javatutor/graph.py` | 新链路装配（修改） |
| `scripts/seed_knowledge.py` | 团队语料灌库脚本 |
| `assets/knowledge/error_quickref.json` | 错误速查语料 |
| `assets/knowledge/java_std.json` | Java 标准库语料 |
| `tests/test_intent.py` | 意图分类测试 |
| `tests/test_compaction.py` | 压缩测试 |
| `tests/test_knowledge.py` | 检索测试 |
| `tests/test_critic.py` | 评审/修订测试 |
| `tests/test_expert_nodes.py` | RAG 注入测试（修改） |
| `tests/test_graph.py` | 全流程集成测试（修改） |

---

### Task 1: LLM 意图分类器

**Files:**
- Create: `src/graphs/javatutor/intent.py`
- Modify: `src/graphs/javatutor/prompts.py`
- Test: `tests/test_intent.py`

**Interfaces:**
- Produces: `classify_intent(question: str, model=None) -> dict`，返回 `{intent, confidence, reason}`；枚举 `data_query|concept|debug|animate_guide|other`。

- [ ] **Step 1: 写失败测试**

创建 `tests/test_intent.py`：

```python
from langchain_core.messages import AIMessage

from graphs.javatutor.intent import classify_intent


class FakeModel:
    def __init__(self, content):
        self.content = content

    def invoke(self, messages):
        assert messages[0].type == "system"
        return AIMessage(content=self.content)


def test_classify_valid():
    out = classify_intent("为什么 arr 变了", FakeModel('{"intent":"data_query","confidence":0.9,"reason":"追问变量"}'))
    assert out["intent"] == "data_query"
    assert out["confidence"] == 0.9


def test_classify_low_confidence_falls_back():
    out = classify_intent("随便问问", FakeModel('{"intent":"concept","confidence":0.3,"reason":"不确定"}'))
    assert out["intent"] == "other"
    assert out["reason"] == "低置信度"


def test_classify_invalid_json_falls_back():
    out = classify_intent("你好", FakeModel("not json"))
    assert out["intent"] == "other"
    assert out["reason"] == "分类输出非法"


def test_classify_markdown_fence_stripped():
    out = classify_intent("讲讲 HashMap", FakeModel('```json\n{"intent":"concept","confidence":0.8,"reason":"概念"}```'))
    assert out["intent"] == "concept"
```

- [ ] **Step 2: 运行测试确认失败**

Run: `uv run pytest tests/test_intent.py -v`
Expected: FAIL，`ModuleNotFoundError: graphs.javatutor.intent`。

- [ ] **Step 3: 添加分类提示词**

在 `src/graphs/javatutor/prompts.py` 末尾追加：

```python
SYSTEM_PROMPT_INTENT = """你是一个意图分类器。根据学生问题只返回 JSON：
{"intent": "data_query|concept|debug|animate_guide|other", "confidence": 0-1, "reason": "一句话"}
分类规则：
- data_query：追问执行步骤中的变量值、变量变化、运行结果
- concept：询问算法、数据结构、复杂度、概念原理
- debug：报错、异常、如何修复
- animate_guide：请求生成动画、演示、可视化
- other：其他
只返回 JSON，不要 Markdown 围栏。"""
```

- [ ] **Step 4: 实现分类器**

创建 `src/graphs/javatutor/intent.py`：

```python
"""LLM 意图分类器，替代关键词匹配。"""

import json
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from graphs.javatutor.prompts import SYSTEM_PROMPT_INTENT

VALID_INTENTS = {"data_query", "concept", "debug", "animate_guide", "other"}
CONFIDENCE_THRESHOLD = 0.6


def _parse_output(raw: str) -> dict[str, Any] | None:
    text = (raw or "").strip()
    if text.startswith("```"):
        lines = text.splitlines()
        if lines and lines[0].startswith("```"):
            text = "\n".join(lines[1:])
        if text.endswith("```"):
            text = text[:-3].strip()
    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return None
    if not isinstance(data, dict):
        return None
    intent = data.get("intent")
    if intent not in VALID_INTENTS:
        return None
    try:
        confidence = float(data.get("confidence", 0.0))
    except (TypeError, ValueError):
        confidence = 0.0
    return {"intent": intent, "confidence": confidence, "reason": str(data.get("reason", ""))}


def classify_intent(question: str, model=None) -> dict[str, Any]:
    messages = [
        SystemMessage(content=SYSTEM_PROMPT_INTENT),
        HumanMessage(content=question),
    ]
    if model is not None:
        response = model.invoke(messages)
        raw = response.content
    else:
        from graphs.javatutor.nodes import _get_chat_model

        client, llm_config = _get_chat_model()
        response = client.invoke(
            messages=messages,
            model=llm_config.model,
            temperature=0.1,
            top_p=llm_config.top_p or 0.9,
            max_completion_tokens=200,
        )
        raw = response.content
    parsed = _parse_output(raw)
    if parsed is None:
        return {"intent": "other", "confidence": 0.0, "reason": "分类输出非法"}
    if parsed["confidence"] < CONFIDENCE_THRESHOLD:
        return {**parsed, "reason": "低置信度"}
    return parsed
```

- [ ] **Step 5: 运行测试确认通过**

Run: `uv run pytest tests/test_intent.py -v`
Expected: 4 passed。

- [ ] **Step 6: 提交**

```bash
git add src/graphs/javatutor/intent.py src/graphs/javatutor/prompts.py tests/test_intent.py
git commit -m "feat: add LLM intent classifier"
```

---

### Task 2: 上下文压缩节点

**Files:**
- Create: `src/graphs/javatutor/compaction.py`
- Test: `tests/test_compaction.py`

**Interfaces:**
- Produces: `compact_steps(steps: list[dict], current_step_index: int = 0, threshold: int = 200, window: int = 30) -> dict`，返回 `{steps_json, context_summary, compaction_mode}`。

- [ ] **Step 1: 写失败测试**

创建 `tests/test_compaction.py`：

```python
import json

from graphs.javatutor.compaction import compact_steps


def _steps(n):
    return [{"step": i, "variables": {"arr": [i, i + 1]}} for i in range(n)]


def test_small_steps_unchanged():
    out = compact_steps(_steps(5), current_step_index=2)
    assert out["compaction_mode"] == "none"
    assert json.loads(out["steps_json"]) == _steps(5)


def test_large_steps_windowed():
    out = compact_steps(_steps(250), current_step_index=100, threshold=200, window=30)
    assert out["compaction_mode"] == "windowed"
    assert "共 250 步" in out["context_summary"]
    assert len(json.loads(out["steps_json"])) == 30


def test_truncated_on_error():
    out = compact_steps([{"step": i} for i in range(250)], current_step_index=None, threshold=200, window=30)
    assert out["compaction_mode"] in ("windowed", "truncated")
```

- [ ] **Step 2: 运行测试确认失败**

Run: `uv run pytest tests/test_compaction.py -v`
Expected: FAIL，`ModuleNotFoundError`。

- [ ] **Step 3: 实现压缩模块**

创建 `src/graphs/javatutor/compaction.py`：

```python
"""steps 上下文压缩：超过阈值时输出窗口 + 摘要 + 变量轨迹。"""

import json
from typing import Any

DEFAULT_THRESHOLD = 200
DEFAULT_WINDOW = 30


def _build_summary(steps: list[dict]) -> str:
    seen = []
    for step in steps:
        variables = step.get("variables") or {}
        for key in ("arr", "array", "nums", "list"):
            if key in variables:
                value = variables[key]
                if value not in seen:
                    seen.append(value)
                break
    return f"共 {len(steps)} 步；最近数组形态: {seen[-5:]}"


def compact_steps(
    steps: list[dict],
    current_step_index: int = 0,
    threshold: int = DEFAULT_THRESHOLD,
    window: int = DEFAULT_WINDOW,
) -> dict[str, Any]:
    count = len(steps)
    if count <= threshold:
        return {
            "steps_json": json.dumps(steps, ensure_ascii=False),
            "context_summary": "",
            "compaction_mode": "none",
        }
    try:
        index = int(current_step_index) if current_step_index is not None else count - 1
        index = max(0, min(index, count - 1))
        start = max(0, min(index - window // 2, count - window))
        window_steps = steps[start:start + window]
        return {
            "steps_json": json.dumps(window_steps, ensure_ascii=False),
            "context_summary": _build_summary(steps),
            "compaction_mode": "windowed",
        }
    except Exception:
        return {
            "steps_json": json.dumps(steps[:threshold], ensure_ascii=False),
            "context_summary": "",
            "compaction_mode": "truncated",
        }
```

- [ ] **Step 4: 运行测试确认通过**

Run: `uv run pytest tests/test_compaction.py -v`
Expected: 3 passed。

- [ ] **Step 5: 提交**

```bash
git add src/graphs/javatutor/compaction.py tests/test_compaction.py
git commit -m "feat: add steps context compaction"
```

---

### Task 3: RAG 知识库与检索

**Files:**
- Create: `src/learning/knowledge.py`
- Create: `scripts/seed_knowledge.py`
- Test: `tests/test_knowledge.py`

**Interfaces:**
- Produces: `chunk_text(text, source, chunk_size=500, overlap=50) -> list[dict]`、`embed_texts(texts) -> list[list[float]]`、`ensure_schema(url=None)`、`insert_chunks(chunks, url=None)`、`seed_assets(url=None) -> int`、`search_chunks(query, top_k=3, threshold=0.3, embedder=embed_texts, fetcher=_fetch_similar) -> list[dict]`。

- [ ] **Step 1: 写失败测试**

创建 `tests/test_knowledge.py`：

```python
from learning.knowledge import chunk_text, search_chunks


def test_chunk_text_creates_overlapping_chunks():
    chunks = chunk_text("0123456789", "知识库: 测试", chunk_size=5, overlap=2)
    assert len(chunks) >= 2
    assert chunks[0]["source"] == "知识库: 测试"
    assert chunks[0]["chunk_index"] == 0


def test_search_filters_by_threshold_and_top_k():
    def fake_embed(texts):
        return [[1.0]]

    def fake_fetch(vector, top_k):
        return [
            ("知识库: A", 0, "内容A", 0.8),
            ("知识库: B", 0, "内容B", 0.2),
        ]

    result = search_chunks("查询", top_k=3, threshold=0.5, embedder=fake_embed, fetcher=fake_fetch)
    assert len(result) == 1
    assert result[0]["source"] == "知识库: A"


def test_search_empty_query():
    assert search_chunks("") == []
```

- [ ] **Step 2: 运行测试确认失败**

Run: `uv run pytest tests/test_knowledge.py -v`
Expected: FAIL，`ModuleNotFoundError`。

- [ ] **Step 3: 实现知识库模块**

创建 `src/learning/knowledge.py`：

```python
"""RAG 知识检索：语料分块、embedding、pgvector 检索。"""

import json
import os
from pathlib import Path
from typing import Any, Callable

import httpx
import psycopg

ASSETS = Path(__file__).resolve().parents[2] / "assets" / "knowledge"
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "doubao-embedding-vision")
EMBEDDING_DIM = int(os.getenv("EMBEDDING_DIM", "2048"))
DEFAULT_TOP_K = 3
DEFAULT_THRESHOLD = 0.3


def chunk_text(text: str, source: str, chunk_size: int = 500, overlap: int = 50) -> list[dict[str, Any]]:
    text = (text or "").strip()
    chunks = []
    start = 0
    index = 0
    while start < len(text):
        end = min(len(text), start + chunk_size)
        chunks.append({"source": source, "chunk_index": index, "content": text[start:end]})
        index += 1
        if end >= len(text):
            break
        start = max(0, end - overlap)
    return chunks


def embed_texts(texts: list[str]) -> list[list[float]]:
    base = os.getenv("COZE_INTEGRATION_MODEL_BASE_URL", "").rstrip("/")
    key = os.getenv("COZE_WORKLOAD_IDENTITY_API_KEY", "")
    model = os.getenv("EMBEDDING_MODEL", EMBEDDING_MODEL)
    resp = httpx.post(
        f"{base}/embeddings",
        headers={"Authorization": f"Bearer {key}"},
        json={"model": model, "input": texts},
        timeout=60,
    )
    resp.raise_for_status()
    return [item["embedding"] for item in resp.json()["data"]]


def _db_url() -> str:
    from storage.database.db import get_db_url

    return get_db_url()


def ensure_schema(url: str | None = None) -> None:
    with psycopg.connect(url or _db_url(), autocommit=True) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "CREATE TABLE IF NOT EXISTS knowledge_chunks ("
                "id BIGSERIAL PRIMARY KEY, source TEXT NOT NULL, chunk_index INT NOT NULL, "
                f"content TEXT NOT NULL, embedding vector({EMBEDDING_DIM}))"
            )
            cur.execute(
                "CREATE INDEX IF NOT EXISTS knowledge_chunks_hnsw_idx "
                "ON knowledge_chunks USING hnsw (embedding vector_cosine_ops)"
            )


def insert_chunks(chunks: list[dict[str, Any]], url: str | None = None) -> None:
    if not chunks:
        return
    vectors = embed_texts([c["content"] for c in chunks])
    with psycopg.connect(url or _db_url()) as conn:
        with conn.cursor() as cur:
            for chunk, vector in zip(chunks, vectors):
                cur.execute(
                    "INSERT INTO knowledge_chunks (source, chunk_index, content, embedding) "
                    "VALUES (%s, %s, %s, %s::vector)",
                    (chunk["source"], chunk["chunk_index"], chunk["content"], vector),
                )
        conn.commit()


def seed_assets(url: str | None = None) -> int:
    ensure_schema(url)
    chunks: list[dict[str, Any]] = []
    for path in sorted(ASSETS.glob("*")):
        if path.suffix in (".md", ".txt"):
            chunks.extend(chunk_text(path.read_text(encoding="utf-8"), f"知识库: {path.stem}"))
        elif path.suffix == ".json":
            data = json.loads(path.read_text(encoding="utf-8"))
            for entry in data.get("entries", []):
                text = f"{entry.get('title', '')}\n{entry.get('explanation', '')}"
                chunks.extend(chunk_text(text, f"知识库: {entry.get('title', path.stem)}"))
    insert_chunks(chunks, url)
    return len(chunks)


def _fetch_similar(vector: list[float], top_k: int, url: str | None = None) -> list[tuple]:
    with psycopg.connect(url or _db_url()) as conn:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT source, chunk_index, content, 1 - (embedding <=> %s::vector) AS score "
                "FROM knowledge_chunks ORDER BY embedding <=> %s::vector LIMIT %s",
                (vector, vector, top_k),
            )
            return cur.fetchall()


def search_chunks(
    query: str,
    top_k: int = DEFAULT_TOP_K,
    threshold: float = DEFAULT_THRESHOLD,
    embedder: Callable = embed_texts,
    fetcher: Callable = _fetch_similar,
) -> list[dict[str, Any]]:
    if not query.strip():
        return []
    try:
        vector = embedder([query])[0]
        rows = fetcher(vector, top_k)
    except Exception:
        return []
    return [
        {"source": row[0], "chunk_index": row[1], "content": row[2], "score": round(float(row[3]), 4)}
        for row in rows
        if float(row[3]) >= threshold
    ]
```

创建 `scripts/seed_knowledge.py`：

```python
"""团队语料灌库脚本：读取 assets/knowledge/ 写入 pgvector。"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))

from learning.knowledge import seed_assets  # noqa: E402

if __name__ == "__main__":
    count = seed_assets()
    print(f"seeded {count} chunks")
```

- [ ] **Step 4: 运行测试确认通过**

Run: `uv run pytest tests/test_knowledge.py -v`
Expected: 3 passed。

- [ ] **Step 5: 提交**

```bash
git add src/learning/knowledge.py scripts/seed_knowledge.py tests/test_knowledge.py
git commit -m "feat: add pgvector RAG knowledge retrieval"
```

---

### Task 4: 状态字段与 RAG 注入

**Files:**
- Modify: `src/graphs/javatutor/state.py`
- Modify: `src/graphs/javatutor/nodes.py`
- Modify: `tests/test_expert_nodes.py`

**Interfaces:**
- State 新增：`intent_confidence`、`retrieved_chunks`、`context_summary`、`critic_feedback`、`revised_answer`、`decision_trace`、`rag_degraded`、`critic_skipped`、`revise_skipped`、`compaction_mode`、`fallback_reason`、`critic_passed`、`revised`。
- Nodes 新增：`context_compaction(state) -> dict`、`retrieve_knowledge(state) -> dict`。

- [ ] **Step 1: 扩展 state**

在 `src/graphs/javatutor/state.py` 末尾追加字段：

```python
    intent_confidence: float
    retrieved_chunks: list[dict]
    context_summary: str
    critic_feedback: str
    revised_answer: str
    decision_trace: dict
    rag_degraded: bool
    critic_skipped: bool
    revise_skipped: bool
    compaction_mode: str
    fallback_reason: str
    critic_passed: bool
    revised: bool
```

- [ ] **Step 2: 写失败测试（RAG 注入）**

在 `tests/test_expert_nodes.py` 末尾追加：

```python
    def test_expert_messages_include_retrieved_chunks(self):
        from graphs.javatutor.nodes import _build_expert_messages

        state = {
            **BASE_STATE,
            "retrieved_chunks": [
                {"source": "知识库: HashMap", "chunk_index": 0, "content": "基于哈希表的映射", "score": 0.8}
            ],
        }
        messages = _build_expert_messages(state, "concept")
        assert "知识库参考" in messages[1].content
        assert "知识库: HashMap" in messages[1].content
```

- [ ] **Step 3: 运行测试确认失败**

Run: `uv run pytest tests/test_expert_nodes.py::TestExpertNodes::test_expert_messages_include_retrieved_chunks -v`
Expected: FAIL，消息中无“知识库参考”。

- [ ] **Step 4: 实现 RAG 注入与两个新节点**

在 `src/graphs/javatutor/nodes.py` 中：

1. `_build_expert_messages` 的 `context_parts` 追加逻辑：

```python
    chunks = state.get("retrieved_chunks") or []
    if chunks:
        refs = "\n".join(f"- {c['source']}: {c['content'][:200]}" for c in chunks)
        context_parts.append(f"\n### 知识库参考\n{refs}\n回答中如引用知识库内容，必须标注「参考知识库：来源名」。")
```

2. 在 `parse_context` 之后追加两个节点：

```python
def context_compaction(state: JavaTutorState) -> dict:
    from graphs.javatutor.compaction import compact_steps

    return compact_steps(state.get("steps") or [], state.get("current_step_index", 0))


def retrieve_knowledge(state: JavaTutorState) -> dict:
    from learning.knowledge import search_chunks

    try:
        query = f"{state.get('user_question', '')} {state.get('context_summary', '')}".strip()
        chunks = search_chunks(query)
        return {"retrieved_chunks": chunks, "rag_degraded": False}
    except Exception:
        return {"retrieved_chunks": [], "rag_degraded": True}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `uv run pytest tests/test_expert_nodes.py -v`
Expected: 全部通过。

- [ ] **Step 6: 提交**

```bash
git add src/graphs/javatutor/state.py src/graphs/javatutor/nodes.py tests/test_expert_nodes.py
git commit -m "feat: add state fields, compaction and retrieval nodes"
```

---

### Task 5: 评审与修订

**Files:**
- Create: `src/graphs/javatutor/critic.py`
- Modify: `src/graphs/javatutor/prompts.py`
- Test: `tests/test_critic.py`

**Interfaces:**
- Produces: `critic_node(state, model=None) -> dict`（返回 `critic_passed`/`critic_feedback`/`critic_skipped`）、`revise_node(state, model=None) -> dict`（返回 `revised_answer`/`revised`/`revise_skipped`）。

- [ ] **Step 1: 写失败测试**

创建 `tests/test_critic.py`：

```python
from langchain_core.messages import AIMessage

from graphs.javatutor.critic import critic_node, revise_node


class FakeModel:
    def __init__(self, content):
        self.content = content

    def invoke(self, messages):
        return AIMessage(content=self.content)


BASE = {
    "answer": "根据第 2 步，arr[1] 变成了 8",
    "current_variables": {"arr": [3, 5, 1]},
    "compile_error": "",
    "steps_json": '[{"step": 1, "variables": {"arr": [3, 5, 1]}}]',
    "user_question": "为什么 arr 变了？",
    "retrieved_chunks": [],
}


def test_critic_passes():
    out = critic_node(BASE, FakeModel('{"pass": true, "issues": []}'))
    assert out["critic_passed"] is True


def test_critic_fails_with_issues():
    out = critic_node(BASE, FakeModel('{"pass": false, "issues": ["变量值 8 与数据不符"]}'))
    assert out["critic_passed"] is False
    assert "变量值" in out["critic_feedback"]


def test_critic_skips_on_bad_output():
    out = critic_node(BASE, FakeModel("not json"))
    assert out["critic_passed"] is True
    assert out["critic_skipped"] is True


def test_revise_returns_revised():
    out = revise_node(BASE, FakeModel("根据第 2 步，arr[1] 变成了 5"))
    assert out["revised"] is True
    assert out["revised_answer"] == "根据第 2 步，arr[1] 变成了 5"
```

- [ ] **Step 2: 运行测试确认失败**

Run: `uv run pytest tests/test_critic.py -v`
Expected: FAIL，`ModuleNotFoundError`。

- [ ] **Step 3: 添加评审/修订提示词**

在 `src/graphs/javatutor/prompts.py` 末尾追加：

```python
SYSTEM_PROMPT_CRITIC = """你是回答评审。对照事实依据核查候选回答，只返回 JSON：
{"pass": true|false, "issues": ["问题1", "问题2"]}
核查重点：步骤号、行号、变量值是否与步骤数据一致；引用来源是否真实存在。
只返回 JSON。"""


SYSTEM_PROMPT_REVISE = """你是回答修订者。根据评审意见修正原回答，保留正确的部分，修正错误引用。
直接输出修订后的完整回答，不要 JSON、不要解释。"""
```

- [ ] **Step 4: 实现评审与修订**

创建 `src/graphs/javatutor/critic.py`：

```python
"""评审与修订节点。"""

import json
from typing import Any

from langchain_core.messages import HumanMessage, SystemMessage

from graphs.javatutor.prompts import SYSTEM_PROMPT_CRITIC, SYSTEM_PROMPT_REVISE


def _invoke(messages, model):
    if model is not None:
        return model.invoke(messages)
    from graphs.javatutor.nodes import _get_chat_model

    client, llm_config = _get_chat_model()
    return client.invoke(
        messages=messages,
        model=llm_config.model,
        temperature=0.1,
        top_p=llm_config.top_p or 0.9,
        max_completion_tokens=800,
    )


def _parse_json(raw: str) -> dict | None:
    text = (raw or "").strip()
    if text.startswith("```"):
        lines = text.splitlines()
        if lines and lines[0].startswith("```"):
            text = "\n".join(lines[1:])
        if text.endswith("```"):
            text = text[:-3].strip()
    try:
        data = json.loads(text)
        return data if isinstance(data, dict) else None
    except json.JSONDecodeError:
        return None


def _facts(state) -> str:
    chunks = state.get("retrieved_chunks") or []
    lines = [
        f"学生问题：{state.get('user_question', '')}",
        f"当前变量：{state.get('current_variables', {})}",
        f"编译错误：{state.get('compile_error', '')}",
        f"步骤数据：{state.get('steps_json', '[]')[:4000]}",
    ]
    if chunks:
        lines.append("检索来源：" + "; ".join(c["source"] for c in chunks))
    return "\n".join(lines)


def critic_node(state, model=None) -> dict[str, Any]:
    answer = state.get("revised_answer") or state.get("answer") or ""
    messages = [
        SystemMessage(content=SYSTEM_PROMPT_CRITIC),
        HumanMessage(content=f"候选回答：\n{answer}\n\n事实依据：\n{_facts(state)}"),
    ]
    try:
        parsed = _parse_json(_invoke(messages, model).content)
        if parsed is None:
            return {"critic_passed": True, "critic_feedback": "", "critic_skipped": True}
        issues = parsed.get("issues", []) if isinstance(parsed.get("issues"), list) else []
        return {
            "critic_passed": bool(parsed.get("pass", False)),
            "critic_feedback": json.dumps(issues, ensure_ascii=False),
            "critic_skipped": False,
        }
    except Exception:
        return {"critic_passed": True, "critic_feedback": "", "critic_skipped": True}


def revise_node(state, model=None) -> dict[str, Any]:
    answer = state.get("answer") or ""
    if state.get("critic_passed") or state.get("revised"):
        return {"revised_answer": answer, "revised": False, "revise_skipped": False}
    messages = [
        SystemMessage(content=SYSTEM_PROMPT_REVISE),
        HumanMessage(
            content=(
                f"原回答：\n{answer}\n\n评审意见：\n{state.get('critic_feedback', '')}\n\n"
                f"事实依据：\n{_facts(state)}"
            )
        ),
    ]
    try:
        raw = _invoke(messages, model).content
        return {"revised_answer": raw, "revised": True, "revise_skipped": False}
    except Exception:
        return {"revised_answer": answer, "revised": False, "revise_skipped": True}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `uv run pytest tests/test_critic.py -v`
Expected: 4 passed。

- [ ] **Step 6: 提交**

```bash
git add src/graphs/javatutor/critic.py src/graphs/javatutor/prompts.py tests/test_critic.py
git commit -m "feat: add critic and revise nodes"
```

---

### Task 6: 路由改造与决策痕迹

**Files:**
- Modify: `src/graphs/javatutor/nodes.py`
- Test: `tests/test_route_intent.py`

**Interfaces:**
- `route_intent(state, model=None)`：显式 intent / compile_error 短路保留；其余调用 `classify_intent`。
- `build_final(state)`：输出正文 + `【决策痕迹】` JSON。

- [ ] **Step 1: 写失败测试**

在 `tests/test_route_intent.py` 追加：

```python
from langchain_core.messages import AIMessage


class FakeClassifierModel:
    def invoke(self, messages):
        return AIMessage(content='{"intent":"concept","confidence":0.9,"reason":"概念问题"}')


def test_route_intent_uses_llm_classifier():
    from graphs.javatutor.nodes import route_intent

    state = {"user_question": "讲讲 HashMap", "compile_error": "", "intent": ""}
    out = route_intent(state, model=FakeClassifierModel())
    assert out["intent"] == "concept"
    assert out["intent_confidence"] == 0.9


def test_route_intent_explicit_wins():
    from graphs.javatutor.nodes import route_intent

    state = {"user_question": "为什么 arr 变了", "compile_error": "error", "intent": "analyze"}
    out = route_intent(state)
    assert out["intent"] == "analyze"
```

- [ ] **Step 2: 运行测试确认失败**

Run: `uv run pytest tests/test_route_intent.py -v`
Expected: FAIL，`route_intent` 仍返回关键词结果。

- [ ] **Step 3: 改造 route_intent 与 build_final**

在 `src/graphs/javatutor/nodes.py` 中，将 `route_intent` 整体替换为：

```python
def route_intent(state: JavaTutorState, model=None) -> dict:
    explicit = state.get("intent", "").strip()
    if explicit in ("data_query", "concept", "debug", "animate", "animate_guide", "analyze", "other"):
        return {"intent": explicit, "intent_confidence": 1.0, "fallback_reason": ""}
    if _is_compile_error_debug(state):
        return {"intent": "debug", "intent_confidence": 1.0, "fallback_reason": ""}

    from graphs.javatutor.intent import classify_intent

    result = classify_intent(state.get("user_question", ""), model=model)
    return {
        "intent": result["intent"],
        "intent_confidence": result["confidence"],
        "fallback_reason": result["reason"],
    }
```

将 `build_final` 替换为：

```python
def build_final(state: JavaTutorState) -> dict:
    from langchain_core.messages import AIMessage

    answer = state.get("revised_answer") or state.get("answer") or "抱歉，我暂时无法回答这个问题。"
    trace = {
        "intent": state.get("intent", "other"),
        "confidence": round(float(state.get("intent_confidence", 0.0)), 2),
        "sources": [
            {"source": c["source"], "score": c.get("score", 0.0)}
            for c in (state.get("retrieved_chunks") or [])
        ],
        "critic_passed": state.get("critic_passed", True),
        "revised": state.get("revised", False),
        "fallback_reason": state.get("fallback_reason", ""),
        "rag_degraded": state.get("rag_degraded", False),
        "critic_skipped": state.get("critic_skipped", False),
        "revise_skipped": state.get("revise_skipped", False),
        "compaction_mode": state.get("compaction_mode", "none"),
    }
    content = f"{answer}\n\n【决策痕迹】\n{json.dumps(trace, ensure_ascii=False)}"
    return {"messages": [AIMessage(content=content)], "decision_trace": trace}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `uv run pytest tests/test_route_intent.py -v`
Expected: 全部通过。

- [ ] **Step 5: 提交**

```bash
git add src/graphs/javatutor/nodes.py tests/test_route_intent.py
git commit -m "feat: switch free QA routing to LLM classifier and add decision trace"
```

---

### Task 7: 图装配与全流程集成测试

**Files:**
- Modify: `src/graphs/javatutor/graph.py`
- Modify: `tests/test_graph.py`

**Interfaces:**
- `build_flow_graph()`：`parse_context → context_compaction → route_intent`；analyze/animate/animate_guide 直达 END；其余 `retrieve_knowledge → 专家 → critic → revise → build_final → END`。

- [ ] **Step 1: 写失败测试**

在 `tests/test_graph.py` 追加：

```python
from graphs.javatutor.critic import critic_node, revise_node
from graphs.javatutor.nodes import build_final


class DeepFakeModel:
    def __init__(self):
        self.calls = []

    def invoke(self, messages):
        self.calls.append(messages[0].content[:20])
        content = messages[0].content
        if "意图分类器" in content:
            return AIMessage(content='{"intent":"data_query","confidence":0.9,"reason":"追问"}')
        if "回答评审" in content:
            return AIMessage(content='{"pass": true, "issues": []}')
        if "回答修订者" in content:
            return AIMessage(content="修订后的回答")
        return AIMessage(content="根据第 2 步，arr[1] 变成了 5")


def test_full_flow_generate_review_revise_trace():
    payload = {
        "source_code": "public class A {}",
        "steps": [{"step": 1, "variables": {"arr": [3, 5, 1]}}],
        "current_step_index": 1,
        "user_question": "为什么 arr 变了？",
        "compile_error": "",
    }
    initial = {"messages": [HumanMessage(content=json.dumps(payload))]}
    compiled = build_agent().builder.compile()
    model = DeepFakeModel()
    result = compiled.invoke(initial, config={"configurable": {"chat_model": model}})
    final_content = [m for m in result.get("messages", []) if getattr(m, "type", "") == "ai"][-1].content
    assert "【决策痕迹】" in final_content
    assert result.get("decision_trace", {}).get("intent") == "data_query"
```

说明：`DeepFakeModel` 依赖路由/评审/修订/专家节点都能从 `configurable.chat_model` 取模型；本任务先让测试失败，下一步统一改模型解析。

- [ ] **Step 2: 运行测试确认失败**

Run: `uv run pytest tests/test_graph.py::TestGraphAssembly::test_full_flow_generate_review_revise_trace -v`
Expected: FAIL（专家/评审仍调用真实 LLM 或消息不含痕迹）。

- [ ] **Step 3: 统一模型注入解析**

在 `src/graphs/javatutor/nodes.py` 顶部追加 helper：

```python
from langchain_core.runnables import get_runnable_config


def _resolve_model(model):
    if model is not None:
        return model
    try:
        return get_runnable_config().get("configurable", {}).get("chat_model")
    except Exception:
        return None
```

将 `_run_expert` 的模型分支改为：

```python
    resolved = _resolve_model(model)
    if resolved is not None:
        response = resolved.invoke(messages)
        answer = response.content
    else:
        client, llm_config = _get_chat_model()
        response = client.invoke(
            messages=messages,
            model=llm_config.model,
            temperature=llm_config.temperature or 0.7,
            top_p=llm_config.top_p or 0.9,
            max_completion_tokens=llm_config.max_completion_tokens or 10000,
        )
        answer = response.content
```

将 `route_intent` 改为先 `_resolve_model(model)` 再传给 `classify_intent`：

```python
    result = classify_intent(state.get("user_question", ""), model=_resolve_model(model))
```

将 `critic.py` 的 `_invoke` 改为支持 `configurable.chat_model`：

```python
def _resolve_model(model):
    if model is not None:
        return model
    try:
        from langchain_core.runnables import get_runnable_config

        return get_runnable_config().get("configurable", {}).get("chat_model")
    except Exception:
        return None
```

并把 `critic.py` 的 `_invoke` 第一行改为 `model = _resolve_model(model)`。

- [ ] **Step 4: 重构图**

将 `src/graphs/javatutor/graph.py` 的 `build_flow_graph` 整体替换为：

```python
def _route_to_expert(state: JavaTutorState) -> str:
    intent = state.get("intent", "other")
    if intent in ("analyze", "animate", "animate_guide"):
        return intent
    return "retrieve_knowledge"


def _route_after_retrieval(state: JavaTutorState) -> str:
    intent = state.get("intent", "other")
    return intent if intent in ("data_query", "concept", "debug", "other") else "other"


def build_flow_graph() -> StateGraph:
    graph = StateGraph(state_schema=JavaTutorState)
    graph.add_node("parse_context", parse_context)
    graph.add_node("context_compaction", context_compaction)
    graph.add_node("route_intent", route_intent)
    graph.add_node("retrieve_knowledge", retrieve_knowledge)
    graph.add_node("data_query", data_query_node)
    graph.add_node("concept", concept_node)
    graph.add_node("debug", debug_node)
    graph.add_node("other", other_node)
    graph.add_node("analyze", analyze_node)
    graph.add_node("animate", animate_node)
    graph.add_node("animate_guide", animate_guide_node)
    graph.add_node("critic", critic_node)
    graph.add_node("revise", revise_node)
    graph.add_node("final", build_final)

    graph.set_entry_point("parse_context")
    graph.add_edge("parse_context", "context_compaction")
    graph.add_edge("context_compaction", "route_intent")
    graph.add_conditional_edges(
        source="route_intent",
        path=_route_to_expert,
        path_map={
            "analyze": "analyze",
            "animate": "animate",
            "animate_guide": "animate_guide",
            "retrieve_knowledge": "retrieve_knowledge",
        },
    )
    for direct in ("analyze", "animate", "animate_guide"):
        graph.add_edge(direct, END)

    graph.add_conditional_edges(
        source="retrieve_knowledge",
        path=_route_after_retrieval,
        path_map={
            "data_query": "data_query",
            "concept": "concept",
            "debug": "debug",
            "other": "other",
        },
    )
    for expert in ("data_query", "concept", "debug", "other"):
        graph.add_edge(expert, "critic")
    graph.add_edge("critic", "revise")
    graph.add_edge("revise", "final")
    graph.add_edge("final", END)
    return graph
```

同步更新 graph.py 的 import 列表，加入 `context_compaction`、`retrieve_knowledge`、`critic_node`、`revise_node`、`build_final`。

- [ ] **Step 5: 运行测试确认通过**

Run: `uv run pytest tests/test_graph.py -v`
Expected: 全部通过。

- [ ] **Step 6: 提交**

```bash
git add src/graphs/javatutor/graph.py src/graphs/javatutor/nodes.py src/graphs/javatutor/critic.py tests/test_graph.py
git commit -m "feat: wire deepened agent graph with critic-revise loop"
```

---

### Task 8: 语料资产、灌库与全量回归

**Files:**
- Create: `assets/knowledge/error_quickref.json`
- Create: `assets/knowledge/java_std.json`
- Modify: `docs/coze-local-dev-checklist.md`（追加灌库与冒烟步骤）

**Interfaces:**
- `seed_assets()` 读取 `assets/knowledge/` 并写入 pgvector；`/health` 与 `/v1/chat/completions` 冒烟验证。

- [ ] **Step 1: 创建语料**

创建 `assets/knowledge/error_quickref.json`：

```json
{
  "entries": [
    {"title": "cannot find symbol", "explanation": "变量名或方法名不存在，检查拼写或是否声明。"},
    {"title": "incompatible types", "explanation": "类型不匹配，例如把字符串赋给了 int。"},
    {"title": "missing return statement", "explanation": "方法声明了返回值，但某个分支没有 return。"},
    {"title": "NullPointerException", "explanation": "对 null 对象调用了方法或访问了字段。"},
    {"title": "ArrayIndexOutOfBoundsException", "explanation": "访问数组时下标越界。"}
  ]
}
```

创建 `assets/knowledge/java_std.json`：

```json
{
  "entries": [
    {"title": "Arrays.sort", "explanation": "对数组原地排序，默认升序。"},
    {"title": "Arrays.binarySearch", "explanation": "在已排序数组中二分查找，返回下标或负数。"},
    {"title": "HashMap", "explanation": "基于哈希表的键值映射，平均 O(1) 查询。"},
    {"title": "ArrayList", "explanation": "动态数组，支持随机访问，扩容时复制元素。"},
    {"title": "String.substring", "explanation": "返回 [beginIndex, endIndex) 的子串。"}
  ]
}
```

- [ ] **Step 2: 灌库**

Run: `uv run python scripts/seed_knowledge.py`
Expected: 输出 `seeded N chunks`。

- [ ] **Step 3: 全量测试**

Run: `uv run pytest tests/ -v`
Expected: 全部通过。

- [ ] **Step 4: HTTP 冒烟**

```bash
bash scripts/http_run.sh -p 5000 &
curl -fsS http://127.0.0.1:5000/health
curl -fsS -X POST http://127.0.0.1:5000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"<config模型名>","messages":[{"role":"user","content":"讲讲 HashMap"}]}'
```

Expected: 回答含“参考知识库：HashMap”和 `【决策痕迹】` JSON。

- [ ] **Step 5: 记录冒烟结果**

在 `docs/coze-local-dev-checklist.md` 追加：

```markdown
## 深化版冒烟记录
- 日期：执行当天
- 意图分类：通过 / 失败
- RAG 检索：通过 / 失败（检索到 HashMap）
- 评审-修订：通过 / 失败
- 决策痕迹：通过 / 失败
- 备注：
```

- [ ] **Step 6: 提交**

```bash
git add assets/knowledge docs/coze-local-dev-checklist.md
git commit -m "docs: add knowledge assets and smoke record template"
```

---

## Self-Review

### Spec Coverage

| 设计条目 | 对应任务 |
|---|---|
| LLM 意图分类 | Task 1 + Task 6 |
| 显式 intent / compile_error 保留 | Task 6 |
| 上下文压缩 | Task 2 + Task 4 |
| pgvector RAG + 语料灌库 | Task 3 + Task 8 |
| RAG 统一注入 + 引用 | Task 4 |
| 评审-修订一轮 | Task 5 |
| 决策痕迹 | Task 6 + Task 7 |
| 降级策略 | Task 1 / 3 / 5 内实现 |
| 接口契约 | `docs/superpowers/specs/2026-08-10-coze-agent-interface.md` |

### Placeholder Scan

计划无 `TBD`、`TODO`、`implement later`；所有代码块为完整实现。

### Type Consistency

- `classify_intent(question, model=None) -> dict`：Task 1 定义，Task 6 使用。
- `compact_steps(steps, current_step_index, threshold, window) -> dict`：Task 2 定义，Task 4 使用。
- `search_chunks(query, top_k, threshold, embedder, fetcher) -> list[dict]`：Task 3 定义，Task 4 使用。
- `critic_node(state, model=None)` / `revise_node(state, model=None)`：Task 5 定义，Task 7 使用。
- `build_final(state)`：Task 6 定义，Task 7 使用。
- `decision_trace` 字段名：Task 4 定义，Task 6/7 使用，接口文档一致。
