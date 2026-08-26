package com.javatutor.controller;

import com.javatutor.analysis.ProjectAnalysisService;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * 项目静态分析接口 — POST /api/project/analyze
 *
 * 请求：{ files: [{ path, code }] }
 * 响应：{ entry, flow, classDiagram, structure, errors }
 */
@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class ProjectController {

    private final ProjectAnalysisService analysisService;

    public ProjectController(ProjectAnalysisService analysisService) {
        this.analysisService = analysisService;
    }

    @PostMapping("/project/analyze")
    public Map<String, Object> analyze(@RequestBody Map<String, Object> request) {
        Object filesObj = request.get("files");
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> files = filesObj instanceof List
            ? (List<Map<String, Object>>) filesObj
            : List.of();

        return analysisService.analyze(files);
    }
}
