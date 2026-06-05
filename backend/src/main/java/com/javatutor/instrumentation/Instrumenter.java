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
        CompilationUnit              ← cu 就是这个根节点
        └── ClassOrInterfaceDeclaration
            └── MethodDeclaration
                    └── BlockStmt { }              ← 方法体
                        └── ExpressionStmt
                            └── VariableDeclarationExpr "int n = 3"

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

                //每条有变化的语句后面加上record()
                NodeList<Statement> statements = newBlock.getStatements();
                for (int i = 0; i < statements.size(); i++) {
                    Statement stmt = statements.get(i);
                    if (shouldInstrument(stmt)) {
                        int line = stmt.getBegin().map(pos -> pos.line).orElse(null);
                        // Bug5 修复：只收集当前语句之前（含自身）已声明的变量，避免把后面还没声明的变量也扫进来导致编译失败
                        List<String> visibleVars = collectVisibleVariables(block, i);
                        // 在当前语句后面插入 record()
                        statements.addAfter(buildRecordStatement(line, visibleVars), stmt);
                    }
                }
                return newBlock;
            }
        },null);

        return LexicalPreservingPrinter.print(cu);
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
        NodeList<Statement> statements = block.getStatements();
        for (int i = 0; i <= beforeStmtIndex && i < statements.size(); i++) {
            collectDirectVariables(statements.get(i), vars);
        }

        //往上遍历父级节点
        //currentNode 表示"从哪个子节点上来的"，用于在父级 BlockStmt 中定位正确的子语句索引
        Node currentNode = block;
        Node parent = currentNode.getParentNode().orElse(null);
        while(parent != null){

            if(parent instanceof BlockStmt){
                //父级是 BlockStmt：只收集包含 currentNode 的那条语句及之前的变量
                BlockStmt parentBlock = (BlockStmt) parent;
                int childIdx = findChildIndex(parentBlock, currentNode);
                for (int i = 0; i <= childIdx && i < parentBlock.getStatements().size(); i++) {
                    collectDirectVariables(parentBlock.getStatements().get(i), vars);
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
        for (VariableDeclarator vd : node.findAll(VariableDeclarator.class)) {
            // 检查该 VariableDeclarator 是否在 node 内部的某个嵌套 BlockStmt 中
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


    
