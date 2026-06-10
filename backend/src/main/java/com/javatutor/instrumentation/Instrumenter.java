package com.javatutor.instrumentation;
//插桩

import com.github.javaparser.*;
import com.github.javaparser.ast.*;
import com.github.javaparser.ast.body.*;
import com.github.javaparser.ast.expr.*;
import com.github.javaparser.ast.stmt.*;
import com.github.javaparser.ast.visitor.ModifierVisitor;
import com.github.javaparser.ast.visitor.Visitable;
import com.github.javaparser.printer.lexicalpreservation.LexicalPreservingPrinter;
import java.util.*;

public class Instrumenter {

    public String instrument(String userCode){
        //parse 用户的代码,形成ast
        //cu就是抽象语法树的根节点
        /**
        CompilationUnit                          ← 根节点：一个完整的 .java 文件
        │
        ├── PackageDeclaration                   ← package com.example;
        ├── ImportDeclaration                    ← import java.util.*;
        │       
        └── ClassOrInterfaceDeclaration          ← public class UserCode
            └── MethodDeclaration                ←   public static void main(...)
                ├── Parameter: String[] args     ←     方法参数
                └── BlockStmt                    ←     方法体 { }
                    ├── ExpressionStmt           ←       int[] arr = {5,3,8};
                    │           └── VariableDeclarationExpr
                    └── ExpressionStmt           ←       int n = arr.length;
                        └── VariableDeclarationExpr


         */
        CompilationUnit cu = StaticJavaParser.parse(userCode);
        
        //保留原格式
        LexicalPreservingPrinter.setup(cu);

        //使用局部数组避免 Spring 单例下的线程安全问题
        int[] counter = {1};



        //遍历已经parse的ast，调用traceEngine.record()记录

        //Visitor 访问器 ，使用 javaParser 的 modifierVisitor，访问该语法树
        //ast 根节点 接受 visitor 
        cu.accept(new ModifierVisitor<Void>(){ //Void 无需额外参数
            //父类也可以实现visit()方法，但是不能修改
            //ModifierVister 可以修改（插桩），所以在此处创建一个匿名的内部类，直接define并使用

            // 方法级别插桩：try-pushFrame ... finally-popFrame
            // 用 try-finally 确保递归调用时帧正确叠加/回收
            @Override
            public Visitable visit(MethodDeclaration md, Void arg) {
                String methodName = md.getNameAsString();

                // 跳过内部类的方法
                Node parent = md.getParentNode().orElse(null);
                while (parent != null && !(parent instanceof CompilationUnit)) {
                    if (parent instanceof ClassOrInterfaceDeclaration) {
                        Node clsParent = parent.getParentNode().orElse(null);
                        if (!(clsParent instanceof CompilationUnit)) {
                            return super.visit(md, arg);
                        }
                        break;
                    }
                    parent = parent.getParentNode().orElse(null);
                }

                MethodDeclaration newMd = (MethodDeclaration) super.visit(md, arg);
                BlockStmt oldBody = newMd.getBody().orElse(null);
                if (oldBody == null) return newMd;

                // 构造 try { pushFrame; ...body... } finally { popFrame; }
                BlockStmt tryBlock = new BlockStmt();
                tryBlock.addStatement(StaticJavaParser.parseStatement(
                    "TraceEngine.pushFrame(\"" + methodName + "\");"));
                for (Statement s : oldBody.getStatements()) {
                    tryBlock.addStatement(s);
                }

                BlockStmt finallyBlock = new BlockStmt();
                finallyBlock.addStatement(StaticJavaParser.parseStatement(
                    "TraceEngine.popFrame();"));

                TryStmt tryStmt = new TryStmt();
                tryStmt.setTryBlock(tryBlock);
                tryStmt.setFinallyBlock(finallyBlock);

                BlockStmt newBody = new BlockStmt();
                newBody.addStatement(tryStmt);
                newMd.setBody(newBody);
                return newMd;
            }

            @Override
            public Visitable visit(BlockStmt block , Void arg){
                // super.visit 会先递归处理 block 里的所有子节点
                BlockStmt newBlock = (BlockStmt) super.visit(block , arg);

                // 跳过内部类构造函数等（块属于非 main 方法，且所在类是嵌套类则跳过）
                if (isInnerClassBlock(block)) {
                    return newBlock;
                }

                /**
                 * 为什么需要递归处理：存在内层BlockStmt
                 * 用户代码:
                void main(String[] a) {
                    int[] arr = {5,3,8};     ← 在外层 BlockStmt
                    for (int i=0; i<n; i++) {  ← 内层 BlockStmt
                        arr[i] = i;             ← visit 处理内层
                    }                           ← visit 处理外层
                }

                遍历顺序：
                1. 进入外层 BlockStmt → visit() 被调用
                2.   super.visit() 先递归 → 进入内层 BlockStmt
                3.     内层 visit() → 在 arr[i] = i 后面插 record
                4.     返回内层
                5.   外层继续 → 在 int[] arr = {5,3,8} 后面插 record
                6.   返回外层
                 */

                // 为了在进入/退出分支和循环时都能记录状态，先构建一个新的 statements 列表，
                // 对于需要插桩的位置，根据语句类型选择在前后插入 record()
                NodeList<Statement> oldStatements = newBlock.getStatements();
                NodeList<Statement> newStatements = new NodeList<>();
                for (int i = 0; i < oldStatements.size(); i++) {
                    Statement stmt = oldStatements.get(i);
                    int line = stmt.getBegin().map(pos -> pos.line).orElse(-1);

                    if (shouldInstrument(stmt)) {
                        // 控制流语句：把 "进入" 记录插入到语句的主体首部（以捕获 for-init 声明的循环变量），
                        // 并在语句之后插入 "退出" 记录；对于简单赋值/声明等，仅在语句后插入记录。
                        if (stmt.isIfStmt() || stmt.isForStmt() || stmt.isForEachStmt() || stmt.isWhileStmt() || stmt.isDoStmt()) {
                            // 先对语句本身进行修改：在其 body 的开头插入一条记录（如果 body 不是块语句则包装为 BlockStmt）
                            if (stmt.isForStmt()) {
                                ForStmt fs = stmt.asForStmt();
                                int ln = line;
                                Statement body = fs.getBody();
                                if (body.isBlockStmt()) {
                                    BlockStmt bodyBlock = body.asBlockStmt();
                                    List<String> insideVars = collectVisibleVariables(bodyBlock, -1);
                                    // 确保包含 for-init 中声明的循环变量
                                    collectDirectVariables(stmt, insideVars);
                                    bodyBlock.getStatements().addFirst(buildRecordStatement(ln, insideVars, counter));
                                    // 仅在进入体首部记录，退出时通过后续退出记录采集快照，避免重复
                                } else {
                                    BlockStmt newBody = new BlockStmt();
                                    fs.setBody(newBody);
                                    List<String> insideVars = collectVisibleVariables(newBody, -1);
                                    collectDirectVariables(stmt, insideVars);
                                    newBody.addStatement(buildRecordStatement(ln, insideVars, counter));
                                    newBody.addStatement(body);
                                    newBody = (BlockStmt) super.visit(newBody, null);
                                    fs.setBody(newBody);
                                }
                                newStatements.add(fs);
                            } else if (stmt.isForEachStmt()) {
                                ForEachStmt fes = stmt.asForEachStmt();
                                int ln = line;
                                Statement body = fes.getBody();
                                if (body.isBlockStmt()) {
                                    BlockStmt bodyBlock = body.asBlockStmt();
                                    List<String> insideVars = collectVisibleVariables(bodyBlock, -1);
                                    collectDirectVariables(stmt, insideVars);
                                    bodyBlock.getStatements().addFirst(buildRecordStatement(ln, insideVars, counter));
                                    // 仅在进入体首部记录，退出时由后续退出记录采集快照
                                } else {
                                    BlockStmt newBody = new BlockStmt();
                                    fes.setBody(newBody);
                                    List<String> insideVars = collectVisibleVariables(newBody, -1);
                                    collectDirectVariables(stmt, insideVars);
                                    newBody.addStatement(buildRecordStatement(ln, insideVars, counter));
                                    newBody.addStatement(body);
                                    newBody = (BlockStmt) super.visit(newBody, null);
                                    fes.setBody(newBody);
                                }
                                newStatements.add(fes);
                            } else if (stmt.isWhileStmt()) {
                                WhileStmt ws = stmt.asWhileStmt();
                                int ln = line;
                                Statement body = ws.getBody();
                                if (body.isBlockStmt()) {
                                    BlockStmt bodyBlock = body.asBlockStmt();
                                    List<String> insideVars = collectVisibleVariables(bodyBlock, -1);
                                    collectDirectVariables(stmt, insideVars);
                                        bodyBlock.getStatements().addFirst(buildRecordStatement(ln, insideVars, counter));
                                        // 仅在进入体首部记录，退出时由后续退出记录采集快照
                                } else {
                                    BlockStmt newBody = new BlockStmt();
                                    ws.setBody(newBody);
                                    List<String> insideVars = collectVisibleVariables(newBody, -1);
                                    collectDirectVariables(stmt, insideVars);
                                    newBody.addStatement(buildRecordStatement(ln, insideVars, counter));
                                    newBody.addStatement(body);
                                    newBody = (BlockStmt) super.visit(newBody, null);
                                    ws.setBody(newBody);
                                }
                                newStatements.add(ws);
                            } else if (stmt.isDoStmt()) {
                                DoStmt ds = stmt.asDoStmt();
                                int ln = line;
                                Statement body = ds.getBody();
                                if (body.isBlockStmt()) {
                                    BlockStmt bodyBlock = body.asBlockStmt();
                                    List<String> insideVars = collectVisibleVariables(bodyBlock, -1);
                                    collectDirectVariables(stmt, insideVars);
                                    bodyBlock.getStatements().addFirst(buildRecordStatement(ln, insideVars, counter));
                                } else {
                                    BlockStmt newBody = new BlockStmt();
                                    ds.setBody(newBody);
                                    List<String> insideVars = collectVisibleVariables(newBody, -1);
                                    collectDirectVariables(stmt, insideVars);
                                    newBody.addStatement(buildRecordStatement(ln, insideVars, counter));
                                    newBody.addStatement(body);
                                    newBody = (BlockStmt) super.visit(newBody, null);
                                    ds.setBody(newBody);
                                }
                                newStatements.add(ds);
                            } else if (stmt.isIfStmt()) {
                                IfStmt ifs = stmt.asIfStmt();
                                int ln = line;
                                // 在 if 之前插入一次记录以表示条件判断时的高亮（无论 true/false 都应高亮）
                                List<String> condVars = collectVisibleVariables(block, i);
                                collectDirectVariables(stmt, condVars);
                                newStatements.add(buildRecordStatement(ln, condVars, counter));

                                // 如果 else 分支是另一个 IfStmt（即 else if），递归给它也加条件高亮
                                if (ifs.getElseStmt().isPresent()) {
                                    Statement elseStmt = ifs.getElseStmt().get();
                                    if (elseStmt.isIfStmt()) {
                                        IfStmt elseIf = elseStmt.asIfStmt();
                                        int elseLn = elseIf.getBegin().map(p -> p.line).orElse(ln);
                                        List<String> elseVars = collectVisibleVariables(block, i);
                                        collectDirectVariables(elseIf, elseVars);
                                        BlockStmt wrap = new BlockStmt();
                                        wrap.addStatement(buildRecordStatement(elseLn, elseVars, counter));
                                        wrap.addStatement(elseIf);
                                        ifs.setElseStmt(wrap);
                                    }
                                }

                                newStatements.add(ifs);
                            } else {
                                // 兜底：将原语句加入
                                newStatements.add(stmt);
                            }

                            // IfStmt 在判断前已插入高亮记录，不需要退出记录
                            // while/for/do 循环：不插入退出记录 — 无限循环时退出
                            // 记录会成为不可达代码；正常退出时下一步的记录自然会覆盖
                        } else if (stmt.isReturnStmt()) {
                            // return 语句：只需在 return 之前插入 record
                            // 不额外加 pushFrame/popFrame — return 后代码不可达
                            List<String> visibleBefore = collectVisibleVariables(block, i);
                            newStatements.add(buildRecordStatement(line, visibleBefore, counter));
                            newStatements.add(stmt);
                        } else {
                            // 检测语句中的方法调用（如 factorial(3)）
                            // 方法入口/出口的 pushFrame/popFrame 由 visit(MethodDeclaration) 管理
                            // 这里只需在调用前插 record 捕获调用点状态
                            String callee = detectMethodCall(stmt);
                            if (callee != null) {
                                List<String> visibleBefore = collectVisibleVariables(block, i - 1);
                                newStatements.add(buildRecordStatement(line, visibleBefore, counter));
                            }
                            // 原有逻辑
                            List<String[]> arrayAllocs = detectArrayAllocations(stmt);
                            for (String[] alloc : arrayAllocs) {
                                newStatements.add(buildAllocArrayStatement(alloc[0], alloc[1]));
                            }
                            newStatements.add(stmt);
                            List<String[]> objAllocs = detectObjectAllocations(stmt);
                            for (String[] alloc : objAllocs) {
                                newStatements.add(buildAllocObjectStatement(alloc[0]));
                            }
                            List<String> visibleAfter = collectVisibleVariables(block, i);
                            newStatements.add(buildRecordStatement(line, visibleAfter, counter));
                        }
                    } else {
                        newStatements.add(stmt);
                    }
                }

                // 替换为新 statements
                newBlock.setStatements(newStatements);
                return newBlock;
            }
        },null);

        return LexicalPreservingPrinter.print(cu);
    }

    //instrument用到的辅助方法，不对外开放接口
    //
    private Statement buildRecordStatement(int line, List<String> varNames, int[] counter) {
        //拼接参数
        StringBuilder mapArgs = new StringBuilder();
        for(int i = 0 ; i < varNames.size() ; i++){
            if(i > 0 )mapArgs.append(",");
            String v = varNames.get(i);
            mapArgs.append("\"").append(v).append("\",").append(v);
        }

        int s = counter[0];
        counter[0]++;

        //生成完整的语句 — 用 buildMap 替代 Map.of() 突破 10 对 KV 上限
        String recordCall = "TraceEngine.record("
        + s + ","
        + line + ","
        + "TraceEngine.buildMap(new Object[]{" + mapArgs.toString() + "})"
        + ");";

        return StaticJavaParser.parseStatement(recordCall);
    }


    /**
    ast 节点关系：
    Statement（父类型）
    ├── ExpressionStmt           ← 包装表达式的语句
    │     └── Expression:
    │           ├── VariableDeclarationExpr   ← "int x = 5"
    │           ├── AssignExpr                ← "x = 10", "arr[i] = 5"
    │           └── MethodCallExpr            ← "println(...)" 我们不插
    └── ReturnStmt               ← return 语句

     */
    // 判断 BlockStmt 是否属于内部类（如 Person）的方法/构造函数
    private boolean isInnerClassBlock(BlockStmt block) {
        // 找到这个 block 所属的方法
        Node parent = block.getParentNode().orElse(null);
        CallableDeclaration<?> method = null;
        while (parent != null && !(parent instanceof CompilationUnit)) {
            if (parent instanceof CallableDeclaration<?>) {
                method = (CallableDeclaration<?>) parent;
                break;
            }
            parent = parent.getParentNode().orElse(null);
        }
        if (method == null) return false;
        // 找到这个方法所属的类
        Node clsNode = method.getParentNode().orElse(null);
        if (clsNode instanceof ClassOrInterfaceDeclaration) {
            // 如果这个类的父节点不是 CompilationUnit，则是内部类
            Node clsParent = clsNode.getParentNode().orElse(null);
            return !(clsParent instanceof CompilationUnit);
        }
        return false;
    }

    private boolean shouldInstrument(Statement stmt) {
        // 情况1：表达式语句 → 往里看是不是赋值或变量声明
        if (stmt.isExpressionStmt()) {
            Expression expr = stmt.asExpressionStmt().getExpression();
            if (expr.isAssignExpr() || expr.isVariableDeclarationExpr()) return true;
            if (expr.isUnaryExpr()) {
                UnaryExpr.Operator op = expr.asUnaryExpr().getOperator();
                return op == UnaryExpr.Operator.PREFIX_INCREMENT
                    || op == UnaryExpr.Operator.PREFIX_DECREMENT
                    || op == UnaryExpr.Operator.POSTFIX_INCREMENT
                    || op == UnaryExpr.Operator.POSTFIX_DECREMENT;
            }
            // 独立方法调用语句（如 System.out.println()）也需要插桩，否则纯打印代码无步骤
            if (expr.isMethodCallExpr()) return true;
            return false;
        }

        // 情况2：return 语句 → 需要插桩
        if (stmt.isReturnStmt()) {
            return true;
        }

        // 控制流语句（if/for/while/do/foreach）也需要插桩以记录进入/退出
        if (stmt.isIfStmt() || stmt.isForStmt() || stmt.isForEachStmt() || stmt.isWhileStmt() || stmt.isDoStmt()) {
            return true;
        }

        // 其他（方法调用、空语句等）→ 不插桩
        return false;
    }

    //内层无法看到外层的可见变量，需要递归查找父节点可见变量获取相应的变量
    //找可见变量，方法是：当前 block + 往上找父级 block + 方法参数

    // 已有工具：JavaParser 提供的工具：
    // block.findAll(VariableDeclarator.class) — 在一个节点下递归查找所有变量声明
    // block.getParentNode() — 获取父节点（返回 Optional）
    // Bug5 修复：
    // - 当前 block：只收集索引 ≤ beforeStmtIndex 的语句中声明的变量
    // - 父级 BlockStmt：定位到包含当前子节点的语句索引，只收集 ≤ 该索引的变量
    // - 非 BlockStmt 父级（ForStmt 等）：收集直接变量（如 for-init 里的 i），跳过嵌套 BlockStmt 内部
    // 避免 "预知" 后面才声明的变量，防止生成引用未声明变量的代码导致编译失败
    private List<String> collectVisibleVariables(BlockStmt block, int beforeStmtIndex){
        List<String> vars = new ArrayList<>();

        //当前 block：只看索引 ≤ beforeStmtIndex 的语句中的变量
        // BugFix: 跳过 ForStmt/ForEachStmt，循环变量作用域仅限于 body 内部
        // 反序遍历：同一 BlockStmt 内后声明的变量自然排在列表前面(栈顶)，符合栈的后进先出
        NodeList<Statement> statements = block.getStatements();
        for (int i = beforeStmtIndex; i >= 0; i--) {
            Statement s = statements.get(i);
            if (s.isForStmt() || s.isForEachStmt()) continue;
            collectDirectVariables(s, vars);
        }

        //往上遍历父级节点
        //currentNode 表示"从哪个子节点上来的"，用于在父级 BlockStmt 中定位正确的子语句索引
        Node currentNode = block;
        Node parent = currentNode.getParentNode().orElse(null);
        while(parent != null){

            if(parent instanceof BlockStmt){
                //父级是 BlockStmt：只收集包含 currentNode 的那条语句及之前的变量
                // BugFix: 跳过 ForStmt/ForEachStmt，循环变量作用域仅限于 body 内部
                // 反序遍历：同 BlockStmt 内后声明的变量排在列表前面 → 显示在栈顶
                BlockStmt parentBlock = (BlockStmt) parent;
                int childIdx = findChildIndex(parentBlock, currentNode);
                for (int i = childIdx; i >= 0; i--) {
                    Statement s = parentBlock.getStatements().get(i);
                    if (s.isForStmt() || s.isForEachStmt()) continue;
                    collectDirectVariables(s, vars);
                }
            } else {
                //父级非 BlockStmt（如 ForStmt）：收集直接属于该节点的变量（如 for-init 里的 i）
                collectDirectVariables(parent, vars);
            }

            //收集方法参数
            if(parent instanceof CallableDeclaration<?>){
                CallableDeclaration<?> method = (CallableDeclaration<?>) parent;
                for(Parameter p : method.getParameters()){
                    String name = p.getNameAsString();
                    if(!vars.contains(name)){
                        vars.add(name);
                    }
                }
            }

            //收集外部类的静态字段（如 static int counter = 0），仅最外层类
            if (parent instanceof ClassOrInterfaceDeclaration) {
                Node clsParent = parent.getParentNode().orElse(null);
                if (clsParent instanceof CompilationUnit) {
                    for (FieldDeclaration fd : ((ClassOrInterfaceDeclaration) parent).getFields()) {
                        if (!fd.isStatic()) continue;
                        for (VariableDeclarator vd : fd.getVariables()) {
                            String name = vd.getNameAsString();
                            if (!vars.contains(name)) vars.add(name);
                        }
                    }
                }
            }

            currentNode = parent;
            parent = currentNode.getParentNode().orElse(null);
        }
        return vars;
    }

    //在 parentBlock 的所有子语句中，找到包含 descendant 节点的那个语句的索引
    private int findChildIndex(BlockStmt parentBlock, Node descendant){
        Node node = descendant;
        while(node != null){
            Node nodeParent = node.getParentNode().orElse(null);
            if(nodeParent == parentBlock){
                //node 现在是 parentBlock 的直接子语句
                NodeList<Statement> stmts = parentBlock.getStatements();
                for (int i = 0; i < stmts.size(); i++) {
                    if(stmts.get(i) == node) return i;
                }
                return stmts.size() - 1; //兜底：返回最后一个索引
            }
            node = nodeParent;
        }
        return parentBlock.getStatements().size() - 1; //兜底
    }

    // 从节点中收集 VariableDeclarator，但跳过嵌套 BlockStmt 内部的
    // 例如：for(int i=0; ...) { int j=... } — 只收 i，不收 j（j 在嵌套 BlockStmt 里，还没执行到）
    private void collectDirectVariables(Node node, List<String> vars) {
        // 情况 B：node 是非 BlockStmt 的父级（如 ForStmt）——收集该节点自身声明的变量（例如 for-init 中的 i）
        if (node instanceof ForStmt) {
            ForStmt forStmt = (ForStmt) node;
            for (Expression e : forStmt.getInitialization()) {
                if (e.isVariableDeclarationExpr()) {
                    for (VariableDeclarator vd : e.asVariableDeclarationExpr().getVariables()) {
                        String name = vd.getNameAsString();
                        if (!vars.contains(name)) vars.add(name);
                    }
                }
            }
            return;
        }

        if (node instanceof ForEachStmt) {
            ForEachStmt fe = (ForEachStmt) node;
            String name = fe.getVariable().getVariable(0).getNameAsString();
            if (!vars.contains(name)) vars.add(name);
            return;
        }

        if (node instanceof WhileStmt || node instanceof DoStmt) {
            // While/Do 本身不声明可见到父作用域的变量（通常在外部声明），无需处理
            return;
        }

        // 如果是类/接口声明（内部类），跳过——其字段不属于当前作用域
        if (node instanceof ClassOrInterfaceDeclaration || node instanceof CompilationUnit) {
            return;
        }

        // 情况 A：node 是一个顶层语句（BlockStmt 的直接子语句）——只收集直接在该语句声明的变量，
        // 例如 "int x = 1;"（ExpressionStmt 包含 VariableDeclarationExpr）
        if (node instanceof Statement) {
            Statement stmt = (Statement) node;
            if (stmt.isExpressionStmt()) {
                Expression expr = stmt.asExpressionStmt().getExpression();
                if (expr.isVariableDeclarationExpr()) {
                    for (VariableDeclarator vd : expr.asVariableDeclarationExpr().getVariables()) {
                        String name = vd.getNameAsString();
                        if (!vars.contains(name)) vars.add(name);
                    }
                }
            }
            return;
        }

        // 如果是方法/构造函数声明，跳过——参数由 collectVisibleVariables 单独处理
        if (node instanceof CallableDeclaration<?>) {
            return;
        }

        // 如果是 BodyDeclaration（包括 FieldDeclaration 字段声明），跳过——不是局部变量
        if (node instanceof BodyDeclaration<?>) {
            return;
        }

        // 如果是 IfStmt，跳过——if 本身不声明可见到父作用域的变量
        if (node instanceof IfStmt) {
            return;
        }

        // 兜底：尝试找到直接的 VariableDeclarator，但过滤掉：
        // 1. 位于嵌套 BlockStmt 内的
        // 2. 位于 FieldDeclaration 内的（那是类字段，不是局部变量）
        for (VariableDeclarator vd : node.findAll(VariableDeclarator.class)) {
            Node parent = vd.getParentNode().orElse(null);
            // 检查该 VariableDeclarator 是否是类字段（FieldDeclaration 的子节点）
            boolean isField = false;
            Node p = parent;
            while (p != null && p != node) {
                if (p instanceof FieldDeclaration || p instanceof BodyDeclaration<?>) {
                    isField = true;
                    break;
                }
                if (p instanceof BlockStmt) {
                    break; // 已进入方法体，不继续往上判断
                }
                p = p.getParentNode().orElse(null);
            }
            if (isField) continue;

            boolean insideNestedBlock = false;
            while (parent != null && parent != node) {
                if (parent instanceof BlockStmt) {
                    insideNestedBlock = true;
                    break;
                }
                parent = parent.getParentNode().orElse(null);
            }
            if (!insideNestedBlock) {
                String name = vd.getNameAsString();
                if (!vars.contains(name)) {
                    vars.add(name);
                }
            }
        }
    }

    // 检测语句中的数组创建表达式，返回 [变量名, 长度表达式] 列表
    // 例如 int[] arr = {5,3,8} → [["arr", "3"]]
    //       int[] arr = new int[n] → [["arr", "n"]]
    private List<String[]> detectArrayAllocations(Statement stmt) {
        List<String[]> result = new ArrayList<>();
        if (!stmt.isExpressionStmt()) return result;
        Expression expr = stmt.asExpressionStmt().getExpression();
        if (!expr.isVariableDeclarationExpr()) return result;
        for (VariableDeclarator vd : expr.asVariableDeclarationExpr().getVariables()) {
            if (!vd.getInitializer().isPresent()) continue;
            Expression init = vd.getInitializer().get();
            if (init.isArrayCreationExpr()) {
                // new int[n]
                ArrayCreationExpr ace = init.asArrayCreationExpr();
                String name = vd.getNameAsString();
                String lenExpr = ace.getLevels().get(0).getDimension()
                    .map(dim -> dim.toString())
                    .orElse("0");
                result.add(new String[]{name, lenExpr});
            } else if (init.isArrayInitializerExpr()) {
                // {5, 3, 8}
                ArrayInitializerExpr aie = init.asArrayInitializerExpr();
                String name = vd.getNameAsString();
                int len = aie.getValues().size();
                result.add(new String[]{name, String.valueOf(len)});
            }
        }
        return result;
    }

    // 生成 TraceEngine.allocArray("arr", n) 或 TraceEngine.allocArray("arr", 3) 语句
    private Statement buildAllocArrayStatement(String name, String lenExpr) {
        String call = "TraceEngine.allocArray(\"" + name + "\", " + lenExpr + ");";
        return StaticJavaParser.parseStatement(call);
    }

    // 生成 TraceEngine.allocObject("name", name) 或 TraceEngine.allocObject("head.next", head.next) 语句
    // 注意：第二个参数必须是目标表达式自身（引用已赋值的对象），而非 new Xxx() 构造表达式
    private Statement buildAllocObjectStatement(String targetExpr) {
        String call = "TraceEngine.allocObject(\"" + targetExpr + "\", " + targetExpr + ");";
        return StaticJavaParser.parseStatement(call);
    }

    // 检测语句中的对象创建表达式，返回 [变量名/表达式] 列表
    // 支持: Person alice = new Person(...) 和 arr[0] = new Item(...)
    private List<String[]> detectObjectAllocations(Statement stmt) {
        List<String[]> result = new ArrayList<>();
        if (!stmt.isExpressionStmt()) return result;
        Expression expr = stmt.asExpressionStmt().getExpression();

        // 变量声明: Person alice = new Person(...)
        if (expr.isVariableDeclarationExpr()) {
            for (VariableDeclarator vd : expr.asVariableDeclarationExpr().getVariables()) {
                if (!vd.getInitializer().isPresent()) continue;
                if (vd.getInitializer().get().isObjectCreationExpr()) {
                    result.add(new String[]{vd.getNameAsString()});
                }
            }
            return result;
        }

        // 赋值表达式: arr[0] = new Point(...) 或 head.next = new ListNode(...)
        if (expr.isAssignExpr()) {
            AssignExpr ae = expr.asAssignExpr();
            if (ae.getValue().isObjectCreationExpr()) {
                result.add(new String[]{ae.getTarget().toString()});
            }
            return result;
        }

        return result;
    }

    // 检测语句中是否调用了用户自定义方法（非 print/sout 等），返回被调用的方法名
    private String detectMethodCall(Statement stmt) {
        if (!stmt.isExpressionStmt()) return null;
        Expression expr = stmt.asExpressionStmt().getExpression();
        return detectCallInExpr(expr);
    }

    private String detectCallInExpr(Expression expr) {
        if (expr.isMethodCallExpr()) {
            String name = expr.asMethodCallExpr().getNameAsString();
            // 过滤掉 System.out.println 等标准库调用
            if (name.equals("println") || name.equals("print") || name.equals("printf")
                || name.equals("equals") || name.equals("hashCode") || name.equals("toString")
                || name.equals("length") || name.equals("size") || name.equals("get")
                || name.equals("charAt") || name.equals("substring")
                || name.equals("valueOf") || name.equals("parseInt") || name.equals("parseDouble"))
                return null;
            return name;
        }
        // 变量声明中的初始化表达式：int result = factorial(3)
        if (expr.isVariableDeclarationExpr()) {
            for (VariableDeclarator vd : expr.asVariableDeclarationExpr().getVariables()) {
                if (vd.getInitializer().isPresent()) {
                    String name = detectCallInExpr(vd.getInitializer().get());
                    if (name != null) return name;
                }
            }
        }
        // 赋值表达式：x = factorial(3)
        if (expr.isAssignExpr()) {
            return detectCallInExpr(expr.asAssignExpr().getValue());
        }
        return null;
    }


}      


    
