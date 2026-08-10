# Coze 侧 JavaTutor 智能体深化设计

## 1. Goal

将 JavaTutor Coze 智能体从“规则路由 + 单次 LLM 回答”深化为“编排 + 专家 + 评审”的多智能体范式，并集成 RAG 知识检索、上下文压缩、决策痕迹等能力，用于智能体类比赛展示技术深度。动画生成、跨会话记忆、Plan-Execute 不在本阶段范围。

## 2. Scope

### In Scope (M1)

- 自由问答意图识别改为 LLM 分类，替代关键词匹配。
- 保留确定性入口：后端显式 `intent` 优先、`compile_error` 短路。
- 完整向量 RAG：pgvector（HNSW + 余弦）+ Doubao-embedding-vision，团队预置语料（Markdown/TXT + 结构化 JSON）。
- 统一检索注入：data_query / concept / debug / other 四个文本专家回答前均检索知识库。
- 回答引用知识来源，评审 Agent 核查引用真实性。
- 评审-修订循环：生成 → 评审 → 修订 → 输出，最多 2 次生成。
- 上下文压缩：steps 超过 200 步时生成“当前窗口 + 全局摘要 + 变量变化轨迹”。
- 决策痕迹：最终回答尾部追加结构化 JSON。
- 低置信度意图降级 `other`。

### Out of Scope (M1)

- 动画生成器。
- 跨会话持久记忆。
- Plan-Execute 规划-执行分支。
- 用户上传知识文档。
- 模型微调（SFT/LoRA）。

## 3. Decisions

- **D-01**：核心范式为 Orchestrator-Specialist-Critic（编排-专家-评审）。
- **D-02**：评审-修订只跑一轮，最多 2 次生成，修订后直接输出。
- **D-03**：自由问答意图识别由 LLM 完成，输出结构化 JSON，替代关键词匹配。
- **D-04**：保留显式 `intent` 与 `compile_error` 两条确定性短路。
- **D-05**：低置信度（< 0.6）意图降级为 `other`，trace 记录原因。
- **D-06**：RAG 使用 pgvector（HNSW + 余弦），已确认 pgvector 0.8.2 可用。
- **D-07**：Embedding 使用 Coze 平台内置 Doubao-embedding-vision。
- **D-08**：M1 语料由团队预置，格式为 Markdown/TXT + 结构化 JSON，不开放上传。
- **D-09**：四个文本专家回答前统一注入检索结果，回答必须标注知识来源。
- **D-10**：评审 Agent 对照真实 steps / compile_error / 检索来源核查回答。
- **D-11**：steps 超过 200 步时执行上下文压缩；压缩失败则截断注入。
- **D-12**：决策痕迹以 JSON 追加在回答文本尾部，透传链路不改。
- **D-13**：检索结果低于余弦阈值 0.3 时返回空，不硬塞无关语料。
- **D-14**：检索/评审/修订任一环节失败均降级放行，不阻塞回答。
- **D-15**：`build_agent()` / `AgentBundle` 契约与 `src/main.py` 外壳不变。
- **D-16**：实现目标环境为 Coze 项目工作区（`/workspace/projects`）；本地 `projects` 目录仅作只读参考。

## 4. Architecture

保持单个 LangGraph 图，节点按顺序执行：

```text
parse_context
  → context_compaction
  → route_intent (LLM 分类 + schema 校验)
  → retrieve_knowledge
  → 专家生成 (data_query / concept / debug / other)
  → critic 评审
  → revise 修订
  → build_final (答案 + 决策痕迹)
```

### Components

- `IntentClassifier`：低温度 LLM 调用，输出 `{intent, confidence, reason}`；非法输出或低置信度降级 `other`。
- `ContextCompactor`：steps ≤ 200 原样；> 200 生成窗口 + 摘要 + 变量轨迹。
- `KnowledgeRetriever`：语料灌入 pgvector；查询时 embedding 后按余弦相似度取 top-3。
- 专家节点：data_query / concept / debug / other，上下文加入 `retrieved_chunks` 并要求标注来源。
- `CriticNode`：核查候选回答中的步骤号、行号、变量值、引用来源。
- `ReviseNode`：按评审 issues 修订一次。
- `TraceAssembler`：组装尾部 JSON 决策痕迹。

## 5. Data Flow & State

### State 新增字段

```python
intent_confidence: float
retrieved_chunks: list[dict]   # [{source, chunk_index, content, score}]
context_summary: str
critic_feedback: str
revised_answer: str
decision_trace: dict
```

### 请求契约（不变）

后端仍通过 Coze Chat API 发送 JSON：

```json
{
  "source_code": "...",
  "steps": [],
  "current_step_index": 0,
  "current_line": 0,
  "user_question": "...",
  "user_id": "...",
  "compile_error": "",
  "intent": "analyze"
}
```

### 意图分类器输出

```json
{
  "intent": "data_query|concept|debug|animate_guide|other",
  "confidence": 0.9,
  "reason": "学生询问执行步骤中变量变化"
}
```

### 检索契约

- 输入：`user_question`、`intent`、`context_summary`。
- 输出：top-3 chunks，低于阈值 0.3 返回空。

### 评审输出

```json
{
  "pass": false,
  "issues": ["回答第 2 步变量值 8 与步骤数据 3 不符", "引用知识库条目不存在"]
}
```

### 最终回答

```text
正文回答...

【决策痕迹】
{"intent":"data_query","confidence":0.9,"sources":["知识库: Arrays.sort"],"critic_passed":false,"revised":true,"fallback_reason":""}
```

## 6. Error Handling

- 意图分类器非法 JSON / 枚举外 / 低置信度 → `other`，trace 记录 `fallback_reason`。
- 检索失败（pgvector 不可用、embedding 失败）→ 跳过 RAG，trace 标记 `rag: degraded`。
- 评审失败 → 视为通过，trace 标记 `critic: skipped`。
- 修订失败 → 返回原回答，trace 标记 `revise: skipped`。
- 压缩失败 → 截断注入，trace 标记 `compaction: truncated`。

## 7. Testing & Acceptance

### Backend/Agent Tests

- `IntentClassifierTest`：合法/非法 JSON、枚举外、低置信度、中文同义表达。
- `KnowledgeRetrieverTest`：top-k 排序、阈值过滤、embedding 失败降级。
- `ContextCompactorTest`：>200 步窗口+摘要+轨迹；≤200 步原样。
- `CriticNodeTest`：虚构变量值、不存在的引用来源被评出；真实数据通过。
- `TraceAssemblerTest`：trace 字段完整。
- 全流程集成测试：FakeModel 注入，验证四个文本专家均走“生成 → 评审 → 修订 → trace”。

### Acceptance Scenarios

1. “为什么第 3 步 arr 变了” → 分类 data_query，回答引用真实 steps，评审通过。
2. “HashMap 原理” → concept + 检索到 Java 语料，回答带“参考知识库”来源。
3. 专家回答编造变量值 → 评审拦截，修订后引用正确值。
4. 编译错误 → compile_error 短路，debug + 错误速查检索。
5. 低置信度问题 → 降级 other，trace 可见原因。
6. 现有 analyze / 显式 intent 流程不受影响。

## 8. Execution Environment

- 实施计划将面向 Coze 项目工作区（`/workspace/projects`）执行。
- 本地 `D:\CHome\Documents\Projects\EL\projects` 为 Coze 导出只读参考，不修改。
- 依赖与外壳约束沿用现有 Coze 项目规范：Python 3.12、uv、`.coze` / `scripts/` / `src/main.py` 不改。

## 9. Related Docs

- [Coze 侧智能体规格](../coze/spec-javatutor-coze-agent.md)
- [初始实施计划](../coze/plan/initial-work-plan.md)
- [Analyze 专家计划](../coze/plan/analyze-specialist-plan.md)
- [多文件项目模式设计](./2026-08-10-multifile-uml-design.md)
