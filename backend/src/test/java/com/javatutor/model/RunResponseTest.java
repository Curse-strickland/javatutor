package com.javatutor.model;

import org.junit.jupiter.api.Test;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

class RunResponseTest {

    @Test
    void okShouldCreateSuccessResponse() {
        String runId = "test-id";
        List<Map<String, Object>> steps = new ArrayList<>();
        String output = "hello";
        RunResponse resp = RunResponse.ok(runId, steps, output);
        assertTrue(resp.isSuccess());
        assertEquals(runId, resp.getRunId());
        assertEquals(steps, resp.getSteps());
        assertEquals(output, resp.getOutput());
        assertNull(resp.getError());
    }

    @Test
    void okWithMethodInfoShouldIncludeMetadata() {
        String runId = "r1";
        List<Map<String, Object>> steps = new ArrayList<>();
        RunResponse resp = RunResponse.ok(runId, steps, "out", "add", "int add(int, int)");
        assertEquals("add", resp.getMethodName());
        assertEquals("int add(int, int)", resp.getMethodSignature());
    }

    @Test
    void failShouldCreateErrorResponse() {
        RunResponse resp = RunResponse.fail("some error");
        assertFalse(resp.isSuccess());
        assertEquals("some error", resp.getError());
        assertNull(resp.getRunId());
        assertNull(resp.getSteps());
        assertNull(resp.getOutput());
    }
}
