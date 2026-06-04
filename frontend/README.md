# JavaTutor — Frontend 开发与对接说明

本文档面向前端开发者（包括 F2：变量面板 / 可视化画布实现者），说明本 `frontend` 的文件职责、开发环境配置、如何从 mock 切换到真实后端，以及与后端接口的约定和测试方法。

先决条件
- Node.js 18+（或兼容的 LTS 版本）
- npm 或 pnpm
- 推荐编辑器：VS Code + Volar 插件

快速启动
```bash
cd frontend
npm install
npm run dev
```
默认本地地址：http://localhost:5173/，Vite 已配置将 `/api` 代理到 `http://localhost:8080`（`vite.config.js`），便于联调本地后端。

项目重要文件与职责（`frontend/src`）
- `main.js`：创建 Vue 应用并安装 Pinia（状态管理）。
- `style.css`：全局样式与 Tailwind 指令。
- `App.vue`：页面骨架与布局（左侧代码编辑器、右侧变量/画布区、底部控制栏），同时持有 `Editor` 的 ref 与自动播放逻辑，监听 `store.currentLine` 触发编辑器高亮。
- `components/Editor.vue`：Monaco Editor 集成（暴露 `getCode()` 与 `highlightLine(line)`），包含对 flex 布局下 Monaco 渲染问题的修复（手动 `editor.layout()`、`ResizeObserver`、强制 `direction: ltr`）。这是编辑器功能的唯一实现点，F2 通过 `Editor` 暴露的 API 与其交互。
- `components/HelloWorld.vue`：占位示例组件，可作为学习参考或快速替换。
- `stores/player.js`：Pinia store，核心契约：
	- state: `steps`（数组）、`currentStep`、`isLoading`、`error`
	- getters: `currentVariables`、`currentLine`、`totalSteps`
	- actions: `runMock()`（当前用于开发的 mock）、`runCode(code)`（占位，建议实现为真实后端调用）、`nextStep()`、`prevStep()`、`reset()`。

当前 mock 实现说明
- `stores/player.js` 内有 `mockSteps`（按顺序的步骤数组），`runMock()` 会把 `steps` 设为 `mockSteps` 并重置 `currentStep`。这是前期离线开发与 UI 联调的默认方式。

F2（另一个前端）快速上手指南
1. 克隆仓库并进入 `frontend`：
	 ```bash
	 git clone <repo>
	 cd javatutor/frontend
	 npm install
	 npm run dev
	 ```
2. 打开 http://localhost:5173/ 进行开发。
3. 使用 Pinia store：
	 - 在组件中导入 `usePlayerStore()`：
		 ```js
		 import { usePlayerStore } from '../stores/player'
		 const store = usePlayerStore()
		 ```
	 - 只读使用 `store.steps` / `store.currentVariables` / `store.currentLine`。若需要触发运行，请调用 `store.runCode(code)`（或由 F1 的运行按钮调用）。
4. 示例：简单的 `VariablePanel.vue`（伪代码）
	 ```vue
	 <template>
		 <div>
			 <div v-for="(v,k) in vars" :key="k">{{ k }}: {{ v }}</div>
		 </div>
	 </template>
	 <script setup>
	 import { computed } from 'vue'
	 import { usePlayerStore } from '../stores/player'
	 const store = usePlayerStore()
	 const vars = computed(() => store.currentVariables)
	 </script>
	 ```
	 把该组件挂载到 `App.vue` 的右侧占位区即可快速看到 mock 数据的渲染效果。

与后端对接（如何从 mock 切换到真实后端）
1. 后端接口约定（重要）：
	 - `POST /api/run`：接收 `{ code: string }`，返回 `{ success: true, runId: string, steps: [...] }` 或 `{ success: false, error: '...' }`。
	 - `GET /api/explain/{runId}/{step}`：SSE（Server-Sent Events）流式返回解说文本片段，最后发送 `data: [DONE]`。
2. 在 `stores/player.js` 中实现 `runCode(code)`：示例（建议实现，拷贝并粘贴到 `runCode` 内）：
	 ```js
	 import axios from 'axios'

	 async runCode(code) {
		 this.isLoading = true
		 this.error = null
		 try {
			 const resp = await axios.post('/api/run', { code })
			 if (resp.data?.success) {
				 this.steps = resp.data.steps || []
				 this.currentStep = 0
				 this.isLoading = false
				 // 可将 runId 存储以便后续请求 explain
				 this.runId = resp.data.runId
			 } else {
				 this.isLoading = false
				 this.error = resp.data?.error || 'unknown error'
			 }
		 } catch (e) {
			 this.isLoading = false
			 this.error = e.message || String(e)
		 }
	 }
	 ```
3. 本地调试注意：若后端在 `localhost:8080`，`vite.config.js` 已将 `/api` 代理到后端；若后端端口不同，请修改 `vite.config.js` 中的 proxy 设置。
4. SSE 示例（在 `ChatBox` 或其它组件中）：
	 ```js
	 const es = new EventSource(`/api/explain/${runId}/${step}`)
	 es.onmessage = (evt) => {
		 if (evt.data === '[DONE]') { es.close() }
		 else { /* 将 evt.data 拼接到 UI */ }
	 }
	 es.onerror = () => { es.close() }
	 ```

后端接入时需要后端开发者注意的点（简要）
- 返回的 `steps` 必须与前端 mock 的结构一致：每个 step 至少包含 `{ step: number, line: number|null, variables: object }`。
- 若后端希望逐步发送 steps（流式），前端现在使用一次性接收整个 `steps` 的方式；若改为流式发送，需要在 `player` 中调整接收逻辑。

调试与常见问题
- Monaco 光标/渲染错位：确保 `Editor.vue` 中 `editor.layout()` 被调用并且容器没有被 CSS 镜像（`transform`）。
- CORS/代理：开发时使用 Vite proxy，生产部署请正确配置后端 CORS 或前端部署代理。


