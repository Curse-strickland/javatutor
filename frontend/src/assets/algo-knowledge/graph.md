# 图上的基本算法

图由顶点 `V` 与边 `E` 组成。邻接表适合稀疏图，邻接矩阵适合稠密图或 O(1) 查边。

## 广度优先搜索 BFS

从源点出发，按**层**扩展：用队列维护 frontier，先访问距离为 k 的所有点，再访问 k+1。

- **时间**：O(V + E)
- **用途**：无权最短路、层次遍历、连通块计数
- **技巧**：记录 `dist[v]` 或 `parent[v]` 还原路径

```java
Queue<Integer> q = new ArrayDeque<>();
q.add(s); dist[s] = 0;
while (!q.isEmpty()) {
  int u = q.poll();
  for (int v : adj[u])
    if (dist[v] == INF) { dist[v] = dist[u] + 1; q.add(v); }
}
```
想深入理解？
如果你对此感兴趣，可以继续阅读这篇教程：
> **推荐模板题解链接**：[代码随想录 · 图论基础（DFS & BFS）](https://programmercarl.com/algo/graph/depth-first-search-basics.html)

## 深度优先搜索 DFS

沿一条边尽量深入，走不通再回溯。可用递归或显式栈。

- **时间**：O(V + E)
- **用途**：连通性、环检测、拓扑排序、强连通分量（Tarjan/Kosaraju）
- **注意**：递归深度大时用迭代 + 栈，或增大栈空间

想深入理解？
如果你对此感兴趣，可以继续阅读这篇教程：
> **推荐模板题解链接**：[代码随想录 · 图论基础（DFS & BFS）](https://programmercarl.com/algo/graph/depth-first-search-basics.html)

## Dijkstra 最短路

**非负权**图上，从单源求到各点最短距离。用小根堆维护当前距离最小的未确定顶点。

- **时间**：O((V + E) log V)（二叉堆）
- **不适用**：存在负权边（用 Bellman-Ford）；全源用 Floyd O(V³)

```java
// dist[s]=0，其余 INF；堆中 (dist, u)
while (!pq.isEmpty()) {
  var [d, u] = pq.poll();
  if (d != dist[u]) continue;
  for (Edge e : adj[u])
    if (dist[u] + e.w < dist[e.v]) { dist[e.v] = ...; pq.add(...); }
}
```

想深入理解？
如果你对此感兴趣，可以继续阅读这篇教程：
> **推荐模板题解链接**：[代码随想录 · Dijkstra 最短路](https://programmercarl.com/algo/graph/kamacoder-0047-meeting-dijkstra-heap.html)

## Floyd 最短路

**全源**最短路：三重循环，用每个顶点 `k` 作为中转点，尝试松弛任意两点 `i→j` 的距离。

- **时间**：O(V³)
- **空间**：O(V²)（邻接矩阵 `dist`）
- **适用**：顶点少（一般 ≤ 500）、允许负权（无负环）的全源问题；单源用 Dijkstra 更快

```java
for (int k = 0; k < n; k++)
  for (int i = 0; i < n; i++)
    for (int j = 0; j < n; j++)
      if (dist[i][k] + dist[k][j] < dist[i][j])
        dist[i][j] = dist[i][k] + dist[k][j];
```

想深入理解？
如果你对此感兴趣，可以继续阅读这篇教程：
> **推荐模板题解链接**：[洛谷 B3647 题解](https://www.luogu.com.cn/problem/solution/B3647)

---

> 本文为 JavaTutor 项目原创教学摘要。
