# 自定义 API Key & 安全性审查

> 审查日期: 2026-06-09

---

## 一、功能架构

**数据流**: 用户输入 Key → 前端 `KEY_PATTERN` 正则校验 → Pinia `userApiKey`（仅会话内存）→ POST body `apiKey` 字段 → Controller 透传 → Service `resolveKey(userApiKey)` → `SAFE_KEY` 正则校验 → `Authorization: Bearer {key}` 头。

**前端 UI**: AiTutorPanel 底部可折叠区域（`border-top` 分割），chevron 展开，`type="password"` 输入框，保存/清除按钮，状态标签（已保存/默认）。

| 层 | 关键设计 | 状态 |
|----|----------|------|
| 前端校验 | `/^[a-zA-Z0-9\-_.]{1,128}$/` 同后端一致 | ✓ |
| 前端存储 | 仅 Pinia 内存，`userApiKey` 不落 localStorage | ✓ |
| 前端输入 | `type="password"` + `autocomplete="off"` | ✓ |
| 前端透传 | `apiKey: this.userApiKey \|\| ''`（空串 fallback） | ✓ |
| 后端校验 | `SAFE_KEY` 正则 `/^[a-zA-Z0-9\-_.]{1,128}$/` | ✓ |
| 后端降级 | `userApiKey` 为空/空白时回退环境变量 key | ✓ |
| 后端 URL | `apiUrl` 硬编码自 `application.properties`，用户不可改 | ✓ |
| SSE 错误 | 前端新增 `event:error` 解析，立即停止流并显示错误 | ✓ |
| localStorage | `uploadHistory` 已加 try-catch（上次审查修复） | ✓ |

---

## 二、安全审查 — 逐条验收

### 2.1 HTTP 头部注入

**攻击面**: 用户 Key 被拼入 `Authorization: Bearer {key}`。

**防御**:
- 前后端双重 `SAFE_KEY` 正则拦截：仅允许 `[a-zA-Z0-9\-_.]`，阻止 `\r`、`\n`、`:` 等注入字符 ✓
- Java `HttpRequest.Builder.header()` 自身也对 header value 做合法性检查 ✓

**结论**: 无法注入额外 HTTP 头。

---

### 2.2 API 端点劫持

**攻击面**: 用户控制目标 API URL，将流量导向恶意服务器。

**防御**: `apiUrl` 由 `application.properties` 注入，**用户不可配置**。仅 Key 可自定义，URL 固定为 `https://api.deepseek.com/v1/chat/completions` ✓

**结论**: 用户无法重定向 API 调用。

---

### 2.3 API 请求体篡改

**攻击面**: 用户通过前端请求注入额外 DeepSeek API 参数。

**防御**: 请求体（`model`、`messages`、`temperature`、`max_tokens`）由 `DeepSeekService` 硬构建，前端仅传入 `code`/`step`/`variables`/`apiKey`，不参与 body 构造 ✓

**结论**: 无法注入 `stop`、`logprobs`、`tools` 等参数。

---

### 2.4 Key 持久化泄露

**攻击面**: 用户 Key 被浏览器持久化存储导致跨会话泄露。

**防御**:
- `userApiKey` 仅存 Pinia store，无 `localStorage.setItem` 调用 ✓
- 页面刷新后丢失（`state: () => ({ userApiKey: '' })`） ✓
- 清除按钮同时清空 store 和输入框 ✓

**结论**: 会话结束后 Key 不可恢复。

---

### 2.5 错误消息泄露 Key

**攻击面**: DeepSeek API 返回 4xx/5xx 时，错误 body 中可能包含部分 Key 信息（如 `invalid key: sk-xxx***`）。

**防御**: 
- `DeepSeekService:74` 将错误 body 嵌入 `IOException` 消息 ✓
- `ExplainController:53-54` 通过 SSE `event:error` 将异常消息回传前端 ✓

**风险**: 若 DeepSeek 在错误响应中回显完整 Key，前端用户可见。但这是上游 API 的默认行为，且用户看到的是**自己输入的 Key**，无第三方泄露。**实战风险极低**。

**建议**: 生产环境可将错误消息脱敏为"API 调用失败 (HTTP 401)"，不暴露原始 body。

---

### 2.6 输入框 XSS

**防御**: `v-model` 绑定到 `ref('')` 字符串，未使用 `v-html` 渲染 Key 值。**无 XSS 向量** ✓

---

### 2.7 CSRF

**防御**: API 仅操作 DeepSeek 远程调用，无状态变更。Key 仅影响请求头，不影响服务器会话。**CSRF 无关** ✓

---

## 三、需修复

### [低] Backend API URL 不可自定义

**文件**: `DeepSeekService:28`, `AnalyzeService:24`

用户无法配置自己托管的兼容 API（如 vLLM、Ollama 的 OpenAI-compatible 端点）。这是功能限制，非安全缺陷。后续可增加 `apiUrl` 同款正则校验的用户配置项。

---

### [低] 错误消息可能暴露原始 API 响应

**文件**: `DeepSeekService:74`, `ExplainController:53`

```java
throw new IOException("DeepSeek API error " + status + ": " + errorBody);
```

若 errorBody 包含完整 Key，前端会显示。可改为仅返回 status code + 通用消息，将原始 body 只写服务器日志。

---

## 四、已验证合理的非问题

| 项目 | 说明 |
|------|------|
| Key 正则不验证 `sk-` 前缀 | DeepSeek 4xx 会兜底拒绝无效 Key |
| Key 明文存在浏览器内存 | 所有 SPA 的必然特性，会话级 |
| `apiKey` 空串通过 `@RequestBody` 传输 | 后端 `resolveKey(null/blank)` 正确降级 |
| `api-key-section` 用 `border-top` 分割 | 卡片内部结构，非裸分割线，合规 |

---

## 五、汇总

| 级别 | 问题 | 位置 |
|------|------|------|
| **低** | API URL 不可自定义（功能限制） | `DeepSeekService:28` |
| **低** | 错误消息可能暴露原始 body | `DeepSeekService:74` |

**安全结论**: 头注入、端点劫持、请求体篡改、Key 持久化、XSS、CSRF 六维度均正确设防。前端 `type="password"` + 正则 + 不持久化，后端正则 + URL 硬编码 + body 不可控，纵深到位。
