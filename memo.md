# 联调备忘录

> 当前状态：前端用 mock 数据跑通，后端正在开发中。

---

## 后端完成后，前端需要改两处

### 1. `src/stores/player.js`

**state 加一个 `runId` 字段：**
```js
state: () => ({
  steps: [],
  currentStep: 0,
  isLoading: false,
  error: null,
  runId: null,        // ← 新增
}),
```

**补全 `runCode(code)` 方法（删掉空壳）：**
```js
async runCode(code) {
  this.isLoading = true;
  this.error = null;
  try {
    const resp = await fetch('/api/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    const data = await resp.json();
    if (data.success) {
      this.steps = data.steps || [];
      this.runId = data.runId;
      this.currentStep = 0;
    } else {
      this.error = data.error || 'unknown error';
    }
  } catch (e) {
    this.error = e.message;
  } finally {
    this.isLoading = false;
  }
},
```

### 2. `src/App.vue`

第 62 行，把 mock 调用改为真实调用：
```js
// 原来：
store.runMock()

// 改为：
const code = editorRef.value?.getCode() || ''
store.runCode(code)
```

---

## 字段契约确认（后端必须遵守）

### POST /api/run

请求：`{"code": "public class UserCode { ... }"}`

成功响应：
```json
{
  "success": true,
  "runId": "uuid-xxx",
  "steps": [
    {"step": 1, "line": 3, "variables": {"arr": [5,3,8]}},
    {"step": 2, "line": 4, "variables": {"arr": [5,3,8], "n": 3}}
  ]
}
```

失败响应：
```json
{"success": false, "error": "编译错误: ..."}
```

### GET /api/explain/{runId}/{step}

SSE 流，`data:` 前缀，`data: [DONE]` 结束。
