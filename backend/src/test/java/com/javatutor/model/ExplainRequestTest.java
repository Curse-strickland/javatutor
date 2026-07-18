package com.javatutor.model;

import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class ExplainRequestTest {

    @Test
    void allFieldsShouldBeSettable() {
        ExplainRequest req = new ExplainRequest();
        req.setCode("public class A {}");
        req.setRunId("run1");
        req.setStep(5);
        req.setTotalSteps(10);
        req.setCurrentLine(12);
        Map<String, Object> vars = new HashMap<>();
        vars.put("x", 1);
        req.setVariables(vars);
        req.setApiKey("sk-test");
        req.setMode("test");
        req.setOverview(true);
        req.setApiUrl("https://api.example.com");
        req.setApiModel("gpt-4");

        assertEquals("public class A {}", req.getCode());
        assertEquals("run1", req.getRunId());
        assertEquals(5, req.getStep());
        assertEquals(10, req.getTotalSteps());
        assertEquals(12, req.getCurrentLine());
        assertEquals(vars, req.getVariables());
        assertEquals("sk-test", req.getApiKey());
        assertEquals("test", req.getMode());
        assertTrue(req.isOverview());
        assertEquals("https://api.example.com", req.getApiUrl());
        assertEquals("gpt-4", req.getApiModel());
    }
}
