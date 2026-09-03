package com.javatutor.config;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.UUID;

/**
 * 统一的 HTTP 请求日志过滤器。
 *
 * 给每个请求生成（或透传）一个 requestId，写进 MDC，这样同一请求在
 * Service / Controller 里打的所有日志都会自动带上它；同时在这里记录
 * 「请求开始 / 结束（状态码 + 耗时）」，所有 API 请求自动有基础日志。
 *
 * requestId 的来源：
 *   1. 前端在 X-Request-ID 头里传了（见 frontend/src/utils/http.js）就复用；
 *   2. 否则后端自己生成一个 UUID。
 *
 * 日志格式里通过 %X{requestId} 把这个值打印出来，业务代码无需手动传。
 */
@Component
public class RequestLoggingFilter extends OncePerRequestFilter {

    /** 前端 / 后端约定的 requestId 头名称。 */
    public static final String REQUEST_ID_HEADER = "X-Request-ID";

    /** MDC 的 key，对应 logback 格式里的 %X{requestId}。 */
    public static final String MDC_KEY = "requestId";

    private static final Logger log = LoggerFactory.getLogger(RequestLoggingFilter.class);

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain)
            throws ServletException, IOException {

        // CORS 预检请求（OPTIONS）不记录，避免刷屏
        if ("OPTIONS".equalsIgnoreCase(request.getMethod())) {
            filterChain.doFilter(request, response);
            return;
        }

        String requestId = request.getHeader(REQUEST_ID_HEADER);
        if (requestId == null || requestId.isBlank()) {
            requestId = UUID.randomUUID().toString();
        }

        long start = System.currentTimeMillis();
        MDC.put(MDC_KEY, requestId);
        try {
            String query = request.getQueryString();
            log.info("{} {} started{}",
                    request.getMethod(),
                    request.getRequestURI(),
                    query == null ? "" : "?" + query);

            filterChain.doFilter(request, response);
        } finally {
            long elapsed = System.currentTimeMillis() - start;
            log.info("{} {} completed, status={}, elapsed={}ms",
                    request.getMethod(),
                    request.getRequestURI(),
                    response.getStatus(),
                    elapsed);
            MDC.remove(MDC_KEY);
        }
    }
}
