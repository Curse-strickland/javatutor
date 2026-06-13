package com.javatutor.model;

import java.util.List;

public class RunRequest {
    private String code;
    private String mode = "default";
    private List<String> testCases;

    public RunRequest() {
    }
    public RunRequest(String code) {
        this.code = code;
    }

    public String getCode() {
        return code;
    }
    public void setCode(String code) {
        this.code = code;
    }

    public String getMode() {
        return mode;
    }
    public void setMode(String mode) {
        this.mode = mode;
    }

    public List<String> getTestCases() {
        return testCases;
    }
    public void setTestCases(List<String> testCases) {
        this.testCases = testCases;
    }
}
