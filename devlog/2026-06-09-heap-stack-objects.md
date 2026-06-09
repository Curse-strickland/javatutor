# Devlog: 2026-06-09 — 真·JVM 堆/栈可视化（对象支持 + 数组元素安全序列化）

## 背景

之前 HeapStackPanel 只是把标量变量放栈、数组变量放堆，不是真正的 JVM 内存模型。
现在通过修改插桩和 TraceEngine，实现了：
- 对象（`new Person(...)`）注册到堆，栈里只存引用 ID
- 对象字段浅拷贝到堆，打断 alice↔bob 循环引用
- 数组元素中的对象引用替换为堆 ID 字符串，避免 Jackson 序列化异常
- 对象引用共享：`p1 = alice` 时复用同一堆条目
- 数组/对象修改在堆上反映，栈引用不变

## 改动清单

### 后端

| 文件 | 改动 |
|------|------|
| `TraceEngine.java` | 新增 `allocObject`、`isComplexObject`、`ensureHeapObject`、`findHeapIdByRef`、`updateHeapFields`；`record()` 数组元素为复杂对象时替换为堆 ID；引用去重后跳过 `updateHeapFields`；引入 `java.lang.reflect.Field/Modifier` |
| `Instrumenter.java` | 新增 `detectObjectAllocations()` / `buildAllocObjectStatement()` / `isInnerClassBlock()`；`allocObject` 插入到声明**之后**；`collectDirectVariables` 跳过内部类声明；`visit(BlockStmt)` 仅跳过内部类构造函数块 |
| `InMemoryCompiler.java` | `getJavaFileForOutput` 改为 `computeIfAbsent` — 内部类（`UserCode$Person`）自动创建 ClassFileObject |
| `RunController.java` | `TRACE_ENGINE_SOURCE` 同步全部新方法 + 异常解包显示根因 |
| `InstrumenterTest.java` | `TRACE_ENGINE_SOURCE` 添加 `allocObject`；新增 `testPersonCodeInstrumentationCompilesAndRuns` 测试 |

### 前端

| 文件 | 改动 |
|------|------|
| `HeapStackPanel.vue` | 堆区增加 `fields` 渲染；栈变量顺序反转（从下往上堆叠，JVM 风格） |

## 关键设计

### 循环引用打断

```
alice.friend = bob;
bob.friend = alice;
```

`updateHeapFields` 中使用反射获取对象的声明字段：
- `findHeapIdByRef(obj)` 通过 `_objRef` 引用比对检测对象是否已注册
- 已注册 → 只存 `{"ref": "0x..."}`，不递归
- 未注册 → 递归注册
- `deepCopyHeap()` 中 `shallow.remove("_objRef")` 移除内部引用，防止 Jackson 序列化异常

### 对象引用共享

```
Person p1 = alice;  // p1 和 alice 指向同一个人
```

`ensureHeapObject("p1", alice)` → `findHeapIdByRef(alice)` 返回已有 ID → 不创建新堆条目。
`record()` 中检查 `heapObjects.containsKey("p1")` 为 false → 跳过 `updateHeapFields`。
栈上：`p1 → 0x1A2B` 和 `alice → 0x1A2B` 指向同一对象。

### 内部类支持

- `isInnerClassBlock()` 仅跳过嵌套类构造函数的块，不影响 main 方法内的控制流块
- `InMemoryCompiler.getJavaFileForOutput` 对内部类（`UserCode$Person`）动态创建 ClassFileObject
- `collectDirectVariables` 遇到 `ClassOrInterfaceDeclaration` 直接跳过

### 数组元素安全序列化

`Person[] people = {alice, bob, null}` → `record()` 处理数组时：
- `alice`、`bob` 是复杂对象 → 替换为堆 ID `"0x..."`
- `null` → 保留
- `varsCopy.put("people", ["0x1A2B", "0x3F4C", null])` — 纯字符串/数字，Jackson 安全序列化

## 验证

```
mvn -f backend/pom.xml clean test -DskipTests=false
→ Tests run: 4, Failures: 0, Errors: 0
```

API 测试（完整 Person 代码含 `p1=alice`、`alice.friend=bob` 循环引用、`Person[]` 数组）：
```
success=True, steps=8
```

## 多方法调用栈帧支持

- `TraceEngine` 维护 `ArrayDeque<Map<String,Object>>` 作为调用栈，`pushFrame()`/`popFrame()` 在方法进入/退出时压栈/弹栈
- `Instrumenter` 在 `else` 分支检测方法调用语句，插入 push/pop
- 前端 `HeapStackPanel` 多帧渲染，最新帧从下往上排列

## 本轮额外修复（2026-06-09 sprint 2）

### 数组元素赋值中的对象创建检测
`detectObjectAllocations` 扩展为同时检测 `AssignExpr`（如 `arr[0] = new Item(10)`），而不仅限于 `VariableDeclarationExpr`。

### 数组复杂元素的字段填充
`record()` 数组元素循环中新增 `updateHeapFields`，确保 `allocObject` 创建的空 entries 被填充实际字段值。

### `ensureHeapObject` 引用重绑定检测
名称已存在时检查 `_objRef` 是否匹配当前对象。`arr[0] = arr[1]` 后通过 `findHeapIdByRef` 返回 `arr[1]` 的 ID。

### `updateHeapFields` 的 `_objRef` 保护
仅当 `heapObjects.get(name)._objRef == elem` 或条目为新创建时才执行，防止引用重绑定后错误更新旧条目。

### 嵌套数组深拷贝
新增 `deepCopyArray()` 递归方法，修复 `int[][]` 内层数组作为引用存储导致快照被污染的问题。

### `allocObject` 使用目标表达式而非构造表达式
`buildAllocObjectStatement` 改回单参数 `targetExpr`，生成 `allocObject("head.next", head.next)` 而非 `allocObject("head.next", new ListNode(2))`，后者会创建额外对象导致实际引用不匹配。

### `updateHeapFields` 递归 visited set 填充字段
新增 `updateHeapFields(String name, Object obj, Set<Object> visited)` 重载：
- 对象字段中已注册的堆条目（如 `head.next`）即使被 `findHeapIdByRef` 找到，也会通过其注册名调用 `updateHeapFields` 填充字段值
- `visited` 集合防止 `alice↔bob` 循环引用再次触发无限递归
- `heapObj.get("_objRef") != obj` 检测跳过已被重绑定的旧条目

### `RunController.TRACE_ENGINE_SOURCE` 同步
嵌入的 TraceEngine 源码字符串同步全部最新逻辑（visited set、`_objRef` 保护、引用重绑定检测）

## 死代码审查

已审查全部修改文件，无死代码。`heap-stack-plan.md` 同步更新。