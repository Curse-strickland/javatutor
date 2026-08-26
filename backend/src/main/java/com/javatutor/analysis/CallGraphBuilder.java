package com.javatutor.analysis;

import java.util.*;

/**
 * 生成项目级调用关系图（call graph），展示跨文件方法调用。
 *
 * 输出结构：
 *   { classes: [{ name, methods: [{ name, calls: ["全限定类名:方法名"] }] }] }
 * 前端据此渲染：方法节点按类分组，调用边跨类连接，
 * 能直观看出「哪个文件的哪个方法调用了哪个文件的哪个方法」。
 */
public class CallGraphBuilder {

    private final ProjectModel model;

    public CallGraphBuilder(ProjectModel model) {
        this.model = model;
    }

    public Map<String, Object> build() {
        Map<String, Object> callGraph = new LinkedHashMap<>();
        List<Map<String, Object>> classes = new ArrayList<>();

        for (ProjectModel.TypeInfo type : model.types.values()) {
            Map<String, Object> cls = new LinkedHashMap<>();
            cls.put("name", type.qualifiedName);

            List<Map<String, Object>> methods = new ArrayList<>();
            for (ProjectModel.MethodInfo m : type.methods) {
                Map<String, Object> mm = new LinkedHashMap<>();
                mm.put("name", m.name);
                List<String> calls = new ArrayList<>();
                for (String target : m.callTargets) {
                    if (!calls.contains(target)) calls.add(target);
                }
                mm.put("calls", calls);
                methods.add(mm);
            }

            cls.put("methods", methods);
            classes.add(cls);
        }

        callGraph.put("classes", classes);
        return callGraph;
    }
}
