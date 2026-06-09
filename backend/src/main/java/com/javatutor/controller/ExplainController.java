package com.javatutor.controller;

import com.javatutor.model.ExplainRequest;
import com.javatutor.service.AnalyzeService;
import com.javatutor.service.DeepSeekService;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.mvc.method.annotation.SseEmitter;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class ExplainController {

    private final DeepSeekService deepSeekService;
    private final AnalyzeService analyzeService;

    public ExplainController(DeepSeekService deepSeekService, AnalyzeService analyzeService) {
        this.deepSeekService = deepSeekService;
        this.analyzeService = analyzeService;
    }

    @PostMapping("/explain")
    public SseEmitter explain(@RequestBody ExplainRequest request) {
        SseEmitter emitter = new SseEmitter(120_000L);

        CompletableFuture.runAsync(() -> {
            try {
                deepSeekService.explainStream(
                    request.getCode(),
                    request.getStep(),
                    request.getTotalSteps(),
                    request.getCurrentLine(),
                    request.getVariables(),
                    chunk -> {
                        try {
                            emitter.send(SseEmitter.event()
                                    .name("chunk")
                                    .data(chunk));
                        } catch (IOException e) {
                            throw new RuntimeException("Client disconnected", e);
                        }
                    }
                );
                emitter.complete();
            } catch (Exception e) {
                try {
                    emitter.send(SseEmitter.event()
                            .name("error")
                            .data(e.getMessage() != null ? e.getMessage() : "AI 服务异常"));
                } catch (IOException ignored) {}
                emitter.completeWithError(e);
            }
        });

        return emitter;
    }

    @PostMapping("/analyze")
    public Map<String, Object> analyze(@RequestBody Map<String, String> request) {
        String code = request.get("code");
        if (code == null || code.isBlank()) {
            return Map.of("error", "代码不能为空");
        }
        try {
            return analyzeService.analyze(code);
        } catch (Exception e) {
            return Map.of("error", e.getMessage() != null ? e.getMessage() : "分析失败");
        }
    }
}
