package com.javatutor.analysis;

import com.javatutor.analysis.ProjectModel.TypeInfo;

import java.util.*;

/**
 * 生成类图：类、字段、方法，以及继承/实现/依赖关系。
 *
 * 输出结构对齐设计文档 §6.2 的 classDiagram 契约：
 *   { classes: [{ id, label, fields, methods }],
 *     relations: [{ from, to, type }] }
 * relation.type ∈ extends | implements | depends_on
 */
public class ClassDiagramBuilder {

    private final ProjectModel model;

    public ClassDiagramBuilder(ProjectModel model) {
        this.model = model;
    }

    public Map<String, Object> build() {
        Map<String, Object> diagram = new LinkedHashMap<>();
        List<Map<String, Object>> classes = new ArrayList<>();
        List<Map<String, Object>> relations = new ArrayList<>();

        for (ProjectModel.TypeInfo t : model.types.values()) {
            Map<String, Object> cls = new LinkedHashMap<>();
            cls.put("id", t.qualifiedName);
            cls.put("label", t.name);
            cls.put("kind", t.kind);
            cls.put("package", t.packageName);

            List<String> fields = new ArrayList<>();
            for (ProjectModel.FieldInfo f : t.fields) {
                String vis = f.visibility != null ? f.visibility : "~";
                fields.add(vis + " " + f.name + ": " + f.type);
            }
            cls.put("fields", fields);

            List<String> methods = new ArrayList<>();
            for (ProjectModel.MethodInfo m : t.methods) {
                String vis = m.visibility != null ? m.visibility : "~";
                String sig = vis + " " + m.name + "(" + String.join(", ", m.paramTypes) + ")"
                    + (m.returnType != null ? ": " + m.returnType : "");
                methods.add(sig);
            }
            cls.put("methods", methods);

            classes.add(cls);

            // 继承
            if (t.superClass != null && !t.superClass.equals("Object")) {
                ProjectModel.TypeInfo sup = model.findBySimpleName(simpleOf(t.superClass), t.packageName);
                if (sup != null) {
                    relations.add(relation(t.qualifiedName, sup.qualifiedName, "extends"));
                }
            }
            // 实现
            for (String in : t.interfaces) {
                ProjectModel.TypeInfo itf = model.findBySimpleName(simpleOf(in), t.packageName);
                if (itf != null) {
                    relations.add(relation(t.qualifiedName, itf.qualifiedName, "implements"));
                }
            }
            // 依赖（关联/依赖统一按 depends_on）
            for (String dep : t.dependencies) {
                ProjectModel.TypeInfo dt = model.findBySimpleName(simpleOf(dep), t.packageName);
                if (dt != null && !dt.qualifiedName.equals(t.qualifiedName)) {
                    relations.add(relation(t.qualifiedName, dt.qualifiedName, "depends_on"));
                }
            }
        }

        diagram.put("classes", classes);
        diagram.put("relations", dedupe(relations));
        return diagram;
    }

    private Map<String, Object> relation(String from, String to, String type) {
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("from", from);
        r.put("to", to);
        r.put("type", type);
        return r;
    }

    private String simpleOf(String qualifiedOrSimple) {
        if (qualifiedOrSimple == null) return null;
        int idx = qualifiedOrSimple.lastIndexOf('.');
        return idx >= 0 ? qualifiedOrSimple.substring(idx + 1) : qualifiedOrSimple;
    }

    private List<Map<String, Object>> dedupe(List<Map<String, Object>> relations) {
        Set<String> seen = new LinkedHashSet<>();
        List<Map<String, Object>> out = new ArrayList<>();
        for (Map<String, Object> r : relations) {
            String key = r.get("from") + "|" + r.get("to") + "|" + r.get("type");
            if (seen.add(key)) out.add(r);
        }
        return out;
    }
}
