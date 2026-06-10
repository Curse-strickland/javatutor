# 自定义 API Key — 开发日志

日期：2026-06-10

## 概述

支持用户在 AI Tutor 面板输入自己的 DeepSeek API Key，也可使用服务器默认 Key。前后端双重校验，会话级存储，不持久化。

## 安全设计

| 措施 | 实现 |
|------|------|
| 前端校验 | `KEY_PATTERN = /^[a-zA-Z0-9\-_.]{1,128}$/`，保存时拦截非法字符 |
| 前端存储 | Pinia `userApiKey` 仅内存，不写 localStorage，刷新即清除 |
| 前端展示 | `type="password"` + `autocomplete="off"` |
| 传输 | POST body `apiKey` 字段，不出现于 URL |
| 后端校验 | `SAFE_KEY` 同款正则，拒绝 \r \n : 等注入字符 |
| 后端降级 | 空/blank → 回退 `DEEPSEEK_API_KEY` 环境变量 |
| 错误脱敏 | API 返回非 200 时仅显示 "API 调用失败 (HTTP xxx)，请检查 API Key 是否正确"，原始 body 写 System.err |
| URL 硬编码 | `apiUrl` 由 `application.properties` 注入，用户不可篡改 |

## 改动清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `model/ExplainRequest.java` | 修改 | 新增 `apiKey` 字段 + getter/setter |
| `service/DeepSeekService.java` | 修改 | `explainStream` 新增 `userApiKey` 重载；`resolveKey()` 校验 + 降级；错误消息脱敏 |
| `service/AnalyzeService.java` | 修改 | 同上：`analyze` 新增 `userApiKey` 重载 + `resolveKey()` + 脱敏；修复 `readAllBytes()` 重复调用 bug |
| `controller/ExplainController.java` | 修改 | `/explain` 传递 `request.getApiKey()`；`/analyze` 传递 `request.get("apiKey")` |
| `stores/player.js` | 修改 | 新增 `userApiKey` state；`requestExplain`/`requestAnalysis` 携带 `apiKey`；SSE 解析器新增 `event:error` 处理 |
| `components/AiTutorPanel.vue` | 修改 | 新增可折叠"自定义 API"区域：password 输入 + 保存/清除按钮 + 格式校验 + 状态标签 |

## UI 设计

```
┌─ AI 解说面板 ─────────────────────────────┐
│                                           │
│ ▸ 自定义 API                     [默认]    │ ← 折叠态
│                                           │
│ ▾ 自定义 API                     [已保存]  │ ← 展开态
│ [sk-••••••••••••]  [保存]                │
│ 已保存自定义 Key（仅本次会话）    [清除]     │
└───────────────────────────────────────────┘
```

## 交互行为

| 操作 | 行为 |
|------|------|
| 输入 Key + 点保存 | 前端 `KEY_PATTERN` 校验 → 通过则写入 `store.userApiKey` → 状态标签变"已保存" |
| 格式错误 | 红色提示"格式无效：仅允许字母、数字、连字符、下划线和点号，长度 1-128" |
| 后端 Key 无效 | DeepSeek 401 → 前端显示"API 调用失败 (HTTP 401)，请检查 API Key 是否正确" |
| 点清除 | 清空 store + 输入框 → 状态标签变"默认" |
| 留空点保存 | 等同于清除，使用默认 Key |
| 刷新页面 | Key 丢失（仅内存存储） |
| 解说/分析请求 | 自动携带 `userApiKey`，空串时后端降级环境变量 |

## Bug 修复

### B1 — 错误 Key 导致"生成中"卡死
- **现象**: 输入错误 API Key → 点解说 → 按钮一直显示"生成中…"
- **根因**: SSE 解析器只处理 `data:` 行，忽略 `event:error`，后端异常未触发前端 `catch`
- **修复**: 解析器新增 `event:` 行跟踪 → `event:error` + `data:` → 直接写 `explainError` + `return`

### B2 — 错误信息溢出红框
- **修复**: `.ai-error` 和 `.api-key-error` 加 `word-break: break-all`；`.ai-error` 加 `max-height: 80px; overflow-y: auto`

## 安全审查

六维度均通过：HTTP 头注入防御 ✓ | API 端点劫持防御 ✓ | 请求体篡改防御 ✓ | Key 持久化泄露防御 ✓ | XSS 防御 ✓ | CSRF 无关 ✓
