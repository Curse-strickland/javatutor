# JavaTutor 日志排查指南

本文档覆盖后端日志的 **三层架构**、**request-id 排查法**、**常用查询命令**，以及可选的第 3 层 **聚合检索（阿里云 SLS）** 接入步骤。

---

## 一、三层架构

| 层 | 内容 | 落点 |
|----|------|------|
| ① 访问日志 | 每条 HTTP 请求一行：时间 / method / path / status / 耗时 / 客户端 IP / UA / request-id / 请求与响应体 | `logs/request.log` |
| ② 应用日志 | 业务事件（Coze 耗时、warn、error），带 requestId（同步请求） | `logs/app.log` |
| ③ 聚合检索 | 把 ① ② 汇总到可搜索平台（可选，见第五节 SLS） | 阿里云 SLS |

核心习惯：**每条请求一个 request-id**，贯穿访问日志 + 应用日志 + 响应头。前端开发在浏览器 DevTools 里复制这个 id，后端就能一把 `grep` 出这次交互的所有记录。

---

## 二、日志文件与字段

- 目录：本地默认 `backend/logs/`；生产 `/opt/javatutor/logs/`（由环境变量 `JAVATUTOR_LOG_DIR` 注入）。
- 滚动：按天滚动，保留 30 天。
- 格式：`request.log` 为单行 JSON；`app.log` 为结构化 JSON（LogstashEncoder）。

`request.log` 单行字段示例：

```json
{"ts":"2026-09-03T17:00:00.123Z","level":"INFO","requestId":"a1b2c3d4",
 "method":"POST","path":"/api/run","query":"","status":200,"durationMs":142,
 "clientIp":"1.2.3.4","userAgent":"Mozilla/5.0 ...","contentType":"application/json",
 "reqBytes":512,"respBytes":2048,
 "reqBody":"{\"code\":\"public class ...\",\"apiKey\":\"***\"}",
 "respBody":"{\"runId\":\"x\",\"steps\":[...]}"}
```

| 字段 | 含义 |
|------|------|
| `ts` | 访问日志写入时间（ISO-8601） |
| `requestId` | 本请求唯一标识，等于响应头 `X-Request-Id` |
| `method` / `path` / `query` | 请求方法 / 路径 / 查询串 |
| `status` / `durationMs` | 状态码 / 耗时（毫秒） |
| `clientIp` | 真实客户端 IP（读 `X-Forwarded-For`，因前面有 nginx） |
| `reqBytes` / `respBytes` | 请求 / 响应字节数 |
| `reqBody` / `respBody` | 脱敏 + 截断后的请求 / 响应体 |
| `streamed` | 仅流式接口（SSE）出现，标记响应体为边写边采的样本 |

---

## 三、request-id 排查法

1. 打开浏览器 DevTools → Network，选中一次请求。
2. 在 **Response Headers** 里找到 `X-Request-Id`（如 `a1b2c3d4`），复制。
3. 后端执行：

```bash
# 在服务器上（或本地）
tail -n +1 /opt/javatutor/logs/request.log | grep "a1b2c3d4" | jq
# 或
grep -h "a1b2c3d4" /opt/javatutor/logs/request*.log | jq
```

一次交互（一次请求 → 一次响应）就对应这一条访问日志；同一条 requestId 还会出现在 `app.log` 的同步请求日志里，串起「访问行 + 业务日志」。

> 说明：SSE 流式接口（`/api/ai/chat`、`/api/explain`）的响应体在异步线程产出，其应用日志不挂同一线程的 MDC，因此 `app.log` 里这些行暂无 requestId；但 `request.log` 的访问行始终带 requestId，是排查的主入口。

---

## 四、常用查询命令

统一入口脚本 `deploy/backend/logs.sh`（服务器上在 `/opt/javatutor/logs.sh`）：

```bash
./logs.sh                       # 实时 tail request.log（jq 美化）
./logs.sh grep a1b2c3d4         # 按 request-id 查
./logs.sh slow 20               # 最慢的 20 个请求
./logs.sh status 500            # 所有 500
./logs.sh status 404            # 所有 404
./logs.sh path /api/run         # 按接口路径过滤
./logs.sh app                   # 实时 tail 应用日志
```

手动命令（等价能力）：

```bash
# 实时看访问日志
tail -f /opt/javatutor/logs/request.log | jq

# 按状态码
grep '"status":500' /opt/javatutor/logs/request.log | jq

# 按慢请求（> 1000ms）
jq 'select(.durationMs > 1000)' /opt/javatutor/logs/request.log
```

---

## 五、第 3 层：聚合检索（阿里云 SLS，可选）

生产部署在阿里云 ECS，最顺的接入方式是 **SLS 日志服务**。改动只在采集侧，后端零改动。

### 5.1 开通 SLS 并创建 Logstore

1. 阿里云控制台 → 日志服务 SLS → 创建 Project（如 `javatutor-prod`）。
2. 在该 Project 下创建 Logstore（如 `javatutor-logs`）。
3. 记录 Project 所属的 **地域**（如 `cn-hangzhou`）。

### 5.2 安装 Logtail 采集 agent

在 ECS 上执行（地域按实际替换）：

```bash
wget https://logtail-release-cn-hangzhou.oss-cn-hangzhou.aliyuncs.com/linux64/logtail.sh -O logtail.sh
chmod +x logtail.sh && sudo ./logtail.sh install cn-hangzhou
```

安装完成后，回到 SLS 控制台「数据接入 → Logtail 配置」，按向导选择 ECS 实例，指定采集路径：

- 日志路径：`/opt/javatutor/logs/request*.log`
- 编码：UTF-8
- 模式：JSON（单行 JSON，自动解析出 `requestId` / `status` / `durationMs` 等字段）

`app.log` 同样可加一条配置采集（也是 JSON）。

### 5.3 检索与告警

- 检索：`requestId:"a1b2c3d4"`、`status:500`、`durationMs > 1000`。
- 告警：新建告警规则，如「5 分钟内 `status:500` 数量 > N」或「`durationMs > 3000` 出现即告警」。

这一步是可选的；未接入时，第 1、2 层的文件日志 + `logs.sh` 已能覆盖绝大多数排查场景。
