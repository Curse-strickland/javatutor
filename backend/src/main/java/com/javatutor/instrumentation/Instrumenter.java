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

    private int stepCounter; //计数
    
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

        //重置stepcounter
        this.stepCounter = 1;



        //遍历已经parse的ast，调用traceEngine.record()记录

        //Visitor 访问器 ，使用 javaParser 的 modifierVisitor，访问该语法树
        //ast 根节点 接受 visitor 
        cu.accept(new ModifierVisitor<Void>(){ //Void 无需额外参数
            //父类也可以实现visit()方法，但是不能修改
            //ModifierVister 可以修改（插桩），所以在此处创建一个匿名的内部类，直接define并使用
            @Override
            public Visitable visit(BlockStmt block , Void arg){
                // super.visit 会先递归处理 block 里的所有子节点
                BlockStmt newBlock = (BlockStmt) super.visit(block , arg);

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
                    int line = stmt.getBegin().map(pos -> pos.line).orElse(null);

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
                                    bodyBlock.getStatements().addFirst(buildRecordStatement(ln, insideVars));
                                    // 仅在进入体首部记录，退出时通过后续退出记录采集快照，避免重复
                                } else {
                                    BlockStmt newBody = new BlockStmt();
                                    fs.setBody(newBody);
                                    List<String> insideVars = collectVisibleVariables(newBody, -1);
                                    collectDirectVariables(stmt, insideVars);
                                    newBody.addStatement(buildRecordStatement(ln, insideVars));
                                    newBody.addStatement(body);
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
                                    bodyBlock.getStatements().addFirst(buildRecordStatement(ln, insideVars));
                                    // 仅在进入体首部记录，退出时由后续退出记录采集快照
                                } else {
                                    BlockStmt newBody = new BlockStmt();
                                    fes.setBody(newBody);
                                    List<String> insideVars = collectVisibleVariables(newBody, -1);
                                    newBody.addStatement(buildRecordStatement(ln, insideVars));
                                    newBody.addStatement(body);
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
                                        bodyBlock.getStatements().addFirst(buildRecordStatement(ln, insideVars));
                                        // 仅在进入体首部记录，退出时由后续退出记录采集快照
                                } else {
                                    BlockStmt newBody = new BlockStmt();
                                    ws.setBody(newBody);
                                    List<String> insideVars = collectVisibleVariables(newBody, -1);
                                    collectDirectVariables(stmt, insideVars);
                                    newBody.addStatement(buildRecordStatement(ln, insideVars));
                                    newBody.addStatement(body);
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
                                    bodyBlock.getStatements().addFirst(buildRecordStatement(ln, insideVars));
                                } else {
                                    BlockStmt newBody = new BlockStmt();
                                    ds.setBody(newBody);
                                    List<String> insideVars = collectVisibleVariables(newBody, -1);
                                    collectDirectVariables(stmt, insideVars);
                                    newBody.addStatement(buildRecordStatement(ln, insideVars));
                                    newBody.addStatement(body);
                                }
                                newStatements.add(ds);
                            } else if (stmt.isIfStmt()) {
                                IfStmt ifs = stmt.asIfStmt();
                                int ln = line;
                                // 在 if 之前插入一次记录以表示条件判断时的高亮（无论 true/false 都应高亮）
                                List<String> condVars = collectVisibleVariables(block, i);
                                collectDirectVariables(stmt, condVars);
                                newStatements.add(buildRecordStatement(ln, condVars));

                                // 不在 then/else 首部再插入进入记录；保持 then/else 原样
                                newStatements.add(ifs);
                            } else {
                                // 兜底：将原语句加入
                                newStatements.add(stmt);
                            }

                            // 在控制流语句之后插入退出记录（except IfStmt：If 已在判断前插入记录，
                            // 不需要额外的退出记录以避免重复高亮）
                            if (!stmt.isIfStmt()) {
                                List<String> visibleAfter = collectVisibleVariables(block, i);
                                // 移除由该控制语句自身声明的循环变量（例如 for-init 的 i/j），
                                // 因为退出语句在该变量作用域之外，引用它们会导致编译错误
                                List<String> declaredHere = getDeclaredNames(stmt);
                                visibleAfter.removeAll(declaredHere);
                                newStatements.add(buildRecordStatement(line, visibleAfter));
                            }
                        } else {
                            newStatements.add(stmt);
                            List<String> visibleAfter = collectVisibleVariables(block, i);
                            newStatements.add(buildRecordStatement(line, visibleAfter));
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

    // 返回节点自身在头部声明的变量名（例如 ForStmt 的 init 中声明的 i）
    private List<String> getDeclaredNames(Node node) {
        List<String> names = new ArrayList<>();
        if (node instanceof ForStmt) {
            ForStmt forStmt = (ForStmt) node;
            for (Expression e : forStmt.getInitialization()) {
                if (e.isVariableDeclarationExpr()) {
                    for (VariableDeclarator vd : e.asVariableDeclarationExpr().getVariables()) {
                        String name = vd.getNameAsString();
                        if (!names.contains(name)) names.add(name);
                    }
                }
            }
            return names;
        }

        if (node instanceof ForEachStmt) {
            ForEachStmt fe = (ForEachStmt) node;
            String name = fe.getVariable().getVariable(0).getNameAsString();
            if (!names.contains(name)) names.add(name);
            return names;
        }

        // 其它语句类型通常不在语句头声明循环变量
        return names;
    }

    //instrument用到的辅助方法，不对外开放接口
    //
    private Statement buildRecordStatement(int line , List<String> varNames){
        //拼接参数
        StringBuilder mapArgs = new StringBuilder();
        for(int i = 0 ; i < varNames.size() ; i++){
            if(i > 0 )mapArgs.append(",");
            String v = varNames.get(i);
            mapArgs.append("\"").append(v).append("\",").append(v);
        }

        //生成完整的语句
        String recordCall = "TraceEngine.record("
        + stepCounter + ","
        + line + ","
        + "java.util.Map.of(" + mapArgs.toString() + ")"
        + ");";
        
        stepCounter ++;

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
    private boolean shouldInstrument(Statement stmt) {
        // 情况1：表达式语句 → 往里看是不是赋值或变量声明
        if (stmt.isExpressionStmt()) {
            Expression expr = stmt.asExpressionStmt().getExpression();
            // 赋值 or 变量声明 → 需要插桩
            return expr.isAssignExpr() || expr.isVariableDeclarationExpr();
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

        //当前 block：只看索引 ≤ beforeStmtIndex 的语句中的变量（跳过嵌套 BlockStmt 内部的，因为还没执行到）
        // BugFix: 跳过 ForStmt/ForEachStmt，它们的循环变量（如 i）作用域仅限于 body 内部，
        // 不能暴露给后续兄弟语句（否则后面语句的 record 引用 i 会导致编译失败）
        NodeList<Statement> statements = block.getStatements();
        for (int i = 0; i <= beforeStmtIndex && i < statements.size(); i++) {
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
                BlockStmt parentBlock = (BlockStmt) parent;
                int childIdx = findChildIndex(parentBlock, currentNode);
                for (int i = 0; i <= childIdx && i < parentBlock.getStatements().size(); i++) {
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

        // 兜底：尝试找到直接的 VariableDeclarator，但过滤掉那些位于嵌套 BlockStmt 内的
        for (VariableDeclarator vd : node.findAll(VariableDeclarator.class)) {
            Node parent = vd.getParentNode().orElse(null);
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

}


    
