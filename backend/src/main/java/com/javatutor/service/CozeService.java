 package com.javatutor.service;

 import com.fasterxml.jackson.databind.JsonNode;
 import com.fasterxml.jackson.databind.ObjectMapper;
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

     private final HttpClient httpClient = HttpClient.newHttpClient();
     private final ObjectMapper objectMapper = new ObjectMapper();

     public boolean isEnabled() {
         return enabled && apiToken != null && !apiToken.isBlank()
             && !apiToken.startsWith("${");
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
                               Consumer<String> onChunk,
                               Consumer<String> onStage) throws Exception {

         if (!isEnabled()) {
             throw new IllegalStateException("Coze is disabled.");
         }

         Map<String, Object> agentPayload = new LinkedHashMap<>();
         agentPayload.put("source_code", sourceCode);
         agentPayload.put("steps", steps != null ? steps : List.of());
         agentPayload.put("current_step_index", currentStepIndex);
         agentPayload.put("current_line", currentLine);
         agentPayload.put("user_question", userQuestion != null ? userQuestion : "");
         agentPayload.put("user_id", sessionId);
         agentPayload.put("compile_error", compileError != null ? compileError : "");

         if (intent != null && !intent.isBlank()) {
             agentPayload.put("intent", intent);
         }
         if (algorithmTags != null && !algorithmTags.isEmpty()) {
             agentPayload.put("algorithm_tags", algorithmTags);
         }

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
                    }
                } catch (Exception e) {
                     if (e instanceof RuntimeException re
                         && re.getMessage().startsWith("Coze")) throw e;
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
            userQuestion, null, sessionId, intent, null, sb::append, null);
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
            userQuestion, null, sessionId, intent, algorithmTags, sb::append, null);
        return sb.toString();
     }
 }
