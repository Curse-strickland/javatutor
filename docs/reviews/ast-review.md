# AST 插桩 & 控制器 全面审查

> 审查日期: 2026-06-08 | 基准: `AST_BUGS.md` v1 + 当前代码

---

## 一、AST_BUGS.md 9 条 Bug — 逐条复验

| 编号 | 简述 | 状态 | 验证依据 |
|------|------|------|----------|
| Bug 1 | ExecutionException 线程泄漏 | **已修复** | `RunController.java:119-139` — executor 独立 try-finally |
| Bug 2 | 字节码兜底死代码 | **已修复** | `InMemoryCompiler.java:65` — 死代码已删除 |
| Bug 3 | 行号 null NPE | **已修复** | `Instrumenter.java:85` — `orElse(-1)` |
| Bug 4 | getCode() null 检查 | **已修复** | `RunController.java:75-77` — null + blank 检查 |
| Bug 5 | 插桩预知未声明变量 | **已修复** | `Instrumenter.java:277-325` — `beforeStmtIndex` + `collectDirectVariables` |
| Bug 6 | return 后不可达代码 | **已修复** | `Instrumenter.java:185-189` — record 插在 return 之前 |
| Bug 7 | 无限循环 OOM | **已修复** | `TraceEngine.disabled` + `disable()` + 移除循环退出 record |
| Bug 8 | SM try-finally 范围过大 | **已修复** | executor 生命周期移出 SM try-finally（随 Bug 1 自然解决） |
| Bug 9 | 编译错误英文未汉化 | **已修复** | `InMemoryCompiler.java:97-106` — 6 条翻译映射 |

**结论：AST_BUGS.md 列出的全部 Bug 均已修复。** 补充发现 6 个新问题如下。

---

## 二、新发现 — Instrumenter 层

### [Medium] I-1: 嵌套非块体循环的内部循环体未被插桩

**文件**: `Instrumenter.java:90-180`
**触发条件**: 外层循环体不是 `{...}` 格式，且内层也是一个循环语句。

```java
// 示例：内层 for 的 body (arr[i][j]=0) 不会有 record 调用
for (int i = 0; i < n; i++)
    for (int j = 0; j < m; j++)
        arr[i][j] = 0;
```

**根因**: 对非块体 for/while，代码将原 body 包入新 `BlockStmt` (L103-109)，然后添加 entry record。但新创建的 `BlockStmt` **从未经过 `super.visit()` 递归处理**——被包入的内层 `ForStmt` 已经在上层 `super.visit()` 中被 `ModifierVisitor` 简单遍历过（仅访问，不修改），之后就不再被处理。

处理链：
```
super.visit(outerBlock)
  → ModifierVisitor.visit(outerFor)  // 访问 body=innerFor，仅访问不修改
  → ModifierVisitor.visit(innerFor)  // 访问 body=exprStmt，不修改
← super.visit 返回
// 我们的代码：outerFor 的 body 被包入 new BlockStmt ← 内层 for 从未重新 visit
```

**修复**: 对非块体 body 创建 `newBody` 后，手动递归调用 `super.visit(newBody, null)` 再继续处理：
```java
// Instrumenter.java L103-109: 创建 newBody 后加一行
BlockStmt newBody = new BlockStmt();
fs.setBody(newBody);
newBody = (BlockStmt) super.visit(newBody, null);  // ← 递归处理内层
```

**影响**: 无括号嵌套循环在教学中虽不常见，但学生可能随手写出。前端会缺失部分变量变化记录。

---

### [Medium] I-2: `java.util.Map.of()` 最多 10 对 KV，超限编译失败

**文件**: `Instrumenter.java:221-225`
**行号**: 224

```java
String recordCall = "TraceEngine.record(... java.util.Map.of(" + mapArgs + ")" + ");";
```

`java.util.Map.of()` 重载最多接受 10 对 key-value。若某时刻可见变量超过 10 个（如全局声明 12 个变量后执行赋值），生成的代码调用 `Map.of(k1,v1,...,k12,v12)` 无匹配重载 → 编译失败。

**触发场景**: 用户在一个 block 内声明 11+ 个变量，然后对它们之一赋值。`collectVisibleVariables` 会包含所有可见变量 → `mapArgs` 包含 11+ 对 → 编译错误。

**修复**: 将 `Map.of()` 替换为动态构建方式，确保护展性：
```java
// 方案 A: 静态工厂方法加到 TraceEngine，内部用 LinkedHashMap 构建
// 方案 B: 直接生成 new LinkedHashMap<>() {{ put(...); put(...); }} 匿名类
String recordCall = "TraceEngine.record(" + stepCounter + "," + line
    + ", TraceEngine.buildMap(new Object[]{" + flatArgs + "}));";
```

或在 `TraceEngine` 中新增：
```java
public static Map<String, Object> buildMap(Object... pairs) {
    LinkedHashMap<String, Object> m = new LinkedHashMap<>();
    for (int i = 0; i < pairs.length; i += 2) {
        m.put((String) pairs[i], pairs[i+1]);
    }
    return m;
}
```

---

### [Low] I-3: 独立 `++`/`--` 不被插桩，与 `+= 1` 行为不一致

**文件**: `Instrumenter.java:244-263`

```java
i++;       // UnaryExpr → shouldInstrument() 返回 false → 不插桩
i += 1;    // AssignExpr → shouldInstrument() 返回 true  → 插桩
```

二者语义等价，前端体验却不同：`i++` 所在行不会高亮（无对应 step），`i += 1` 会。对教学场景，学生可能困惑为何某些行"没反应"。

**修复**: `shouldInstrument` 中增加 `UnaryExpr` 的前后缀自增/自减判断：
```java
if (stmt.isExpressionStmt()) {
    Expression expr = stmt.asExpressionStmt().getExpression();
    if (expr.isAssignExpr() || expr.isVariableDeclarationExpr()) return true;
    if (expr.isUnaryExpr()) {
        UnaryExpr.Operator op = expr.asUnaryExpr().getOperator();
        if (op == UnaryExpr.Operator.PREFIX_INCREMENT
            || op == UnaryExpr.Operator.PREFIX_DECREMENT
            || op == UnaryExpr.Operator.POSTFIX_INCREMENT
            || op == UnaryExpr.Operator.POSTFIX_DECREMENT) {
            return true;
        }
    }
}
```

---

### [Low] I-4: `stepCounter` 字段非线程安全

**文件**: `Instrumenter.java:16, 44, 227`
**行号**: 16, 44

`Instrumenter` 是 Spring 单例（`RunController.java:21` 的 `private final` 字段）。`stepCounter` 在 `instrument()` 开头重置，在 `buildRecordStatement()` 内递增。高并发时可能存在：
- 请求 A 在 `buildRecordStatement` 中读取 `stepCounter`
- 请求 B 的 `instrument()` 将 `stepCounter` 重置为 1
- 请求 A 拿到错误值

**影响**: 低（`instrument()` 极快，窗口极窄；step 号仅用于前端排序，不影响正确性）。

**修复**: 改为局部变量传递或 `ThreadLocal`：
```java
public String instrument(String userCode) {
    int localStepCounter = 1;
    // 通过闭包传递给 buildRecordStatement 或用 AtomicInteger
}
```

但最简单的方案是把 `stepCounter` 改为 `instrument()` 方法内的局部变量，通过方法参数传递。

---

### [Low] I-5: ForEach 非块体处理缺失 `collectDirectVariables` 调用

**文件**: `Instrumenter.java:123-128`

```java
// ForStmt 非块体: L103-109 有 collectDirectVariables(stmt, insideVars)
// ForEachStmt 非块体: L123-128 缺少 collectDirectVariables(stmt, insideVars)
```

**实际影响**: 无。`collectVisibleVariables(newBody, -1)` 在 parent traversal 中会走 `collectDirectVariables(ForEachStmt, vars)` (L363-368)，已包含循环变量。缺少显式调用只是代码不一致，不构成功能 bug。

**修复**: 为一致性补上：
```java
} else {
    BlockStmt newBody = new BlockStmt();
    fes.setBody(newBody);
    List<String> insideVars = collectVisibleVariables(newBody, -1);
    collectDirectVariables(stmt, insideVars);  // ← 补上
    newBody.addStatement(buildRecordStatement(ln, insideVars));
    newBody.addStatement(body);
}
```

---

## 三、新发现 — 测试层

### [Medium] T-1: `InstrumenterTest.testFibonacciAndDetectBugs` 的 Bug 1 断言已过时

**文件**: `InstrumenterTest.java:239`
**行号**: 239

```java
assertFalse(linesWithEnter.isEmpty(), "Bug 1 应可复现：进入和退出 for 的 record 行号相同");
```

该断言**期望 Bug 1 存在**（进入和退出 record 行号相同）。但 Bug 7 修复（移除循环退出 record）后，不再有退出 record → `linesWithEnter ∩ linesWithExit` 为空 → `isEmpty()` 为 `true` → `assertFalse(true)` **失败**。

当前运行 `mvn test` 时此测试会 FAIL。

**修复**: 将断言语义反转：
```java
assertTrue(linesWithEnter.isEmpty(),
    "Bug 1 已修复：进入和退出 for 不再共用行号 → 前端可正常重渲染");
```

同时更新行 220-232 的变量命名（`linesWithExit` 现在是"不含 i 的 step 行号"，不一定是"退出"记录）。

---

## 四、新发现 — RunController 层

### [Low] C-1: `extractClassName` 和 `removePackageDeclaration` 重复解析 AST

**文件**: `RunController.java:161-173`

整个 `/api/run` 流程中，用户代码被 JavaParser 解析了 **至少 3 次**：
1. `SandboxValidator.validate(userCode)` → parse (L82)
2. `extractClassName(userCode)` → parse (L88)
3. `removePackageDeclaration(instrumentedCode)` → parse (L94)

加上 Instrumenter 内部的 `StaticJavaParser.parse(userCode)` (L38)，同一份代码被解析 4 次。

**影响**: 低（JavaParser 解析很快），但可优化。

---

## 五、潜在增强建议

### E-1: 循环条件判断缺少高亮记录

For/While 循环仅有 entry record（位于 body 首部），没有"条件检查"的独立 step。对比 if 语句（在 if 之前插入 condition record），循环的初始条件检查不会被可视化。对教学来说，显示"判断 `i < n` → true → 进入循环体"的过渡步骤有价值。

### E-2: 方法调用链变量状态不可见

`System.out.println(x)`、`Math.max(a, b)` 等方法调用不会产生 step。如果学生在算法中间打印调试，这些行不会高亮。

### E-3: try-catch 不被插桩

`try { ... } catch (Exception e) { ... }` 的 try/catch body 通过 `super.visit()` 递归处理后会被插桩，但异常发生时的变量状态不会记录。如果需要展示异常发生点的变量快照，需要额外处理。

---

## 六、修复优先级

| 优先级 | 编号 | 问题 | 文件 |
|--------|------|------|------|
| **高** | T-1 | 测试断言过时，`mvn test` 失败 | `InstrumenterTest.java:239` |
| **中** | I-1 | 嵌套非块体循环内层未插桩 | `Instrumenter.java:103-109` |
| **中** | I-2 | Map.of() 10 对 KV 上限 | `Instrumenter.java:224` |
| **低** | I-3 | ++/-- 不被插桩 | `Instrumenter.java:244-263` |
| **低** | I-4 | stepCounter 线程安全 | `Instrumenter.java:16,44` |
| **低** | I-5 | ForEach 代码不一致 | `Instrumenter.java:123-128` |
| **低** | C-1 | 重复 AST 解析 | `RunController.java:161-173` |

---

## 七、已验证合理的"非问题"

以下行为经确认是正确的设计决策，非 bug：

- **循环移除退出 record**（Bug 7 修复）— 避免无限循环时退出 record 成为不可达代码。前端通过 VariablePanel 的 value-based deduplication 仍能正确渲染（同一行号不同值 → 会闪光刷新；同一行号同值 → 跳过）。
- **if 单语句体不包装 BlockStmt** — 仅记录条件判断，body 不被插桩。这是有意设计（if body 不是 BlockStmt 时 `super.visit` 不触发 `visit(BlockStmt)`）。
- **collectVisibleVariables 用原 block 而非 newBlock**（L171）— 原 block 仍有正确的 parent 引用且变量声明一致，不影响正确性。
- **WhileStmt/DoStmt collectDirectVariables 直接返回**（L370-372）— while/do 自身不声明可见到外作用域的变量，正确。
