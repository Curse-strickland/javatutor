
# 后端数据结构可视化支持 — 改造指南

> **面向**：后端开发（A/B）  
> **目标**：让前端 `LinkedListCanvas.vue` 和 `RecursionStackCanvas.vue` 能正确渲染  
> **核心改动**：`TraceEngine.java` 的对象序列化 + 递归调用栈追踪

---

## 一、现状问题

| 画布 | 前端组件 | 当前状态 | 不显示原因 |
|------|---------|---------|-----------|
| 链表画布 | `LinkedListCanvas.vue` | 组件已写好，已集成到 `VariablePanel.vue` | 后端 `TraceEngine` 不序列化对象字段，JSON 中没有 `{id, val, next}` 结构 |
| 递归栈画布 | `RecursionStackCanvas.vue` | 组件已写好，已集成到 `VariablePanel.vue` | 后端没有调用栈追踪机制，JSON 中没有 `_recursionStack_` 数据 |

---

## 二、改造任务总览

| 任务 | 优先级 | 难度 | 涉及文件 |
|------|--------|------|---------|
| **任务1**：TraceEngine 对象字段序列化 | ⭐⭐⭐ 高 | 中 | `TraceEngine.java` |
| **任务2**：递归调用栈追踪 | ⭐⭐ 中 | 高 | `TraceEngine.java` + `Instrumenter.java` |

---

## 三、任务1：TraceEngine 对象字段序列化

### 3.1 问题说明

当前 `TraceEngine.record()` 只处理了两种情况：
- **数组**：逐元素拷贝为 `List`
- **其他对象**：直接存引用 `varsCopy.put(key, v)`

当用户代码中有链表节点对象时，直接存引用会导致 JSON 序列化时字段丢失（Jackson 可能无法正确序列化任意 Java 对象的字段）。

### 3.2 期望行为

对于非基本类型、非数组、非 String 的对象，使用**反射提取其所有实例字段**，序列化为 `Map<String, Object>`。

### 3.3 前端期望的链表节点 JSON 格式

```json
{
  "step": 1,
  "line": 5,
  "variables": {
    "head": {
      "id": "node1",
      "val": 5,
      "next": {
        "id": "node2",
        "val": 3,
        "next": {
          "id": "node3",
          "val": 8,
          "next": null
        }
      }
    }
  }
}
```

> **注意**：`next` 字段如果指向另一个节点对象，也需要递归序列化。如果存在循环引用（如环形链表），需要用 `id` 字符串引用来打破循环。

### 3.4 参考实现

在 `TraceEngine.java` 中添加以下方法：

```java
import java.lang.reflect.Field;
import java.lang.reflect.Modifier;

// ========== 新增：对象序列化支持 ==========

/**
 * 判断是否为基本类型或包装类
 */
private static boolean isPrimitiveOrWrapper(Object v) {
    return v instanceof Boolean || v instanceof Byte || v instanceof Character ||
           v instanceof Short || v instanceof Integer || v instanceof Long ||
           v instanceof Float || v instanceof Double;
}

/**
 * 使用反射将对象的实例字段提取为 Map，便于 JSON 序列化
 * 支持递归序列化嵌套对象（如链表的 next 指针）
 * 使用 visited 集合防止循环引用导致栈溢出
 */
private static Object deepSerialize(Object obj, Set<Object> visited) {
    if (obj == null) return null;
    if (isPrimitiveOrWrapper(obj) || obj instanceof String) return obj;
    
    // 数组处理
    if (obj.getClass().isArray()) {
        int len = Array.getLength(obj);
        List<Object> list = new ArrayList<>(len);
        for (int i = 0; i < len; i++) {
            list.add(deepSerialize(Array.get(obj, i), visited));
        }
        return list;
    }
    
    // 防止循环引用：如果已经访问过该对象，返回其 id 或 toString
    if (visited.contains(obj)) {
        return tryGetId(obj);
    }
    visited.add(obj);
    
    // 普通对象：反射提取字段
    LinkedHashMap<String, Object> map = new LinkedHashMap<>();
    try {
        for (Field f : obj.getClass().getDeclaredFields()) {
            if (Modifier.isStatic(f.getModifiers())) continue;
            f.setAccessible(true);
            Object val = f.get(obj);
            map.put(f.getName(), deepSerialize(val, visited));
        }
    } catch (Exception ignored) {}
    return map;
}

/**
 * 尝试获取对象的 id 字段，用于打破循环引用
 */
private static Object tryGetId(Object obj) {
    try {
        Field idField = obj.getClass().getDeclaredField("id");
        idField.setAccessible(true);
        return idField.get(obj);
    } catch (Exception e) {
        return obj.toString();
    }
}
```

修改 `record()` 方法中的对象处理逻辑：

```java
public static void record(int step, int line, Map<String,Object> vars) {
    if (disabled) return;
    LinkedHashMap<String,Object> record = new LinkedHashMap<>();
    record.put("step", step);
    record.put("line", line);
    LinkedHashMap<String,Object> varsCopy = new LinkedHashMap<>();
    
    // 每个步骤使用新的 visited 集合，避免跨步骤干扰
    Set<Object> visited = new HashSet<>();
    
    for (Map.Entry<String,Object> e : vars.entrySet()) {
        varsCopy.put(e.getKey(), deepSerialize(e.getValue(), visited));
    }
    record.put("variables", varsCopy);
    steps.add(record);
}
```

### 3.5 验证方法

用户编写如下代码测试：

```java
public class UserCode {
    static class ListNode {
        String id;
        int val;
        ListNode next;
        ListNode(String id, int val) { this.id = id; this.val = val; }
    }
    
    public static void main(String[] args) {
        ListNode head = new ListNode("n1", 5);
        head.next = new ListNode("n2", 3);
        head.next.next = new ListNode("n3", 8);
        // 此时前端应能看到链表画布：[5] -> [3] -> [8]
    }
}
```

检查 `/api/run` 返回的 JSON 中，`head` 变量应为嵌套的 `{id, val, next}` 结构。

---

## 四、任务2：递归调用栈追踪

### 4.1 问题说明

前端 `RecursionStackCanvas.vue` 需要一个名为 `_recursionStack_` 的特殊变量，格式如下。但后端目前没有任何调用栈追踪机制。

### 4.2 前端期望的递归栈 JSON 格式

```json
{
  "step": 3,
  "line": 5,
  "variables": {
    "n": 3,
    "_recursionStack_": {
      "frames": [
        {
          "id": "f1",
          "name": "factorial(3)",
          "variables": { "n": 3 },
          "returnValue": null
        },
        {
          "id": "f2",
          "name": "factorial(2)",
          "variables": { "n": 2 },
          "returnValue": null
        }
      ],
      "activeFrameIndex": 1,
      "returningFrameIndices": []
    }
  }
}
```

**字段说明**：

| 字段 | 类型 | 说明 |
|------|------|------|
| `frames` | `Array` | 调用栈中所有帧，**底部在前，顶部在后** |
| `frames[].id` | `String` | 帧的唯一标识，建议格式 `f{序号}` |
| `frames[].name` | `String` | 函数名 + 参数值，如 `factorial(3)` |
| `frames[].variables` | `Object` | 该帧的局部变量快照 |
| `frames[].returnValue` | `any` | 函数返回值，未返回时为 `null` |
| `activeFrameIndex` | `Number` | 当前活跃帧的索引（0-based） |
| `returningFrameIndices` | `Array<Number>` | 正在返回（回溯）中的帧索引列表 |

### 4.3 实现方案

#### 方案概述

1. **TraceEngine 新增调用栈管理**：维护一个 `callStack`（`List<Frame>`）
2. **Instrumenter 在方法入口/出口插桩**：插入 `TraceEngine.pushFrame()` 和 `TraceEngine.popFrame()` 调用
3. **每次 record() 时自动附加 `_recursionStack_`**

#### 4.3.1 TraceEngine 新增方法

```java
// ========== 新增：递归调用栈追踪 ==========

/** 调用栈帧 */
public static class StackFrame {
    public String id;
    public String name;
    public Map<String, Object> variables;
    public Object returnValue;
    
    public StackFrame(String id, String name, Map<String, Object> vars) {
        this.id = id;
        this.name = name;
        this.variables = new LinkedHashMap<>(vars);
        this.returnValue = null;
    }
}

/** 全局调用栈 */
private static List<StackFrame> callStack = new ArrayList<>();
private static int frameCounter = 0;

/** 方法进入时调用 */
public static void pushFrame(String methodName, Map<String, Object> params) {
    frameCounter++;
    String id = "f" + frameCounter;
    callStack.add(new StackFrame(id, methodName, params));
}

/** 方法返回时调用 */
public static void popFrame(Object returnValue) {
    if (!callStack.isEmpty()) {
        StackFrame top = callStack.get(callStack.size() - 1);
        top.returnValue = returnValue;
    }
}

/** 在 record 时自动附加调用栈信息 */
private static void attachCallStack(Map<String, Object> varsCopy) {
    if (callStack.isEmpty()) return;
    
    LinkedHashMap<String, Object> stackData = new LinkedHashMap<>();
    List<LinkedHashMap<String, Object>> framesList = new ArrayList<>();
    
    for (StackFrame frame : callStack) {
        LinkedHashMap<String, Object> frameMap = new LinkedHashMap<>();
        frameMap.put("id", frame.id);
        frameMap.put("name", frame.name);
        frameMap.put("variables", frame.variables);
        frameMap.put("returnValue", frame.returnValue);
        framesList.add(frameMap);
    }
    
    stackData.put("frames", framesList);
    stackData.put("activeFrameIndex", callStack.size() - 1);
    stackData.put("returningFrameIndices", new ArrayList<>());
    
    varsCopy.put("_recursionStack_", stackData);
}
```

修改 `record()` 方法，在最后调用 `attachCallStack`：

```java
public static void record(int step, int line, Map<String,Object> vars) {
    // ... 原有逻辑 ...
    record.put("variables", varsCopy);
    
    // 新增：自动附加调用栈信息
    attachCallStack(varsCopy);
    
    steps.add(record);
}
```

`reset()` 方法中清理调用栈：

```java
public static void reset() {
    steps.clear();
    callStack.clear();
    frameCounter = 0;
    disabled = false;
}
```

#### 4.3.2 Instrumenter 插桩方法入口/出口

在 `Instrumenter.java` 的 `ModifierVisitor` 中，对每个 `MethodDeclaration` 进行插桩：

**方法入口**（在方法体第一行插入）：
```java
// 生成代码示例：
TraceEngine.pushFrame("factorial", java.util.Map.of("n", n));
```

**方法出口**（在每个 return 语句前插入）：
```java
// 对于 return expr; 改为：
TraceEngine.popFrame(expr);
return expr;

// 对于无返回值的 return; 改为：
TraceEngine.popFrame(null);
return;
```

**Visitor 实现参考**：

```java
// 在 Instrumenter.java 的 cu.accept() 中新增 MethodDeclaration 的 visit
@Override
public Visitable visit(MethodDeclaration md, Void arg) {
    MethodDeclaration md2 = (MethodDeclaration) super.visit(md, arg);
    
    BlockStmt body = md2.getBody().orElse(null);
    if (body == null) return md2;
    
    // 1. 收集方法参数名
    List<String> paramNames = new ArrayList<>();
    for (Parameter p : md2.getParameters()) {
        paramNames.add("\"" + p.getNameAsString() + "\"");
        paramNames.add(p.getNameAsString());
    }
    
    // 2. 构造 pushFrame 调用
    String methodName = md2.getNameAsString();
    String pushCall = "TraceEngine.pushFrame(\"" + methodName + "(" + 
        buildParamDesc(md2) + ")\", java.util.Map.of(" + 
        String.join(",", paramNames) + "));";
    
    body.getStatements().addFirst(StaticJavaParser.parseStatement(pushCall));
    
    return md2;
}

// 辅助方法：构建参数描述字符串
private String buildParamDesc(MethodDeclaration md) {
    StringBuilder sb = new StringBuilder();
    for (int i = 0; i < md.getParameters().size(); i++) {
        if (i > 0) sb.append(", ");
        Parameter p = md.getParameters().get(i);
        sb.append("\"").append(p.getNameAsString()).append("=\"").append(p.getNameAsString());
    }
    return sb.toString();
}
```

### 4.4 验证方法

用户编写如下递归代码测试：

```java
public class UserCode {
    public static int factorial(int n) {
        if (n <= 1) return 1;
        return n * factorial(n - 1);
    }
    
    public static void main(String[] args) {
        int result = factorial(3);
        // 前端应能看到递归栈画布：
        // factorial(3) → factorial(2) → factorial(1)
        // 然后逐层回溯消失
    }
}
```

检查 `/api/run` 返回的 JSON 中：
1. 每个 step 的 `variables` 中应包含 `_recursionStack_`
2. `frames` 数组应随递归深度增加而增长
3. 回溯时 `returnValue` 应有值

---

## 五、完整改造后的 TraceEngine.java 结构

```
TraceEngine.java
├── record(step, line, vars)          // 修改：使用 deepSerialize + attachCallStack
├── reset()                           // 修改：清理 callStack 和 frameCounter
├── disable()                         // 不变
├── getSteps()                        // 不变
│
├── [新增] deepSerialize(obj, visited)     // 对象深度序列化
├── [新增] isPrimitiveOrWrapper(v)         // 类型判断
├── [新增] tryGetId(obj)                   // 获取对象 id（打破循环引用）
│
├── [新增] StackFrame (内部类)             // 调用栈帧
├── [新增] callStack (静态字段)            // 调用栈
├── [新增] frameCounter (静态字段)         // 帧计数器
├── [新增] pushFrame(methodName, params)   // 方法进入
├── [新增] popFrame(returnValue)           // 方法返回
└── [新增] attachCallStack(varsCopy)       // 附加调用栈到变量快照
```

---

## 六、前端自动检测规则（供参考）

前端 `VariablePanel.vue` 的检测逻辑如下，后端只需确保数据格式匹配即可：

| 检测目标 | 检测条件 | 触发组件 |
|---------|---------|---------|
| 链表节点 | 变量具有 `id`、`val`、`next` 字段 | `LinkedListCanvas.vue` |
| 递归调用栈 | 存在 `_recursionStack_` 变量且包含 `frames` 数组 | `RecursionStackCanvas.vue` |
| 数组 | 变量是数组类型 | `ArrayCanvas.vue`（已正常工作） |

**高亮规则**（前端自动识别指针变量）：
- 链表高亮变量名：`current`, `prev`, `next`, `curr`, `head`, `tail`, `p`, `q`
- 比较高亮变量名：`temp`, `node1`, `node2`, `first`, `second`

---

## 七、开发建议

1. **先做任务1（对象序列化）**：这是链表画布的前置条件，改动集中在 `TraceEngine.java`，不影响 `Instrumenter.java`
2. **任务2（递归栈）可后做**：改动涉及 `Instrumenter.java` 的方法插桩，复杂度较高；如果时间紧张，前端可以用 mock 数据演示
3. **测试时关注 JSON 输出**：直接用 `curl` 或 Postman 调用 `/api/run`，检查返回的 JSON 结构是否符合前端期望的格式
4. **注意循环引用**：链表可能成环，`deepSerialize` 必须使用 `visited` 集合防止栈溢出

---


