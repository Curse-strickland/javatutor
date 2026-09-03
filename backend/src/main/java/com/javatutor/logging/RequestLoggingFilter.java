package com.javatutor.logging;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.servlet.AsyncEvent;
import jakarta.servlet.AsyncListener;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import org.springframework.web.util.ContentCachingRequestWrapper;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.TimeUnit;

/**
 * 请求访问日志过滤器：为每个请求生成/透传 request-id，记录一条结构化访问日志。
 *
 * <p>职责：
 * <ul>
 *   <li>生成/透传 requestId（优先读上游 X-Request-Id，否则 UUID），写入 MDC 与响应头。</li>
 *   <li>记录访问行：时间 / method / path+query / status / 耗时 / 真实客户端 IP / UA / Content-Type / 字节数。</li>
 *   <li>请求体用 {@link ContentCachingRequestWrapper} 捕获（同步、安全），截断 + 脱敏。</li>
 *   <li>响应体用 {@link TeeResponseWrapper} 边写边采：非流式全量、流式(SSE)实时透传并采样。</li>
 * </ul>
 *
 * <p>日志通过专用 logger {@code REQUEST} 输出单行 JSON（见 logback-spring.xml），
 * 落到 {@code logs/request.log}。
 */
@Component
public class RequestLoggingFilter extends OncePerRequestFilter {

    public static final String REQUEST_ID_HEADER = "X-Request-Id";

    private static final Logger requestLog = LoggerFactory.getLogger("REQUEST");
    private static final ObjectMapper mapper = new ObjectMapper();

    private final int maxBodyChars;
    private final boolean maskingEnabled;

    public RequestLoggingFilter(
            @Value("${javatutor.logging.dir:logs}") String logDir,
            @Value("${javatutor.logging.mask:true}") boolean maskingEnabled,
            @Value("${javatutor.logging.max-body-chars:8000}") int maxBodyChars) {
        this.maskingEnabled = maskingEnabled;
        this.maxBodyChars = maxBodyChars;
        try {
            // 确保日志目录存在，避免 logback 首个文件写不进去（生产由 deploy.yml 预建）
            Files.createDirectories(Paths.get(logDir));
        } catch (IOException ignored) {
            // 目录创建失败不影响服务启动，日志退化为 console 输出
        }
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        // CORS 预检等 OPTIONS 请求无业务体，跳过以免刷屏
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            filterChain.doFilter(request, response);
            return;
        }

        long start = System.nanoTime();
        String requestId = resolveRequestId(request);
        MDC.put("requestId", requestId);

        ContentCachingRequestWrapper reqWrapper = new ContentCachingRequestWrapper(request);
        TeeResponseWrapper respWrapper = new TeeResponseWrapper(response, maxBodyChars);
        respWrapper.setHeader(REQUEST_ID_HEADER, requestId);
        // 允许前端读取 X-Request-Id（跨域场景下也可见）
        respWrapper.setHeader("Access-Control-Expose-Headers", REQUEST_ID_HEADER);

        try {
            filterChain.doFilter(reqWrapper, respWrapper);
            if (request.isAsyncStarted()) {
                // 异步（SSE 流式）：请求体已读完，响应体仍在异步线程边写边采，
                // 挂一个 AsyncListener，在异步真正完成时统一写访问日志。
                request.getAsyncContext().addListener(
                    new AccessLogAsyncListener(requestId, reqWrapper, respWrapper, start));
            } else {
                // 同步：立即写访问日志
                logAccess(requestId, reqWrapper, respWrapper, start, null);
            }
        } catch (ServletException | IOException e) {
            logAccess(requestId, reqWrapper, respWrapper, start, e);
            throw e;
        } catch (RuntimeException e) {
            logAccess(requestId, reqWrapper, respWrapper, start, e);
            throw e;
        } finally {
            MDC.remove("requestId");
        }
    }

    private String resolveRequestId(HttpServletRequest request) {
        String upstream = request.getHeader("X-Request-Id");
        if (upstream == null || upstream.isBlank()) {
            upstream = request.getHeader("X-Request-ID");
        }
        if (upstream != null && !upstream.isBlank()) {
            return upstream.length() > 128 ? upstream.substring(0, 128) : upstream;
        }
        return UUID.randomUUID().toString();
    }

    /** 取真实客户端 IP：优先 X-Forwarded-For 首段（前面有 nginx，remoteAddr 全是 127.0.0.1）。 */
    private String resolveClientIp(HttpServletRequest request) {
        String xff = request.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) {
            int comma = xff.indexOf(',');
            return (comma > 0 ? xff.substring(0, comma) : xff).trim();
        }
        String realIp = request.getHeader("X-Real-IP");
        if (realIp != null && !realIp.isBlank()) {
            return realIp.trim();
        }
        return request.getRemoteAddr();
    }

    private void logAccess(String requestId, ContentCachingRequestWrapper request,
                           TeeResponseWrapper response, long startNanos, Throwable error) {
        long durationMs = TimeUnit.NANOSECONDS.toMillis(System.nanoTime() - startNanos);

        Map<String, Object> entry = new LinkedHashMap<>();
        entry.put("ts", Instant.now().toString());
        entry.put("level", "INFO");
        entry.put("requestId", requestId);
        entry.put("method", request.getMethod());
        entry.put("path", request.getRequestURI());
        entry.put("query", nz(request.getQueryString()));
        entry.put("status", response.getStatus());
        entry.put("durationMs", durationMs);
        entry.put("clientIp", resolveClientIp(request));
        entry.put("userAgent", nz(request.getHeader("User-Agent")));
        entry.put("contentType", nz(response.getContentType()));
        byte[] reqBytes = request.getContentAsByteArray();
        entry.put("reqBytes", reqBytes.length);
        entry.put("respBytes", response.getTotalBytes());
        entry.put("reqBody", sanitize(new String(reqBytes, StandardCharsets.UTF_8)));
        String respText = new String(response.getCapturedBody(), StandardCharsets.UTF_8);
        if (response.isStreamed()) {
            entry.put("streamed", true);
        }
        entry.put("respBody", sanitize(respText));
        if (error != null) {
            entry.put("error", error.getMessage());
        }

        try {
            requestLog.info(mapper.writeValueAsString(entry));
        } catch (Exception ignored) {
            // 序列化失败（几乎不可能）时退化成不带 body 的一行
            requestLog.info("{\"ts\":\"" + Instant.now() + "\",\"requestId\":\"" + requestId
                + "\",\"status\":" + response.getStatus() + ",\"logError\":\"serialize failed\"}");
        }
    }

    private String sanitize(String raw) {
        if (raw == null) {
            return "";
        }
        String out = raw.replace("\r\n", "\n").replace('\r', '\n');
        if (maskingEnabled) {
            out = LogMasker.mask(out);
        }
        return LogMasker.truncate(out, maxBodyChars);
    }

    private String nz(String s) {
        return s == null ? "" : s;
    }

    private final class AccessLogAsyncListener implements AsyncListener {
        private final String requestId;
        private final ContentCachingRequestWrapper request;
        private final TeeResponseWrapper response;
        private final long startNanos;

        AccessLogAsyncListener(String requestId, ContentCachingRequestWrapper request,
                               TeeResponseWrapper response, long startNanos) {
            this.requestId = requestId;
            this.request = request;
            this.response = response;
            this.startNanos = startNanos;
        }

        @Override
        public void onComplete(AsyncEvent event) {
            logAccess(requestId, request, response, startNanos, null);
        }

        @Override
        public void onTimeout(AsyncEvent event) {
            logAccess(requestId, request, response, startNanos, new IllegalStateException("async timeout"));
        }

        @Override
        public void onError(AsyncEvent event) {
            logAccess(requestId, request, response, startNanos, event.getThrowable());
        }

        @Override
        public void onStartAsync(AsyncEvent event) {
        }
    }
}
