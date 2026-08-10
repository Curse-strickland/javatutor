# Coze Agent 深化接口契约

> 本文档定义 JavaTutor 后端与 Coze 侧智能体之间的消息契约，以及智能体回答中“决策痕迹”的解析格式。前后端与 Coze 侧实现均以本文档为准。

## 1. Request（JavaTutor 后端 → Coze Chat API）

后端通过 Coze Chat API 发送 JSON 字符串作为消息文本，字段不变，`intent` 可选：

```json
{
  "source_code": "public class BubbleSort { ... }",
  "steps": [
    {"step": 0, "line": 3, "variables": {"arr": [5, 3, 1]}}
  ],
  "current_step_index": 0,
  "current_line": 3,
  "user_question": "为什么 arr[1] 变成了 3？",
  "user_id": "u-001",
  "compile_error": "",
  "intent": "analyze"
}
```

规则：

- `intent` 缺省时由智能体 LLM 分类；显式传值时智能体直接采用。
- `intent` 合法枚举：`data_query`、`concept`、`debug`、`animate`、`animate_guide`、`analyze`、`other`。
- `steps` 允许为空数组；`compile_error` 允许为空字符串；`user_id` 允许缺失。

## 2. Response（Coze 智能体 → 消息文本）

智能体回答正文后，可能追加决策痕迹块：

```text
正文回答...

【决策痕迹】
{"intent":"data_query","confidence":0.9,"sources":[...],"critic_passed":true,"revised":false,"fallback_reason":"","rag_degraded":false,"critic_skipped":false,"revise_skipped":false,"compaction_mode":"none"}
```

约定：

- 决策痕迹块固定以单独一行 `【决策痕迹】` 开头，其后一行是 JSON。
- 正文与痕迹块之间空一行。
- 前端按“最后一个 `【决策痕迹】` 标记之后的内容”提取 JSON，其余全部视为正文。
- 无痕迹时（如 analyze 返回纯 JSON、动画返回 SVG），正文就是完整消息，前端不强制解析。

## 3. 决策痕迹 Schema

```json
{
  "intent": "data_query|concept|debug|other|animate_guide",
  "confidence": 0.0,
  "sources": [
    {"source": "知识库: Arrays.sort", "score": 0.82}
  ],
  "critic_passed": true,
  "revised": false,
  "fallback_reason": "",
  "rag_degraded": false,
  "critic_skipped": false,
  "revise_skipped": false,
  "compaction_mode": "none|windowed|truncated"
}
```

字段说明：

| 字段 | 类型 | 说明 |
|---|---|---|
| `intent` | string | 最终采用的意图 |
| `confidence` | number | LLM 分类置信度，0-1 |
| `sources` | array | 检索命中的知识来源，未命中为空数组 |
| `critic_passed` | boolean | 评审是否通过；评审跳过时为 `true` 且 `critic_skipped=true` |
| `revised` | boolean | 是否执行过修订 |
| `fallback_reason` | string | 降级原因，未降级为空字符串 |
| `rag_degraded` | boolean | 检索降级（跳过 RAG）时为 `true` |
| `critic_skipped` | boolean | 评审调用失败时为 `true` |
| `revise_skipped` | boolean | 修订调用失败时为 `true` |
| `compaction_mode` | string | `none`（≤200 步）、`windowed`（压缩成功）、`truncated`（压缩失败后截断） |

## 4. 正文引用格式

专家回答需要标注知识来源时，使用以下格式：

```text
参考知识库：Arrays.sort
```

或并列多个来源：

```text
参考知识库：Arrays.sort、HashMap
```

前端可把“参考知识库：”后的来源文本渲染为来源标签；评审 Agent 会核查该来源是否真实存在于检索结果中。

## 5. 降级行为

| 场景 | 行为 | trace 标记 |
|---|---|---|
| 意图分类输出非法/低置信度 | 降级 `other` | `fallback_reason` |
| 检索失败 | 跳过 RAG，用原上下文回答 | `rag_degraded=true` |
| 评审失败 | 视为通过 | `critic_skipped=true` |
| 修订失败 | 返回原回答 | `revise_skipped=true` |
| steps > 200 且压缩失败 | 截断注入 | `compaction_mode=truncated` |

## 6. 示例

### 6.1 概念问答（带 RAG）

```text
HashMap 是基于哈希表的键值映射，平均查询复杂度为 O(1)。
参考知识库：HashMap

【决策痕迹】
{"intent":"concept","confidence":0.95,"sources":[{"source":"知识库: HashMap","score":0.86}],"critic_passed":true,"revised":false,"fallback_reason":"","rag_degraded":false,"critic_skipped":false,"revise_skipped":false,"compaction_mode":"none"}
```

### 6.2 评审拦截并修订

```text
根据第 2 步（第 4 行），arr[1] 由 3 变成 5，原因是发生了交换。
参考知识库：无

【决策痕迹】
{"intent":"data_query","confidence":0.88,"sources":[],"critic_passed":false,"revised":true,"fallback_reason":"","rag_degraded":false,"critic_skipped":false,"revise_skipped":false,"compaction_mode":"windowed"}
```

## 7. 前后端约定

- 后端：保持消息透传，不截断、不转义正文；`【决策痕迹】` 属于消息文本的一部分。
- 前端：流式接收时先累积完整消息，收到结束标记后再解析痕迹块并渲染。
- 前端解析规则：全文按 `\n【决策痕迹】\n` 切分，前半为正文，后半为 JSON；JSON 解析失败时整段按正文展示。
