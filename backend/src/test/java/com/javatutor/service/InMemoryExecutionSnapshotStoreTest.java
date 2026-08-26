package com.javatutor.service;

import com.javatutor.model.ExecutionSnapshot;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

class InMemoryExecutionSnapshotStoreTest {

    private ExecutionSnapshot snapshot(String runId, long expiresAt) {
        ExecutionSnapshot snapshot = new ExecutionSnapshot();
        snapshot.setRunId(runId);
        snapshot.setSourceCode("public class A {}");
        snapshot.setSteps(List.of());
        snapshot.setCreatedAtEpochMs(0L);
        snapshot.setExpiresAtEpochMs(expiresAt);
        return snapshot;
    }

    @Test
    void saveAndFindByRunId() {
        InMemoryExecutionSnapshotStore store = new InMemoryExecutionSnapshotStore();
        store.save(snapshot("run-1", Long.MAX_VALUE));
        Optional<ExecutionSnapshot> found = store.findByRunId("run-1");
        assertTrue(found.isPresent());
        assertEquals("run-1", found.get().getRunId());
    }

    @Test
    void expiredSnapshotReturnsEmpty() {
        InMemoryExecutionSnapshotStore store = new InMemoryExecutionSnapshotStore();
        store.save(snapshot("run-1", System.currentTimeMillis() - 1000L));
        assertTrue(store.findByRunId("run-1").isEmpty());
    }

    @Test
    void updatePositionChangesCurrentStepAndLine() {
        InMemoryExecutionSnapshotStore store = new InMemoryExecutionSnapshotStore();
        store.save(snapshot("run-1", Long.MAX_VALUE));
        store.updatePosition("run-1", 3, 9);
        ExecutionSnapshot found = store.findByRunId("run-1").orElseThrow();
        assertEquals(3, found.getCurrentStepIndex());
        assertEquals(9, found.getCurrentLine());
    }

    @Test
    void evictExpiredRemovesOnlyExpired() {
        InMemoryExecutionSnapshotStore store = new InMemoryExecutionSnapshotStore();
        store.save(snapshot("expired", System.currentTimeMillis() - 1000L));
        store.save(snapshot("alive", Long.MAX_VALUE));
        store.evictExpired();
        assertTrue(store.findByRunId("expired").isEmpty());
        assertTrue(store.findByRunId("alive").isPresent());
    }
}
