package com.javatutor.analysis;

import java.util.*;

/**
 * 多文件项目静态分析的中间模型。
 *
 * 由 ProjectModelBuilder 解析全部 .java 文件构建，随后被
 * FlowGraphBuilder / ClassDiagramBuilder / StructureGraphBuilder 消费，
 * 产出三张图的结构化数据。
 */
public class ProjectModel {

    /** 解析成功的类型，key = 全限定名（如 com.demo.Main） */
    public final Map<String, TypeInfo> types = new LinkedHashMap<>();

    /** 每个类型的原始源码，key = 全限定名（供流程图按类重新解析出图） */
    public final Map<String, String> sourceByQualifiedName = new LinkedHashMap<>();

    /** 解析失败的文件清单：{path, message} */
    public final List<Map<String, String>> errors = new ArrayList<>();

    /** 入口类全限定名（含 main 的类优先，否则第一个可解析类） */
    public String entryClass;

    /** 入口方法名（默认 main） */
    public String entryMethod = "main";

    /** 类型信息 */
    public static class TypeInfo {
        public String name;              // 短名，如 Main
        public String qualifiedName;     // 全限定名，如 com.demo.Main
        public String packageName;       // 包名，如 com.demo（可能为空）
        public String kind;              // class / interface / enum

        public final List<FieldInfo> fields = new ArrayList<>();
        public final List<MethodInfo> methods = new ArrayList<>();

        public String superClass;                       // 直接父类全限定名（尽力解析，可能为 null）
        public final List<String> interfaces = new ArrayList<>(); // 实现的接口全限定名
        public final Set<String> dependencies = new LinkedHashSet<>(); // 依赖的其他类型全限定名
    }

    /** 字段信息 */
    public static class FieldInfo {
        public String name;
        public String type;  // 类型短名或全限定名（尽力）
        public boolean isStatic;
        public String visibility; // + public / - private / # protected / ~ package

        public FieldInfo(String name, String type) {
            this.name = name;
            this.type = type;
        }
    }

    /** 方法信息 */
    public static class MethodInfo {
        public String name;
        public String returnType;
        public boolean isStatic;
        public boolean isPublic;
        public String visibility; // + public / - private / # protected / ~ package

        public final List<String> paramTypes = new ArrayList<>();
        public final List<String> paramNames = new ArrayList<>();
        public final List<String> calledMethods = new ArrayList<>();   // 方法体内调用的方法短名
        public final List<String> callTargets = new ArrayList<>();     // 解析后的调用目标："全限定类名:方法名"（外部类为短名:方法名）
        public final Set<String> referencedTypes = new LinkedHashSet<>(); // 方法体内引用的类型短名
    }

    /** 按短名查找类型（同包优先，用于依赖解析兜底） */
    public TypeInfo findBySimpleName(String simpleName, String currentPackage) {
        // 优先同包匹配
        for (TypeInfo t : types.values()) {
            if (t.name.equals(simpleName) && Objects.equals(t.packageName, currentPackage)) {
                return t;
            }
        }
        // 退化为唯一短名匹配
        TypeInfo found = null;
        for (TypeInfo t : types.values()) {
            if (t.name.equals(simpleName)) {
                if (found != null) return null; // 多个同名，无法唯一确定
                found = t;
            }
        }
        return found;
    }
}
