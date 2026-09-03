# How to actually use it, step by step

1. Just watching in dev — run the backend, then look at its terminal output. Every API call prints a started line and a completed, status=…, elapsed=… line. That's your request log.
2. Frontend side — open the browser console (F12 → Console). Each request prints [id] METHOD url status timeMs.
3. When something fails — copy the requestId from either place, then on the backend machine run:
grep 8f31a2c4 logs/app.log
   This pulls every line (including exception stack traces) that belongs to that one request, start to finish.


1. Ship the logging code (merge → main → auto-deploy)

Commit these files, merge the branch to main, push. GitHub Actions then builds the jar + frontend and restarts the server automatically.

2. Fix where the log file actually lands on the server ⚠️

This is a silent trap. Your config says:

logging.file.name=logs/app.log   # relative path

A relative path resolves against the process's working directory. The server runs via systemd:

ExecStart=/usr/bin/java -jar /opt/javatutor/javatutor-backend-0.1.0.jar

No WorkingDirectory is set, so systemd runs it from / → the log would try to write to /logs/app.log (likely fails silently, or scatters to the wrong place). You'd think you have logs and have nothing.

Fix with one of:
- Change to absolute: logging.file.name=/opt/javatutor/logs/app.log, or
- Add WorkingDirectory=/opt/javatutor to the systemd unit.

3. Capture the request input — the real gap for "can't reproduce"

The current filter logs method / URI / status / elapsed, but not the request body. So when a user hits a bug, your log tells you "POST /api/run failed, 500, 666ms" but not what code/input they sent — which is exactly what you need to reproduce it.

This is the single most valuable addition. I'd make the filter record the incoming payload (submitted code, test cases, chat question) alongside the requestId, at DEBUG level so it doesn't spam normal operation.

---

Then, how you'll actually read logs when a bug is reported

Log in to the server and:

# Watch live
tail -f /opt/javatutor/logs/app.log

# Or via systemd's own capture (stdout)
journalctl -u javatutor -f

# Find one request by its requestId (the [8f31a2c4-...] bracket)
grep 8f31a2c4 /opt/javatutor/logs/app.log

The log already rotates (10 MB per file, keeps 7 days, gzips old ones), so you have a rolling history by default.

---

I can implement #2 (absolute path) and #3 (request-body logging) right now — those are small, self-contained changes to application.properties and RequestLoggingFilter.java. Want me to do them? (Then you just merge to main and deploy.)

I'd also suggest adding one line to the systemd docs so whoever manages the server knows to set WorkingDirectory. Want that too?






# 日志系统使用说明

本项目在尽量不改动原有业务代码的前提下，加了一套「出问题能追查」的基础日志（Level 1 → Level 2）。核心目标是：**把「前端点击 → HTTP 请求 → 后端处理」这条链用同一个 requestId 串起来**，下次 bug 发生时能留下证据。

## 一、加了什么

### 后端（Spring Boot + SLF4J + Logback）

| 文件 | 作用 |
| --- | --- |
| `config/RequestLoggingFilter.java` | 给每个 HTTP 请求生成 / 透传 `X-Request-ID`，写进 MDC，并自动打印「请求开始 / 结束（状态码 + 耗时）」日志 |
| `config/GlobalExceptionHandler.java` | 全局兜底异常处理：返回统一 JSON（含 requestId），避免 500 裸页 |
| `application.properties` | 配置日志文件 `logs/app.log` + 日志格式（格式里带 `[requestId]`） |

### 前端（Vue + 原生 fetch 封装）

| 文件 | 作用 |
| --- | --- |
| `utils/http.js` | `fetch` 的封装：每次请求生成 requestId、带上 `X-Request-ID` 头、在控制台打印请求 / 错误日志 |

> 注：本项目实际用原生 `fetch` 而非 axios，所以做的是 `fetch` 封装（等价于 axios 拦截器），用法与 `fetch` 完全一致，只是把 `fetch(...)` 换成 `http(...)`。

## 二、日志长什么样

### 后端控制台 / `logs/app.log`

```
2026-09-01 13:20:01.123 INFO  [http-nio-8080-exec-1] [8f31a2c4-...] c.j.config.RequestLoggingFilter - POST /api/run started
2026-09-01 13:20:01.456 INFO  [http-nio-8080-exec-1] [8f31a2c4-...] c.j.service.CozeService - Coze message_end: wallLatencyMs=...
2026-09-01 13:20:01.789 INFO  [http-nio-8080-exec-1] [8f31a2c4-...] c.j.config.RequestLoggingFilter - POST /api/run completed, status=200, elapsed=666ms
```

`[8f31a2c4-...]` 就是 requestId，同一次请求的所有日志都带它。

### 前端浏览器控制台

```
[8f31a2c4-...] POST /api/run 200 666ms
[8f31a2c4-...] POST /api/ai/chat failed after 1234ms  TypeError: ...
```

## 三、怎么追一个失败的请求

1. 用户反馈「刚才保存失败了」，在浏览器 **Network** 面板找到那次请求，看它的 `X-Request-ID` 头（或控制台日志里方括号里的 id）。
2. 后端日志里搜这个 requestId，就能看到这条请求从头到尾的所有日志和异常堆栈：

   ```bash
   grep 8f31a2c4 logs/app.log
   ```

## 四、日志级别怎么用

| 级别 | 用法 |
| --- | --- |
| DEBUG | 开发调试细节（默认不开，避免刷屏） |
| INFO | 正常的重要业务流程（默认） |
| WARN | 不正常但程序还能继续跑 |
| ERROR | 真正的错误 |

业务代码里这样用：

```java
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

private static final Logger log = LoggerFactory.getLogger(XxxService.class);

log.info("Creating order, orderId={}", orderId);
log.warn("User attempted to access expired order, orderId={}", orderId);
log.error("Failed to create order, orderId={}", orderId, e); // 带异常对象，会打完整堆栈
```

> 别写 `log.error("Failed: " + e.getMessage())`，要写 `log.error("...", e)`，否则会丢掉异常堆栈。

## 五、怎么配置

改 `backend/src/main/resources/application.properties`：

```properties
# 日志文件位置（相对后端工作目录）
logging.file.name=logs/app.log

# 打开某包的 DEBUG 日志（默认 INFO）
logging.level.com.javatutor=DEBUG
```

日志文件默认**按大小 + 天滚动**：单文件超过 10MB 自动切，保留最近 7 天，压缩为 `.gz`（例如 `logs/app.log.2026-09-01.0.gz`）。

- **开发阶段**：直接看后端控制台就够，文件只是兜底。
- **部署后**：去服务器上的 `logs/app.log` 查（相对启动目录）。

## 六、后续（Level 3，真正需要时再加）

Metrics / Tracing / ELK / Sentry / Prometheus / Grafana。现在不用上，先把手动这套（requestId + 全局异常 + 请求日志）用熟——它正好对应「bug 难复现、不知道该怎么描述」的问题：下次发生时，至少能留下证据。
