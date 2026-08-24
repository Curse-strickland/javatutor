package com.javatutor.sandbox;

import com.github.javaparser.StaticJavaParser;
import com.github.javaparser.ast.CompilationUnit;
import com.github.javaparser.ast.ImportDeclaration;
import com.github.javaparser.ast.expr.ClassExpr;
import com.github.javaparser.ast.expr.Expression;
import com.github.javaparser.ast.expr.FieldAccessExpr;
import com.github.javaparser.ast.expr.MethodCallExpr;
import com.github.javaparser.ast.expr.NameExpr;
import com.github.javaparser.ast.expr.ObjectCreationExpr;
import com.github.javaparser.ast.visitor.VoidVisitorAdapter;

import java.util.ArrayList;
import java.util.List;
import java.util.Set;

/**
 * AST 层安全校验：扫描用户代码中的危险调用，在编译前拦截。
 *
 * 调用方式：SandboxValidator.validate(userCode) → Result
 *   Result.allowed = true  → 通过
 *   Result.allowed = false → 被拒绝，Result.reason 是原因
 */
public class SandboxValidator {

    // 只允许导入这些包（含子包，如 java.util.concurrent 也放行）
    private static final Set<String> ALLOWED_IMPORT_PREFIXES = Set.of(
        "java.util", "java.lang", "java.math", "java.text"
    );

    // 在允许的前缀下的例外：反射、JMX、管理、native 访问等危险子包
    private static final Set<String> BLOCKED_IMPORT_PREFIXES = Set.of(
        "java.lang.reflect", "java.lang.invoke", "java.lang.management",
        "java.lang.ref", "java.lang.module"
    );

    // 禁止实例化的危险类型（检查 new XXX() 调用）
    private static final Set<String> FORBIDDEN_TYPES = Set.of(
        // 文件 I/O（传统）
        "File", "FileInputStream", "FileOutputStream", "FileReader", "FileWriter",
        "RandomAccessFile",
        // 文件 I/O（NIO）
        "Files", "Path", "Paths",
        // 网络
        "Socket", "ServerSocket", "URL", "URLConnection", "HttpURLConnection",
        // 进程
        "ProcessBuilder",
        // 线程
        "Thread", "ThreadGroup",
        // 线程池（java.util.concurrent 子包）
        "ExecutorService", "ScheduledExecutorService", "ForkJoinPool", "Executors"
    );

    /**
     * 校验结果。
     */
    public static class Result {
        public final boolean allowed;
        public final String reason;

        private Result(boolean allowed, String reason) {
            this.allowed = allowed;
            this.reason = reason;
        }

        public static Result ok() {
            return new Result(true, null);
        }

        public static Result reject(String reason) {
            return new Result(false, reason);
        }
    }

    /**
     * 对用户代码做 AST 黑名单扫描。
     *
     * @param userCode 用户的原始 Java 代码（插桩前）
     * @return 校验结果
     */
    public static Result validate(String userCode) {
        List<String> violations = new ArrayList<>();

        try {
            CompilationUnit cu = StaticJavaParser.parse(userCode);

            // ① 检查 import 白名单
            checkImports(cu, violations);

            // ② 遍历所有方法调用
            cu.accept(new VoidVisitorAdapter<Void>() {
                @Override
                public void visit(MethodCallExpr call, Void arg) {
                    super.visit(call, arg);
                    checkMethodCall(call, violations);
                }
            }, null);

            // 遍历所有 new 对象创建
            cu.accept(new VoidVisitorAdapter<Void>() {
                @Override
                public void visit(ObjectCreationExpr expr, Void arg) {
                    super.visit(expr, arg);
                    String typeName = expr.getType().getNameAsString();
                    if (FORBIDDEN_TYPES.contains(typeName)) {
                        violations.add("不能使用 " + typeName + " — 该类型不允许在沙箱中创建");
                    }
                }
            }, null);

        } catch (Exception e) {
            // 解析失败说明代码本身有语法错误，交给后续编译器报错，这里放行
            return Result.ok();
        }

        if (!violations.isEmpty()) {
            return Result.reject("代码中包含不支持的操作：\n" + String.join("\n", violations));
        }
        return Result.ok();
    }

    // ---- 私有辅助 ----

    /** 检查 import 语句，只允许白名单包 */
    private static void checkImports(CompilationUnit cu, List<String> violations) {
        // 先检查 import 位置是否正确
        // import 必须出现在类型声明之前。如果 import 行号 > 第一个类型声明的行号，位置错误
        boolean importPositionOk = true;
        int firstTypeLine = cu.getTypes().stream()
            .findFirst()
            .flatMap(t -> t.getBegin().map(pos -> pos.line))
            .orElse(Integer.MAX_VALUE);
        for (ImportDeclaration imp : cu.getImports()) {
            int impLine = imp.getBegin().map(pos -> pos.line).orElse(0);
            if (impLine > firstTypeLine) {
                importPositionOk = false;
                break;
            }
            String importName = imp.getNameAsString();
            boolean allowed = ALLOWED_IMPORT_PREFIXES.stream()
                .anyMatch(importName::startsWith);
            boolean blocked = BLOCKED_IMPORT_PREFIXES.stream()
                .anyMatch(importName::startsWith);
            if (blocked || !allowed) {
                violations.add("不允许导入: " + importName);
            }
        }

        if (!importPositionOk) {
            // 清空已有的沙箱拦截信息，换成语法错误提示
            violations.clear();
            violations.add("import 必须写在文件顶部（类声明之前），请移到文件开头");
        }
    }

    private static void checkMethodCall(MethodCallExpr call, List<String> violations) {
        String methodName = call.getNameAsString();

        // System.exit(...)
        if (isStaticCall(call, "System", "exit")) {
            violations.add("不能使用 System.exit() — 该操作会直接终止程序");
        }

        // Runtime.getRuntime().exec(...)
        if ("exec".equals(methodName) && isCallOnRuntime(call)) {
            violations.add("不能使用 Runtime.exec() — 不允许执行外部命令");
        }

        // Class.forName(...)
        if (isStaticCall(call, "Class", "forName")) {
            violations.add("不能使用 Class.forName() — 不允许动态加载类");
        }

        // 反射相关 — 仅当调用目标确为反射类型时才拦截
        if ("invoke".equals(methodName) && isCallOnReflectType(call)) {
            violations.add("不能使用反射: invoke() — 反射操作不允许执行");
        }
        if ("setAccessible".equals(methodName) && isCallOnReflectType(call)) {
            violations.add("不能使用反射: setAccessible() — 反射操作不允许执行");
        }
        if ("getDeclaredMethod".equals(methodName) || "getDeclaredField".equals(methodName)
            || "getDeclaredConstructor".equals(methodName)) {
            violations.add("不能使用反射: " + methodName + "() — 反射操作不允许执行");
        }
        if ("newInstance".equals(methodName) && isCallOnClassType(call)) {
            violations.add("不能使用反射: newInstance() — 反射操作不允许执行");
        }
    }

    /** 检查是否为 ClassName.staticMethod() 形式的静态调用（支持短名和全限定名） */
    private static boolean isStaticCall(MethodCallExpr call, String className, String methodName) {
        if (!methodName.equals(call.getNameAsString())) return false;
        return call.getScope()
            .filter(scope -> scopeNameEndsWith(scope, className))
            .isPresent();
    }

    /** 检查是否为 Runtime.getRuntime().exec() 调用链（支持短名和全限定名） */
    private static boolean isCallOnRuntime(MethodCallExpr call) {
        Expression scope = call.getScope().orElse(null);
        if (!(scope instanceof MethodCallExpr)) return false;
        MethodCallExpr scopeCall = (MethodCallExpr) scope;
        if (!"getRuntime".equals(scopeCall.getNameAsString())) return false;
        return scopeCall.getScope()
            .filter(s -> scopeNameEndsWith(s, "Runtime"))
            .isPresent();
    }

    /** 提取作用域名，支持 NameExpr 和 FieldAccessExpr（如 java.lang.System） */
    private static boolean scopeNameEndsWith(Expression scope, String shortName) {
        if (scope.isNameExpr()) {
            String name = scope.asNameExpr().getNameAsString();
            return shortName.equals(name) || name.endsWith("." + shortName);
        }
        if (scope.isFieldAccessExpr()) {
            // java.lang.System.exit(...) → FieldAccessExpr(FieldAccessExpr(NameExpr("java"),"lang"),"System")
            return scope.asFieldAccessExpr().getNameAsString().equals(shortName);
        }
        return false;
    }

    /** 检查调用目标是否为反射相关类型（Method/Field/Constructor/AccessibleObject 的方法链） */
    private static boolean isCallOnReflectType(MethodCallExpr call) {
        return call.getScope().filter(scope -> {
            if (scope.isNameExpr()) {
                String name = scope.asNameExpr().getNameAsString();
                return isReflectVarName(name);
            }
            if (scope instanceof MethodCallExpr) {
                MethodCallExpr s = (MethodCallExpr) scope;
                String n = s.getNameAsString();
                return "getDeclaredMethod".equals(n) || "getDeclaredField".equals(n)
                    || "getDeclaredConstructor".equals(n) || "getMethod".equals(n)
                    || "getField".equals(n) || "getConstructor".equals(n);
            }
            return false;
        }).isPresent();
    }

    private static boolean isReflectVarName(String name) {
        // 反射相关变量名常见为 m / method / f / field 等
        return "m".equals(name) || "method".equals(name) || "f".equals(name)
            || "field".equals(name) || "c".equals(name) || "constructor".equals(name);
    }

    /** 检查调用目标是否为 Class 类型（如 String.class.newInstance()） */
    private static boolean isCallOnClassType(MethodCallExpr call) {
        return call.getScope()
            .filter(scope -> scope.isClassExpr()  // String.class is a ClassExpr
                || (scope.isNameExpr() && scope.asNameExpr().getNameAsString().endsWith(".class"))
                || (scope.isFieldAccessExpr() && "class".equals(scope.asFieldAccessExpr().getNameAsString())))
            .isPresent();
    }
}
