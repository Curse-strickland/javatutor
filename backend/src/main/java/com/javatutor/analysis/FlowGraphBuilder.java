package com.javatutor.analysis;

import com.github.javaparser.StaticJavaParser;
import com.github.javaparser.ast.CompilationUnit;
import com.github.javaparser.ast.body.MethodDeclaration;
import com.github.javaparser.ast.expr.MethodCallExpr;
import com.github.javaparser.ast.stmt.*;
import com.javatutor.analysis.ProjectModel.TypeInfo;

import java.util.*;

/**
 * 按「每个类、每个方法」生成流程图，支持跨文件调用跳转。
 *
 * 输出结构对齐设计文档 §6.2 的 flow 契约：
 *   { classes: [{ name, methods: [{ name, nodes, edges, targets }] }] }
 * 方法调用 target 使用「全限定类名:方法名」（若能解析）或「方法名」。
 */
public class FlowGraphBuilder {

    private final ProjectModel model;

    public FlowGraphBuilder(ProjectModel model) {
        this.model = model;
    }

    public Map<String, Object> build() {
        Map<String, Object> flow = new LinkedHashMap<>();
        List<Map<String, Object>> classes = new ArrayList<>();

        for (ProjectModel.TypeInfo type : model.types.values()) {
            String code = model.sourceByQualifiedName.get(type.qualifiedName);
            if (code == null) continue;
            try {
                CompilationUnit cu = StaticJavaParser.parse(code);
                Map<String, Object> cls = new LinkedHashMap<>();
                cls.put("name", type.qualifiedName);
                List<Map<String, Object>> methods = new ArrayList<>();

                for (MethodDeclaration md : cu.findAll(MethodDeclaration.class)) {
                    if (md.getBody().isEmpty()) continue;
                    MethodCtx ctx = new MethodCtx(type);
                    String entryId = ctx.addNode("entry",
                        md.getDeclarationAsString(false, false, false),
                        md.getBegin().map(p -> p.line).orElse(1));
                    String bodyEnd = traverseBlock(md.getBody().get(), entryId, ctx);
                    if (bodyEnd != null) {
                        String exitId = ctx.addNode("exit", "return", -1);
                        ctx.addEdge(bodyEnd, exitId, "");
                    }

                    Map<String, Object> m = new LinkedHashMap<>();
                    m.put("name", md.getNameAsString());
                    m.put("nodes", ctx.nodes);
                    m.put("edges", ctx.edges);
                    m.put("targets", ctx.targets);
                    methods.add(m);
                }

                cls.put("methods", methods);
                classes.add(cls);
            } catch (Exception ignored) {
                // 单个类解析失败已在模型构建阶段记录，这里跳过出图
            }
        }

        flow.put("classes", classes);
        return flow;
    }

    private String traverseBlock(BlockStmt block, String fromId, MethodCtx ctx) {
        String current = fromId;
        for (Statement stmt : block.getStatements()) {
            current = traverseStmt(stmt, current, ctx);
            if (current == null) break;
        }
        return current;
    }

    private String traverseStmt(Statement stmt, String fromId, MethodCtx ctx) {
        if (stmt.isForStmt()) return handleLoop(stmt.asForStmt(), stmt.asForStmt().getCompare().map(Object::toString).orElse("..."), "for", fromId, ctx);
        if (stmt.isForEachStmt()) return handleLoop(stmt.asForEachStmt(), stmt.asForEachStmt().getIterable().toString(), "for", fromId, ctx);
        if (stmt.isWhileStmt()) return handleLoop(stmt.asWhileStmt(), stmt.asWhileStmt().getCondition().toString(), "while", fromId, ctx);
        if (stmt.isDoStmt()) return handleLoop(stmt.asDoStmt(), stmt.asDoStmt().getCondition().toString(), "do", fromId, ctx);
        if (stmt.isIfStmt()) return handleIf(stmt.asIfStmt(), fromId, ctx);
        if (stmt.isReturnStmt()) {
            String id = ctx.addNode("exit", "return " + stmt.asReturnStmt().getExpression().map(Object::toString).orElse(""),
                stmt.getBegin().map(p -> p.line).orElse(0));
            ctx.addEdge(fromId, id, "");
            return null;
        }
        if (stmt.isBlockStmt()) return traverseBlock(stmt.asBlockStmt(), fromId, ctx);
        if (stmt.isEmptyStmt()) return fromId;

        // 普通语句：标注方法调用 target
        String label = stmt.toString().replace("\n", " ").trim();
        if (label.length() > 55) label = label.substring(0, 52) + "...";
        String callType = "block";
        String target = null;
        for (MethodCallExpr call : stmt.findAll(MethodCallExpr.class)) {
            if (model.findBySimpleName(call.getNameAsString(), ctx.owner.packageName) != null
                || isKnownMethod(call.getNameAsString())) {
                callType = "call";
                target = resolveTarget(ctx.owner, call.getNameAsString());
                break;
            }
        }
        int line = stmt.getBegin().map(p -> p.line).orElse(0);
        String id = ctx.addNode(callType, label, line);
        if (target != null) {
            ctx.targets.add(target);
            ctx.nodes.get(ctx.nodes.size() - 1).put("target", target);
        }
        ctx.addEdge(fromId, id, "");
        return id;
    }

    private String handleLoop(Statement stmt, String cond, String kind, String fromId, MethodCtx ctx) {
        String label = kind + " (" + (cond.length() > 50 ? cond.substring(0, 47) + "..." : cond) + ")";
        int line = stmt.getBegin().map(p -> p.line).orElse(0);
        String loopId = ctx.addNode(kind.equals("for") ? "for" : "while", label, line);
        ctx.addEdge(fromId, loopId, "");
        String bodyEnd = null;
        if (stmt.isForStmt()) bodyEnd = traverseStmt(stmt.asForStmt().getBody(), loopId, ctx);
        else if (stmt.isForEachStmt()) bodyEnd = traverseStmt(stmt.asForEachStmt().getBody(), loopId, ctx);
        else if (stmt.isWhileStmt()) bodyEnd = traverseStmt(stmt.asWhileStmt().getBody(), loopId, ctx);
        else if (stmt.isDoStmt()) bodyEnd = traverseStmt(stmt.asDoStmt().getBody(), loopId, ctx);
        if (bodyEnd != null) ctx.addEdge(bodyEnd, loopId, "next");
        return loopId;
    }

    private String handleIf(IfStmt ifStmt, String fromId, MethodCtx ctx) {
        String cond = ifStmt.getCondition().toString();
        if (cond.length() > 50) cond = cond.substring(0, 47) + "...";
        int line = ifStmt.getBegin().map(p -> p.line).orElse(0);
        String ifId = ctx.addNode("if", "if (" + cond + ")", line);
        ctx.addEdge(fromId, ifId, "");
        String thenEnd = traverseStmt(ifStmt.getThenStmt(), ifId, ctx);
        String mergeId = ifId;
        if (ifStmt.getElseStmt().isPresent()) {
            String elseEnd = traverseStmt(ifStmt.getElseStmt().get(), ifId, ctx);
            if (thenEnd != null && elseEnd != null) {
                mergeId = ctx.addNode("block", "end if", -1);
                ctx.addEdge(thenEnd, mergeId, "");
                ctx.addEdge(elseEnd, mergeId, "");
            } else if (thenEnd != null) mergeId = thenEnd;
            else if (elseEnd != null) mergeId = elseEnd;
        }
        return mergeId;
    }

    private boolean isKnownMethod(String name) {
        for (ProjectModel.TypeInfo t : model.types.values()) {
            for (ProjectModel.MethodInfo m : t.methods) {
                if (m.name.equals(name)) return true;
            }
        }
        return false;
    }

    /** 解析方法调用目标：全限定类名:方法名（唯一确定时），否则方法名 */
    private String resolveTarget(ProjectModel.TypeInfo owner, String methodName) {
        ProjectModel.TypeInfo target = model.findBySimpleName(methodName, owner.packageName);
        // findBySimpleName 是按「类型短名」查找，这里方法名不等于类型名，需遍历方法
        ProjectModel.TypeInfo found = null;
        for (ProjectModel.TypeInfo t : model.types.values()) {
            for (ProjectModel.MethodInfo m : t.methods) {
                if (m.name.equals(methodName)) {
                    if (found != null && !found.qualifiedName.equals(t.qualifiedName)) {
                        return methodName; // 多个类都有该方法，无法唯一确定
                    }
                    found = t;
                }
            }
        }
        return found != null ? found.qualifiedName + ":" + methodName : methodName;
    }

    /** 每个方法遍历过程中的可变状态 */
    private static class MethodCtx {
        int nodeId;
        final ProjectModel.TypeInfo owner;
        final List<Map<String, Object>> nodes = new ArrayList<>();
        final List<Map<String, Object>> edges = new ArrayList<>();
        final List<String> targets = new ArrayList<>();

        MethodCtx(ProjectModel.TypeInfo owner) {
            this.owner = owner;
        }

        String addNode(String type, String label, int line) {
            String id = "n" + (nodeId++);
            Map<String, Object> node = new LinkedHashMap<>();
            node.put("id", id);
            node.put("type", type);
            node.put("label", label);
            if (line >= 0) node.put("line", line);
            nodes.add(node);
            return id;
        }

        void addEdge(String from, String to, String label) {
            Map<String, Object> edge = new LinkedHashMap<>();
            edge.put("from", from);
            edge.put("to", to);
            edge.put("label", label);
            edges.add(edge);
        }
    }
}
