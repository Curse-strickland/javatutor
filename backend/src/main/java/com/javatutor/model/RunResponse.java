package com.javatutor.model;

import java.util.List;
import java.util.Map;

public class RunResponse {
    private boolean success;
    private String runId;
    private List<Map<String, Object>> steps;
    private String error;
    private String output;
    private String methodName;
    private String methodSignature;

    public RunResponse() {
    }

    public boolean isSuccess() {
        return success;
    }
    public String getRunId() {
        return runId;
    }
    public List<Map<String, Object>> getSteps() {
        return steps;
    }
    public String getError() {
        return error;
    }
    public String getOutput() {
        return output;
    }
    public String getMethodName() {
        return methodName;
    }
    public String getMethodSignature() {
        return methodSignature;
    }

    public void setSuccess(boolean success) {
        this.success = success;
    }
    public void setRunId(String runId) {
        this.runId = runId;
    }
    public void setSteps(List<Map<String, Object>> steps) {
        this.steps = steps;
    }
    public void setError(String error) {
        this.error = error;
    }
    public void setOutput(String output) {
        this.output = output;
    }
    public void setMethodName(String methodName) {
        this.methodName = methodName;
    }
    public void setMethodSignature(String methodSignature) {
        this.methodSignature = methodSignature;
    }

    public static RunResponse ok(String runId, List<Map<String, Object>> steps, String output) {
        return ok(runId, steps, output, null, null);
    }

    public static RunResponse ok(String runId, List<Map<String, Object>> steps, String output,
                                  String methodName, String methodSignature) {
        RunResponse response = new RunResponse();
        response.setSuccess(true);
        response.setRunId(runId);
        response.setSteps(steps);
        response.setOutput(output);
        response.setMethodName(methodName);
        response.setMethodSignature(methodSignature);
        return response;
    }

    public static RunResponse fail(String error) {
        RunResponse response = new RunResponse();
        response.setSuccess(false);
        response.setError(error);
        return response;
    }
}
