package com.javatutor.logging;

import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.read.ListAppender;
import jakarta.servlet.FilterChain;
import jakarta.servlet.http.HttpServletResponse;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.slf4j.LoggerFactory;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import java.nio.charset.StandardCharsets;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 直接构造过滤器（不经 Spring 容器）验证：request-id 透传/生成、访问行写入、响应体脱敏。
 * 通过给 REQUEST logger 挂 ListAppender 捕获单行 JSON。
 */
class RequestLoggingFilterTest {

    private final RequestLoggingFilter filter =
        new RequestLoggingFilter("target/test-logs", true, 8000);

    private final Logger requestLogger = (Logger) LoggerFactory.getLogger("REQUEST");
    private ListAppender<ILoggingEvent> appender;

    @BeforeEach
    void attachAppender() {
        appender = new ListAppender<>();
        appender.start();
        requestLogger.addAppender(appender);
    }

    @AfterEach
    void detachAppender() {
        requestLogger.detachAppender(appender);
        appender.stop();
    }

    @Test
    void logsAccessLineWithRequestIdAndMasksApiKey() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("POST", "/api/run");
        request.setContentType("application/json");
        request.setContent("{\"code\":\"int x=1;\",\"apiKey\":\"sk-secret\"}".getBytes(StandardCharsets.UTF_8));
        request.addHeader("User-Agent", "test-agent");

        MockHttpServletResponse response = new MockHttpServletResponse();

        FilterChain chain = (req, res) -> {
            // 模拟 @RequestBody：读请求体，使 ContentCachingRequestWrapper 缓存
            req.getInputStream().readAllBytes();
            HttpServletResponse resp = (HttpServletResponse) res;
            resp.setStatus(200);
            resp.setContentType("application/json");
            resp.getOutputStream().write("{\"ok\":true}".getBytes(StandardCharsets.UTF_8));
        };

        filter.doFilter(request, response, chain);

        String rid = response.getHeader(RequestLoggingFilter.REQUEST_ID_HEADER);
        assertNotNull(rid, "响应应回带 X-Request-Id 头");
        assertFalse(rid.isBlank());

        List<ILoggingEvent> events = appender.list;
        assertEquals(1, events.size(), "同步请求应只写一条访问日志");
        String msg = events.get(0).getFormattedMessage();

        assertTrue(msg.contains("\"requestId\":\"" + rid + "\""), "访问行应含 requestId：" + msg);
        assertTrue(msg.contains("\"status\":200"), "访问行应含状态码 200：" + msg);
        assertFalse(msg.contains("sk-secret"), "真实 apiKey 不应残留：" + msg);
        assertTrue(msg.contains("***"), "敏感值应被打码：" + msg);
    }

    @Test
    void reusesUpstreamRequestId() throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/agent/x");
        request.addHeader("X-Request-Id", "trace-abc-123");

        MockHttpServletResponse response = new MockHttpServletResponse();
        FilterChain chain = (req, res) -> ((HttpServletResponse) res).setStatus(200);

        filter.doFilter(request, response, chain);

        assertEquals("trace-abc-123", response.getHeader(RequestLoggingFilter.REQUEST_ID_HEADER));
        String msg = appender.list.get(0).getFormattedMessage();
        assertTrue(msg.contains("\"requestId\":\"trace-abc-123\""), "应透传上游 requestId：" + msg);
    }
}
