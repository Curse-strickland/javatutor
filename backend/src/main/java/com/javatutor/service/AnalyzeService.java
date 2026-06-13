package com.javatutor.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class AnalyzeService {

    @Value("${deepseek.api.url}")
    private String apiUrl;

    @Value("${deepseek.api.model}")
    private String model;

    @Value("${deepseek.api.key}")
    private String defaultKey;

    private final HttpClient httpClient = HttpClient.newHttpClient();
    private final ObjectMapper objectMapper = new ObjectMapper();

    private static final java.util.regex.Pattern SAFE_KEY = java.util.regex.Pattern.compile("^[a-zA-Z0-9\\-_.]{1,128}$");

    public Map<String, Object> analyze(String code) throws IOException, InterruptedException {
        return analyze(code, null);
    }

    public Map<String, Object> analyze(String code, String userApiKey) throws IOException, InterruptedException {

        String effectiveKey = (userApiKey != null && !userApiKey.isBlank())
                ? userApiKey : defaultKey;
        if (!SAFE_KEY.matcher(effectiveKey).matches())
            throw new IllegalArgumentException("API Key 格式无效");

        String systemPrompt =
            "你是一个算法分析专家。分析以下Java代码，返回严格的JSON（只返回JSON，不要markdown代码块，不要任何其他文字）：\n" +
            "{\n" +
            "  \"complexity\": {\n" +
            "    \"time\": \"O(…)\",\n" +
            "    \"timeExplanation\": \"一句话解释为什么是这个时间复杂度\",\n" +
            "    \"space\": \"O(…)\",\n" +
            "    \"spaceExplanation\": \"一句话解释为什么是这个空间复杂度\"\n" +
            "  },\n" +
            "  \"algorithms\": [\n" +
            "    {\"name\": \"算法名\", \"category\": \"排序/搜索/递归/动态规划/贪心/分治/遍历/其他\"}\n" +
            "  ],\n" +
            "  \"dataStructures\": [\n" +
            "    {\"name\": \"结构名\", \"category\": \"数组/链表/栈/队列/树/图/哈希表/堆/字符串/其他\"}\n" +
            "  ]\n" +
            "}\n" +
            "注意：algorithms和dataStructures的category必须是给出的选项之一。每个数组至少包含一个元素。";

        String userPrompt = "请分析以下Java代码：\n```java\n" + code + "\n```";

        List<Map<String, String>> messages = List.of(
            mapOf("role", "system", "content", systemPrompt),
            mapOf("role", "user", "content", userPrompt)
        );

        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", model);
        body.put("messages", messages);
        body.put("stream", false);
        body.put("temperature", 0.3);
        body.put("max_tokens", 1024);

        String jsonBody = objectMapper.writeValueAsString(body);

        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(apiUrl))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + effectiveKey)
                .POST(HttpRequest.BodyPublishers.ofString(jsonBody))
                .build();

        HttpResponse<java.io.InputStream> response = httpClient.send(request,
                HttpResponse.BodyHandlers.ofInputStream());

        byte[] responseBytes = response.body().readAllBytes();
        int status = response.statusCode();
        if (status != 200) {
            System.err.println("AI API error " + status + ": " + new String(responseBytes, StandardCharsets.UTF_8));
            throw new IOException("API 调用失败 (HTTP " + status + ")" +
                (effectiveKey != null ? "，请检查 API Key 是否正确" : "，匿名 AI 服务暂不可用，请稍后重试或配置 API Key"));
        }

        String raw = new String(responseBytes, StandardCharsets.UTF_8);
        JsonNode root = objectMapper.readTree(raw);
        String content = root.at("/choices/0/message/content").asText();

        // Extract JSON from response (may be wrapped in markdown)
        String json = content.trim();
        int jsonStart = json.indexOf("{");
        int jsonEnd = json.lastIndexOf("}");
        if (jsonStart >= 0 && jsonEnd > jsonStart) {
            json = json.substring(jsonStart, jsonEnd + 1);
        }

        @SuppressWarnings("unchecked")
        Map<String, Object> result = objectMapper.readValue(json, Map.class);
        return result;
    }

    private Map<String, String> mapOf(String k1, String v1, String k2, String v2) {
        Map<String, String> m = new LinkedHashMap<>();
        m.put(k1, v1);
        m.put(k2, v2);
        return m;
    }

}
