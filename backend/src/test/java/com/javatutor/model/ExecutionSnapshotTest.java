package com.javatutor.model;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class ExecutionSnapshotTest {

    @Test
    void allFieldsShouldBeSettable() {
        ExecutionSnapshot snapshot = new ExecutionSnapshot();
        List<Map<String, Object>> steps = List.of(Map.of("step", 0));
        List<String> tags = List.of("排序");

        snapshot.setRunId("run-1");
        snapshot.setSourceCode("public class A {}");
        snapshot.setSteps(steps);
        snapshot.setCurrentStepIndex(2);
        snapshot.setCurrentLine(5);
        snapshot.setCompileError("");
        snapshot.setAlgorithmTags(tags);
        snapshot.setCreatedAtEpochMs(1000L);
        snapshot.setExpiresAtEpochMs(2000L);

        assertEquals("run-1", snapshot.getRunId());
        assertEquals("public class A {}", snapshot.getSourceCode());
        assertEquals(steps, snapshot.getSteps());
        assertEquals(2, snapshot.getCurrentStepIndex());
        assertEquals(5, snapshot.getCurrentLine());
        assertEquals("", snapshot.getCompileError());
        assertEquals(tags, snapshot.getAlgorithmTags());
        assertEquals(1000L, snapshot.getCreatedAtEpochMs());
        assertEquals(2000L, snapshot.getExpiresAtEpochMs());
    }
}
