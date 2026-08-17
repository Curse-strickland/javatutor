# Heap-Stack 堆栈可视化审查

> 审查日期: 2026-06-09 | 基准提交: `3a573a6`

---

## 一、架构评估

**数据流**: Instrumenter 插入 `allocObject`/`allocArray` → TraceEngine 维护 `heapObjects` 注册表 → 每步 `record()` 输出 `heap` + `stackFrame` → 前端 `currentHeap`/`currentStackFrame` getters → HeapStackPanel 渲染。完整闭环。

| 层 | 关键逻辑 | 状态 |
|----|----------|------|
| Instrumenter | `detectArrayAllocations` 识别 `new int[n]` / `{5,3,8}`；`detectObjectAllocations` 识别 `new Person()` / `arr[0] = new Item()` | ✓ |
| Instrumenter | `isInnerClassBlock` 跳过内部类构造函数，防止误插桩 | ✓ |
| Instrumenter | `collectDirectVariables` 新增 `ClassOrInterfaceDeclaration`/`CompilationUnit` 跳过，防字段泄漏 | ✓ |
| TraceEngine | `ensureHeapObject` 引用去重（按 `_objRef` identity 比对 + `findHeapIdByRef` 遍历） | ✓ |
| TraceEngine | `updateHeapFields` 反射遍历字段 → 值类型存值，引用型存 `{ref: id}` 打断循环 | ✓ |
| TraceEngine | `deepCopyArray` 递归处理 `int[][]` 嵌套数组 | ✓ |
| TraceEngine | `deepCopyHeap` 移除 `_objRef` 防止 Jackson 序列化异常 | ✓ |
| Frontend | `stackFrames` 兼容 `activeStackFrames`（数组）和 `currentStackFrame`（单帧） | ✓ |
| Frontend | `heapObjects` 双模式：`slots`（数组索引）和 `fields`（对象字段引用） | ✓ |
| Frontend | `getFrameItems` 最新帧 `items.reverse()` 从下往上显示 | ✓ |

---

## 二、需清理项

### [Low] 重复 `<style scoped>` 块

**文件**: `HeapStackPanel.vue:144-287` 和 `:289-427`

两个块完全重复，产生双倍 CSS 规则。CSS cascade 靠后者（L289-427）生效，但维护时极易混淆。删除 L289-427。

---

### [Low] `frameMethod` computed 未使用

**文件**: `HeapStackPanel.vue:95`

```js
const frameMethod = computed(() => stackFrames.value[stackFrames.value.length - 1]?.method || 'main')
```

模板中无任何引用，死代码。

---

### [Low] TraceEngine `else if (!existed)` 重复 + 注释损坏

**文件**: `TraceEngine.java:45-51`

```java
} else if (!existed) {
    // 新注册的条目（ensureHeapObject 中 allocObject 创建的）.get(name).get("_objRef") == elem) {
    updateHeapFields(name, elem);
} else if (!existed) {    // ← 重复，永不可达
    // 新注册的条目（ensureHeapObject 中 allocObject 创建的）
    updateHeapFields(name, elem);
}
```

删除 L48-50 的重复块。同时 L46 注释中的 `.get(name).get("_objRef") == elem) {` 是合并冲突残留。

---

## 三、已验证合理的设计决策

- **`activeStackFrames` 当前始终为空** — 后端只设 `stackFrame`（单帧），`activeStackFrames` 为未来多方法调用栈预留。前端 `stackFrames` computed 优雅降级到 `[currentStackFrame]`。不是 bug。
- **堆无 `(示意图)` 标签** — 数据来自后端真实追踪，非伪地址，不需要标注。
- **栈帧 `frame.method` 硬编码 `"main"`** — 当前只有单一入口方法，合理简化。

---

## 四、汇总

整体架构扎实，引用去重、循环引用打断、嵌套数组深拷贝等边界情况处理到位。3 条均为低优先级清理项，不影响功能。
