package com.javatutor.service;

import com.javatutor.model.ExecutionSnapshot;

import java.util.Optional;

public interface ExecutionSnapshotStore {
    void save(ExecutionSnapshot snapshot);
    Optional<ExecutionSnapshot> findByRunId(String runId);
    void updatePosition(String runId, int currentStepIndex, int currentLine);
    void evictExpired();
}
