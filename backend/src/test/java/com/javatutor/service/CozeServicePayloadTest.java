package com.javatutor.service;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class CozeServicePayloadTest {

    @Test
    void withRunIdBuildsMinimalEnvelope() {
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
            "run-1"
        );

        assertEquals("run-1", payload.get("run_id"));
        assertEquals("session-1", payload.get("session_id"));
        assertEquals("x 怎么变了？", payload.get("user_question"));
        assertEquals("data_query", payload.get("intent"));
        assertFalse(payload.containsKey("source_code"));
        assertFalse(payload.containsKey("steps"));
        assertFalse(payload.containsKey("current_step_index"));
        assertFalse(payload.containsKey("current_line"));
        assertFalse(payload.containsKey("algorithm_tags"));
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
