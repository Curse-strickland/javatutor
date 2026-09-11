# 后端结构化日志 + request-id（阶段 1 + 2 + 3 说明）

## 目标

对标大厂三层日志：① 访问日志（每请求一行）② 结构化应用日志 ③ 聚合检索。本次落地 ① ② 的代码与配置，③ 以接入文档形式交付（见 [logging-guide.md](../logging-guide.md) 第五节）。

## 改动

### 新增

| 文件 | 职责 |
|------|------|
| `backend/.../logging/RequestLoggingFilter.java` | `OncePerRequestFilter`：生成/透传 requestId（读上游 `X-Request-Id`，否则 UUID），写入 MDC 与响应头；记录访问行（时间/method/path/status/耗时/客户端 IP/UA/字节数）；请求体用 `ContentCachingRequestWrapper` 捕获，响应体用 tee 边写边采；异步(SSE)挂 `AsyncListener` 在完成时统一落日志 |
| `backend/.../logging/LogMasker.java` | 纯静态脱敏工具：JSON 键、`key=value`、`Authorization: Bearer` 三类敏感值 → `***`；超长截断 |
| `backend/.../logging/TeeResponseWrapper.java` | 响应体 tee 包装器：写透传同时采样（有上限），流式接口保持实时；`getTotalBytes()` 统计真实字节数 |
| `backend/src/main/resources/logback-spring.xml` | 三个 appender：console（可读）、`logs/app.log`（LogstashEncoder 结构化 JSON）、`logs/request.log`（单行 JSON，按天滚动保留 30 天） |
| `backend/.../logging/LogMaskerTest.java` / `RequestLoggingFilterTest.java` | 脱敏单测 + 过滤器访问行/requestId 单测 |
| `deploy/backend/logs.sh` | 日志查询脚本：`grep <id>` / `slow` / `status` / `path` / `app` |
| `docs/logging-guide.md` | 排查指南 + SLS 接入步骤 |

### 修改

| 文件 | 改动 |
|------|------|
| `backend/pom.xml` | 新增 `net.logstash.logback:logstash-logback-encoder:7.4` |
| `backend/src/main/resources/application.properties` | 新增 `javatutor.logging.dir`（默认 `${JAVATUTOR_LOG_DIR:logs}`）/ `.mask` / `.max-body-chars` |
| `.github/workflows/deploy.yml` | `SCRIPT_AFTER` 追加 `mkdir -p /opt/javatutor/logs` 并把 `JAVATUTOR_LOG_DIR` 写入 `coze.env` |
| `deploy/scripts/deploy.sh` | 推送 `logs.sh` |

## 关键决策

- **流式响应体**：用户选择「多写一个 tee 边写边采」。SSE 接口（`/api/ai/chat`、`/api/explain`）响应体实时透传，仅采样一份（上限 `max-body-chars`），访问行带 `streamed` 标记，不破坏实时性。
- **脱敏**：保留脱敏层（默认开启，`javatutor.logging.mask=false` 可关）。
- **request.log 不用 LogstashEncoder**：由过滤器用 Jackson 序列化成单行 JSON 后以 `%msg%n` 原样落盘，字段完全可控；`app.log` 用 LogstashEncoder 结构化。

## 验证

- `LogMaskerTest`：JSON 键 / Bearer / 表单式 / 截断 / null 安全 共 8 例。
- `RequestLoggingFilterTest`：响应回带 `X-Request-Id`、访问行含 requestId 与 `status:200`、reqBody 中 `apiKey` 打码、上游 requestId 透传。
- 全量 `./mvnw test` 通过（见本会话执行结果）。

## 遗留 / 说明

- **异步线程 MDC 不传播**：`CozeAIController` / `ExplainController` 用 `CompletableFuture.runAsync` 起异步线程，MDC 不会自动带入，故 SSE 处理期间 `app.log` 的 Coze 日志暂无 requestId；访问行始终有 requestId，排查以 `request.log` 为主线。若后续需要，可给 `runAsync` 显式传 MDC 上下文或换 Spring 线程池 + `TaskDecorator`。
- **第 3 层 SLS**：需在阿里云控制台开通并装 Logtail，属采集侧手动步骤，已写成文档；后端零改动。
