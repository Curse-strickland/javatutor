# 2026-06-09 数据结构可视化 — 后端待办

## 现状

前端已准备好 4 个可视化组件，但后端数据采集未跟上：

| 前端组件 | 期望数据格式 | 后端状态 |
|----------|-------------|----------|
| ArrayCanvas | `[5, 3, 8]`（数组拷贝成 List） | ✅ 已有 |
| LinkedListCanvas | `{id, val, next}` 嵌套节点对象 | ❌ 未实现 |
| RecursionStackCanvas | `_recursionStack_: {frames: [...], activeFrameIndex}` | ❌ 未实现 |
| HeapStackPanel | 栈变量 + 堆对象（含 `_heapRef` / `id`） | ⚠️ 底层方法已定义但未接入 |

TraceEngine 源码（`TRACE_ENGINE_SOURCE` 在 RunController 中）已定义 `isComplexObject`、`ensureHeapObject`、`allocObject`、`updateHeapFields`、`allocArray`、`updateHeapSlots`、`deepCopyArray` 等方法，但 `record()` 只调用 `deepCopyValue()`（仅处理数组），**复杂对象原样返回、栈/递归未被追踪。**

---

## 改动项

### 1. TraceEngine — `record()` 接入对象字段展开

**文件**: `RunController.java` → `TRACE_ENGINE_SOURCE`

**当前**：`deepCopyValue()` 对非数组对象直接 `return v`（对象引用透传）。

**改为**：`deepCopyValue()` 内检测 `isComplexObject(v)`，若是复杂对象则递归展开字段为 Map 结构。

```java
// 伪代码
private static Object deepCopyValue(Object v) {
    if (v == null) return null;
    if (v.getClass().isArray()) {
        // ...已有逻辑...
    }
    if (isComplexObject(v)) {
        // 递归展开字段，生成 {id, val, next, _heapRef, ...}
        String heapId = ensureHeapObject(nameHint, v);
        updateHeapFields(nameHint, v);
        return buildObjectSnapshot(v);  // 返回可 JSON 序列化的 Map
    }
    return v;
}
```

**关键点**：
- 对链表节点（`Node` 类），字段展开后前端自动识别 `id` + `val` + `next`
- 递归深度需限制（死循环防止 `Node.next → Node`）
- 对于 `next` 字段指向的对象，存入 heapObjects Map 后只返回引用 id

### 2. TraceEngine — `record()` 接入 heapObjects 输出

**当前**：`heapObjects` 被维护但未附加到 `record.put(...)` 中。

**改为**：`record()` 末尾将当前 `heapObjects` 的快照写入 `record.put("heap", ...)`。

```java
record.put("heap", new LinkedHashMap<>(heapObjects));
```

HeapStackPanel 渲染堆区需要此字段。

### 3. Instrumenter — 递归调用栈采集

**文件**: `Instrumenter.java`

**当前**：无递归方法调用检测。

**改为**：
- 新增 `RecursionTracker` 辅助类：一个 `Stack<String>` 记录当前递归深度的方法名
- 在方法体的第一句 `addFirst` 处 push 当前方法帧
- 在 `return` 语句的 record 前 pop 帧
- TraceEngine 暴露 `pushFrame(name, vars)` / `popFrame(returnValue)` 方法
- `_recursionStack_` 作为特殊变量注入到 step 的 variables 中

```java
// TraceEngine 新增
public static void pushFrame(String methodName, Map<String,Object> args) { ... }
public static void popFrame(Object returnValue) { ... }
public static Map<String,Object> getStackSnapshot() { ... }
```

### 4. 三处同步

改动涉及三份 TraceEngine 源码，**每次改动须三处一致**：

| 位置 | 用途 |
|------|------|
| `RunController.TRACE_ENGINE_SOURCE` | 运行时实际编译执行的代码 |
| `compiler/TraceEngine.java` | 磁盘副本，IDE 可引用 |
| `InstrumenterTest.TRACE_ENGINE_SOURCE` | 单元测试用 |

### 5. Instrumenter — `buildRecordStatement` 支持复杂对象作为变量参数

**当前**：`buildRecordStatement` 生成 `Map.of("name", varName)` 格式，变量名直接拼入 Java 代码。

**对于对象变量不需要改动**：`Map.of("head", head)` 把 `head` 对象传进 TraceEngine 后，由 TraceEngine 的 `deepCopyValue` 做反射展开。Instrumenter 无需感知对象结构。

---

## 优先级

| 优先级 | 改动 | 理由 |
|--------|------|------|
| P0 | 对象字段展开 `deepCopyValue` | 链表可视化依赖此功能 |
| P1 | heapObjects 输出到 step | 堆/栈面板显示对象 |
| P2 | 递归栈采集 | RecursionStackCanvas 依赖 |
| P3 | Instrumenter 递归调用检测 | 配合 P2 |

---

## 验证

- 冒泡排序 → ArrayCanvas 正常（无回归）
- `Node head = new Node(5); head.next = new Node(3);` → LinkedListCanvas 渲染两个节点 + 箭头
- `fib(5)` → RecursionStackCanvas 显示 5 层调用帧
