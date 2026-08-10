# 链表操作

链表由节点串成，每个节点存 `val` 与 `next`（双向链表还有 `prev`）。不像数组，**不支持 O(1) 随机访问**，但插入删除在已知前驱时可为 O(1)。

## 基本操作

| 操作 | 单向链表 | 说明 |
|------|----------|------|
| 遍历 | O(n) | `while (p != null)` |
| 头部插入 | O(1) | `node.next = head; head = node;` |
| 尾部插入 | O(n) 或 O(1)* | *维护 tail 指针 |
| 按值删除 | O(n) | 需找前驱 `pre`，`pre.next = pre.next.next` |

**虚拟头结点 dummy**：在 head 前加哨兵，统一「删除头节点」「在头部前插入」的边界写法。

```java
ListNode dummy = new ListNode(0, head), pre = dummy;
while (pre.next != null && pre.next.val != target) pre = pre.next;
if (pre.next != null) pre.next = pre.next.next;
return dummy.next;
```

## 常见技巧

- **快慢指针**：找中点（快 2 慢 1）、判环（相遇则有环）
- **反转**：迭代三指针 `pre/cur/next`，或递归后挂接
- **合并有序链**：类似归并，比较两链头较小者接到结果尾

## 复杂度对照

- 查找第 k 个：O(k)；数组为 O(1)
- 在已知节点后插入/删除：O(1)；数组中间插入 O(n) 移动
- 额外空间：链表节点指针开销，无连续大块预分配

---

> 本文为 JavaTutor 项目原创教学摘要。延伸阅读：[oi.wiki 链表](https://oi.wiki/ds/linked-list/)，遵循 **CC-BY-SA** 协议。
