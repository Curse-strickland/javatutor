package com.javatutor.controller;

import com.javatutor.model.ExecutionSnapshot;
import com.javatutor.service.ExecutionSnapshotStore;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;

@RestController
@RequestMapping("/api/agent")
public class ExecutionSnapshotController {

    private final ExecutionSnapshotStore store;
    private final String token;

    public ExecutionSnapshotController(
        ExecutionSnapshotStore store,
        @Value("${javatutor.agent.token:}") String token
    ) {
        this.store = store;
        this.token = token;
    }

    @GetMapping("/execution-context/{runId}")
    public ResponseEntity<?> getExecutionContext(
        @PathVariable String runId,
        @RequestHeader(value = "X-Agent-Token", required = false) String suppliedToken
    ) {
        if (token.isBlank() || !Objects.equals(token, suppliedToken)) {
            return ResponseEntity.status(401).body(Map.of("error", "unauthorized"));
        }
        return store.findByRunId(runId)
            .map(snapshot -> ResponseEntity.ok(toMap(snapshot)))
            .orElseGet(() -> ResponseEntity.status(404).body(Map.of("error", "not_found")));
    }

    private Map<String, Object> toMap(ExecutionSnapshot snapshot) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("run_id", snapshot.getRunId());
        out.put("source_code", snapshot.getSourceCode());
        out.put("steps", snapshot.getSteps() == null ? java.util.List.of() : snapshot.getSteps());
        out.put("current_step_index", snapshot.getCurrentStepIndex());
        out.put("current_line", snapshot.getCurrentLine());
        out.put("compile_error", snapshot.getCompileError() == null ? "" : snapshot.getCompileError());
        out.put("algorithm_tags", snapshot.getAlgorithmTags() == null ? java.util.List.of() : snapshot.getAlgorithmTags());
        out.put("expires_at", snapshot.getExpiresAtEpochMs());
        return out;
    }
}
