package com.javatutor.analysis;

import com.javatutor.analysis.ProjectModel.TypeInfo;

import java.util.*;

/**
 * 生成结构图（包/类两级依赖图）。
 *
 * 输出结构对齐设计文档 §6.2 的 structure 契约：
 *   { packages: [{ id, classes: [全限定类名] }],
 *     dependencies: [{ from, to }] }
 * 依赖边基于类间依赖关系，跨包归并到包级。
 */
public class StructureGraphBuilder {

    private final ProjectModel model;

    public StructureGraphBuilder(ProjectModel model) {
        this.model = model;
    }

    public Map<String, Object> build() {
        Map<String, Object> structure = new LinkedHashMap<>();

        // 按包聚合类
        Map<String, List<String>> pkgClasses = new TreeMap<>();
        for (ProjectModel.TypeInfo t : model.types.values()) {
            String pkg = t.packageName.isEmpty() ? "(default)" : t.packageName;
            pkgClasses.computeIfAbsent(pkg, k -> new ArrayList<>()).add(t.qualifiedName);
        }

        List<Map<String, Object>> packages = new ArrayList<>();
        for (Map.Entry<String, List<String>> e : pkgClasses.entrySet()) {
            Collections.sort(e.getValue());
            Map<String, Object> p = new LinkedHashMap<>();
            p.put("id", e.getKey());
            p.put("classes", e.getValue());
            packages.add(p);
        }
        structure.put("packages", packages);

        // 类间依赖边
        Set<String> depKeys = new LinkedHashSet<>();
        List<Map<String, Object>> classDeps = new ArrayList<>();
        for (ProjectModel.TypeInfo t : model.types.values()) {
            for (String dep : t.dependencies) {
                ProjectModel.TypeInfo dt = model.findBySimpleName(simpleOf(dep), t.packageName);
                if (dt == null || dt.qualifiedName.equals(t.qualifiedName)) continue;
                String key = t.qualifiedName + "|" + dt.qualifiedName;
                if (depKeys.add(key)) {
                    Map<String, Object> d = new LinkedHashMap<>();
                    d.put("from", t.qualifiedName);
                    d.put("to", dt.qualifiedName);
                    classDeps.add(d);
                }
            }
        }
        structure.put("dependencies", classDeps);

        return structure;
    }

    private String simpleOf(String qualifiedOrSimple) {
        if (qualifiedOrSimple == null) return null;
        int idx = qualifiedOrSimple.lastIndexOf('.');
        return idx >= 0 ? qualifiedOrSimple.substring(idx + 1) : qualifiedOrSimple;
    }
}
