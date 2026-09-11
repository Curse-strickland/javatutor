package com.javatutor.logging;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class LogMaskerTest {

    @Test
    void masksJsonApiKey() {
        String in = "{\"code\":\"int x=1;\",\"apiKey\":\"sk-1234567890\"}";
        String out = LogMasker.mask(in);
        assertTrue(out.contains("\"apiKey\":\"***\""), "apiKey 应被打码，实际：" + out);
        assertFalse(out.contains("sk-1234567890"), "真实 key 不应残留：" + out);
    }

    @Test
    void masksJsonTokenAndPassword() {
        String in = "{\"token\":\"abc\",\"password\":\"p@ss\",\"code\":\"x\"}";
        String out = LogMasker.mask(in);
        assertTrue(out.contains("\"token\":\"***\""), "token 应打码，实际：" + out);
        assertTrue(out.contains("\"password\":\"***\""), "password 应打码，实际：" + out);
    }

    @Test
    void masksBearerHeader() {
        String in = "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.abc";
        String out = LogMasker.mask(in);
        assertTrue(out.contains("Bearer ***"), "Bearer token 应打码，实际：" + out);
        assertFalse(out.contains("eyJhbGciOiJIUzI1NiJ9"), "JWT 不应残留：" + out);
    }

    @Test
    void masksFormStyleKey() {
        String in = "apiKey=sk-abc&mode=test";
        String out = LogMasker.mask(in);
        assertTrue(out.contains("apiKey=***"), "表单式 key 应打码，实际：" + out);
        assertFalse(out.contains("sk-abc"), "真实 key 不应残留：" + out);
    }

    @Test
    void leavesNonSensitiveIntact() {
        String in = "{\"code\":\"int x=1;\",\"steps\":[{\"line\":1}]}";
        assertEquals(in, LogMasker.mask(in), "无敏感字段应原样保留");
    }

    @Test
    void truncatesLongContent() {
        String longStr = "a".repeat(100);
        String out = LogMasker.truncate(longStr, 20);
        assertEquals(20, out.indexOf('…'), "截断点应在第 20 个字符处");
        assertTrue(out.endsWith("chars]"), "末尾应有截断标记：" + out);
    }

    @Test
    void truncateKeepsShortContent() {
        assertEquals("short", LogMasker.truncate("short", 100));
    }

    @Test
    void nullAndEmptySafe() {
        assertNull(LogMasker.mask(null));
        assertEquals("", LogMasker.mask(""));
        assertNull(LogMasker.truncate(null, 10));
    }
}
