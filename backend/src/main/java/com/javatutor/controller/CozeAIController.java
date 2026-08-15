 package com.javatutor.controller;

 import com.fasterxml.jackson.databind.ObjectMapper;
 import com.javatutor.model.ExplainRequest;
 import com.javatutor.service.CozeService;
 import com.javatutor.service.AnalyzeService;
 import org.springframework.web.bind.annotation.*;
 import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

 import java.util.HashMap;
 import java.util.List;
 import java.util.Map;
 import java.util.concurrent.CompletableFuture;

 @RestController
 @RequestMapping("/api/ai")
 @CrossOrigin(origins = "*")
 public class CozeAIController {

     private final CozeService cozeService;
     private final AnalyzeService analyzeService;
     private final ObjectMapper objectMapper = new ObjectMapper();

     /**
      * Coze 智能体返回的 category 是中文长标签（如「排序算法」「线性表」），
      * 而前端 AiTutorPanel 的 TAG_COLORS 映射使用短标签（如「排序」「数组」）。
      * 这里做包含匹配归一化，使标签页配色符合现有设计风格；匹配不到则保留原值。
      */
     private static final String[][] ALGO_CATEGORY_RULES = {
         {"排序", "排序"}, {"搜索", "搜索"}, {"查找", "搜索"},
         {"递归", "递归"}, {"动态规划", "动态规划"}, {"贪心", "贪心"},
         {"分治", "分治"}, {"遍历", "遍历"}, {"其他", "其他"},
     };
     private static final String[][] DS_CATEGORY_RULES = {
         {"数组", "数组"}, {"链表", "链表"}, {"栈", "栈"}, {"队列", "队列"},
         {"树", "树"}, {"图", "图"}, {"哈希", "哈希表"}, {"堆", "堆"}, {"字符串", "字符串"},
         // 放在最后：Coze 常用上位概念「线性表」描述数组，且需先匹配更具体的链表等
         {"线性", "数组"},
     };

     public CozeAIController(CozeService cozeService, AnalyzeService analyzeService) {
         this.cozeService = cozeService;
         this.analyzeService = analyzeService;
     }

     /**
      * 自由问答 SSE — 逐步解说、概念问答、错误排查
      * 不传 intent，由 Coze route_intent 关键词路由
      */
     @PostMapping("/chat")
     public SseEmitter chat(@RequestBody ExplainRequest request) {
         SseEmitter emitter = new SseEmitter(120_000L);

         if (!cozeService.isEnabled()) {
             emitter.completeWithError(new IllegalStateException("Coze is disabled"));
             return emitter;
         }

         CompletableFuture.runAsync(() -> {
             try {
                 String question = request.getVariables() != null
                     ? String.valueOf(request.getVariables().getOrDefault("_explainTopic", ""))
                     : "";
                 if (question.isEmpty() || "null".equals(question)) {
                     question = request.getVariables() != null
                         ? buildFallbackQuestion(request)
                         : "请解释当前代码";
                 }

                 cozeService.streamExplain(
                     request.getCode(),
                     request.getSteps(),
                     request.getStep(),
                     request.getCurrentLine(),
                     question,
                     null,
                     request.getCode() != null
                         ? Integer.toHexString(request.getCode().hashCode()) : null,
                     null, // no intent → route_intent handles it
                     null, // no algorithmTags for chat
                     chunk -> {
                         try { emitter.send(SseEmitter.event().name("chunk").data(chunk)); }
                         catch (Exception e) { throw new RuntimeException(e); }
                     },
                     stage -> {
                         try { emitter.send(SseEmitter.event().name("stage").data(stage)); }
                         catch (Exception e) { throw new RuntimeException(e); }
                     }
                 );
                 emitter.complete();
             } catch (Exception e) {
                 try {
                     emitter.send(SseEmitter.event().name("error")
                         .data(e.getMessage() != null ? e.getMessage() : "AI error"));
                 } catch (Exception ignored) {}
                 emitter.completeWithError(e);
             }
         });

         return emitter;
     }

     private String buildFallbackQuestion(ExplainRequest request) {
         return String.format(
             "当前第 %d/%d 步，行 %d",
             request.getStep() + 1,
             request.getTotalSteps(),
             request.getCurrentLine()
         );
     }

     /**
      * 复杂度+标签 — 确定性入口，intent=analyze
      */
     @PostMapping("/analyze")
     public Map<String, Object> analyze(@RequestBody ExplainRequest request) {
         String code = request.getCode();
         if (code == null || code.isBlank()) {
             return Map.of("error", "Code cannot be empty");
         }

         if (!cozeService.isEnabled()) {
             try {
                 return analyzeService.analyze(code, request.getApiKey(),
                     request.getApiUrl(), request.getApiModel());
             } catch (Exception e) {
                 return Map.of("error",
                     e.getMessage() != null ? e.getMessage() : "Analysis failed");
             }
         }

         try {
             String sessionId = Integer.toHexString(code.hashCode());
             String answer = cozeService.blockingExplain(
                 code, 0, 0, "", sessionId, "analyze");

             @SuppressWarnings("unchecked")
             Map<String, Object> result = objectMapper.readValue(extractFirstJson(answer), Map.class);
             normalizeCategories(result);
             return result;
         } catch (Exception e) {
             return Map.of("error",
                 e.getMessage() != null ? e.getMessage() : "Coze analysis failed");
         }
     }

     /**
      * UML 图 — intent=uml，多文件 Java 源码生成 SVG
      * Coze 未启用或 kind 缺失时返回 success:false，前端回退静态图
      */
     @PostMapping("/uml")
     public Map<String, Object> uml(@RequestBody Map<String, Object> request) {
         String kind = request.get("kind") != null
             ? String.valueOf(request.get("kind")).trim() : "";

         if (kind.isBlank()) {
             return umlFailure("UML kind is required");
         }

         if (!cozeService.isEnabled()) {
             return umlFailure("Coze is disabled");
         }

         @SuppressWarnings("unchecked")
         List<Map<String, Object>> files = request.get("files") instanceof List
             ? (List<Map<String, Object>>) request.get("files")
             : List.of();

         String combinedCode = buildUmlCombinedCode(files);
         if (combinedCode.isBlank()) {
             return umlFailure("No source files provided");
         }

         try {
             String prompt = buildUmlPrompt(kind, files);
             String sessionId = Integer.toHexString(combinedCode.hashCode());
             String answer = cozeService.blockingExplain(
                 combinedCode, 0, 0, prompt, sessionId, "uml");

             String svg = extractSvg(answer);
             if (svg == null || svg.isBlank()) {
                 return umlFailure("Coze 未返回 SVG");
             }

             Map<String, Object> ok = new HashMap<>();
             ok.put("success", true);
             ok.put("svg", svg);
             ok.put("source", "ai");
             ok.put("ts", System.currentTimeMillis());
             return ok;
         } catch (Exception e) {
             return umlFailure(
                 e.getMessage() != null ? e.getMessage() : "UML generation failed");
         }
     }

     private Map<String, Object> umlFailure(String error) {
         Map<String, Object> out = new HashMap<>();
         out.put("success", false);
         out.put("error", error);
         out.put("source", "none");
         return out;
     }

     private String buildUmlCombinedCode(List<Map<String, Object>> files) {
         StringBuilder sb = new StringBuilder();
         for (Map<String, Object> file : files) {
             if (file == null) continue;
             String name = file.get("name") != null
                 ? String.valueOf(file.get("name")) : "unknown.java";
             String code = file.get("code") != null
                 ? String.valueOf(file.get("code")) : "";
             sb.append("// File: ").append(name).append('\n').append(code).append("\n\n");
         }
         String combined = sb.toString().trim();
         final int maxLen = 8000;
         if (combined.length() > maxLen) {
             return combined.substring(0, maxLen) + "\n// ... truncated";
         }
         return combined;
     }

     private String buildUmlPrompt(String kind, List<Map<String, Object>> files) {
         String kindLabel = switch (kind) {
             case "flow" -> "流程图 (flowchart)";
             case "dataflow" -> "数据流图 (data flow diagram)";
             case "structure" -> "结构图 (structure diagram)";
             case "class" -> "类图 (class diagram)";
             case "usecase" -> "用例图 (use case diagram)";
             default -> kind;
         };
         StringBuilder names = new StringBuilder();
         for (Map<String, Object> file : files) {
             if (file == null || file.get("name") == null) continue;
             if (names.length() > 0) names.append(", ");
             names.append(file.get("name"));
         }
         return String.format(
             "Generate ONLY a valid SVG %s for the following Java source file(s): %s. "
                 + "Return raw SVG starting with <svg>, no markdown fences, no explanation.",
             kindLabel, names.toString());
     }

     /** 从 Coze 回答中提取 SVG（支持代码围栏或夹杂文本）。 */
     private String extractSvg(String answer) {
         if (answer == null || answer.isBlank()) return null;
         String svg = answer.trim();
         if (!svg.startsWith("<svg")) {
             svg = svg.replaceAll("(?s)^```[a-zA-Z0-9]*\\s*", "")
                 .replaceAll("(?s)\\s*```$", "").trim();
         }
         int start = svg.indexOf("<svg");
         int end = svg.lastIndexOf("</svg>");
         if (start >= 0 && end > start) {
             return svg.substring(start, end + 6);
         }
         return svg.startsWith("<svg") ? svg : null;
     }

     /**
      * SVG 动画 — 确定性入口，intent=animate（显式声明，触发 coze 动画生成链）
      * 需要 steps 数据，coze animate_node 依赖 variables.arr 等生成动画
      */
     @PostMapping("/animate")
     public Map<String, Object> animate(@RequestBody ExplainRequest request) {
         String code = request.getCode();
         if (code == null || code.isBlank()) {
             return Map.of("error", "Code cannot be empty");
         }
         if (!cozeService.isEnabled()) {
             return Map.of("error", "Coze is disabled");
         }
         try {
             String sessionId = Integer.toHexString(code.hashCode());
             List<Map<String, Object>> steps = request.getSteps() != null
                 ? request.getSteps() : List.of();
             String answer = cozeService.blockingExplainWithSteps(
                 code, steps, request.getStep(),
                 request.getCurrentLine(), "", sessionId, "animate",
                 request.getAlgorithmTags());

             String svg = answer != null ? answer.trim() : "";
             if (svg.isEmpty()) {
                 return Map.of("error", "Coze 未返回动画内容");
             }
             if (!svg.startsWith("<svg")) {
                 // coze 偶发把 SVG 包进代码围栏，去掉围栏
                 svg = svg.replaceAll("(?s)^```[a-zA-Z0-9]*\\s*", "")
                     .replaceAll("(?s)\\s*```$", "").trim();
             }
             return Map.of("svg", svg);
         } catch (Exception e) {
             return Map.of("error",
                 e.getMessage() != null ? e.getMessage() : "Coze animation failed");
         }
     }

     /** 把 Coze 返回的长 category 归一化为前端 TAG_COLORS 认可的短标签。 */
     private void normalizeCategories(Map<String, Object> result) {
         normalizeList(result.get("algorithms"), ALGO_CATEGORY_RULES);
         normalizeList(result.get("dataStructures"), DS_CATEGORY_RULES);
     }

     @SuppressWarnings("unchecked")
     private void normalizeList(Object listObj, String[][] rules) {
         if (!(listObj instanceof java.util.List)) return;
         for (Object itemObj : (java.util.List<Object>) listObj) {
             if (!(itemObj instanceof Map)) continue;
             Map<String, Object> item = (Map<String, Object>) itemObj;
             Object categoryObj = item.get("category");
             if (!(categoryObj instanceof String)) continue;
             String category = (String) categoryObj;
             for (String[] rule : rules) {
                 if (category.contains(rule[0])) {
                     item.put("category", rule[1]);
                     break;
                 }
             }
         }
     }

     /**
      * Coze 智能体常把 JSON 包裹在 ```json 代码围栏里，或先输出围栏版再重复一遍
      * 纯文本版。这里从整段回答中提取第一个完整 JSON 对象再解析。
      */
     private String extractFirstJson(String answer) {
         if (answer == null || answer.isBlank()) {
             throw new IllegalArgumentException("Coze 返回内容为空");
         }
         int depth = 0;
         boolean inString = false;
         boolean escaped = false;
         int start = -1;
         char[] chars = answer.toCharArray();
         for (int i = 0; i < chars.length; i++) {
             char c = chars[i];
             if (inString) {
                 if (escaped) { escaped = false; }
                 else if (c == '\\') { escaped = true; }
                 else if (c == '"') { inString = false; }
                 continue;
             }
             if (c == '"') { inString = true; continue; }
             if (c == '{') {
                 if (depth == 0) start = i;
                 depth++;
             } else if (c == '}') {
                 depth--;
                 if (depth == 0 && start >= 0) {
                     return answer.substring(start, i + 1);
                 }
             }
         }
         throw new IllegalArgumentException("Coze 返回内容中未找到合法 JSON");
     }
 }
