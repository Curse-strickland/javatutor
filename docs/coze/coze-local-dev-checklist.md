# Coze Agent 本地开发与回传部署注意事项

> 适用范围：`javatutor-coze-agent`（Coze Vibe Coding 导出模板）
> 技术栈：Python 3.12 + FastAPI + LangGraph
> 核心原则：守住"部署契约"，契约之外可以自由扩展。

## 一、平台外壳（默认只读，不修改）

| 文件 / 目录 | 为什么不能改 | 说明 |
|---|---|---|
| `.coze` | 平台清单文件，不是目录 | 声明 `entrypoint = src/main.py`、`requires = python-3.12`、dev/deploy 的 build/run/pack 命令 |
| `scripts/` | 构建、启动、打包脚本 | `.coze` 的 build/run/pack 全部指向这里 |
| `src/main.py` | 服务入口 | FastAPI + SSE 协议，平台通过 `/run`、`/stream_run`、`/async_run`、`/node_run`、`/v1/chat/completions`、`/health` 等接口调用 |
| `src/storage/` | 启动期依赖的初始化代码 | DB、LangGraph checkpointer、S3 存储，`main.py` 在 lifespan 里直接引用 |
| `src/utils/` | 平台内置工具函数 | `main.py` 和模板代码依赖其行为 |
| `pyproject.toml` 中平台 SDK 版本区间 | 部署兼容性 | `coze-coding-utils >=0.2.8,<1`、`coze-coding-dev-sdk >0.5.0,<1`、`coze-workload-identity`、`cozeloop` 等不要改 |

说明：这里的"不要改"实际约束的是接口契约，不是源码冻结。如果你确信需要改外壳，先做基线 diff，改完必须本地完整回归再回传；否则默认不要动。

## 二、可自由修改的部分

| 文件 / 目录 | 用途 |
|---|---|
| `src/agents/agent.py` | Agent 主逻辑、提示词、工具装配、状态 |
| `src/tools/` | 自定义工具，自由增删 |
| `src/graphs/` | LangGraph 节点、子流程、路由编排（模板预留位置） |
| `config/agent_llm_config.json` | 模型参数、系统提示词 |
| `assets/` | 资源文件、SVG 模板、测试数据 |
| `docs/` | 文档 |
| `pyproject.toml` 的 `dependencies` | 新增普通依赖（需同步更新 `uv.lock`） |

## 三、`agent.py` 必须遵守的契约（代码实测）

- [ ] 必须存在 `build_agent(ctx=None)` 函数。
- [ ] 返回值必须暴露 `.builder`：`main.py` 会调用 `base.builder.compile(checkpointer=...)` 并基于它做流式执行。模板同款 `from langchain.agents import create_agent` 最稳；换实现也必须满足这个接口。
- [ ] 模型配置从 `config/agent_llm_config.json` 读取，路径基于 `COZE_WORKSPACE_PATH`。
- [ ] API Key 从环境变量 `COZE_WORKLOAD_IDENTITY_API_KEY` 获取。
- [ ] Base URL 从环境变量 `COZE_INTEGRATION_MODEL_BASE_URL` 获取。
- [ ] 需要传递请求头时使用 `default_headers(ctx)`。

## 四、`config/agent_llm_config.json` 格式

| 字段 | 实际要求 | 说明 |
|---|---|---|
| `config` | object | 必须存在 |
| `config.model` | 必填 | 代码直接读取 |
| `config.temperature` | 必填 | 代码读取，默认 0.7 |
| `config.timeout` | 必填 | 代码读取，默认 600 |
| `config.thinking` | 必填 | 代码读取，默认 `disabled`，通过 `extra_body` 传给模型 |
| `config.top_p` | 保留字段 | 当前 `agent.py` 未读取，建议保留以兼容平台 |
| `config.max_completion_tokens` | 保留字段 | 当前 `agent.py` 未读取，建议保留以兼容平台 |
| `sp` | 非空字符串 | 系统提示词 |
| `tools` | 数组，无工具时为 `[]` | 注意：当前 `agent.py` 写死 `tools=[]`，config 里的工具名不会自动注册，必须在 `agent.py` 中手动导入并传入 |

## 五、依赖管理

- [ ] 只用 `uv`，禁止 `pip install` 到环境。
- [ ] 新增依赖写在 `pyproject.toml` 的 `dependencies`。
- [ ] 本地安装用 `uv sync`。
- [ ] `uv.lock` 必须一并提交；`scripts/pack.sh` 会执行 `uv lock`，部署构建走 `uv export --frozen`。
- [ ] Python 版本：`pyproject.toml` 要求 `>=3.12`，`.coze` 要求 `python-3.12`。
- [ ] 新增依赖如平台镜像装不上（需要系统库或编译），回传前必须验证；优先选纯 Python 依赖。

## 六、import 规范

- [ ] 禁止 `from src.xxx import ...` 前缀。
- [ ] 正确写法：`from agents.agent import build_agent`、`from tools.my_tool import my_func`。
- [ ] 平台运行时会确保 `${COZE_WORKSPACE_PATH}/src/` 在 `PYTHONPATH` 中；本地也按这个方式组织。

## 七、工具定义规范

- [ ] 工具文件放在 `src/tools/` 下。
- [ ] 使用 `@tool` 装饰器定义工具。
- [ ] `@tool` 函数内部不要调用其他 `@tool` 函数，公共逻辑抽成普通函数。
- [ ] `@tool` 函数参数不要使用 `ToolRuntime` 类型。
- [ ] 上下文获取：`ctx = request_context.get() or new_context(method="工具名")`。
- [ ] 工具真正生效需要在 `agent.py` 中导入并传入 `create_agent(tools=[...])`，仅写在 config 里不会生效。

## 八、文件与路径

- [ ] 生成的产物文件默认写到 `/tmp`，再通过对象存储上传（模板提供 `src/storage/s3/s3_storage.py`）。
- [ ] 资源、模板、测试数据放 `assets/`。
- [ ] 文件名只允许字母、数字、下划线、短横线，禁止空格和特殊字符。
- [ ] 日志统一走 `coze_coding_utils` 提供的 logger（`LOG_FILE` 由 SDK 内部定义），不要手工硬编码 `/app/work/logs/bypass/app.log`。
- [ ] 本地开发不依赖 `PGDATABASE_URL` 也能启动：`storage/memory/memory_saver.py` 在数据库不可用时自动回退 `MemorySaver`。

## 九、本地开发环境

建议使用 Git Bash 或 WSL 跑 bash 脚本；仓库脚本全部基于 bash。

Windows 本地环境说明：

- 项目通过 `.python-version` 固定为 Python 3.12，`uv sync` 会自动使用 3.12，不要用本机默认的新版本（如 3.14）直接跑，否则部分旧版依赖没有对应 wheel 会触发源码编译。
- `dbus-python`、`PyGObject` 是 Coze 部署环境（Linux）专用依赖，已在 `pyproject.toml` 中通过 `sys_platform == 'linux'` 标记，Windows 本地安装会自动跳过，不影响回传部署。

```bash
# 1. 准备 Python 3.12（本机默认可能是其他版本）
uv python install 3.12

# 2. 安装依赖
uv sync

# 3. 设置环境变量（Windows 用 Git Bash 最省事）
export COZE_WORKSPACE_PATH="/d/CHome/Documents/Projects/EL/javatutor-coze-agent"
export COZE_INTEGRATION_MODEL_BASE_URL="<你的模型 Base URL>"
export COZE_WORKLOAD_IDENTITY_API_KEY="<你的 Key，可先用占位值>"

# 4. 启动本地 HTTP 服务
bash scripts/http_run.sh -p 5000
```

本地验证接口：

```bash
curl http://127.0.0.1:5000/health
curl http://127.0.0.1:5000/graph_parameter
curl -X POST http://127.0.0.1:5000/stream_run -H "Content-Type: application/json" -d '{"messages": "你好"}'
```

注意：文件编码统一使用 UTF-8，避免 Windows 编辑器把中文注释改坏。

## 十、本地查看效果（无 Coze 页面）

本项目只有后端服务，仓库里没有网页聊天界面；Coze 的聊天 UI 在平台上。本地看效果 = 通过 HTTP 接口看回复、流式输出和工具调用结果。

1. 准备环境变量（至少模型地址和 Key 要可用）：

```bash
export COZE_WORKSPACE_PATH="/d/CHome/Documents/Projects/EL/javatutor-coze-agent"
export COZE_INTEGRATION_MODEL_BASE_URL="http://127.0.0.1:9999/v1"  # 任意 OpenAI 兼容端点
export COZE_WORKLOAD_IDENTITY_API_KEY="sk-placeholder"
```

2. 启动服务：

```bash
bash scripts/http_run.sh -p 5000
```

3. 冒烟检查：

```bash
curl http://127.0.0.1:5000/health
curl http://127.0.0.1:5000/graph_parameter
```

4. 对话效果（OpenAI 兼容接口）：

```bash
curl http://127.0.0.1:5000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"<你的模型名>","messages":[{"role":"user","content":"你好"}]}'
```

5. 流式效果：

```bash
curl -N http://127.0.0.1:5000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"<你的模型名>","stream":true,"messages":[{"role":"user","content":"你好"}]}'
```

6. 工具效果：通过对话触发工具，观察回复和 SSE 事件；生成的文件产物默认写到 `/tmp` 或对象存储，按工具实现检查对应位置。

7. 想用图形界面看，可以用任意 OpenAI 兼容客户端（如 Chatbox、Postman、Open WebUI）指向 `http://127.0.0.1:5000/v1`，或把 JavaTutor 前端的 ChatPanel 指向本地服务（属于 JavaTutor 仓库的集成工作）。

## 十一、回传前自检清单

- [ ] `.coze`、`scripts/`、`src/main.py`、`src/storage/`、`src/utils/` 与基线 diff 为空。
- [ ] `pyproject.toml` 与 `uv.lock` 最新，且 `uv sync --frozen` 可成功。
- [ ] `build_agent(ctx=None)` 签名未变。
- [ ] import 自检通过：

```bash
cd src
python -c "from agents.agent import build_agent"
```

- [ ] 实际构建自检通过（比 import 自检更重要）：

```bash
cd src
python -c "from agents.agent import build_agent; a = build_agent(); g = a.builder.compile(); print('agent ok')"
```

- [ ] 本地 HTTP 冒烟测试通过：`/health`、`/graph_parameter`、`/stream_run` 至少各调一次。
- [ ] 没有硬编码 API Key、Token 或敏感信息。
- [ ] 没有使用模拟 / Mock 数据交付。
- [ ] 所有新增依赖都已声明在 `pyproject.toml`。
- [ ] 新增文件名符合"字母、数字、下划线、短横线"规范。
- [ ] 自定义工具已在 `agent.py` 中实际注册（不是只写在 config 的 `tools` 数组里）。

## 十二、与原 Coze 清单的关键差异

1. `.coze` 是文件不是目录。
2. `top_p`、`max_completion_tokens` 当前代码未读取，保留即可，不是启动硬约束。
3. config 的 `tools` 数组不会自动注册工具，必须在 `agent.py` 里导入并传入。
4. `create_agent` 不是硬契约，真正硬契约是返回值暴露 `.builder` 且可编译、可流式执行。
5. 本地必须设置 `COZE_WORKSPACE_PATH`，否则 config 路径会落到 `/workspace/projects` 导致启动失败。
6. `src/graphs/` 可以用于 LangGraph 节点和子流程，原清单未提及。
7. 日志路径由 `coze_coding_utils` 提供，不要手工硬编码平台路径。
8. 仅做 import 自检不够，必须做 `build_agent()` + `.builder.compile()` 和 HTTP 冒烟测试。
