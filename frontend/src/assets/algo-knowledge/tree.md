# 树与堆

二叉树每个节点最多两个孩子：左子树、右子树。遍历顺序由**根节点相对左右子树的访问时机**决定。堆是一棵**完全二叉树**，常作为优先队列的底层结构。

## 前序遍历

**根 → 左 → 右**。适合复制树、输出前缀表达式、DFS 先序。

```java
void pre(TreeNode root) {
  if (root == null) return;
  visit(root);
  pre(root.left);
  pre(root.right);
}
```

## 中序遍历

**左 → 根 → 右**。对**二叉搜索树**得到**有序序列**。

- 迭代写法：沿左链入栈，弹栈访问再转向右子树

## 后序遍历

**左 → 右 → 根**。适合释放树、后缀表达式、自底向上计算（如树的高度、子树和）。

## 层序遍历

按层从左到右，用**队列**实现 BFS。

```java
Queue<TreeNode> q = new ArrayDeque<>();
q.add(root);
while (!q.isEmpty()) {
  TreeNode u = q.poll();
  visit(u);
  if (u.left != null) q.add(u.left);
  if (u.right != null) q.add(u.right);
}
```

**复杂度**：四种遍历均为 O(n) 时间、O(h) 栈/队列空间（h 为树高）。

## 优先队列

**出队顺序由优先级决定，而非先进先出**。底层通常用**二叉堆**（完全二叉树）实现：堆顶恒为当前最值，插入/删除堆顶均为 O(log n)。

- **时间**：插入 O(log n)、取最值 O(1)、删除最值 O(log n)
- **空间**：O(n)
- **适用**：Top-K、Dijkstra 松弛、任务调度、合并有序流

```java
// Java 默认小顶堆：队首为最小元素
PriorityQueue<Integer> pq = new PriorityQueue<>();
pq.offer(x);           // 插入
int min = pq.peek();   // 取最小（不删除）
min = pq.poll();       // 取出并删除最小
// 大顶堆：传入比较器反转顺序
PriorityQueue<Integer> maxPq = new PriorityQueue<>(Collections.reverseOrder());
```
想深入理解？
如果你对此感兴趣，可以继续阅读这篇教程：
> **推荐模板题解链接**：[洛谷 · 堆](https://www.luogu.com.cn/problem/solution/P3378)

---

> 本文为 JavaTutor 项目原创教学摘要。
