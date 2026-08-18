# 真实 JVM 堆/栈可视化 — 实现总结

> 日期：2026-06-10
> 关联计划：`docs/heap-stack-plan.md`

## 改动总览

| 文件 | 改动 |
|------|------|
| `TraceEngine.java` | +`callStack`/`frameLocals`，`pushFrame`/`popFrame`，`record()` 生成 `stackFrames`，`isComplexObject` 排除 JDK 类，`findHeapNameByRef` |
| `Instrumenter.java` | +`visit(MethodDeclaration)` try-finally 包方法体，`collectVisibleVariables` 反序遍历+静态字段收集，`collectDirectVariables` 过滤 FieldDeclaration/Callable/IfStmt |
| `InMemoryCompiler.java` | `getJavaFileForOutput` 用 `computeIfAbsent` 动态创建内部类 ClassFileObject |
| `RunController.java` | `TRACE_ENGINE_SOURCE` 同步全部 |
| `InstrumenterTest.java` | `TRACE_ENGINE_SOURCE` 同步 |
| `player.js` | +`currentHeap`/`activeStackFrames` getters |
| `HeapStackPanel.vue` | 真实堆/栈渲染：slots + fields 双模式，多栈帧从下往上排列 |

## 核心实现

### 调用栈（Stack Frames）
- `pushFrame/popFrame` 管理帧列表
- `visit(MethodDeclaration)` 用 try-finally 包装：`try { pushFrame; body } finally { popFrame }`，确保递归正确叠加/回收
- `record()` 持久化每帧局部变量到 `frameLocals`（新变量在前、旧变量在后）
- 栈帧按后进先出顺序从底部展示到顶部

### 堆（Heap Objects）
- 数组：`allocArray(name, length)` 注册，`updateHeapSlots` 快照
- 对象：`allocObject(name, obj)` + `_objRef` 引用去重 + `findHeapIdByRef` 循环引用打断
- 对象字段：`updateHeapFields` 反射遍历，引用型字段存 `{"ref": id}`
- 内部类 Person：`InMemoryCompiler.computeIfAbsent` 动态创建 `UserCode$Person` 的 ClassFileObject
- 引用共享更新：`findHeapNameByRef` 在 `p` 指向已存在对象 `c` 时，更新源堆条目 `c` 的字段

### 变量可见性修复
- `collectVisibleVariables` 同 BlockStmt 内反序遍历（后声明变量在栈顶）
- `collectDirectVariables` 跳过 `ClassOrInterfaceDeclaration`（防止 Person 字段泄漏）、`CallableDeclaration`、`IfStmt`
- 类静态字段 `static int counter` 正确收集

## 验证

```bash
mvn test -DskipTests=false
→ Tests run: 4, Failures: 0, Errors: 0
```

## BUG修复汇总

1. **Person内部类字段泄漏**：`collectDirectVariables` 增加 `ClassOrInterfaceDeclaration`、`CallableDeclaration`、`IfStmt` 跳过
2. **内部类编译NPE**：`getJavaFileForOutput` 改用 `computeIfAbsent`
3. **栈帧变量缺失**：`frameLocals` 持久化，每帧独立
4. **栈中n只在顶帧显示**：每帧独立 `frameLocals`
5. **死代码清理**：删除 `currentMethod()`、`_retVal`、`formatReturnVal`、`detectReturnMethodCall`
6. **JDK 类反射异常**：`isComplexObject` 排除 `java.*`/`jdk.*`/`sun.*` 包
7. **静态字段不可见**：`collectVisibleVariables` 收集最外层类的 `static` 字段
8. **引用共享对象字段不更新**：`findHeapNameByRef` 更新源堆条目字段
9. **帧内变量顺序**：新变量在前、旧变量在后（`merged` 逻辑）
10. **TRACE_ENGINE_SOURCE 死代码**：删除残留的 `currentMethod()`
11. **JDK 集合类（Stack/Queue）不可见**：`record()` 中加 `Collection<?>` 分支，浅拷贝为数组存入堆
12. **引用共享字段填充**：`isComplexObject(fv)` 找到已有条目时仍调用 `updateHeapFields` 填充字段（用 `visited` 防循环）
13. **变量面板不显示调用方帧变量**：`currentVariables` getter 合并所有栈帧的 locals
14. **`else if` 条件无高亮**：`IfStmt` 处理中递归给 `elseIf` 包一层 record
15. **for 循环旧变量不淘汰**：帧 locals 改为完全替换（`new LinkedHashMap<>(varsCopy)`），过期变量自然消失

