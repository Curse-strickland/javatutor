# JavaTutor Coze Agent 本地开发规约

> 目标：保证项目安全，并保证本地代码在 Coze 平台环境可运行。
> 本规约不涉及具体业务/产品设计；业务设计与接口契约见其他文档。

## 1. 工作模型

1. 本地仓库（Git）是唯一代码事实来源；Coze 平台工作区只做部署运行，不在平台内手工改代码。
2. 每次改动：本地通过全部验证门槛 → commit → push 远程仓库 → Coze 平台拉取指定分支/标签部署。
3. Coze 平台导出目录仅作只读参考，禁止编辑。
4. 禁止在 Coze 平台工作区执行与 `scripts/`、`.coze` 不一致的手工构建。

## 2. 外壳契约（禁止修改）

以下文件/目录为平台外壳，默认禁止修改；确需修改必须双人评审并单独提交：

| 路径 | 说明 |
|---|---|
| `.coze` | entrypoint、python-3.12、dev/deploy 命令 |
| `scripts/` | 依赖安装、启动、打包、环境加载 |
| `src/main.py` | FastAPI 服务与 HTTP/SSE 协议 |
| `src/storage/` | 数据库、checkpointer、S3 初始化 |
| `src/utils/` | 平台内置工具 |
| `pyproject.toml` 中平台 SDK 版本区间 | `coze-coding-utils`、`coze-coding-dev-sdk`、`coze-workload-identity`、`cozeloop` 等 |

业务代码只允许新增到：`src/agents/`、`src/graphs/`、`src/tools/`、`assets/`、`config/`、`tests/`、`docs/`。

## 3. 环境一致性规约

1. Python 固定 3.12：仓库根目录必须有 `.python-version`，内容为 `3.12`。
2. 依赖管理只用 `uv`：

```bash
uv sync --frozen
```

3. `uv.lock` 必须提交；禁止手工改锁文件。
4. Linux 专用依赖必须带平台标记（如 `dbus-python`、`PyGObject` 加 `; sys_platform == 'linux'`），保证 Windows 本地可装、Coze Linux 正常安装。
5. 环境变量必须与 Coze 平台一致，本地无法注入的变量不得硬编码：

| 变量 | Coze 平台 | 本地 |
|---|---|---|
| `COZE_WORKSPACE_PATH` | 平台注入 | 本地仓库根目录 |
| `COZE_INTEGRATION_MODEL_BASE_URL` | 平台注入 | 本地模型端点 |
| `COZE_WORKLOAD_IDENTITY_API_KEY` | 平台注入 | 本地 Key（可占位） |
| `COZE_WORKLOAD_IDENTITY_*` | 平台注入 | 本地可不配 |
| `PGDATABASE_URL` | 平台注入 | 本地必须配可用 PostgreSQL |
| `DEPLOY_RUN_PORT` | 平台注入 | 默认 `5000` |
| `COZE_PROJECT_ID` | 平台注入 | 本地可不配 |
| `COZE_LOG_DIR` | 平台默认 | 本地必须指向可写目录（如 `<repo>/.logs`） |

6. 敏感信息禁止入库：`.env`、`coze-local.properties`、真实 token 一律 gitignore；仓库只提交 `.env.example` 模板。
7. 本地 PostgreSQL 建议 Docker：

```bash
docker run -d --name javatutor-pg -e POSTGRES_PASSWORD=local -e POSTGRES_DB=javatutor \
  -p 5432:5432 postgres:16
```

```bash
export PGDATABASE_URL="postgresql://postgres:local@127.0.0.1:5432/javatutor"
export COZE_LOG_DIR="<repo root>/.logs"
```

## 4. 代码安全规约

1. 禁止 `from src.xxx import ...`，统一从顶层包导入（`agents`、`graphs`、`tools` 等）。
2. 代码中禁止硬编码绝对路径、密钥、Token；一律读环境变量或 `config/` 下配置文件。
3. `build_agent(ctx=None)` 必须保留，返回值必须暴露 `.builder`；不得在 `build_agent()` 内调用 `.compile()`。
4. 新增文件命名只允许字母、数字、下划线、短横线。
5. 文件统一 UTF-8，禁止改写既有文件编码。
6. 核心逻辑必须可注入测试替身（如 `model` 参数或 `configurable.chat_model`），测试不依赖真实网络。

## 5. 提交前验证门槛（强制）

每次 push 前按顺序执行，全部通过才能提交：

### L1 依赖锁

```bash
uv sync --frozen
```

Expected: 无报错。

### L2 全量测试

```bash
uv run pytest tests/ -v
```

Expected: 全部通过。

### L3 离线构建

```bash
export COZE_WORKSPACE_PATH="<repo root>"
export COZE_INTEGRATION_MODEL_BASE_URL="http://127.0.0.1:9999/v1"
export COZE_WORKLOAD_IDENTITY_API_KEY="placeholder"
cd src && python -c "from agents.agent import build_agent; g = build_agent().builder.compile(); print('ok')"
```

Expected: 输出 `ok`。

### L4 本地 HTTP 冒烟

需要本地 PostgreSQL 与模型端点：

```bash
export COZE_WORKSPACE_PATH="<repo root>"
export COZE_INTEGRATION_MODEL_BASE_URL="<本地模型端点>"
export COZE_WORKLOAD_IDENTITY_API_KEY="<key>"
export PGDATABASE_URL="<本地 PostgreSQL>"
export COZE_LOG_DIR="<repo root>/.logs"
bash scripts/http_run.sh -p 5000 &
sleep 15
curl -fsS http://127.0.0.1:5000/health
curl -fsS http://127.0.0.1:5000/graph_parameter
curl -fsS -X POST http://127.0.0.1:5000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"model":"<config模型名>","messages":[{"role":"user","content":"你好"}]}'
```

Expected: 三个接口均返回预期结果；模型端点未配置时 L4 可标记 SKIP，但提交说明必须注明。

### L5 外壳回归

```bash
git diff --name-only HEAD | grep -E "^(\.coze|scripts/|src/main\.py|src/storage/|src/utils/)"
```

Expected: 无输出（外壳未改动）。

## 6. 提交与推送规约

1. 每个功能一个分支：`feat/<name>`；提交信息遵循 `feat|fix|docs|refactor: 摘要`。
2. 推送前必须通过第 5 节全部门槛。
3. 禁止 `git push --force`；禁止提交 `.env`、日志、`.venv`、`.logs`。
4. 部署使用明确分支或 tag（推荐 tag：`v1.x.x`）。

## 7. 快速测试（本地，不部署）

1. 代码层最快验证：

```bash
uv run pytest tests/ -q
```

2. HTTP 层快速验证：按第 5 节 L4 启动本地服务，用 curl 检查 `/health`、`/graph_parameter`、`/v1/chat/completions`；可维护 `scripts/local_client.py` 作为本地冒烟客户端（不属于平台外壳）。

3. 前端可视化验证：当前 JavaTutor 后端通过 Coze v3 Chat API 调用，本地 Agent 提供 OpenAI 兼容接口，前端不能直接连本地。若需要本地可视化联调，需在 JavaTutor 后端增加 OpenAI 兼容模式（`coze.api.openai-mode=true` + `coze.api.url` 指向本地 Agent），此改造属于 JavaTutor 仓库，不进入本规约的 Coze 侧外壳范围。

在可视化改造完成前，代码与接口验证走 7.1/7.2，前端最终效果通过 Coze 平台部署确认。

## 8. Coze 平台部署规约

1. 部署来源必须是远程仓库指定分支/tag，禁止从本地直接上传导出目录。
2. 平台构建执行 `scripts/setup.sh`（`uv export --frozen`），因此 `uv.lock` 必须与 `pyproject.toml` 同步。
3. 平台运行执行 `scripts/http_run.sh`，读取 `DEPLOY_RUN_PORT`。
4. 平台注入的 `PGDATABASE_URL`、workload identity 变量不可在本地模拟时硬编码进代码。
5. 部署后如平台预览不可用，先用平台终端/日志确认 `/health` 与依赖安装是否成功，再反馈到本地修复；禁止在平台手工改文件。

## 9. 评审与修订

1. 本规约由本地开发组与 Coze 平台侧 Agent 共同评审；修改必须提交远程仓库并记录修订版本。
2. 任何与 Coze 平台实测行为冲突的条目，以平台实测为准并回写规约。
