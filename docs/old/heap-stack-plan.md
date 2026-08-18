# 真实 JVM 堆/栈可视化实现方案 ✅ 已完成

> **状态：已实现。** 实现细节见 `devlog/2026-06-09-heap-stack-objects.md`。

---

## 目标（已完成）

在 JavaTutor 中，用户运行代码后能直观看到：

- **栈（Stack）**：当前调用栈的栈帧，局部变量表从下往上堆叠。基本类型存值，对象/数组存引用 ID。
- **堆（Heap）**：所有 `new` 创建的对象和数组，含伪地址、slots（数组）或 fields（对象），循环引用被自动打断。

---

## 实现步骤总览

| 步骤 | 层级 | 文件 | 改动内容 | 状态 |
|------|------|------|----------|------|
| 1 | 后端 | `TraceEngine.java` | 新增 `allocArray`/`allocObject`/`isComplexObject`/`ensureHeapObject`/`findHeapIdByRef`/`updateHeapFields`，数组元素复杂对象替换为堆 ID | ✅ |
| 2 | 后端 | `TraceEngine.java` | `record()` 增加 `heap`/`stackFrame` 字段，`deepCopyHeap()` 移除 `_objRef` | ✅ |
| 3 | 后端 | `Instrumenter.java` | `detectArrayAllocations`/`detectObjectAllocations`/`isInnerClassBlock`，`allocObject` 插入到声明之后，跳过内部类构造函数 | ✅ |
| 4 | 后端 | `RunController.java` | `TRACE_ENGINE_SOURCE` 同步全部新方法，异常解包显示根因 | ✅ |
| 5 | 后端 | `InstrumenterTest.java` | 同步 `TRACE_ENGINE_SOURCE`，新增 Person 编译+运行测试 | ✅ |
| 6 | 前端 | `player.js` | 新增 `currentHeap`/`currentStackFrame` getters | ✅ |
| 7 | 前端 | `HeapStackPanel.vue` | 真实堆/栈数据渲染：slots + fields 双模式，栈从下往上排列 | ✅ |

## 实际实现与原始设计的关键差异

| 差异点 | 原始设计 | 实际实现 |
|--------|----------|----------|
| 堆对象 key | 用 ID 作为 key | 用变量名作为 key，`_objRef` 存原始引用用于引用去重 |
| 对象引用去重 | 无 | `findHeapIdByRef(obj)` 通过 `==` 比对 `_objRef`，避免循环引用无限递归 |
| 对象引用共享 | 每个变量名独立堆条目 | `p1 = alice` 时 `ensureHeapObject` 返回已有 ID，不创建新条目，`updateHeapFields` 被跳过 |
| 数组元素 | 存原始对象 | `Person[]` 中复杂对象替换为堆 ID 字符串，避免 Jackson 序列化异常 |
| 内部类跳桩 | `isMainMethodBlock`（太严格） | `isInnerClassBlock`（只跳嵌套类的构造函数，不影响 main 内的 for/if） |
| 异常报告 | 只返回外层消息 | 解包 `InvocationTargetException` 显示根因 |
| InMemoryCompiler | `classFileMap.get()` | `computeIfAbsent` 动态创建内部类 ClassFileObject |
| 栈帧变量持久化 | 每次内存实时快照 | `frameLocals` + `merged` 持久化，新变量在前 |
| 引用共享 | 未处理 | `findHeapNameByRef` 更新源堆条目字段（`p`→`c`） |
| JDK 类 | 反射报错 | `isComplexObject` 排除 `java.*`/`jdk.*`/`sun.*` 包 |
| 静态字段 | 不可见 | `collectVisibleVariables` 收集最外层类 `static` 字段 |

## 测试

```
mvn -f backend/pom.xml clean test -DskipTests=false
→ Tests run: 4, Failures: 0, Errors: 0
```

## 后续扩展

- **多方法调用**：`pushFrame` / `popFrame` 实现真正的栈帧压栈/弹栈 ✅
- **GC 模拟**：对象不再被引用时从堆中移除
- **原始类型数组标签**：`boolean[]`、`double[]` 等
