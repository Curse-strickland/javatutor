package com.javatutor.model;

import java.util.Map;

public class ExplainRequest {
    private String code;
    private String runId;
    private int step;
    private int totalSteps;
    private int currentLine;
    private Map<String, Object> variables;
    private String apiKey;

    public ExplainRequest() {}

    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }

    public String getRunId() { return runId; }
    public void setRunId(String runId) { this.runId = runId; }

    public int getStep() { return step; }
    public void setStep(int step) { this.step = step; }

    public int getTotalSteps() { return totalSteps; }
    public void setTotalSteps(int totalSteps) { this.totalSteps = totalSteps; }

    public int getCurrentLine() { return currentLine; }
    public void setCurrentLine(int currentLine) { this.currentLine = currentLine; }

    public Map<String, Object> getVariables() { return variables; }
    public void setVariables(Map<String, Object> variables) { this.variables = variables; }

    public String getApiKey() { return apiKey; }
    public void setApiKey(String apiKey) { this.apiKey = apiKey; }
}
