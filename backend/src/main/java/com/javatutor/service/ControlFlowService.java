package com.javatutor.service;

import com.github.javaparser.StaticJavaParser;
import com.github.javaparser.ast.CompilationUnit;
import com.github.javaparser.ast.body.MethodDeclaration;
import com.github.javaparser.ast.expr.Expression;
import com.github.javaparser.ast.expr.MethodCallExpr;
import com.github.javaparser.ast.stmt.*;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class ControlFlowService {

    /** Per-request mutable state, passed through all traversal methods */
    private static class Ctx {
        int nodeId;
        final List<Map<String, Object>> nodes = new ArrayList<>();
        final List<Map<String, Object>> edges = new ArrayList<>();
        final Set<String> knownMethods;

        Ctx(Set<String> km) { this.knownMethods = km; }

        String addNode(String type, String label, int line) {
            String id = "n" + (nodeId++);
            Map<String, Object> node = new LinkedHashMap<>();
            node.put("id", id);
            node.put("type", type);
            node.put("label", label);
            node.put("line", line);
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

    public Map<String, Object> analyze(String code) {
        CompilationUnit cu = StaticJavaParser.parse(code);
        List<MethodDeclaration> methods = cu.findAll(MethodDeclaration.class).stream()
            .filter(m -> m.getBody().isPresent()).toList();

        Set<String> knownMethods = new HashSet<>();
        methods.forEach(m -> knownMethods.add(m.getNameAsString()));

        Map<String, Object> result = new LinkedHashMap<>();
        Map<String, Map<String, Object>> subgraphs = new LinkedHashMap<>();

        for (MethodDeclaration m : methods) {
            Ctx ctx = new Ctx(knownMethods);
            String label = m.getDeclarationAsString(false, false, false);
            int line = m.getBegin().map(p -> p.line).orElse(1);
            String entryId = ctx.addNode("entry", label, line);
            String bodyEnd = traverseBlock(m.getBody().get(), entryId, ctx);
            if (bodyEnd != null) {
                String exitId = ctx.addNode("exit", "return", line + 99);
                ctx.addEdge(bodyEnd, exitId, "");
            }
            Map<String, Object> sub = new LinkedHashMap<>();
            sub.put("nodes", ctx.nodes);
            sub.put("edges", ctx.edges);
            subgraphs.put(m.getNameAsString(), sub);
        }

        result.put("methods", subgraphs);
        result.put("default", subgraphs.containsKey("main") ? "main" : (!methods.isEmpty() ? methods.get(0).getNameAsString() : ""));
        return result;
    }

    private String traverseBlock(BlockStmt block, String fromId, Ctx ctx) {
        String current = fromId;
        for (Statement stmt : block.getStatements()) {
            current = traverseStmt(stmt, current, ctx);
            if (current == null) break;
        }
        return current;
    }

    private String traverseStmt(Statement stmt, String fromId, Ctx ctx) {
        if (stmt.isForStmt()) return handleFor(stmt.asForStmt(), fromId, ctx);
        if (stmt.isForEachStmt()) return handleForEach(stmt.asForEachStmt(), fromId, ctx);
        if (stmt.isWhileStmt()) return handleWhile(stmt.asWhileStmt(), fromId, ctx);
        if (stmt.isDoStmt()) return handleDoWhile(stmt.asDoStmt(), fromId, ctx);
        if (stmt.isIfStmt()) return handleIf(stmt.asIfStmt(), fromId, ctx);
        if (stmt.isReturnStmt()) {
            String id = ctx.addNode("exit", "return " + stmt.asReturnStmt().getExpression().map(Object::toString).orElse(""),
                    stmt.getBegin().map(p -> p.line).orElse(0));
            ctx.addEdge(fromId, id, "");
            return null;
        }
        if (stmt.isBlockStmt()) return traverseBlock(stmt.asBlockStmt(), fromId, ctx);
        if (!stmt.isEmptyStmt()) {
            String label = stmt.toString().replace("\n", " ").trim();
            if (label.length() > 55) label = label.substring(0, 52) + "...";
            String callType = "block";
            String callTarget = null;
            List<MethodCallExpr> calls = stmt.findAll(MethodCallExpr.class);
            for (MethodCallExpr call : calls) {
                if (ctx.knownMethods.contains(call.getNameAsString())) {
                    callType = "call";
                    callTarget = call.getNameAsString();
                    break;
                }
            }
            int l = stmt.getBegin().map(p -> p.line).orElse(0);
            String id = ctx.addNode(callType, label, l);
            if (callTarget != null) {
                ctx.nodes.get(ctx.nodes.size() - 1).put("target", callTarget);
            }
            ctx.addEdge(fromId, id, "");
            return id;
        }
        return fromId;
    }

    private void checkAndAttachTarget(Expression expr, Ctx ctx) {
        if (expr == null) return;
        for (MethodCallExpr call : expr.findAll(MethodCallExpr.class)) {
            if (ctx.knownMethods.contains(call.getNameAsString())) {
                ctx.nodes.get(ctx.nodes.size() - 1).put("target", call.getNameAsString());
                return;
            }
        }
    }

    private String handleFor(ForStmt stmt, String fromId, Ctx ctx) {
        String comp = stmt.getCompare().map(Object::toString).orElse("...");
        String label = "for (" + comp + ")";
        int line = stmt.getBegin().map(p -> p.line).orElse(0);
        String loopId = ctx.addNode("for", label, line);
        checkAndAttachTarget(stmt.getCompare().orElse(null), ctx);
        ctx.addEdge(fromId, loopId, "");
        String bodyEnd = traverseStmt(stmt.getBody(), loopId, ctx);
        if (bodyEnd != null) ctx.addEdge(bodyEnd, loopId, "next");
        return loopId;
    }

    private String handleForEach(ForEachStmt stmt, String fromId, Ctx ctx) {
        String label = "for (" + stmt.getVariable().getVariable(0).getNameAsString() + " : " + stmt.getIterable().toString() + ")";
        String loopId = ctx.addNode("for", label, stmt.getBegin().map(p -> p.line).orElse(0));
        checkAndAttachTarget(stmt.getIterable(), ctx);
        ctx.addEdge(fromId, loopId, "");
        String bodyEnd = traverseStmt(stmt.getBody(), loopId, ctx);
        if (bodyEnd != null) ctx.addEdge(bodyEnd, loopId, "next");
        return loopId;
    }

    private String handleWhile(WhileStmt ws, String fromId, Ctx ctx) {
        String label = "while (" + ws.getCondition().toString() + ")";
        if (label.length() > 60) label = "while (...)";
        String loopId = ctx.addNode("while", label, ws.getBegin().map(p -> p.line).orElse(0));
        checkAndAttachTarget(ws.getCondition(), ctx);
        ctx.addEdge(fromId, loopId, "");
        String bodyEnd = traverseStmt(ws.getBody(), loopId, ctx);
        if (bodyEnd != null) ctx.addEdge(bodyEnd, loopId, "next");
        return loopId;
    }

    private String handleDoWhile(DoStmt ds, String fromId, Ctx ctx) {
        String label = "do ... while (" + ds.getCondition().toString() + ")";
        if (label.length() > 60) label = "do ... while (...)";
        String loopId = ctx.addNode("while", label, ds.getBegin().map(p -> p.line).orElse(0));
        checkAndAttachTarget(ds.getCondition(), ctx);
        ctx.addEdge(fromId, loopId, "");
        String bodyEnd = traverseStmt(ds.getBody(), loopId, ctx);
        if (bodyEnd != null) ctx.addEdge(bodyEnd, loopId, "next");
        return loopId;
    }

    private String handleIf(IfStmt ifStmt, String fromId, Ctx ctx) {
        String label = "if (" + ifStmt.getCondition().toString() + ")";
        if (label.length() > 60) label = "if (...)";
        int line = ifStmt.getBegin().map(p -> p.line).orElse(0);
        String ifId = ctx.addNode("if", label, line);
        checkAndAttachTarget(ifStmt.getCondition(), ctx);
        ctx.addEdge(fromId, ifId, "");
        String thenEnd = traverseStmt(ifStmt.getThenStmt(), ifId, ctx);
        String mergeId = ifId;
        if (ifStmt.getElseStmt().isPresent()) {
            String elseEnd = traverseStmt(ifStmt.getElseStmt().get(), ifId, ctx);
            if (thenEnd != null && elseEnd != null) {
                mergeId = ctx.addNode("block", "end if", line + 99);
                ctx.addEdge(thenEnd, mergeId, "");
                ctx.addEdge(elseEnd, mergeId, "");
            } else if (thenEnd != null) mergeId = thenEnd;
            else if (elseEnd != null) mergeId = elseEnd;
        }
        return mergeId;
    }
}
