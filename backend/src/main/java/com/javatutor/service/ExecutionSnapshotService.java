package com.javatutor.service;

import com.javatutor.model.ExecutionSnapshot;
import com.javatutor.model.ExplainRequest;
import com.javatutor.model.RunResponse;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;
import java.util.Optional;

@Service
public class ExecutionSnapshotService {

    private final ExecutionSnapshotStore store;

    public ExecutionSnapshotService(ExecutionSnapshotStore store) {
        this.store = store;
    }

    public void saveRunSnapshot(RunResponse response, String sourceCode, List<String> algorithmTags) {
        if (response == null || !response.isSuccess() || response.getRunId() == null || response.getRunId().isBlank()) {
            return;
        }
        ExecutionSnapshot snapshot = new ExecutionSnapshot();
        snapshot.setRunId(response.getRunId());
        snapshot.setSourceCode(sourceCode == null ? "" : sourceCode);
        snapshot.setSteps(response.getSteps() == null ? List.of() : response.getSteps());
        snapshot.setCurrentStepIndex(0);
        snapshot.setCurrentLine(firstLine(response.getSteps()));
        snapshot.setCompileError("");
        snapshot.setAlgorithmTags(algorithmTags == null ? List.of() : algorithmTags);
        store.save(snapshot);
    }

    public void updateChatSnapshot(ExplainRequest request) {
        if (request == null || request.getRunId() == null || request.getRunId().isBlank()) {
            return;
        }
        Optional<ExecutionSnapshot> found = store.findByRunId(request.getRunId());
        if (found.isEmpty()) {
            return;
        }
        ExecutionSnapshot snapshot = found.get();
        store.updatePosition(request.getRunId(), request.getStep(), request.getCurrentLine());
        if (request.getSteps() != null) {
            snapshot.setSteps(request.getSteps());
        }
        if (request.getCode() != null && !request.getCode().isBlank()) {
            snapshot.setSourceCode(request.getCode());
        }
        if (request.getAlgorithmTags() != null) {
            snapshot.setAlgorithmTags(request.getAlgorithmTags());
        }
    }

    private int firstLine(List<Map<String, Object>> steps) {
        if (steps == null || steps.isEmpty()) {
            return 0;
        }
        Object line = steps.get(0).get("line");
        return line instanceof Number number ? number.intValue() : 0;
    }
}
