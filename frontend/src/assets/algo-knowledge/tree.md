# 二叉树遍历

二叉树每个节点最多两个孩子：左子树、右子树。遍历顺序由**根节点相对左右子树的访问时机**决定。

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

---

> 本文为 JavaTutor 项目原创教学摘要。延伸阅读：[oi.wiki 二叉树](https://oi.wiki/ds/binary-tree/)，遵循 **CC-BY-SA** 协议。
