package com.javatutor.analysis;

import org.springframework.stereotype.Service;

import java.util.*;

/**
 * 项目静态分析编排：规模校验 → 解析建模 → 三张图生成。
 */
@Service
public class ProjectAnalysisService {

    // 规模限制（前后端双重校验）
    public static final int MAX_FILES = 50;
    public static final int MAX_TOTAL_BYTES = 2 * 1024 * 1024;
    public static final int MAX_SINGLE_BYTES = 500 * 1024;

    public Map<String, Object> analyze(List<Map<String, Object>> files) {
        // 规模校验
        Map<String, Object> sizeError = validateSize(files);
        if (sizeError != null) return sizeError;

        ProjectModel model = new ProjectModel();
        ProjectModelBuilder builder = new ProjectModelBuilder();

        for (Map<String, Object> file : files) {
            if (file == null) continue;
            String path = file.get("path") != null
                ? String.valueOf(file.get("path"))
                : (file.get("name") != null ? String.valueOf(file.get("name")) : "unknown.java");
            String code = file.get("code") != null ? String.valueOf(file.get("code")) : "";
            builder.addFile(model, path, code);
        }

        builder.resolveEntry(model);
        builder.resolveCallTargets(model);

        Map<String, Object> result = new LinkedHashMap<>();

        // entry
        Map<String, Object> entry = new LinkedHashMap<>();
        entry.put("class", model.entryClass);
        entry.put("method", model.entryMethod);
        result.put("entry", entry);

        result.put("flow", new FlowGraphBuilder(model).build());
        result.put("callGraph", new CallGraphBuilder(model).build());
        result.put("classDiagram", new ClassDiagramBuilder(model).build());
        result.put("structure", new StructureGraphBuilder(model).build());
        result.put("errors", model.errors);

        return result;
    }

    /** 校验规模，超限返回 error 结果，否则返回 null */
    private Map<String, Object> validateSize(List<Map<String, Object>> files) {
        if (files == null || files.isEmpty()) {
            return error("项目不能为空，请先上传 .java 文件");
        }
        if (files.size() > MAX_FILES) {
            return error("文件数量超过上限（最多 " + MAX_FILES + " 个 .java 文件）");
        }
        long total = 0;
        for (Map<String, Object> file : files) {
            if (file == null) continue;
            String code = file.get("code") != null ? String.valueOf(file.get("code")) : "";
            int bytes = code.getBytes(java.nio.charset.StandardCharsets.UTF_8).length;
            if (bytes > MAX_SINGLE_BYTES) {
                String name = file.get("path") != null ? String.valueOf(file.get("path"))
                    : (file.get("name") != null ? String.valueOf(file.get("name")) : "未知文件");
                return error("文件「" + name + "」超过单文件大小上限（500KB）");
            }
            total += bytes;
        }
        if (total > MAX_TOTAL_BYTES) {
            return error("项目总大小超过上限（2MB）");
        }
        return null;
    }

    private Map<String, Object> error(String message) {
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("success", false);
        out.put("error", message);
        return out;
    }
}
