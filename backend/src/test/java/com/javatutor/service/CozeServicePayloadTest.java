package com.javatutor.service;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class CozeServicePayloadTest {

    @Test
    void withRunIdBuildsFullEnvelope() {
        CozeService service = new CozeService();
        Map<String, Object> payload = service.buildAgentPayload(
            "public class A {}",
            List.of(Map.of("step", 0)),
            1,
            4,
            "x 怎么变了？",
            "",
            "session-1",
            "data_query",
            List.of("排序"),
            "run-1",
            List.of(Map.of("name", "A.java", "code", "public class A {}")),
            "A.java"
        );

        assertEquals("run-1", payload.get("run_id"));
        assertEquals("session-1", payload.get("session_id"));
        assertEquals("x 怎么变了？", payload.get("user_question"));
        assertEquals("data_query", payload.get("intent"));
        assertEquals("public class A {}", payload.get("source_code"));
        assertEquals(List.of(Map.of("step", 0)), payload.get("steps"));
        assertEquals(1, payload.get("current_step_index"));
        assertEquals(4, payload.get("current_line"));
        assertEquals(List.of("排序"), payload.get("algorithm_tags"));
        assertEquals(List.of(Map.of("name", "A.java", "code", "public class A {}")), payload.get("files"));
        assertEquals("A.java", payload.get("entry_file"));
    }

    @Test
    void withNulFilesOmitsKeys() {
        CozeService service = new CozeService();
        Map<String, Object> payload = service.buildAgentPayload(
            "a", null, 0, 1, "q", "", "s", "data_query", null, "r", null, null);
        assertFalse(payload.containsKey("files"));
        assertFalse(payload.containsKey("entry_file"));
    }

    @Test
    void withoutRunIdBuildsLegacyEnvelope() {
        CozeService service = new CozeService();
        Map<String, Object> payload = service.buildAgentPayload(
            "public class A {}",
            List.of(Map.of("step", 0)),
            1,
            4,
            "x 怎么变了？",
            "",
            "session-1",
            null,
            List.of("排序"),
            null,
            null,
            null
        );

        assertEquals("public class A {}", payload.get("source_code"));
        assertEquals(List.of(Map.of("step", 0)), payload.get("steps"));
        assertEquals(1, payload.get("current_step_index"));
        assertEquals(4, payload.get("current_line"));
        assertEquals("session-1", payload.get("user_id"));
        assertEquals(List.of("排序"), payload.get("algorithm_tags"));
    }
}
