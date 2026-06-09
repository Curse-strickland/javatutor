# 数据结构可视化 - 后端数据格式规范

## 概述

本文档说明后端如何在 `steps` 的 `variables` 中提供链表和递归栈的结构化数据，以便前端画布组件能够正确渲染。

---

## 一、链表（Linked List）数据格式

### 1.1 节点结构

每个链表节点应该是一个对象，包含以下字段：

```javascript
{
  id: "n1",           // 唯一标识符，字符串类型
  val: 5,             // 节点的值，可以是任意类型
  next: "n2"          // 下一个节点的id（字符串），如果是null则为null
}
```

### 1.2 完整链表示例

假设有一个链表：`5 -> 3 -> 8 -> null`

后端应该在 variables 中这样提供：

```json
{
  "head": {
    "id": "n1",
    "val": 5,
    "next": "n2"
  },
  "n2": {
    "id": "n2",
    "val": 3,
    "next": "n3"
  },
  "n3": {
    "id": "n3",
    "val": 8,
    "next": null
  }
}
```

**注意**：如果后端无法提供完整的节点链，可以只返回 head 节点，前端会尝试遍历。但推荐提供所有节点以确保准确性。

### 1.3 指针变量

为了高亮当前操作的节点，后端应该同时提供指针变量：

```json
{
  "head": { "id": "n1", "val": 5, "next": "n2" },
  "current": { "id": "n2", "val": 3, "next": "n3" },
  "prev": { "id": "n1", "val": 5, "next": "n2" }
}
```

前端会自动检测 `current`, `prev`, `next`, `head`, `tail` 等常见指针变量名，并高亮对应的节点。

### 1.4 Java 代码示例

在后端插桩时，需要序列化链表节点：

```java
// 在 TraceEngine.record() 中
public static void record(int step, int line, Map<String,Object> vars) {
    LinkedHashMap<String,Object> record = new LinkedHashMap<>();
    record.put("step", step);
    record.put("line", line);
    
    LinkedHashMap<String,Object> varsCopy = new LinkedHashMap<>();
    for (Map.Entry<String,Object> e : vars.entrySet()) {
        Object v = e.getValue();
        
        // 检测是否是链表节点（通过反射或 instanceof）
        if (v instanceof ListNode) {
            varsCopy.put(e.getKey(), serializeListNode((ListNode) v));
        } else {
            varsCopy.put(e.getKey(), deepCopyValue(v));
        }
    }
    
    record.put("variables", varsCopy);
    steps.add(record);
}

private static Map<String, Object> serializeListNode(ListNode node) {
    if (node == null) return null;
    
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("id", "n" + System.identityHashCode(node)); // 使用对象哈希作为唯一ID
    result.put("val", node.val);
    result.put("next", node.next != null ? "n" + System.identityHashCode(node.next) : null);
    
    return result;
}
```

---

## 二、递归调用栈（Recursion Stack）数据格式

### 2.1 调用栈结构

递归调用栈应该作为一个特殊变量 `_recursionStack_` 提供：

```json
{
  "_recursionStack_": {
    "frames": [
      {
        "id": "f1",
        "name": "fib",
        "variables": {
          "n": 5
        },
        "returnValue": null
      },
      {
        "id": "f2",
        "name": "fib",
        "variables": {
          "n": 4
        },
        "returnValue": null
      }
    ],
    "activeFrameIndex": 0,
    "returningFrameIndices": []
  }
}
```

### 2.2 字段说明

- **frames**: 调用帧数组，第一个元素是栈顶（最新调用）
  - **id**: 帧的唯一标识符
  - **name**: 函数名
  - **variables**: 该帧的局部变量快照
  - **returnValue**: 返回值（如果函数已返回则为具体值，否则为 null）

- **activeFrameIndex**: 当前正在执行的帧索引（从0开始）

- **returningFrameIndices**: 正在返回的帧索引数组（用于显示返回动画）

### 2.3 递归展开示例

以 `fib(3)` 为例：

**步骤1：进入 fib(3)**
```json
{
  "_recursionStack_": {
    "frames": [
      { "id": "f1", "name": "fib", "variables": { "n": 3 }, "returnValue": null }
    ],
    "activeFrameIndex": 0,
    "returningFrameIndices": []
  }
}
```

**步骤2：进入 fib(2)**
```json
{
  "_recursionStack_": {
    "frames": [
      { "id": "f2", "name": "fib", "variables": { "n": 2 }, "returnValue": null },
      { "id": "f1", "name": "fib", "variables": { "n": 3 }, "returnValue": null }
    ],
    "activeFrameIndex": 0,
    "returningFrameIndices": []
  }
}
```

**步骤3：fib(2) 返回 1**
```json
{
  "_recursionStack_": {
    "frames": [
      { "id": "f2", "name": "fib", "variables": { "n": 2 }, "returnValue": 1 },
      { "id": "f1", "name": "fib", "variables": { "n": 3 }, "returnValue": null }
    ],
    "activeFrameIndex": 0,
    "returningFrameIndices": [0]
  }
}
```

### 2.4 Java 代码示例

在后端插桩递归函数时：

```java
// 需要在方法入口和出口处记录调用栈
public class TraceEngine {
    private static Deque<CallFrame> callStack = new ArrayDeque<>();
    
    public static void recordMethodEntry(String methodName, Map<String, Object> params) {
        CallFrame frame = new CallFrame();
        frame.id = "f" + System.identityHashCode(Thread.currentThread()) + "_" + callStack.size();
        frame.name = methodName;
        frame.variables = new LinkedHashMap<>(params);
        frame.returnValue = null;
        callStack.push(frame);
        
        // 记录当前步骤
        recordCurrentState();
    }
    
    public static void recordMethodExit(Object returnValue) {
        if (!callStack.isEmpty()) {
            CallFrame frame = callStack.peek();
            frame.returnValue = returnValue;
            recordCurrentStateWithReturning();
            callStack.pop();
        }
    }
    
    private static void recordCurrentState() {
        Map<String, Object> stackData = new LinkedHashMap<>();
        List<Map<String, Object>> frames = new ArrayList<>();
        
        for (CallFrame frame : callStack) {
            Map<String, Object> frameData = new LinkedHashMap<>();
            frameData.put("id", frame.id);
            frameData.put("name", frame.name);
            frameData.put("variables", frame.variables);
            frameData.put("returnValue", frame.returnValue);
            frames.add(frameData);
        }
        
        stackData.put("frames", frames);
        stackData.put("activeFrameIndex", 0);
        stackData.put("returningFrameIndices", new ArrayList<>());
        
        // 添加到当前步骤的 variables 中
        currentStepVariables.put("_recursionStack_", stackData);
    }
}
```

---

## 三、前端自动检测逻辑

### 3.1 链表检测

前端会检测变量是否为链表节点：

```javascript
function isLinkedList(value) {
  if (!value || typeof value !== 'object') return false
  return value.hasOwnProperty('id') && 
         value.hasOwnProperty('val') && 
         value.hasOwnProperty('next')
}
```

### 3.2 递归栈检测

前端会查找特殊变量名：

```javascript
const recursionStack = computed(() => {
  const stackVar = variables.value._recursionStack_ || variables.value.recursionStack
  if (!stackVar || !Array.isArray(stackVar.frames)) return null
  return stackVar
})
```

---

## 四、最佳实践

1. **唯一ID**：使用对象的 `System.identityHashCode()` 或 UUID 确保节点/帧ID唯一
2. **完整性**：尽量提供完整的数据结构（所有链表节点、所有调用帧）
3. **一致性**：同一对象在不同步骤中应保持相同的ID
4. **性能**：避免过深的递归或过长的链表导致JSON过大
5. **空值处理**：null 指针用 `null` 表示，不要用字符串 "null"

---

## 五、测试示例

### 5.1 链表反转测试代码

```java
public class LinkedListDemo {
    static class ListNode {
        int val;
        ListNode next;
        ListNode(int val) { this.val = val; }
    }
    
    public static void main(String[] args) {
        ListNode head = new ListNode(1);
        head.next = new ListNode(2);
        head.next.next = new ListNode(3);
        
        // 反转链表
        ListNode prev = null;
        ListNode current = head;
        while (current != null) {
            ListNode next = current.next;
            current.next = prev;
            prev = current;
            current = next;
        }
        head = prev;
    }
}
```

### 5.2 斐波那契递归测试代码

```java
public class FibonacciDemo {
    public static int fib(int n) {
        if (n <= 1) return n;
        return fib(n - 1) + fib(n - 2);
    }
    
    public static void main(String[] args) {
        int result = fib(5);
        System.out.println(result);
    }
}
```

---

## 六、常见问题

**Q: 如果后端无法提供完整的链表节点链怎么办？**  
A: 前端会尝试从 head 开始遍历，但如果节点之间有循环引用或不完整，可能无法正确显示。建议后端提供所有相关节点。

**Q: 递归深度太大怎么办？**  
A: 建议限制最大递归深度（如50层），超过则截断并显示警告。

**Q: 如何区分普通对象和链表节点？**  
A: 通过检查是否同时具有 `id`, `val`, `next` 三个字段。如果普通对象也有这些字段，可以考虑添加 `__type__: "ListNode"` 标记。

---

生成日期：2026-06-09  
维护者：前端F2团队
