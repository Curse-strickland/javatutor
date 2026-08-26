package com.javatutor.analysis;

import com.github.javaparser.StaticJavaParser;
import com.github.javaparser.ast.CompilationUnit;
import com.github.javaparser.ast.ImportDeclaration;
import com.github.javaparser.ast.NodeList;
import com.github.javaparser.ast.body.*;
import com.github.javaparser.ast.expr.*;
import com.github.javaparser.ast.nodeTypes.NodeWithModifiers;
import com.github.javaparser.ast.type.ClassOrInterfaceType;
import com.github.javaparser.ast.type.Type;
import com.javatutor.analysis.ProjectModel.TypeInfo;
import com.javatutor.analysis.ProjectModel.MethodInfo;
import com.javatutor.analysis.ProjectModel.FieldInfo;

import java.util.*;

/**
 * 解析全部 .java 文件，构建 {@link ProjectModel}。
 *
 * 尽力而为：单个文件解析失败仅记录到 errors，不影响其他文件。
 * 依赖解析：类型引用（字段/参数/返回值/局部变量/继承/实现/方法调用）按
 * 全限定名或短名归类到 dependencies / referencedTypes。
 */
public class ProjectModelBuilder {

    /** 每个文件独立解析，失败隔离 */
    public void addFile(ProjectModel model, String path, String code) {
        try {
            CompilationUnit cu = StaticJavaParser.parse(code);
            String packageName = cu.getPackageDeclaration()
                .map(pd -> pd.getNameAsString())
                .orElse("");

            Map<String, String> importMap = buildImportMap(cu, packageName);

            for (TypeDeclaration<?> td : cu.getTypes()) {
                TypeInfo info = buildType(td, packageName, importMap);
                if (info != null) {
                    model.types.putIfAbsent(info.qualifiedName, info);
                    model.sourceByQualifiedName.put(info.qualifiedName, code);
                }
            }
        } catch (Exception e) {
            Map<String, String> err = new LinkedHashMap<>();
            err.put("path", path);
            err.put("message", e.getMessage() != null ? e.getMessage() : "解析失败");
            model.errors.add(err);
        }
    }

    /** 解析完成后确定入口类与方法 */
    public void resolveEntry(ProjectModel model) {
        // 优先含 main(String[]) 的类
        for (TypeInfo t : model.types.values()) {
            for (MethodInfo m : t.methods) {
                if (m.name.equals("main") && m.paramTypes.size() == 1
                    && (m.paramTypes.get(0).equals("String[]") || m.paramTypes.get(0).equals("String..."))) {
                    model.entryClass = t.qualifiedName;
                    model.entryMethod = "main";
                    return;
                }
            }
        }
        // 退化为第一个可解析类的第一个方法
        if (!model.types.isEmpty()) {
            TypeInfo first = model.types.values().iterator().next();
            model.entryClass = first.qualifiedName;
            model.entryMethod = first.methods.isEmpty() ? "main" : first.methods.get(0).name;
        }
    }

    /**
     * 模型建全后解析方法调用目标：把 calledMethods 短名映射为
     * 「全限定类名:方法名」或「方法名」（无法唯一确定时），供调用关系图使用。
     */
    public void resolveCallTargets(ProjectModel model) {
        // 建 方法短名 → 所属类型 列表 索引
        Map<String, List<TypeInfo>> methodOwners = new LinkedHashMap<>();
        for (TypeInfo t : model.types.values()) {
            for (MethodInfo m : t.methods) {
                methodOwners.computeIfAbsent(m.name, k -> new ArrayList<>()).add(t);
            }
        }

        for (TypeInfo t : model.types.values()) {
            for (MethodInfo m : t.methods) {
                for (String called : m.calledMethods) {
                    m.callTargets.add(resolveTarget(t, called, methodOwners));
                }
            }
        }
    }

    /** 解析单个调用：同包/同类型优先，唯一确定时给全限定类名，否则短名 */
    private String resolveTarget(TypeInfo owner, String methodName, Map<String, List<TypeInfo>> owners) {
        List<TypeInfo> candidates = owners.get(methodName);
        if (candidates == null || candidates.isEmpty()) return methodName;

        // 优先同包匹配
        List<TypeInfo> samePkg = candidates.stream()
            .filter(c -> Objects.equals(c.packageName, owner.packageName))
            .toList();
        if (samePkg.size() == 1) return samePkg.get(0).qualifiedName + ":" + methodName;

        // 唯一候选
        if (candidates.size() == 1) return candidates.get(0).qualifiedName + ":" + methodName;

        // 多个候选且无法唯一确定 → 短名
        return methodName;
    }

    // ---- 类型构建 ----

    private TypeInfo buildType(TypeDeclaration<?> td, String packageName, Map<String, String> importMap) {
        String shortName = td.getNameAsString();
        String qualified = packageName.isEmpty() ? shortName : packageName + "." + shortName;

        String kind = td.isClassOrInterfaceDeclaration()
            ? (td.asClassOrInterfaceDeclaration().isInterface() ? "interface" : "class")
            : (td.isEnumDeclaration() ? "enum" : "class");

        TypeInfo info = new TypeInfo();
        info.name = shortName;
        info.qualifiedName = qualified;
        info.packageName = packageName;
        info.kind = kind;

        if (td.isClassOrInterfaceDeclaration()) {
            ClassOrInterfaceDeclaration cd = td.asClassOrInterfaceDeclaration();
            cd.getExtendedTypes().forEach(t -> {
                info.superClass = resolveTypeName(t, importMap, packageName);
                addDependency(info, info.superClass);
            });
            cd.getImplementedTypes().forEach(t -> {
                String in = resolveTypeName(t, importMap, packageName);
                info.interfaces.add(in);
                addDependency(info, in);
            });
        }

        // 字段
        for (FieldDeclaration fd : td.getFields()) {
            for (VariableDeclarator vd : fd.getVariables()) {
                String typeName = resolveTypeName(fd.getElementType(), importMap, packageName);
                FieldInfo fi = new FieldInfo(vd.getNameAsString(), typeName);
                fi.isStatic = fd.isStatic();
                fi.visibility = visibilityOf(fd);
                info.fields.add(fi);
                addDependency(info, typeName);
            }
        }

        // 方法
        for (MethodDeclaration md : td.getMethods()) {
            info.methods.add(buildMethod(md, importMap, packageName, info));
        }

        // 构造函数也纳入依赖分析（类型引用）
        for (ConstructorDeclaration ctor : td.getConstructors()) {
            ctor.getParameters().forEach(p -> {
                String tn = resolveTypeName(p.getType(), importMap, packageName);
                addDependency(info, tn);
            });
            for (MethodCallExpr call : ctor.findAll(MethodCallExpr.class)) {
                addDependency(info, call.getNameAsString());
            }
        }

        return info;
    }

    private MethodInfo buildMethod(MethodDeclaration md, Map<String, String> importMap,
                                   String packageName, TypeInfo owner) {
        MethodInfo mi = new MethodInfo();
        mi.name = md.getNameAsString();
        mi.returnType = resolveTypeName(md.getType(), importMap, packageName);
        mi.isStatic = md.isStatic();
        mi.isPublic = md.isPublic();
        mi.visibility = visibilityOf(md);

        for (Parameter p : md.getParameters()) {
            String tn = resolveTypeName(p.getType(), importMap, packageName);
            mi.paramTypes.add(tn);
            mi.paramNames.add(p.getNameAsString());
            addDependency(owner, tn);
        }
        addDependency(owner, mi.returnType);

        // 方法体内的方法调用与类型引用
        md.getBody().ifPresent(body -> {
            for (MethodCallExpr call : body.findAll(MethodCallExpr.class)) {
                mi.calledMethods.add(call.getNameAsString());
            }
            for (ObjectCreationExpr oc : body.findAll(ObjectCreationExpr.class)) {
                mi.referencedTypes.add(oc.getType().getNameAsString());
                addDependency(owner, oc.getType().getNameAsString());
            }
            for (VariableDeclarator vd : body.findAll(VariableDeclarator.class)) {
                mi.referencedTypes.add(vd.getType().asString());
                addDependency(owner, vd.getType().asString());
            }
        });

        return mi;
    }

    // ---- 类型解析 ----

    /** 尽力把类型表达式解析为全限定名或短名 */
    private String resolveTypeName(Type type, Map<String, String> importMap, String packageName) {
        if (type == null) return null;
        String raw = type.toString();
        // 泛型 / 数组简化：取最外层基础类型名
        if (type.isClassOrInterfaceType()) {
            ClassOrInterfaceType cit = type.asClassOrInterfaceType();
            String base = cit.getNameAsString();
            // 已带包名（如 java.util.List）
            if (base.contains(".")) return base;
            String imported = importMap.get(base);
            if (imported != null) return imported;
            return base;
        }
        if (type.isArrayType()) {
            return type.asArrayType().getComponentType().asString() + "[]";
        }
        if (type.isPrimitiveType() || type.isVoidType()) {
            return raw;
        }
        return raw;
    }

    private void addDependency(TypeInfo info, String typeName) {
        if (typeName == null || typeName.isBlank()) return;
        String t = typeName.replace("[]", "").trim();
        // 排除自身与 Java 内置类型
        if (t.equals(info.name) || t.equals(info.qualifiedName)) return;
        if (t.startsWith("java.lang.") || isPrimitive(t)) return;
        info.dependencies.add(t);
    }

    private boolean isPrimitive(String t) {
        return Set.of("int", "long", "double", "float", "boolean", "char", "byte", "short", "void", "String")
            .contains(t);
    }

    /** 提取可见性符号：+ public / - private / # protected / ~ package */
    private String visibilityOf(NodeWithModifiers<?> node) {
        com.github.javaparser.ast.AccessSpecifier as = node.getAccessSpecifier();
        if (as == com.github.javaparser.ast.AccessSpecifier.PUBLIC) return "+";
        if (as == com.github.javaparser.ast.AccessSpecifier.PRIVATE) return "-";
        if (as == com.github.javaparser.ast.AccessSpecifier.PROTECTED) return "#";
        return "~";
    }

    /** 构建 import 短名 → 全限定名映射 */
    private Map<String, String> buildImportMap(CompilationUnit cu, String packageName) {
        Map<String, String> map = new HashMap<>();
        for (ImportDeclaration imp : cu.getImports()) {
            if (imp.isAsterisk()) continue;
            String fq = imp.getNameAsString();
            String simple = fq.substring(fq.lastIndexOf('.') + 1);
            map.put(simple, fq);
        }
        return map;
    }
}
