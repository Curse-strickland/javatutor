# AI 解说功能审查

> 审查日期: 2026-06-09

---

## 一、架构评估

**数据流**: 前端 fetch POST `/api/explain` → ExplainController (SseEmitter 120s) → CompletableFuture.runAsync → DeepSeekService.explainStream (Java HttpClient → DeepSeek SSE) → BufferedReader 逐行解析 → Consumer\<String\> onChunk → emitter.send(event:chunk, data:token)。

**并行链路**: `POST /api/analyze` 同步调用 DeepSeek（非流式），代码运行后自动触发分析，返回复杂度 + 算法标签 JSON。

**前端交互**: 三 Tab（解说/复杂度/算法），手动/自动双模式，`explainHistory` 缓存已请求步骤，`AbortController` 中断进行中请求。

| 层 | 亮点 | 状态 |
|----|------|------|
| DeepSeekService | Prompt 精炼、`extractLine` 提取高亮行源码嵌入 | ✓ |
| ExplainController | SseEmitter 120s 超时、`finally` 保证 `emitter.complete()` | ✓ |
| Player Store | `requestExplain` 含 AbortController + `explainHistory` 缓存 | ✓ |
| Player Store | `requestAnalysis` 运行代码后自动触发，非阻塞 | ✓ |
| AiTutorPanel | Tag 颜色映射 17 种分类、`explainTag` 标签点击获取专题解说 | ✓ |
| AiTutorPanel | 自研轻量 Markdown 渲染器（`**` + `` ` ``），无第三方依赖 | ✓ |
| App.vue | `autoExplain` 模式下自动播放等待 AI 完成后再前进（L361-363） | ✓ |
| App.vue | `prefers-reduced-motion` 全面支持（panel-slide、pulse、spin） | ✓ |

---

## 二、需修复

### [致命] API Key 硬编码在仓库中

**文件**: `application.properties:4`

```
deepseek.api.key=sk-a09ad8373c4f438faec1a322fd64e6d8
```

已提交到 Git。任何人可读取仓库即可消费该 Key。须立即轮换 Key 并外置：

1. 删除 `application.properties` 中该行
2. 通过环境变量注入：`DEEPSEEK_API_KEY=xxx`
3. Spring 用 `@Value("${DEEPSEEK_API_KEY}")` 读取（Spring 自动将环境变量映射为属性占位符）
4. 将 `application.properties` 中加入 `deepseek.api.key=${DEEPSEEK_API_KEY:}` 作为默认空值
5. `.gitignore` 确保不含 secrets

---

### [中等] SSE 流解析逻辑重复

**文件**: `player.js:99-158` 和 `AiTutorPanel.vue:185-235`

`AiTutorPanel.explainTag()` 自行实现了完整的 fetch + ReadableStream + `data:` 行解析，而非调用 `store.requestExplain()`。两处维护同一逻辑。

**修复**: `explainTag` 应复用 `store.requestExplain()`，仅注入 `_explainTopic` 差异。可将 topic 作为参数透传：
```js
// player.js — requestExplain 接受可选 topic
async requestExplain(topic) {
  // ...
  body: JSON.stringify({
    // ...
    variables: topic 
      ? { ...this.currentVariables, _explainTopic: topic }
      : this.currentVariables
  })
}
```

---

### [中等] 三处 DESIGN.md 颜色违规

| 位置 | 当前色 | 问题 |
|------|--------|------|
| `App.vue:612-618` `.ctrl-btn.run-btn` | `#10b981` / `#34d399` (绿色) | DESIGN 规定"只用蓝色 accent" |
| `App.vue:669` `.progress-fill` | `#6366f1 → #8b5cf6` (紫色渐变) | DESIGN 规定 blue only |
| `Editor.vue:141` `.exec-arrow::before` | `#fbbf24` (琥珀色) | DESIGN 禁止琥珀色 |

运行按钮和进度条是核心 UI 元素，与整体设计系统冲突明显。exec-arrow 是装饰性元素，影响较小。

**建议**:
- run-btn: `color: var(--primary)` + hover `background: var(--accent-bg)`
- progress-fill: `background: linear-gradient(90deg, var(--primary-600), var(--primary))`
- exec-arrow: `color: var(--primary)` 或 `var(--text-muted)`

---

## 三、已验证合理

| 设计决策 | 说明 |
|----------|------|
| `editorRef.value.clearHighlights()` | Editor.vue L113-121 已定义并 expose ✓ |
| 自研 Markdown 渲染器 | 仅处理 `**` + `` ` ``，无第三方库依赖和 XSS 风险 ✓ |
| `explainHistory` 缓存 | 仅缓存成功解说（L155-157），失败不缓存 ✓ |
| 面板关闭时 abort | `toggleExplainPanel` 中 abort + 清空文本 ✓ |
| `autoExplain` + 自动播放互锁 | 自动播放等待 AI 完成后前进（L361-363），避免请求堆积 ✓ |
| `prefers-reduced-motion` | 全局覆盖 panel-slide + pulse + spin ✓ |

---

## 四、汇总

| 级别 | 问题 | 位置 |
|------|------|------|
| **致命** | API Key 硬编码在仓库 | `application.properties:4` |
| **中等** | SSE 解析重复实现 | `player.js:99` vs `AiTutorPanel.vue:185` |
| **中等** | run-btn 绿色 + progress 紫色 + arrow 琥珀色 | `App.vue:612,669` + `Editor.vue:141` |

功能实现完整度较高（SSE 流式 + 自动解说 + 历史缓存 + 算法分析 + 标签专题），Prompt 设计精炼。修复优先级：API Key > 颜色违规 > SSE 去重。
