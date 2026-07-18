package com.javatutor.model;

import org.junit.jupiter.api.Test;

import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class RunRequestTest {

    @Test
    void defaultModeShouldBeDefault() {
        RunRequest req = new RunRequest();
        assertEquals("default", req.getMode());
    }

    @Test
    void codeShouldBeSettable() {
        RunRequest req = new RunRequest();
        req.setCode("public class A {}");
        assertEquals("public class A {}", req.getCode());
    }

    @Test
    void constructorWithCodeShouldSetCode() {
        RunRequest req = new RunRequest("code here");
        assertEquals("code here", req.getCode());
    }

    @Test
    void testCasesShouldBeSettable() {
        RunRequest req = new RunRequest();
        List<String> cases = Arrays.asList("[1,2,3]", "4");
        req.setTestCases(cases);
        assertEquals(cases, req.getTestCases());
    }

    @Test
    void modeShouldBeSettable() {
        RunRequest req = new RunRequest();
        req.setMode("test");
        assertEquals("test", req.getMode());
    }
}
