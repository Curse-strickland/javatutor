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

## 约瑟夫问题

n 个人围成一圈，从 1 开始报数，报到 m 的人出圈，求出圈顺序（或最后幸存者）。可用**循环链表**模拟，也可用递推 `f(n,m)=(f(n-1,m)+m)%n` 直接求最后幸存者。

- **链表模拟**：O(n·m)；**递推**：O(n)
- **适用**：报数出列、循环淘汰类问题

想深入理解？
如果你对此感兴趣，可以继续阅读这篇教程：
> **推荐模板题解链接**：[洛谷 P1996 题解](https://www.luogu.com.cn/problem/solution/P1996)

## 链表相交

两个单链表可能在某节点后重合为同一条链，求第一个交点。**对齐尾部**后同步前进：各自走完自己后从另一条链头继续，相遇点即交点（无交点则同时为 null）。

- **时间**：O(n + m)
- **空间**：O(1)
- **关键**：`pA` 走到头转到 `headB`，`pB` 走到头转到 `headA`

想深入理解？
如果你对此感兴趣，可以继续阅读这篇教程：
> **推荐模板题解链接**：[力扣 · 链表相交](https://leetcode.cn/problems/intersection-of-two-linked-lists-lcci/solutions/1190240/mian-shi-ti-0207-lian-biao-xiang-jiao-sh-b8hn/)

## 环形链表

判断链表是否有环并找环入口。**快慢指针**：快指针每步 2、慢指针每步 1，相遇则有环；再让一指针回到头、另一指针留在相遇点，同步前进再次相遇即环入口。

- **时间**：O(n)
- **空间**：O(1)
- **关键**：Floyd 判圈；入口由「头到入口 = 相遇点到入口」的距离关系推导

想深入理解？
如果你对此感兴趣，可以继续阅读这篇教程：
> **推荐模板题解链接**：[力扣 · 环形链表 II](https://leetcode.cn/problems/linked-list-cycle-ii/solutions/12616/linked-list-cycle-ii-kuai-man-zhi-zhen-shuang-zhi-/)

---

> 本文为 JavaTutor 项目原创教学摘要。