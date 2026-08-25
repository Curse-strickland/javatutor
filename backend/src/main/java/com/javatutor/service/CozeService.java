 package com.javatutor.service;

 import com.fasterxml.jackson.databind.JsonNode;
 import com.fasterxml.jackson.databind.ObjectMapper;
 import org.slf4j.Logger;
 import org.slf4j.LoggerFactory;
 import org.springframework.beans.factory.annotation.Value;
 import org.springframework.stereotype.Service;

 import java.io.BufferedReader;
 import java.io.InputStreamReader;
 import java.net.URI;
 import java.net.http.HttpClient;
 import java.net.http.HttpRequest;
 import java.net.http.HttpResponse;
 import java.nio.charset.StandardCharsets;
 import java.util.LinkedHashMap;
 import java.util.List;
 import java.util.Map;
 import java.util.function.Consumer;

 @Service
 // 配置由 application.properties 的 spring.config.import 加载（coze.properties + coze-local.properties）
 public class CozeService {

     @Value("${coze.api.url}")
     private String apiUrl;

     @Value("${coze.api.token}")
     private String apiToken;

     @Value("${coze.api.project-id}")
     private long projectId;

     @Value("${coze.enabled:false}")
     private boolean enabled;

     private static final Logger log = LoggerFactory.getLogger(CozeService.class);

     private final HttpClient httpClient = HttpClient.newHttpClient();
     private final ObjectMapper objectMapper = new ObjectMapper();

     public boolean isEnabled() {
         return enabled && apiToken != null && !apiToken.isBlank()
             && !apiToken.startsWith("${");
     }

     /** 构造发给 Coze 的 agentPayload：有 runId 时走最小 envelope，否则回退旧完整 payload。 */
     Map<String, Object> buildAgentPayload(String sourceCode,
                                           List<Map<String, Object>> steps,
                                           int currentStepIndex,
                                           int currentLine,
                                           String userQuestion,
                                           String compileError,
                                           String sessionId,
                                           String intent,
                                           List<String> algorithmTags,
                                           String runId) {
         Map<String, Object> agentPayload = new LinkedHashMap<>();
         if (runId != null && !runId.isBlank()) {
             agentPayload.put("run_id", runId);
             agentPayload.put("session_id", sessionId != null ? sessionId : "");
             agentPayload.put("user_question", userQuestion != null ? userQuestion : "");
             agentPayload.put("intent", intent != null ? intent : "");
             agentPayload.put("compile_error", compileError != null ? compileError : "");
             return agentPayload;
         }

         agentPayload.put("source_code", sourceCode);
         agentPayload.put("steps", steps != null ? steps : List.of());
         agentPayload.put("current_step_index", currentStepIndex);
         agentPayload.put("current_line", currentLine);
         agentPayload.put("user_question", userQuestion != null ? userQuestion : "");
         agentPayload.put("user_id", sessionId != null ? sessionId : "");
         agentPayload.put("compile_error", compileError != null ? compileError : "");
         if (intent != null && !intent.isBlank()) {
             agentPayload.put("intent", intent);
         }
         if (algorithmTags != null && !algorithmTags.isEmpty()) {
             agentPayload.put("algorithm_tags", algorithmTags);
         }
         return agentPayload;
     }

     public void streamExplain(String sourceCode,
                               List<Map<String, Object>> steps,
                               int currentStepIndex,
                               int currentLine,
                               String userQuestion,
                               String compileError,
                               String sessionId,
                               String intent,
                               List<String> algorithmTags,
                               String runId,
                               Consumer<String> onChunk,
                               Consumer<String> onStage) throws Exception {

         if (!isEnabled()) {
             throw new IllegalStateException("Coze is disabled.");
         }

         long startMs = System.currentTimeMillis();

         Map<String, Object> agentPayload = buildAgentPayload(
             sourceCode,
             steps,
             currentStepIndex,
             currentLine,
             userQuestion,
             compileError,
             sessionId,
             intent,
             algorithmTags,
             runId
         );

         String agentJson = objectMapper.writeValueAsString(agentPayload);

         Map<String, Object> promptContent = new LinkedHashMap<>();
         promptContent.put("type", "text");
         promptContent.put("content", Map.of("text", agentJson));

         Map<String, Object> body = new LinkedHashMap<>();
         body.put("content", Map.of(
             "query", Map.of("prompt", List.of(promptContent))
         ));
         body.put("type", "query");
         body.put("session_id", sessionId != null ? sessionId : "");
         body.put("project_id", projectId);

         String jsonBody = objectMapper.writeValueAsString(body);

         HttpRequest request = HttpRequest.newBuilder()
             .uri(URI.create(apiUrl))
             .header("Content-Type", "application/json")
             .header("Authorization", "Bearer " + apiToken)
             .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
             .build();

         HttpResponse<java.io.InputStream> response = httpClient.send(request,
             HttpResponse.BodyHandlers.ofInputStream());

         int status = response.statusCode();
         if (status != 200) {
             byte[] errBytes = response.body().readAllBytes();
             throw new RuntimeException("Coze API error " + status + ": "
                 + new String(errBytes, StandardCharsets.UTF_8));
         }

         try (BufferedReader reader = new BufferedReader(
             new InputStreamReader(response.body(), StandardCharsets.UTF_8))) {
             String line;
             while ((line = reader.readLine()) != null) {
                 if (!line.startsWith("event: message")) continue;
                 String dataLine = reader.readLine();
                 if (dataLine == null || !dataLine.startsWith("data: ")) continue;
                 String data = dataLine.substring(6).trim();
                 try {
                     JsonNode node = objectMapper.readTree(data);
                     String type = node.has("type") ? node.get("type").asText() : "";
                     if ("answer".equals(type)) {
                         JsonNode answer = node.at("/content/answer");
                         if (answer != null && !answer.isNull() && !answer.asText().isEmpty()) {
                             onChunk.accept(answer.asText());
                         }
                     } else if ("error".equals(type)) {
                         JsonNode errorNode = node.at("/content/error");
                         String errMsg = errorNode != null && !errorNode.isNull()
                             ? errorNode.asText() : "Unknown";
                        throw new RuntimeException("Coze agent error: " + errMsg);
                    } else if ("message_start".equals(type)) {
                        if (onStage != null) {
                            onStage.accept("正在分析代码并生成回答…");
                        }
                    } else if ("message_end".equals(type)) {
                        // 平台耗时与 token 指标：message_end 返回 time_cost_ms，token_cost 位于其对象内
                        long wallLatencyMs = System.currentTimeMillis() - startMs;
                        JsonNode messageEnd = node.at("/content/message_end");
                        long timeCostMs = messageEnd != null && !messageEnd.isNull()
                            && messageEnd.has("time_cost_ms")
                            ? messageEnd.get("time_cost_ms").asLong() : -1;
                        JsonNode tokenCostNode = messageEnd != null && !messageEnd.isNull()
                            ? messageEnd.get("token_cost") : null;
                        long totalTokens = tokenCostNode != null && !tokenCostNode.isNull()
                            && tokenCostNode.has("total_tokens")
                            ? tokenCostNode.get("total_tokens").asLong() : -1;
                        log.info("Coze message_end: wallLatencyMs={}, platformTimeCostMs={}, platformTotalTokens={}",
                            wallLatencyMs, timeCostMs, totalTokens);
                    }
                } catch (Exception e) {
                    if (e instanceof RuntimeException re
                        && re.getMessage().startsWith("Coze")) {
                        log.warn("Coze streamExplain failed after {}ms: {}",
                            System.currentTimeMillis() - startMs, e.getMessage());
                        throw e;
                    }
                    log.warn("Coze streamExplain parse error after {}ms: {}",
                        System.currentTimeMillis() - startMs, e.getMessage());
                }
             }
         }
     }

     public String blockingExplain(String sourceCode,
                                   int currentStepIndex,
                                   int currentLine,
                                   String userQuestion,
                                   String sessionId,
                                   String intent) throws Exception {
        StringBuilder sb = new StringBuilder();
        streamExplain(sourceCode, null, currentStepIndex, currentLine,
            userQuestion, null, sessionId, intent, null, null, sb::append, null);
        return sb.toString();
     }

     /** 阻塞获取完整回答，附带步骤数据（animate 分支依赖 steps 生成 SVG）。 */
     public String blockingExplainWithSteps(String sourceCode,
                                            List<Map<String, Object>> steps,
                                            int currentStepIndex,
                                            int currentLine,
                                            String userQuestion,
                                            String sessionId,
                                            String intent,
                                            List<String> algorithmTags) throws Exception {
        StringBuilder sb = new StringBuilder();
        streamExplain(sourceCode, steps, currentStepIndex, currentLine,
            userQuestion, null, sessionId, intent, algorithmTags, null, sb::append, null);
        return sb.toString();
     }
 }
