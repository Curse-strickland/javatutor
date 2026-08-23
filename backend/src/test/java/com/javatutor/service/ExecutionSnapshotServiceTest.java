package com.javatutor.service;

import com.javatutor.model.ExecutionSnapshot;
import com.javatutor.model.ExplainRequest;
import com.javatutor.model.RunResponse;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

class ExecutionSnapshotServiceTest {

    private static class FakeStore implements ExecutionSnapshotStore {
        ExecutionSnapshot saved;
        int updateCalls;

        @Override public void save(ExecutionSnapshot snapshot) { this.saved = snapshot; }
        @Override public Optional<ExecutionSnapshot> findByRunId(String runId) { return Optional.ofNullable(saved); }
        @Override public void updatePosition(String runId, int currentStepIndex, int currentLine) { updateCalls++; }
        @Override public void evictExpired() {}
    }

    @Test
    void saveRunSnapshotUsesResponseAndSourceCode() {
        FakeStore store = new FakeStore();
        ExecutionSnapshotService service = new ExecutionSnapshotService(store);
        List<Map<String, Object>> steps = List.of(Map.of("step", 0, "line", 3));
        RunResponse response = RunResponse.ok("run-1", steps, "out");

        service.saveRunSnapshot(response, "public class A {}", List.of("排序"));

        assertEquals("run-1", store.saved.getRunId());
        assertEquals("public class A {}", store.saved.getSourceCode());
        assertEquals(steps, store.saved.getSteps());
        assertEquals(0, store.saved.getCurrentStepIndex());
        assertEquals(3, store.saved.getCurrentLine());
        assertEquals(List.of("排序"), store.saved.getAlgorithmTags());
    }

    @Test
    void updateChatSnapshotUpdatesPositionAndContent() {
        FakeStore store = new FakeStore();
        ExecutionSnapshotService service = new ExecutionSnapshotService(store);
        ExecutionSnapshot existing = new ExecutionSnapshot();
        existing.setRunId("run-1");
        existing.setSourceCode("old");
        existing.setSteps(new ArrayList<>());
        store.saved = existing;

        ExplainRequest request = new ExplainRequest();
        request.setRunId("run-1");
        request.setStep(4);
        request.setCurrentLine(8);
        request.setCode("new");
        request.setSteps(List.of(Map.of("step", 4)));
        request.setAlgorithmTags(List.of("搜索"));

        service.updateChatSnapshot(request);

        assertEquals(1, store.updateCalls);
        assertEquals("new", existing.getSourceCode());
        assertEquals(1, existing.getSteps().size());
        assertEquals(List.of("搜索"), existing.getAlgorithmTags());
    }
}
