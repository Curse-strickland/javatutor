# 查找与搜索

把「在一个集合里找目标」分成三类：直接在数据上扫（顺序）、用哈希把 key 映射到位置、用单调性跳着找（二分）。再把图上的「状态空间」搜索一并收进来。

---

## 顺序查找

**思路**：从左到右逐一比对。最朴素但通用（不要求有序）。

**模板**：

```java
for (int i = 0; i < a.length; i++) {
  if (a[i] == target) return i;
}
return -1;
```

**哨兵优化**（少一次 `i < n` 判断）：把 `target` 暂存到 `a[n]`，循环里只判 `a[i] == target`，返回前还原。

- **时间**：O(n)
- **空间**：O(1)
- **适用**：小数组、几乎不命中、无序数据

---

## 哈希查找

**思路**：哈希函数把 key 映射到数组下标，平均 O(1) 定位。冲突处理两种思路：拉链法（数组每个槽挂链表）与开放定址（探测下一个空槽）。

**模板**（链地址 / `HashMap` 视角）：

```java
Map<Integer, Integer> idx = new HashMap<>();
for (int i = 0; i < a.length; i++) idx.put(a[i], i);
// 查询
Integer pos = idx.get(target);
return pos == null ? -1 : pos;
```

**冲突与负载因子**：装载超过 ~0.75 时 rehash，期望查找长度 O(1)；极端情况下所有 key 落到同一槽 → O(n)。

**常见错误**：
- 自定义 `hashCode` 未与 `equals` 一致（`HashMap` 退化）
- 用可变对象做 key（put 后改字段，丢失定位）

- **时间**：平均 O(1)，最坏 O(n)
- **空间**：O(n)

---

## 二分查找

在**有序**数组（或具有单调性的答案空间）上，每次排除一半区间，将 O(n) 线性扫描降为 O(log n)。

**前提**：下标 `0..n-1` 上数组单调非降（或问题具有「越界一侧必错」的单调性）。

**模板要点**：

1. 维护搜索区间 `[lo, hi]`（闭区间）或 `[lo, hi)`（半开）
2. 取 `mid`，根据与 `target` 的关系收缩区间
3. 循环条件：`lo <= hi` 或 `lo < hi`，二者与边界更新必须配对

```java
int lo = 0, hi = n - 1;
while (lo <= hi) {
  int mid = lo + (hi - lo) / 2;
  if (a[mid] == target) return mid;
  if (a[mid] < target) lo = mid + 1;
  else hi = mid - 1;
}
return -1;
```

- **时间**：O(log n)
- **空间**：O(1)

---

## 边界与变体

| 问题 | 思路 |
|------|------|
| 第一个 ≥ x 的位置 | `hi = mid` 或 `lo = mid + 1`，看 `a[mid] < x` |
| 最后一个 ≤ x 的位置 | 对称写法 |
| 答案在实数域 | 对答案二分，写 `check(mid)` 判定可行性 |
| 山脉数组找峰 | 上下坡单调性二分 |

**常见错误**：`mid = (lo + hi) / 2` 溢出（用 `lo + (hi-lo)/2`）；死循环（`lo/hi` 更新未严格缩小区间）。

---

## 广度优先搜索（BFS）

**思路**：按「距起点层数」扩展，队列维护当前层。一层一层推进 → 天然适合「无权图最短路」「最少操作数」问题。

**模板**：

```java
int[] dist = new int[n];
Arrays.fill(dist, -1);
Deque<Integer> q = new ArrayDeque<>();
dist[s] = 0;
q.offer(s);
while (!q.isEmpty()) {
  int u = q.poll();
  for (int v : g[u]) {
    if (dist[v] != -1) continue;
    dist[v] = dist[u] + 1;
    q.offer(v);
  }
}
```

**关键性质**：第一次到达即最短路径（无权图）。
**空间**：队列 + dist 数组，O(V + E)。

**常见错误**：
- 忘记判 `dist[v] != -1` → 重复入队爆炸
- 边权非 1 时仍用 BFS（应换 Dijkstra）

---

## 深度优先搜索（DFS）

**思路**：递归或显式栈沿一条路走到底再回溯。常用于连通分量、拓扑序、生成树、回溯枚举。

**模板**（递归）：

```java
boolean[] vis = new boolean[n];
int ccCount = 0;
for (int s = 0; s < n; s++) {
  if (vis[s]) continue;
  ccCount++;
  dfs(s, vis);
}
void dfs(int u, boolean[] vis) {
  vis[u] = true;
  for (int v : g[u]) if (!vis[v]) dfs(v, vis);
}
```

**关键性质**：先入后出 → 回溯；可做拓扑排序（后序压栈反转）。

**空间**：递归深度 O(V)，最坏栈溢出（节点多时改显式栈 / 限制深度）。

**常见错误**：
- 递归无 base case
- 状态未在入/出口对称标记（如 vis 标了忘清）

---

> 本文为 JavaTutor 项目原创教学摘要。延伸阅读：[oi.wiki 查找](https://oi.wiki/basic/binary/)、[oi.wiki BFS](https://oi.wiki/search/bfs/)、[oi.wiki DFS](https://oi.wiki/search/dfs/)、[洛谷题单](https://www.luogu.com.cn/)，遵循 **CC-BY-SA** 协议。
