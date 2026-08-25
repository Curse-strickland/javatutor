package com.javatutor.model;

import java.util.List;
import java.util.Map;

public class ExecutionSnapshot {
    private String runId;
    private String sourceCode;
    private List<Map<String, Object>> steps;
    private int currentStepIndex;
    private int currentLine;
    private String compileError;
    private List<String> algorithmTags;
    private long createdAtEpochMs;
    private long expiresAtEpochMs;

    public String getRunId() { return runId; }
    public void setRunId(String runId) { this.runId = runId; }

    public String getSourceCode() { return sourceCode; }
    public void setSourceCode(String sourceCode) { this.sourceCode = sourceCode; }

    public List<Map<String, Object>> getSteps() { return steps; }
    public void setSteps(List<Map<String, Object>> steps) { this.steps = steps; }

    public int getCurrentStepIndex() { return currentStepIndex; }
    public void setCurrentStepIndex(int currentStepIndex) { this.currentStepIndex = currentStepIndex; }

    public int getCurrentLine() { return currentLine; }
    public void setCurrentLine(int currentLine) { this.currentLine = currentLine; }

    public String getCompileError() { return compileError; }
    public void setCompileError(String compileError) { this.compileError = compileError; }

    public List<String> getAlgorithmTags() { return algorithmTags; }
    public void setAlgorithmTags(List<String> algorithmTags) { this.algorithmTags = algorithmTags; }

    public long getCreatedAtEpochMs() { return createdAtEpochMs; }
    public void setCreatedAtEpochMs(long createdAtEpochMs) { this.createdAtEpochMs = createdAtEpochMs; }

    public long getExpiresAtEpochMs() { return expiresAtEpochMs; }
    public void setExpiresAtEpochMs(long expiresAtEpochMs) { this.expiresAtEpochMs = expiresAtEpochMs; }
}
