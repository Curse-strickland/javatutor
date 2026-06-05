package com.javatutor.model;
/** 这个类是后端返回给前端的 JSON 对象。
 * 前端期望的格式：
{
  "success": true,
  "runId": "uuid-xxx",
  "steps": [ ... ],
  "error": "编译错误..."
}
*/
import java.util.List;
import java.util.Map;

public class RunResponse {
    private boolean success;
    private String runId;    
    private List<Map<String, Object>> steps;
    private String error;
    //构造
    public RunResponse() {
    }
    public RunResponse(boolean success, String runId, List<Map<String, Object>> steps, String error) {
        this.success = success;
        this.runId = runId; //标识第几步
        this.steps = steps;
        this.error = error;
    }

    // getter 和 setter 方法
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

    //方法
    //两种状态 ok / fail 下快速创建 RunResponse 对象的方法
    public static RunResponse ok(String runId, List<Map<String, Object>> steps) {
        RunResponse response = new RunResponse();
        response.setSuccess(true);
        response.setRunId(runId);
        response.setSteps(steps);
        return response;
    }

    public static RunResponse fail(String error) {
        RunResponse response = new RunResponse();
        response.setSuccess(false);
        response.setError(error);
        return response;
    }
}
