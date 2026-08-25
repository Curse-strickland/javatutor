package com.javatutor.controller;

import com.javatutor.model.ExecutionSnapshot;
import com.javatutor.service.ExecutionSnapshotStore;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.test.context.TestPropertySource;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.Optional;

import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(ExecutionSnapshotController.class)
@TestPropertySource(properties = "javatutor.agent.token=secret-token")
class ExecutionSnapshotControllerTest {

    @Autowired
    private MockMvc mvc;

    @MockBean
    private ExecutionSnapshotStore store;

    @Test
    void missingTokenReturns401() throws Exception {
        mvc.perform(get("/api/agent/execution-context/run-1"))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void wrongTokenReturns401() throws Exception {
        mvc.perform(get("/api/agent/execution-context/run-1")
                .header("X-Agent-Token", "wrong"))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void missingSnapshotReturns404() throws Exception {
        when(store.findByRunId("run-1")).thenReturn(Optional.empty());
        mvc.perform(get("/api/agent/execution-context/run-1")
                .header("X-Agent-Token", "secret-token"))
            .andExpect(status().isNotFound());
    }

    @Test
    void validSnapshotReturnsJson() throws Exception {
        ExecutionSnapshot snapshot = new ExecutionSnapshot();
        snapshot.setRunId("run-1");
        snapshot.setSourceCode("public class A {}");
        snapshot.setSteps(List.of());
        snapshot.setCurrentStepIndex(2);
        snapshot.setCurrentLine(5);
        snapshot.setCompileError("");
        snapshot.setAlgorithmTags(List.of("排序"));
        snapshot.setExpiresAtEpochMs(1784736000L);

        when(store.findByRunId("run-1")).thenReturn(Optional.of(snapshot));
        mvc.perform(get("/api/agent/execution-context/run-1")
                .header("X-Agent-Token", "secret-token"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.run_id").value("run-1"))
            .andExpect(jsonPath("$.source_code").value("public class A {}"))
            .andExpect(jsonPath("$.current_step_index").value(2))
            .andExpect(jsonPath("$.current_line").value(5))
            .andExpect(jsonPath("$.algorithm_tags[0]").value("排序"));
    }
}
