package com.javatutor.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Consumer;

@Service
public class DeepSeekService {

    @Value("${deepseek.api.key}")
    private String apiKey;

    @Value("${deepseek.api.url}")
    private String apiUrl;

    @Value("${deepseek.api.model}")
    private String model;

    private final HttpClient httpClient = HttpClient.newHttpClient();
    private final ObjectMapper objectMapper = new ObjectMapper();

    private static final java.util.regex.Pattern SAFE_KEY = java.util.regex.Pattern.compile("^[a-zA-Z0-9\\-_.]{1,128}$");

    public void explainStream(String code, int step, int totalSteps,
                              int currentLine, Map<String, Object> variables,
                              Consumer<String> onChunk) throws IOException, InterruptedException {
        explainStream(code, step, totalSteps, currentLine, variables, onChunk, null);
    }

    public void explainStream(String code, int step, int totalSteps,
                              int currentLine, Map<String, Object> variables,
                              Consumer<String> onChunk, String userApiKey) throws IOException, InterruptedException {

        List<Map<String, String>> messages = buildMessages(code, step, totalSteps, currentLine, variables);

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", model);
        body.put("messages", messages);
        body.put("stream", true);
        body.put("temperature", 0.7);
        body.put("max_tokens", 512);

        String jsonBody = objectMapper.writeValueAsString(body);

        String effectiveKey = resolveKey(userApiKey);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(apiUrl))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + effectiveKey)
                .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
                .build();

        HttpResponse<java.io.InputStream> response = httpClient.send(request,
                HttpResponse.BodyHandlers.ofInputStream());

        int status = response.statusCode();
        if (status != 200) {
            byte[] errorBytes = response.body().readAllBytes();
            System.err.println("DeepSeek API error " + status + ": " + new String(errorBytes, StandardCharsets.UTF_8));
            throw new IOException("API 调用失败 (HTTP " + status + ")，请检查 API Key 是否正确");
        }

        try (BufferedReader reader = new BufferedReader(
                new InputStreamReader(response.body(), StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                if (!line.startsWith("data: ")) continue;
                String data = line.substring(6).trim();
                if ("[DONE]".equals(data)) break;
                try {
                    JsonNode node = objectMapper.readTree(data);
                    JsonNode content = node.at("/choices/0/delta/content");
                    if (!content.isNull() && !content.asText().isEmpty()) {
                        onChunk.accept(content.asText());
                    }
                } catch (Exception ignored) {
                    // skip malformed JSON lines
                }
            }
        }
    }

    private List<Map<String, String>> buildMessages(String code, int step, int totalSteps,
                                                     int currentLine, Map<String, Object> variables) {
        List<Map<String, String>> messages = new ArrayList<>();

        Map<String, String> systemMsg = new LinkedHashMap<>();
        systemMsg.put("role", "system");
        systemMsg.put("content",
            "你是一个Java算法可视化教学助手。根据当前步骤的变量状态和代码行，用中文解释发生了什么。\n" +
            "风格要求：\n" +
            "- 严格控制在1-2句话，像注释一样精炼\n" +
            "- 直接说变量值和操作，不铺垫、不总结、不展望\n" +
            "- 禁止感叹号，禁止'很好！''没错！'等口头禅，禁止'程序很快就要结束了'等多余话\n" +
            "- 必须优先基于「当前高亮行」的源代码来解释，不要仅凭变量值推测\n" +
            "- 即使是System.out.println或空行，也要如实说明\n" +
            "- 语气冷静客观，不要用'现在'、'当前'等冗余时间词\n" +
            "- 可以适度使用**加粗**突出关键变量值"
        );
        messages.add(systemMsg);

        String varsStr;
        try {
            varsStr = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(variables);
        } catch (Exception e) {
            varsStr = String.valueOf(variables);
        }

        // Check if there's a topic tag to explain
        Object topicObj = variables.get("_explainTopic");
        String topic = (topicObj instanceof String && !((String) topicObj).isEmpty()) ? (String) topicObj : null;

        Map<String, String> userMsg = new LinkedHashMap<>();
        userMsg.put("role", "user");
        StringBuilder content = new StringBuilder();
        content.append("当前算法代码：\n```java\n").append(code).append("\n```\n\n");
        if (topic != null) {
            content.append("用户点击了「").append(topic).append("」标签，想了解这个算法/数据结构。请用2-3句话简介：它是什么，在这段代码中起什么作用。\n");
        } else {
            // Extract the current line's source text so the AI knows exactly what code is executing
            String lineText = extractLine(code, currentLine);
            content.append("当前执行进度：第 ").append(step + 1).append(" / ").append(totalSteps).append(" 步\n");
            content.append("当前高亮行(第").append(currentLine).append("行)：`").append(lineText).append("`\n");
            content.append("当前变量状态：\n").append(varsStr).append("\n\n");
            content.append("优先解释当前这一行代码在做什么，再补充变量变化。用一两句话。");
        }
        userMsg.put("content", content.toString());
        messages.add(userMsg);

        return messages;
    }

    private String extractLine(String code, int lineNumber) {
        String[] lines = code.split("\n");
        if (lineNumber > 0 && lineNumber <= lines.length) {
            return lines[lineNumber - 1].trim();
        }
        return "(未知)";
    }

    private String resolveKey(String userApiKey) {
        if (userApiKey != null && !userApiKey.isBlank()) {
            if (!SAFE_KEY.matcher(userApiKey).matches()) {
                throw new IllegalArgumentException("API Key 格式无效，仅允许字母、数字、连字符、下划线和点号，长度 1-128");
            }
            return userApiKey;
        }
        return apiKey;
    }
}
