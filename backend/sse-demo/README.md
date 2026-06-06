# SSE Demo

这是一个用于演示 Server-Sent Events（SSE）的简单后端。本示例模拟助手对用户消息的流式回复。

运行：

```bash
cd backend/sse-demo
npm install
npm start
```

访问点：
- SSE 事件流：`http://localhost:3000/stream`
- 发送消息（POST JSON）：`http://localhost:3000/send` 例如 `{ "role": "user", "message": "你好" }`

前端开发时可以将 `VITE_SSE_SERVER` 环境变量设置为 `http://localhost:3000`。
