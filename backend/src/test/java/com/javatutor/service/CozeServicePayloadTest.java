package com.javatutor.service;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class CozeServicePayloadTest {

    /** 统一构造入口：runId=null 走 legacy 分支，runMode=null 表示旧客户端（不带运行模式）。 */
    private Map<String, Object> build(String runId, String runMode, int testCaseCount) {
        CozeService service = new CozeService();
        return service.buildAgentPayload(
            "public class A {}",
            List.of(Map.of("step", 0)),
            1,
            4,
            "x 怎么变了？",
            "",
            "session-1",
            "data_query",
            List.of("排序"),
            runId,
            List.of(Map.of("name", "A.java", "code", "public class A {}")),
            "A.java",
            runMode,
            testCaseCount
        );
    }

    @Test
    void withRunIdBuildsFullEnvelope() {
        Map<String, Object> payload = build("run-1", null, 0);

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
            "a", null, 0, 1, "q", "", "s", "data_query", null, "r", null, null, null, 0);
        assertFalse(payload.containsKey("files"));
        assertFalse(payload.containsKey("entry_file"));
    }

    @Test
    void withoutRunIdBuildsLegacyEnvelope() {
        Map<String, Object> payload = build(null, null, 0);

        assertEquals("public class A {}", payload.get("source_code"));
        assertEquals(List.of(Map.of("step", 0)), payload.get("steps"));
        assertEquals(1, payload.get("current_step_index"));
        assertEquals(4, payload.get("current_line"));
        assertEquals("session-1", payload.get("user_id"));
        assertEquals(List.of("排序"), payload.get("algorithm_tags"));
    }

    // --- 运行模式透传（/grilling F1：事实由前端传，缺失时行为与现状完全一致） ---

    @Test
    void runIdBranchCarriesRunModeAndTestCaseCount() {
        Map<String, Object> payload = build("run-1", "test", 2);
        assertEquals("test", payload.get("run_mode"));
        assertEquals(2, payload.get("test_case_count"));
    }

    @Test
    void legacyBranchCarriesRunModeAndTestCaseCount() {
        Map<String, Object> payload = build(null, "default", 0);
        assertEquals("default", payload.get("run_mode"));
        // 0 是**有意义**的值（「默认模式，已保存用例 0 条」），不得当成缺失省略
        assertEquals(0, payload.get("test_case_count"));
        assertTrue(payload.containsKey("test_case_count"));
    }

    @Test
    void missingRunModeOmitsBothKeys() {
        // 旧客户端 / 其它调用方：两个键**同时不出现**，coze 侧据此判定「模式未知」而非「默认模式」
        for (Map<String, Object> payload : List.of(build("run-1", null, 0), build("run-1", "", 0))) {
            assertFalse(payload.containsKey("run_mode"));
            assertFalse(payload.containsKey("test_case_count"));
        }
        assertFalse(build(null, null, 0).containsKey("run_mode"));
        assertFalse(build(null, "   ", 0).containsKey("test_case_count"));
    }
}
