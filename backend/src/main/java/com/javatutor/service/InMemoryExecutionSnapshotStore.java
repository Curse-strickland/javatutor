package com.javatutor.service;

import com.javatutor.model.ExecutionSnapshot;
import org.springframework.stereotype.Service;

import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class InMemoryExecutionSnapshotStore implements ExecutionSnapshotStore {
    private static final long TTL_MS = 30 * 60 * 1000L;
    private final Map<String, ExecutionSnapshot> store = new ConcurrentHashMap<>();

    @Override
    public void save(ExecutionSnapshot snapshot) {
        long now = System.currentTimeMillis();
        snapshot.setCreatedAtEpochMs(now);
        // 仅在调用方未显式设置过期时间时盖章默认 TTL；否则尊重传入值（如测试注入过期快照）
        if (snapshot.getExpiresAtEpochMs() <= 0) {
            snapshot.setExpiresAtEpochMs(now + TTL_MS);
        }
        store.put(snapshot.getRunId(), snapshot);
        evictExpired();
    }

    @Override
    public Optional<ExecutionSnapshot> findByRunId(String runId) {
        ExecutionSnapshot snapshot = store.get(runId);
        if (snapshot == null) {
            return Optional.empty();
        }
        if (snapshot.getExpiresAtEpochMs() <= System.currentTimeMillis()) {
            store.remove(runId);
            return Optional.empty();
        }
        return Optional.of(snapshot);
    }

    @Override
    public void updatePosition(String runId, int currentStepIndex, int currentLine) {
        findByRunId(runId).ifPresent(snapshot -> {
            snapshot.setCurrentStepIndex(currentStepIndex);
            snapshot.setCurrentLine(currentLine);
        });
    }

    @Override
    public void evictExpired() {
        long now = System.currentTimeMillis();
        store.entrySet().removeIf(entry -> entry.getValue().getExpiresAtEpochMs() <= now);
    }
}
