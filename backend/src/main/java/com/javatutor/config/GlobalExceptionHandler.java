package com.javatutor.config;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * 全局兜底异常处理。
 *
 * 只负责那些没有被 Controller 自己 try/catch 住的异常（现有 Controller 大多
 * 已经自己捕获并返回 error 信息），这里作为最后一道防线：
 *   1. 打一条带完整堆栈的 ERROR 日志（requestId 由 MDC 自动带上）；
 *   2. 返回统一 JSON，避免前端收到 500 裸页或 Spring 默认错误页。
 *
 * 返回体里的 requestId 可以直接拿去后端日志里 grep，定位到完整过程。
 */
@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleException(Exception e) {
        String requestId = MDC.get(RequestLoggingFilter.MDC_KEY);
        // 用 (message, throwable) 两参形式，Logback 才会打印完整异常堆栈
        log.error("Unhandled exception", e);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("success", false);
        body.put("error", e.getMessage() != null ? e.getMessage() : "服务器内部错误");
        body.put("requestId", requestId);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(body);
    }
}
