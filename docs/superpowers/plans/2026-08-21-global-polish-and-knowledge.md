# 全局美化 & 知识库扩充 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 一次性交付 5 个独立 plan，覆盖知识库扩充、树/堆 chip 不透明、数组高亮对齐、chip 色板扩展、顶栏重构 + 字体 + AI 按钮删除。

**Architecture:** 8 项 UI / 内容变更按依赖拆为 5 段（P1–P5），每段各自 commit。CSS 变量（`--ak-*`、`--ds-strip-gap`）集中在 `style.css`；色板集中在 `pointerRoleColors.js`；运行时关键帧（`wire-pulse`）提升到全局。组件只消费 token，不内联具体值。

**Tech Stack:** Vue 3 Composition API、Vite、Vitest、TailwindCSS（仅 utility class）、Google Fonts（Inter / Archivo / Noto Sans SC / JetBrains Mono）、Maple Mono（本地，仅 Monaco 编辑器）。

---

## Global Constraints

- **font-size / line-height / letter-spacing 在 UI 层不动**；知识库内 .sm-md 字号从 11/12/13/14 重设为 `--ak-font-base` / `--ak-font-mono`（变量值固定）
- **保留 mid(yellow `#eab308`) / next(blue `#3b82f6`) / prev(grey `#6b7280`) / root(red `#ef476f`) 四色 hex 不变**
- **insert → `#d946ef` (magenta)**，**neutral → `#f59e0b` (amber)**；其它色板 hex 不动
- **`Maple Mono` 本地字体保留**；仅补 Google Fonts 字重与 `Inter` 备用字体
- **多文件 out-of-scope**（2026-08 用户明确）
- **每 plan 一次 commit**，commit message 形如 `feat(plan-id): ...`

---

## 目录

- [P1 · 知识库扩充](#p1--知识库扩充)
- [P2 · 树/堆 chip 不透明 + z-index](#p2--树堆-chip-不透明--z-index)
- [P3 · chip 色板扩展](#p3--chip-色板扩展)
- [P4 · 数组格子高亮对齐](#p4--数组格子高亮对齐)
- [P5 · 顶栏重构 + 字体 + AI 按钮删除](#p5--顶栏重构--字体--ai-按钮删除)

---

# P1 · 知识库扩充

涵盖 spec §4（#1 + #2）。新增 `--ak-*` 主题变量；改组 `index.json`；重写 `search.md`；graph.md 加交叉链接；改造 `AlgoKnowledgeHeader.vue`。

## File Structure（仅本 plan）

| 操作 | 文件 | 职责 |
|---|---|---|
| 改 | `frontend/src/style.css` | 新增 `--ak-*` 主题变量 |
| 改 | `frontend/src/assets/algo-knowledge/index.json` | search 类目 → search-and-find；anchors 6 个 |
| 改 | `frontend/src/assets/algo-knowledge/search.md` | 重写为 6 节 |
| 改 | `frontend/src/assets/algo-knowledge/graph.md` | 顶部加交叉链接 |
| 改 | `frontend/src/components/AlgoKnowledgeHeader.vue` | 圆角标签 + shadow + 字号走 --ak-* 变量 |
| 新建 | `frontend/src/assets/algo-knowledge/__tests__/search-anchors.test.js` | 锚点存在冒烟 |

---

## Task 1.1 · 在 style.css 新增 --ak-* 主题变量

**Files:**
- Modify: `frontend/src/style.css:104-111`

**Interfaces:**
- 消费：none
- 产出：`--ak-font-base` / `--ak-font-mono` / `--ak-code-bg` / `--ak-tag-radius` / `--ak-tag-shadow` / `--ak-tag-shadow-hover`（在 :root 内）

- [ ] **Step 1: 在 style.css :root 块末尾追加 --ak-* 变量**

找到 `frontend/src/style.css` 中 `:root { ... }` 块（第 54-111 行），在最后 `}` 前、`--ds-popover-shadow` 之后追加：

```css
  /* 算法知识库主题（v1.0） */
  --ak-font-base: 13px;       /* 与正文统一 */
  --ak-font-mono: 12px;       /* 代码块（与正文一致，不再放大） */
  --ak-code-bg: rgba(13, 158, 196, 0.06);
  --ak-tag-radius: 8px;
  --ak-tag-shadow: 0 1px 3px rgba(18, 22, 29, 0.08),
    0 4px 12px -4px rgba(18, 22, 29, 0.10);
  --ak-tag-shadow-hover: 0 2px 6px rgba(18, 22, 29, 0.10),
    0 8px 20px -6px rgba(18, 22, 29, 0.16);
```

- [ ] **Step 2: 验证 CSS 变量被加载**

Run: `cd frontend && npm run dev`
Expected: dev server 起来（无 CSS 解析错误）；DevTools 打开 Algo tab → 知识库 header → Computed 面板确认 `--ak-font-base` 已 resolve。

- [ ] **Step 3: Commit**

```bash
cd /c/d盘/JavaTutor/javatutor
git add frontend/src/style.css
git commit -m "feat(knowledge): add --ak-* theme tokens"
```

---

## Task 1.2 · 改组 index.json：search → search-and-find

**Files:**
- Modify: `frontend/src/assets/algo-knowledge/index.json`

**Interfaces:**
- 消费：`frontend/src/components/AlgoKnowledgeHeader.vue:69-85` 通过 `id` 查 `mdByFile[file]`，通过 `id` 查 `activeCategory`
- 产出：6 个 anchor（顺序 / 哈希 / 二分 / 边界与变体 / BFS / DFS）

- [ ] **Step 1: 修改 search 类目**

打开 `frontend/src/assets/algo-knowledge/index.json`，把 `search` 整块替换为：

```json
    {
      "id": "search-and-find",
      "title": "查找与搜索",
      "file": "search.md",
      "anchors": [
        { "id": "顺序查找", "title": "顺序" },
        { "id": "哈希查找", "title": "哈希" },
        { "id": "二分查找", "title": "二分" },
        { "id": "边界与变体", "title": "变体" },
        { "id": "广度优先搜索-bfs", "title": "BFS" },
        { "id": "深度优先搜索-dfs", "title": "DFS" }
      ]
    }
```

- [ ] **Step 2: 验证 JSON 格式**

Run: `cd frontend && node -e "JSON.parse(require('fs').readFileSync('src/assets/algo-knowledge/index.json','utf8'))"`
Expected: 无报错（exit 0）。

- [ ] **Step 3: Commit**

```bash
git add frontend/src/assets/algo-knowledge/index.json
git commit -m "feat(knowledge): rename search → search-and-find with 6 anchors"
```

---

## Task 1.3 · 重写 search.md 为 6 节内容

**Files:**
- Modify: `frontend/src/assets/algo-knowledge/search.md`

**Interfaces:**
- 消费：none）
- 产出：6 个 ## 二级标题，id 分别为 `顺序查找` / `哈希查找` / `二分查找` / `边界与变体` / `广度优先搜索-bfs` / `深度优先搜索-dfs`

- [ ] **Step 1: 完整替换 search.md 内容**

将 `frontend/src/assets/algo-knowledge/search.md` 整体替换为下面内容（保留 CC-BY-SA 致谢结尾；每节包含思路 / Java 模板 / 时间 / 空间 / 常见错误 / oi.wiki 链接）：

````markdown
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
````

- [ ] **Step 2: 验证 6 个二级标题**

Run:
```bash
cd frontend
grep -E "^## " src/assets/algo-knowledge/search.md
```
Expected: 6 行，分别是：
```
## 顺序查找
## 哈希查找
## 二分查找
## 边界与变体
## 广度优先搜索（BFS）
## 深度优先搜索（DFS）
```

注意 BFS / DFS 行是中文括号，不参与 id 计算（id 由 simpleMarkdown slug 规则生成，可参考 `frontend/src/utils/simpleMarkdown.js`）。anchor 的 `id` 在 index.json 已写为 `广度优先搜索-bfs` / `深度优先搜索-dfs`（连字符 `bfs` / `dfs`），simpleMarkdown 会把 `（BFS）` slugify 为 `广度优先搜索bfs` —— 见下步修正。

- [ ] **Step 3: 修正 BFS/DFS 标题确保 anchor 命中**

打开 `frontend/src/utils/simpleMarkdown.js`，找到 slug 函数（slugify heading 的部分），确认它会把 `（` 和 `）` 替换成空字符串还是连字符。如果当前实现是删除中英括号后剩余字符直连，则 `广度优先搜索（BFS）` → `广度优先搜索bfs`（无连字符）。

需要把 anchor id 改成无连字符形式：

在 `index.json` 把：
```json
{ "id": "广度优先搜索-bfs", "title": "BFS" },
{ "id": "深度优先搜索-dfs", "title": "DFS" }
```
改为：
```json
{ "id": "广度优先搜索bfs", "title": "BFS" },
{ "id": "深度优先搜索dfs", "title": "DFS" }
```

如果 slug 实现本身就保留连字符 `-`，则保留带连字符的形式。**确认方式**：在浏览器打开知识库，点 anchor 按钮，看是否跳到对应标题。

- [ ] **Step 4: Commit**

```bash
git add frontend/src/assets/algo-knowledge/search.md frontend/src/assets/algo-knowledge/index.json
git commit -m "feat(knowledge): rewrite search.md with 6 sections (sequential/hash/binary/BFS/DFS)"
```

---

## Task 1.4 · graph.md 顶部加交叉链接

**Files:**
- Modify: `frontend/src/assets/algo-knowledge/graph.md:1-5`

**Interfaces:**
- 消费：none
- 产出：graph.md 第 1 行加一行 blockquote 引用

- [ ] **Step 1: 在 graph.md 顶部插入交叉链接**

打开 `frontend/src/assets/algo-knowledge/graph.md`，在第一行 `# 图论` 之后（行 2 空行之前）插入：

```markdown

> 通用 BFS / DFS 模板与边界条件见「查找与搜索」分类。
```

（注意 markdown 中 `>` 行作为 blockquote，需保留上方空行以与标题分离。）

- [ ] **Step 2: Commit**

```bash
git add frontend/src/assets/algo-knowledge/graph.md
git commit -m "docs(knowledge): cross-link BFS/DFS from graph.md to search-and-find"
```

---

## Task 1.5 · 改造 AlgoKnowledgeHeader.vue 走 --ak-* 主题

**Files:**
- Modify: `frontend/src/components/AlgoKnowledgeHeader.vue`

**Interfaces:**
- 消费：`--ak-font-base` / `--ak-font-mono` / `--ak-code-bg` / `--ak-tag-radius` / `--ak-tag-shadow` / `--ak-tag-shadow-hover`（Task 1.1 产出）
- 产出：`.sm-md` / `.sm-md .sm-code` / `.ak-cat-btn` / `.ak-anchor-btn` 全部走主题变量，圆角 + shadow

- [ ] **Step 1: 替换 `.sm-md h1/h2/h3` 字号定义**

打开 `frontend/src/components/AlgoKnowledgeHeader.vue`，找到 unscoped 样式段（`<!-- Markdown output — unscoped for v-html -->` 下方，`<style>` 块第 236 行起）。

把：
```css
.sm-md h1 { font-size: 14px; }
.sm-md h2 { font-size: 13px; }
.sm-md h3 { font-size: 12px; }
```
替换为：
```css
.sm-md h1,
.sm-md h2,
.sm-md h3 {
  font-size: var(--ak-font-base);
}
```

- [ ] **Step 2: 替换 `.sm-md .sm-code` 样式**

在 unscoped 样式段找到 `.sm-md .sm-code` 块（第 264-274 行附近），把：
```css
.sm-md .sm-code {
  margin: 8px 0;
  padding: 8px 10px;
  overflow-x: auto;
  background: var(--code-bg);
  border: 1px solid var(--border);
  border-left: 2px solid var(--accent);
  font-family: var(--mono);
  font-size: 11px;
  line-height: 1.45;
}
```
替换为：
```css
.sm-md .sm-code {
  margin: 8px 0;
  padding: 8px 10px;
  overflow-x: auto;
  background: var(--ak-code-bg);
  border: 1px solid var(--border);
  border-left: 2px solid var(--accent);
  border-radius: var(--ak-tag-radius);
  box-shadow: var(--ak-tag-shadow);
  font-family: var(--mono);
  font-size: var(--ak-font-mono);
  line-height: 1.45;
}
```

- [ ] **Step 3: 替换 `.sm-md .sm-table` 字号**

把：
```css
.sm-md .sm-table {
  width: 100%;
  margin: 8px 0;
  border-collapse: collapse;
  font-size: 11px;
}
```
改为字号走 `--ak-font-mono`：
```css
.sm-md .sm-table {
  width: 100%;
  margin: 8px 0;
  border-collapse: collapse;
  font-size: var(--ak-font-mono);
}
```

- [ ] **Step 4: 替换 `.ak-cat-btn` 圆角 + shadow**

找到 `.ak-cat-btn`（scoped 样式段内），把：
```css
.ak-cat-btn {
  padding: 3px 8px;
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.06em;
  color: var(--text-muted);
  background: transparent;
  border: 1px solid var(--border);
  cursor: pointer;
  clip-path: polygon(4px 0, 100% 0, 100% calc(100% - 4px), calc(100% - 4px) 100%, 0 100%, 0 4px);
}
.ak-cat-btn:hover {
  color: var(--text-h);
  border-color: var(--line-strong, var(--border));
}
.ak-cat-btn.active {
  color: var(--accent);
  border-color: var(--accent);
  background: var(--accent-bg);
}
```
替换为：
```css
.ak-cat-btn {
  padding: 3px 8px;
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.06em;
  color: var(--text-muted);
  background: transparent;
  border: 1px solid var(--border);
  border-radius: var(--ak-tag-radius);
  cursor: pointer;
  box-shadow: var(--ak-tag-shadow);
  transition: color 0.15s, border-color 0.15s, background 0.15s,
    box-shadow 0.2s ease, transform 0.16s ease;
}
.ak-cat-btn:hover {
  color: var(--text-h);
  border-color: var(--line-strong, var(--border));
  box-shadow: var(--ak-tag-shadow-hover);
  transform: translateY(-1px);
}
.ak-cat-btn.active {
  color: var(--accent);
  border-color: var(--accent);
  background: var(--accent-bg);
  box-shadow: var(--ak-tag-shadow-hover);
  transform: translateY(-1px);
}
```

- [ ] **Step 5: 替换 `.ak-anchor-btn` 圆角 + shadow**

把：
```css
.ak-anchor-btn {
  padding: 2px 6px;
  font-family: var(--mono);
  font-size: 9px;
  color: var(--text-muted);
  background: var(--code-bg);
  border: 1px solid var(--border);
  cursor: pointer;
}
.ak-anchor-btn:hover {
  color: var(--accent);
  border-color: var(--accent);
}
```
替换为：
```css
.ak-anchor-btn {
  padding: 2px 6px;
  font-family: var(--mono);
  font-size: 9px;
  color: var(--text-muted);
  background: var(--code-bg);
  border: 1px solid var(--border);
  border-radius: var(--ak-tag-radius);
  box-shadow: var(--ak-tag-shadow);
  cursor: pointer;
  transition: color 0.15s, border-color 0.15s,
    box-shadow 0.2s ease, transform 0.16s ease;
}
.ak-anchor-btn:hover {
  color: var(--accent);
  border-color: var(--accent);
  box-shadow: var(--ak-tag-shadow-hover);
  transform: translateY(-1px);
}
```

- [ ] **Step 6: 替换 `.ak-content` 字号**

把：
```css
.ak-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 8px 4px;
  font-size: 12px;
  line-height: 1.55;
  color: var(--text-h);
}
```
替换为：
```css
.ak-content {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 8px 4px;
  font-size: var(--ak-font-base);
  line-height: 1.55;
  color: var(--text-h);
}
```

- [ ] **Step 7: 验证 dev server 编译通过**

Run: `cd frontend && npm run dev`
Expected: dev server 无编译错误；浏览器打开知识库 → 「查找与搜索」分类 → 标签与代码块呈现圆角 + shadow 立体感，代码字号 ~12px。

- [ ] **Step 8: Commit**

```bash
git add frontend/src/components/AlgoKnowledgeHeader.vue
git commit -m "feat(knowledge): themed knowledge base with --ak-* tokens (rounded + shadow)"
```

---

## Task 1.6 · 锚点冒烟测试

**Files:**
- Create: `frontend/src/assets/algo-knowledge/__tests__/search-anchors.test.js`

**Interfaces:**
- 消费：`index.json`（Task 1.2）+ `search.md`（Task 1.3）
- 产出：vitest 断言 anchor 数 = 6，每个 anchor id 在 search.md ## 标题列表里能命中

- [ ] **Step 1: 创建测试文件**

新建 `frontend/src/assets/algo-knowledge/__tests__/search-anchors.test.js`：

```js
import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import index from '../index.json'
import searchMd from '../search.md?raw'

const cat = index.categories.find(c => c.id === 'search-and-find')

describe('search-and-find category anchors', () => {
  it('exists with expected anchors', () => {
    expect(cat).toBeTruthy()
    expect(cat.title).toBe('查找与搜索')
    expect(cat.anchors).toHaveLength(6)
  })

  it('every anchor id matches a ## heading in search.md', () => {
    const headings = searchMd
      .split('\n')
      .filter(line => line.startsWith('## '))
      .map(line => line.replace(/^##\s+/, '').trim())
    for (const a of cat.anchors) {
      // slugify 规则：保留中文，去掉英文括号与空白
      const slug = a.id
      expect(headings.some(h => h.replace(/[()（）]/g, '').replace(/\s+/g, '') === slug))
        .toBe(true)
    }
  })
})
```

- [ ] **Step 2: 跑测试**

Run: `cd frontend && npx vitest run src/assets/algo-knowledge/__tests__/search-anchors.test.js`
Expected: 2 passed。如果失败，回到 Task 1.3 Step 3 校正 anchor id。

- [ ] **Step 3: Commit**

```bash
git add frontend/src/assets/algo-knowledge/__tests__/search-anchors.test.js
git commit -m "test(knowledge): search-and-find anchor smoke test"
```

---

# P2 · 树/堆 chip 不透明 + z-index

涵盖 spec §5（#3）。仅修改 `TreeNode.vue` 与 `TreeCanvas.vue`；视觉靠手测验收（无 DOM 自动化）。

## File Structure（仅本 plan）

| 操作 | 文件 | 职责 |
|---|---|---|
| 改 | `frontend/src/components/TreeNode.vue` | chip 背景改不透明，加 box-shadow，文字改白，加 z-index |
| 改 | `frontend/src/components/TreeCanvas.vue` | `.tc-svg` 加 z-index: 1 |

---

## Task 2.1 · TreeNode.vue chip 改不透明 + 加 z-index

**Files:**
- Modify: `frontend/src/components/TreeNode.vue:60-83, 96-139`

**Interfaces:**
- 消费：`colorForRole(role)` / `colorForPointerName(label)` 返回 hex 字符串
- 产出：`.tree-node-label` 背景为 `color`（不透明），文字 `#fff`，`.tree-node` 加 `z-index: 3`

- [ ] **Step 1: 修改 `labelStyle` computed**

打开 `frontend/src/components/TreeNode.vue`，找到 `labelStyle` computed（`:64-72`）：

```js
const labelStyle = computed(() => {
  const color = accentColor.value
  if (!color) return {}
  return {
    color,
    borderColor: `${color}4d`,
    background: `${color}18`,
  }
})
```

替换为：

```js
const labelStyle = computed(() => {
  const color = accentColor.value
  if (!color) return {}
  return {
    color: '#ffffff',
    borderColor: color,
    background: color,
    boxShadow: '0 1px 2px rgba(0,0,0,0.18)',
  }
})
```

- [ ] **Step 2: 修改 `labelChipStyle` 函数**

找到 `labelChipStyle(label)` 函数（`:74-82`）：

```js
function labelChipStyle(label) {
  const color = colorForPointerName(label) || accentColor.value
  if (!color) return labelStyle.value
  return {
    color,
    borderColor: `${color}4d`,
    background: `${color}18`,
  }
}
```

替换为：

```js
function labelChipStyle(label) {
  const color = colorForPointerName(label) || accentColor.value
  if (!color) return labelStyle.value
  return {
    color: '#ffffff',
    borderColor: color,
    background: color,
    boxShadow: '0 1px 2px rgba(0,0,0,0.18)',
  }
}
```

- [ ] **Step 3: 在 `.tree-node` 加 z-index**

找到 `.tree-node` scoped CSS（`:97-109`），在 `:108` 后（`pointer-events: none;` 前一行）插入：

```css
  z-index: 3;
```

- [ ] **Step 4: 调整 `.tree-node-label` 字号 padding 不变，但确保 color 不被覆盖**

scoped CSS 中 `.tree-node-label` 第 129-139 行已设 `color: var(--accent); background: var(--accent-bg);`。我们的 inline style 优先级更高（Vue 把 computed 写到 `:style` 属性 → inline style 覆盖 class）。无需改 CSS。

但 hover 态下若 class 设了 `color: var(--accent)`，不会被 inline 覆盖（class 比 inline 低），需要去掉 hover 对 color 的覆盖。在 `.tree-node-label` 块内删除（如果存在）：

```css
.tree-node-label:hover { color: var(--accent); }
```

如有其它地方给 `.tree-node-label` 设了 `color` 或 `background`，一并删除。**当前文件确认无 hover 规则**。

- [ ] **Step 5: dev server 手测**

Run: `cd frontend && npm run dev`
打开任意 heap sort / BST / tree 渲染 step，确认：
- chip 背景为纯色（不透明）
- chip 文字白色可读
- 树边（SVG）在 chip 下方不穿透

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/TreeNode.vue
git commit -m "feat(canvas): opaque tree/heap chips with z-index above edges"
```

---

## Task 2.2 · TreeCanvas.vue tc-svg 加 z-index

**Files:**
- Modify: `frontend/src/components/TreeCanvas.vue:246-252`

**Interfaces:**
- 消费：none
- 产出：`.tc-svg` 加 `z-index: 1`

- [ ] **Step 1: 修改 `.tc-svg` 加 z-index**

打开 `frontend/src/components/TreeCanvas.vue`，找到 `.tc-svg`（`:246-252`）：

```css
.tc-svg {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
  overflow: visible;
}
```

替换为：

```css
.tc-svg {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
  overflow: visible;
  z-index: 1;
}
```

- [ ] **Step 2: 手测 + Commit**

手测步骤同 2.1 Step 5；提交：

```bash
git add frontend/src/components/TreeCanvas.vue
git commit -m "feat(canvas): explicit z-index on tree svg edges"
```

---

# P3 · chip 色板扩展

涵盖 spec §7（#5）。仅改 `pointerRoleColors.js` hex 值；新增单元测试。

## File Structure（仅本 plan）

| 操作 | 文件 | 职责 |
|---|---|---|
| 改 | `frontend/src/utils/pointerRoleColors.js:18-25` | insert / neutral hex 替换 |
| 改 | `frontend/src/utils/pointerRoleColors.test.js` | 新增 insert / neutral 断言 |

---

## Task 3.1 · 新增 insert/neutral 色值测试（failing）

**Files:**
- Modify: `frontend/src/utils/pointerRoleColors.test.js`

**Interfaces:**
- 消费：none
- 产出：3 个新断言（待失败）

- [ ] **Step 1: 找到现有 test 文件**

打开 `frontend/src/utils/pointerRoleColors.test.js`，定位已有 `describe('colorForRole', ...)` 块末尾（如果没有则新建）。本仓库该文件存在，按现有风格追加：

在文件末尾（最后一个 `})` 之后）追加：

```js
describe('extended color palette (insert/neutral)', () => {
  it('insert 与 root 颜色不同', () => {
    expect(colorForRole('insert')).not.toBe(colorForRole('root'))
  })
  it('insert 为 magenta', () => {
    expect(colorForRole('insert')).toBe('#d946ef')
  })
  it('neutral 为 amber', () => {
    expect(colorForRole('neutral')).toBe('#f59e0b')
  })
})
```

文件顶部需导入 `colorForRole`：

```js
import { colorForRole, POINTER_ROLE_COLORS, primaryRoleFromLabels, inferPointerRole } from './pointerRoleColors.js'
```

如果现有 import 已有 `colorForRole`，无需重复添加。

- [ ] **Step 2: 跑测试验证 fail**

Run: `cd frontend && npx vitest run src/utils/pointerRoleColors.test.js`
Expected: 3 failed（insert 当前是 `#ef476f` 红色，不是 `#d946ef`；neutral 当前是 `#9ca3af` 浅灰，不是 `#f59e0b`）。

- [ ] **Step 3: Commit（红测试）**

```bash
git add frontend/src/utils/pointerRoleColors.test.js
git commit -m "test(colors): failing assertions for insert/neutral palette extension"
```

---

## Task 3.2 · 改 pointerRoleColors.js 色值

**Files:**
- Modify: `frontend/src/utils/pointerRoleColors.js:18-25`

**Interfaces:**
- 消费：none
- 产出：`POINTER_ROLE_COLORS.insert = '#d946ef'`，`POINTER_ROLE_COLORS.neutral = '#f59e0b'`

- [ ] **Step 1: 修改色板**

打开 `frontend/src/utils/pointerRoleColors.js`，找到 `POINTER_ROLE_COLORS`（`:18-25`）：

```js
export const POINTER_ROLE_COLORS = {
  mid: '#eab308',
  next: '#3b82f6',
  prev: '#6b7280',
  insert: '#ef476f',
  root: '#ef476f',
  neutral: '#9ca3af',
}
```

替换为：

```js
export const POINTER_ROLE_COLORS = {
  mid: '#eab308',
  next: '#3b82f6',
  prev: '#6b7280',
  root: '#ef476f',
  insert: '#d946ef',
  neutral: '#f59e0b',
}
```

注意 `root` 保持 `#ef476f` 不变；`insert` 改为 `#d946ef` magenta，与 root 区分；`neutral` 改为 `#f59e0b` amber。

- [ ] **Step 2: 跑测试验证 pass**

Run: `cd frontend && npx vitest run src/utils/pointerRoleColors.test.js`
Expected: 全部 passed（含原有用例）。

- [ ] **Step 3: Commit**

```bash
git add frontend/src/utils/pointerRoleColors.js
git commit -m "feat(colors): insert → magenta, neutral → amber (mid/next/prev/root unchanged)"
```

---

# P4 · 数组格子高亮对齐

涵盖 spec §6（#4）。抽 `--ds-strip-gap` token；新增纯函数 `rangeRect(lo, hi, cellWidth, gap)`；修 SortArrayCanvas 计算；增 .sac-range / .sac-sorted 边框。

## File Structure（仅本 plan）

| 操作 | 文件 | 职责 |
|---|---|---|
| 改 | `frontend/src/style.css` | 新增 `--ds-strip-gap: 2px` |
| 改 | `frontend/src/components/SortArrayCanvas.vue` | 用 STRIP_GAP 计算 + 引用 token + 补全边框 |
| 改 | `frontend/src/components/ArrayCanvas.vue` | 仅改 gap 走 token（无 range/sorted band） |
| 新建 | `frontend/src/utils/rangeRect.js` | 纯函数：lo/hi/cellWidth/gap → {left, width} |
| 新建 | `frontend/src/utils/rangeRect.test.js` | 单测 |

---

## Task 4.1 · 新增纯函数 rangeRect（failing → passing）

**Files:**
- Create: `frontend/src/utils/rangeRect.js`
- Create: `frontend/src/utils/rangeRect.test.js`

**Interfaces:**
- 消费：none
- 产出：`rangeRect(lo, hi, cellWidth, gap)` → `{ left: number, width: number }`

- [ ] **Step 1: 写测试（failing）**

新建 `frontend/src/utils/rangeRect.test.js`：

```js
import { describe, it, expect } from 'vitest'
import { rangeRect } from './rangeRect.js'

describe('rangeRect', () => {
  it('单格 (lo=hi=0)', () => {
    expect(rangeRect(0, 0, 48, 2)).toEqual({ left: 0, width: 48 })
  })
  it('多格 (lo=2, hi=4, cellWidth=48, gap=2)', () => {
    // left = 2*(48+2) = 100
    // width = 3*48 + 2*2 = 148
    expect(rangeRect(2, 4, 48, 2)).toEqual({ left: 100, width: 148 })
  })
  it('gap=0 时与简单公式一致', () => {
    expect(rangeRect(1, 3, 50, 0)).toEqual({ left: 50, width: 150 })
  })
})
```

- [ ] **Step 2: 跑测试验证 fail**

Run: `cd frontend && npx vitest run src/utils/rangeRect.test.js`
Expected: FAIL with "Cannot find module './rangeRect.js'"。

- [ ] **Step 3: 实现 rangeRect**

新建 `frontend/src/utils/rangeRect.js`：

```js
/**
 * 计算 range / sorted 高亮框的 left / width，考虑 grid gap。
 * @param {number} lo - 起始 index
 * @param {number} hi - 结束 index（含）
 * @param {number} cellWidth - 单格宽度
 * @param {number} gap - 列间距
 * @returns {{ left: number, width: number }}
 */
export function rangeRect(lo, hi, cellWidth, gap) {
  return {
    left: lo * (cellWidth + gap),
    width: (hi - lo + 1) * cellWidth + (hi - lo) * gap,
  }
}
```

- [ ] **Step 4: 跑测试验证 pass**

Run: `cd frontend && npx vitest run src/utils/rangeRect.test.js`
Expected: 3 passed。

- [ ] **Step 5: Commit**

```bash
git add frontend/src/utils/rangeRect.js frontend/src/utils/rangeRect.test.js
git commit -m "feat(canvas): rangeRect util with gap-aware rect math"
```

---

## Task 4.2 · 在 style.css 加 --ds-strip-gap token

**Files:**
- Modify: `frontend/src/style.css:104-111`

**Interfaces:**
- 消费：none
- 产出：`--ds-strip-gap: 2px`（与现有 `--ds-*` token 同段）

- [ ] **Step 1: 添加 token**

打开 `frontend/src/style.css`，在 `:root` 块的 `--ds-popover-shadow` 行（第 110 行）后追加：

```css
  --ds-strip-gap: 2px;
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/style.css
git commit -m "feat(canvas): --ds-strip-gap token for grid gap"
```

---

## Task 4.3 · SortArrayCanvas.vue 用 STRIP_GAP 计算 + 补全边框

**Files:**
- Modify: `frontend/src/components/SortArrayCanvas.vue:155, 239-255, 365-386`

**Interfaces:**
- 消费：`utils/rangeRect.js`（Task 4.1）+ `var(--ds-strip-gap)`（Task 4.2）
- 产出：`rangeHighlight` / `sortedHighlight` 用 `rangeRect`；`.sac-strip` gap 走 token；`.sac-range` / `.sac-sorted` 补 border-top / border-bottom

- [ ] **Step 1: 引入 rangeRect 与 token**

打开 `frontend/src/components/SortArrayCanvas.vue`，找到 `<script setup>` 顶部 import 段（第 79-91 行附近），追加：

```js
import { rangeRect } from '../utils/rangeRect.js'
```

- [ ] **Step 2: 修 rangeHighlight**

找到 `rangeHighlight` computed（第 239-246 行）：

```js
const rangeHighlight = computed(() => {
  const r = props.range
  if (!r || r.lo == null || r.hi == null) return null
  const lo = Math.max(0, r.lo)
  const hi = Math.min(props.values.length - 1, r.hi)
  if (lo > hi) return null
  return { left: `${lo * layout.value.cellWidth}px`, width: `${(hi - lo + 1) * layout.value.cellWidth}px` }
})
```

替换为：

```js
const rangeHighlight = computed(() => {
  const r = props.range
  if (!r || r.lo == null || r.hi == null) return null
  const lo = Math.max(0, r.lo)
  const hi = Math.min(props.values.length - 1, r.hi)
  if (lo > hi) return null
  const gap = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ds-strip-gap')) || 2
  const rect = rangeRect(lo, hi, layout.value.cellWidth, gap)
  return { left: `${rect.left}px`, width: `${rect.width}px` }
})
```

- [ ] **Step 3: 修 sortedHighlight**

找到 `sortedHighlight` computed（第 248-255 行），用同样的方式改造：

```js
const sortedHighlight = computed(() => {
  const r = props.sortedRange
  if (!r || r.lo == null || r.hi == null) return null
  const lo = Math.max(0, r.lo)
  const hi = Math.min(props.values.length - 1, r.hi)
  if (lo > hi) return null
  const gap = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--ds-strip-gap')) || 2
  const rect = rangeRect(lo, hi, layout.value.cellWidth, gap)
  // sorted 用 green 注入到 --range-color
  return {
    left: `${rect.left}px`,
    width: `${rect.width}px`,
    '--range-color': '#10b981',
  }
})
```

将 `return` 增加 `style` 字段需同步修改模板绑定：找到模板 `<div v-if="sortedHighlight" class="sac-sorted" :style="sortedHighlight" />`，把 `:style="sortedHighlight"` 改为 `:style="sortedHighlight"`（Vue 自动把对象当 style 绑定，无需改）。

- [ ] **Step 4: 让 .sac-strip gap 走 token**

找到 `.sac-strip` CSS（第 355-360 行附近）：

```css
.sac-strip {
  position: relative;
  display: grid;
  grid-auto-rows: auto;
  gap: 2px;
}
```

替换为：

```css
.sac-strip {
  position: relative;
  display: grid;
  grid-auto-rows: auto;
  gap: var(--ds-strip-gap, 2px);
}
```

- [ ] **Step 5: 补全 .sac-range / .sac-sorted 边框**

找到 `.sac-range`（第 365-375 行）和 `.sac-sorted`（第 376-386 行），分别补 `border-top` / `border-bottom`，并用 `var(--range-color)` 替代硬编码色：

`.sac-range`：

```css
.sac-range {
  position: absolute;
  top: 0;
  bottom: 0;
  background: color-mix(in srgb, var(--range-color, #3b82f6) 10%, transparent);
  border: 1px solid color-mix(in srgb, var(--range-color, #3b82f6) 25%, transparent);
  border-radius: var(--ds-cell-radius);
  pointer-events: none;
  z-index: 0;
}
```

（将 `border-left: 1px solid` / `border-right: 1px solid` 合并为 `border: 1px solid`，四边统一。）

`.sac-sorted`：

```css
.sac-sorted {
  position: absolute;
  top: 0;
  bottom: 0;
  background: color-mix(in srgb, var(--range-color, #10b981) 12%, transparent);
  border: 1px solid color-mix(in srgb, var(--range-color, #10b981) 30%, transparent);
  border-radius: var(--ds-cell-radius);
  pointer-events: none;
  z-index: 0;
}
```

- [ ] **Step 6: 手测快速排序 range 高亮**

Run: `cd frontend && npm run dev`
跑一段快排 step，确认 range 蓝框上下左右与格子边缘 1px 对齐，无偏移。

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/SortArrayCanvas.vue
git commit -m "fix(canvas): range/sorted band aligns to grid cells (gap-aware rect)"
```

---

## Task 4.4 · ArrayCanvas.vue .ac-strip gap 走 token

**Files:**
- Modify: `frontend/src/components/ArrayCanvas.vue:403-408`

**Interfaces:**
- 消费：`var(--ds-strip-gap)`（Task 4.2）
- 产出：`.ac-strip` gap 走 token

- [ ] **Step 1: 修改 .ac-strip gap**

打开 `frontend/src/components/ArrayCanvas.vue`，找到 `.ac-strip`（第 403-408 行）：

```css
.ac-strip {
  position: relative;
  display: grid;
  grid-auto-rows: auto;
  gap: 2px;
}
```

替换为：

```css
.ac-strip {
  position: relative;
  display: grid;
  grid-auto-rows: auto;
  gap: var(--ds-strip-gap, 2px);
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/ArrayCanvas.vue
git commit -m "refactor(canvas): ArrayCanvas strip gap via --ds-strip-gap token"
```

---

# P5 · 顶栏重构 + 字体 + AI 按钮删除

涵盖 spec §8、§9、§10（#6 + #7 + #8）。先 Google Fonts + 字体栈，再提升 keyframes，最后迁移 runtime wire，最后删 AI 按钮。

## File Structure（仅本 plan）

| 操作 | 文件 | 职责 |
|---|---|---|
| 改 | `frontend/index.html` | Google Fonts 补全 + Inter |
| 改 | `frontend/src/style.css` | `--sans` / `--heading` / `--mono` 更新；提升 `@keyframes wire-pulse` |
| 改 | `frontend/src/components/SingleFileShell.vue` | 删本地 `@keyframes wire-pulse`；删 AI 按钮 |
| 改 | `frontend/src/components/MultiFileShell.vue` | 删本地 `@keyframes wire-pulse` |
| 改 | `frontend/src/App.vue` | 删 `.runtime-wire` DOM + 样式；删 `wireItems` 数据 |
| 改 | `frontend/src/components/ModeBar.vue` | 吸收 runtime wire DOM + 样式 + 数据 |

---

## Task 5.1 · index.html 补全 Google Fonts + Inter

**Files:**
- Modify: `frontend/index.html:10`

**Interfaces:**
- 消费：none
- 产出：stylesheet 链接改为补全字重 + Inter

- [ ] **Step 1: 修改 Google Fonts link**

打开 `frontend/index.html`，找到第 10 行：

```html
<link href="https://fonts.googleapis.com/css2?family=Archivo:wght@600;700;800;900&family=Noto+Sans+SC:wght@400;500;700;900&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet" />
```

替换为：

```html
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Archivo:wght@400;500;600;700;800;900&family=Noto+Sans+SC:wght@400;500;700;900&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet" />
```

- [ ] **Step 2: Commit**

```bash
git add frontend/index.html
git commit -m "feat(fonts): add Inter + extend Archivo/Noto Sans SC weights"
```

---

## Task 5.2 · style.css 更新字体栈 + 提升 wire-pulse

**Files:**
- Modify: `frontend/src/style.css:91-93` + 新增 `@keyframes wire-pulse`（在 :root 后）

**Interfaces:**
- 消费：none
- 产出：`--sans` / `--heading` / `--mono` 加入 Inter；`@keyframes wire-pulse` 提升

- [ ] **Step 1: 替换字体栈**

打开 `frontend/src/style.css`，找到第 91-93 行：

```css
  --sans: 'Archivo', 'Noto Sans SC', -apple-system, system-ui, sans-serif;
  --heading: 'Archivo', 'Noto Sans SC', -apple-system, system-ui, sans-serif;
  --mono: 'JetBrains Mono', 'Noto Sans SC', Menlo, monospace;
```

替换为：

```css
  --sans: 'Inter', 'Archivo', 'Noto Sans SC', -apple-system, system-ui, sans-serif;
  --heading: 'Archivo', 'Inter', 'Noto Sans SC', -apple-system, system-ui, sans-serif;
  --mono: 'JetBrains Mono', 'Noto Sans SC', Menlo, monospace;
```

- [ ] **Step 2: 提升 @keyframes wire-pulse 到 style.css 顶层**

在 `:root` 块结束（第 111 行 `}` 后）插入：

```css
@keyframes wire-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.18; }
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/style.css
git commit -m "feat(fonts): --sans/--heading with Inter; promote wire-pulse to global"
```

---

## Task 5.3 · 删除 SingleFileShell.vue 本地 wire-pulse

**Files:**
- Modify: `frontend/src/components/SingleFileShell.vue:775-776`

**Interfaces:**
- 消费：style.css 全局 `@keyframes wire-pulse`（Task 5.2）
- 产出：scoped CSS 中 `@keyframes wire-pulse` 删除

- [ ] **Step 1: 找到并删除 scoped keyframes**

打开 `frontend/src/components/SingleFileShell.vue`，找到 scoped 样式段中 `.rc-dot` 的 `@keyframes wire-pulse`（第 775-776 行附近）：

```css
@keyframes wire-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.18; }
}
```

整段删除。

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/SingleFileShell.vue
git commit -m "refactor(shell): remove local wire-pulse keyframes (now global)"
```

---

## Task 5.4 · 删除 MultiFileShell.vue 本地 wire-pulse

**Files:**
- Modify: `frontend/src/components/MultiFileShell.vue:269-272`

**Interfaces:**
- 消费：style.css 全局 `@keyframes wire-pulse`（Task 5.2）
- 产出：scoped CSS 中 `@keyframes wire-pulse` 删除

- [ ] **Step 1: 找到并删除 scoped keyframes**

打开 `frontend/src/components/MultiFileShell.vue`，找到 scoped 样式段中 `.rc-dot` 的 `@keyframes wire-pulse`（第 269-272 行）：

```css
@keyframes wire-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.18; }
}
```

整段删除。

- [ ] **Step 2: Commit**

```bash
git add frontend/src/components/MultiFileShell.vue
git commit -m "refactor(shell): remove local wire-pulse keyframes (now global)"
```

---

## Task 5.5 · App.vue 删 runtime-wire DOM + 样式 + 数据

**Files:**
- Modify: `frontend/src/App.vue:10-36, 68-76, 133-235`

**Interfaces:**
- 消费：none
- 产出：`.runtime-wire` DOM / CSS / wireItems 数据全部移除

- [ ] **Step 1: 删除 .runtime-wire DOM**

打开 `frontend/src/App.vue`，删除第 10-36 行整段 `<div class="runtime-wire">...</div>`。

- [ ] **Step 2: 删除 .runtime-wire CSS**

在 `<style scoped>` 段（第 133-235 行）删除：

```css
/* ---- Runtime wire banner (prototype .wire, compact) ---- */
.runtime-wire { ... }
.runtime-wire::after { ... }
.wire-left { ... }
.wire-mark { ... }
.wire-pulse-dot { ... }
@keyframes wire-pulse { ... }
.wire-title { ... }
.wire-row { ... }
.marquee-track { ... }
.wire-item { ... }
.wire-dot { ... }
.wire-coord { ... }
@keyframes wire-marquee { ... }
@media (prefers-reduced-motion: reduce) {
  .marquee-track { animation: none; }
  .wire-pulse { animation: none; }
}
@media (max-width: 720px) {
  .runtime-wire { grid-template-columns: 1fr; }
  .wire-left { border-right: none; border-bottom: 1px solid var(--border); }
}
```

整段删除。注意 `wire-pulse` 已提升到 style.css（Task 5.2），本文件无需再保留。

- [ ] **Step 3: 删除 wireItems 数据**

在 `<script setup>` 内找到 `wireItems` 数组（第 68-76 行）：

```js
const wireItems = [
  { name: 'TRACE', coord: 'AST' },
  { name: 'STEP', coord: 'PLAYBACK' },
  { name: 'HEAP', coord: 'VIEW' },
  { name: 'STACK', coord: 'FRAME' },
  { name: 'AI TUTOR', coord: 'COZE' },
  { name: 'SANDBOX', coord: 'JDK17' },
  { name: 'LIVE2D', coord: 'OP' },
]
```

整段删除（这一数据在 Task 5.6 迁到 ModeBar.vue）。

- [ ] **Step 4: Commit**

```bash
git add frontend/src/App.vue
git commit -m "refactor(app): remove runtime-wire banner (moves to ModeBar)"
```

---

## Task 5.6 · ModeBar.vue 吸收 runtime wire

**Files:**
- Modify: `frontend/src/components/ModeBar.vue`

**Interfaces:**
- 消费：原 App.vue `.runtime-wire / .wire-row / .marquee-track / .wire-item / .wire-dot / .wire-coord / @keyframes wire-marquee` CSS（这些类不再 scoped，全放 ModeBar scoped 内）
- 产出：ModeBar.vue DOM 含「单/多文件按钮 + wire 标识 + 走马灯 + brand」

- [ ] **Step 1: 替换 ModeBar.vue template**

打开 `frontend/src/components/ModeBar.vue`，把 template 部分（第 1-13 行）替换为：

```html
<div class="mode-bar" role="tablist" aria-label="文件模式">
  <button
    v-for="opt in options"
    :key="opt.value"
    class="mode-bar-btn"
    :class="{ active: store.mode === opt.value }"
    role="tab"
    :aria-selected="store.mode === opt.value"
    @click="store.switchMode(opt.value)"
  >{{ opt.label }}</button>

  <span class="mode-bar-divider" aria-hidden="true" />

  <span class="wire-mark" aria-hidden="true">
    <svg viewBox="0 0 28 28" width="28" height="28" fill="none">
      <path d="M5 1h18l4 4v18l-4 4H5l-4-4V5l4-4Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="miter"/>
      <circle class="wire-pulse-dot" cx="14" cy="14" r="4.5" fill="currentColor" opacity="1"/>
      <circle cx="14" cy="14" r="8" stroke="currentColor" stroke-width="1" stroke-dasharray="2.5 3.5" opacity="0.4"/>
    </svg>
  </span>
  <span class="wire-title">
    <b>RUNTIME WIRE</b>
    <span>教学终端 · HEARTBEAT</span>
  </span>

  <div class="wire-row" aria-label="运行时数据流">
    <div class="marquee-track">
      <span v-for="(item, i) in wireItems" :key="'a'+i" class="wire-item">
        <span class="wire-dot">·</span>{{ item.name }}
        <span class="wire-coord">{{ item.coord }}</span>
      </span>
      <span v-for="(item, i) in wireItems" :key="'b'+i" class="wire-item" aria-hidden="true">
        <span class="wire-dot">·</span>{{ item.name }}
        <span class="wire-coord">{{ item.coord }}</span>
      </span>
    </div>
  </div>

  <span class="mode-bar-brand">JavaTutor · 教学终端</span>
</div>
```

- [ ] **Step 2: 替换 script setup**

把 `<script setup>` 段（第 15-23 行）替换为：

```html
<script setup>
import { usePlayerStore } from '../stores/player'
const store = usePlayerStore()
const options = [
  { label: '单文件', value: 'single' },
  { label: '多文件', value: 'multi' },
]
const wireItems = [
  { name: 'TRACE', coord: 'AST' },
  { name: 'STEP', coord: 'PLAYBACK' },
  { name: 'HEAP', coord: 'VIEW' },
  { name: 'STACK', coord: 'FRAME' },
  { name: 'AI TUTOR', coord: 'COZE' },
  { name: 'SANDBOX', coord: 'JDK17' },
  { name: 'LIVE2D', coord: 'OP' },
]
</script>
```

- [ ] **Step 3: 替换 scoped CSS**

把 ModeBar.vue scoped CSS（第 25-78 行）替换为：

```html
<style scoped>
.mode-bar {
  position: relative;
  z-index: 3;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  margin: 8px 12px 0;
  background: var(--card-bg);
  border: 1px solid var(--border);
  clip-path: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px);
  box-shadow: var(--shadow);
  min-height: 44px;
}
.mode-bar::after {
  content: '';
  position: absolute;
  left: 0;
  bottom: -1px;
  width: 88px;
  height: 2px;
  background: var(--accent);
}
.mode-bar-btn {
  background: transparent;
  border: 1px solid var(--line-strong);
  padding: 6px 16px;
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-muted);
  cursor: pointer;
  clip-path: polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px);
  transition: color 0.15s, background 0.15s, border-color 0.15s;
}
.mode-bar-btn:hover { color: var(--text-h); background: var(--accent-bg); }
.mode-bar-btn.active {
  color: var(--accent);
  border-color: var(--accent);
  background: var(--accent-bg);
  box-shadow: inset 0 -2px 0 var(--accent);
}
.mode-bar-divider {
  width: 1px;
  height: 22px;
  background: var(--border);
  flex-shrink: 0;
}
.wire-mark {
  width: 28px;
  height: 28px;
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--accent);
}
.wire-pulse-dot {
  animation: wire-pulse 1.6s steps(2) infinite;
}
.wire-title {
  display: flex;
  flex-direction: column;
  gap: 2px;
  line-height: 1.2;
}
.wire-title b {
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.12em;
  color: var(--text-h);
}
.wire-title span {
  font-family: var(--mono);
  font-size: 9px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--text-muted);
}
.wire-row {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  display: flex;
  align-items: center;
  white-space: nowrap;
}
.marquee-track {
  display: inline-flex;
  gap: 28px;
  padding-right: 28px;
  animation: wire-marquee 42s linear infinite;
}
.wire-item {
  display: inline-flex;
  align-items: baseline;
  gap: 8px;
  font-family: var(--mono);
  font-size: 10.5px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text);
}
.wire-dot { color: var(--accent); }
.wire-coord {
  color: var(--text-muted);
  font-size: 9px;
}
@keyframes wire-marquee { to { transform: translateX(-50%); } }
.mode-bar-brand {
  flex-shrink: 0;
  font-family: var(--mono);
  font-size: 10px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--text-muted);
}
@media (prefers-reduced-motion: reduce) {
  .marquee-track { animation: none; }
}
@media (max-width: 720px) {
  .wire-row { display: none; }
}
</style>
```

- [ ] **Step 4: 手测验证**

Run: `cd frontend && npm run dev`
打开页面，确认：
- 顶部只剩 ModeBar 一行
- 左侧「单文件 / 多文件」切换按钮位置不变
- 中间有 RUNTIME WIRE 标识 + 走马灯跑动
- 切换模式不报错

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/ModeBar.vue
git commit -m "feat(modebar): absorb runtime wire (wire title + marquee) into ModeBar"
```

---

## Task 5.7 · 删除 SingleFileShell.vue AI 问答按钮

**Files:**
- Modify: `frontend/src/components/SingleFileShell.vue:210-237, 539-541, 1026-1048`

**Interfaces:**
- 消费：none
- 产出：AI 按钮 DOM / CSS / JS 函数全部移除；`.ctrl-right-group` 保留自动播放 + 速度选择器

- [ ] **Step 1: 删除 AI 按钮 DOM**

打开 `frontend/src/components/SingleFileShell.vue`，找到 `<button class="ctrl-btn ai-toggle-btn" ...>` 块（第 210-237 行附近），整段删除。

保留 `.ctrl-right-group` 内其它按钮（自动播放 toggle + 速度选择器）。

- [ ] **Step 2: 删除 toggleAiPanel 函数**

在 `<script setup>` 段找到 `toggleAiPanel` 函数（第 539-541 行）：

```js
function toggleAiPanel() {
  store.toggleExplainPanel()
}
```

整段删除。

- [ ] **Step 3: 删除 .ai-toggle-btn scoped CSS**

在 scoped 样式段找到 `.ai-toggle-btn` 全部规则（hover / active / pulsing） + `@keyframes ai-pulse`（第 1026-1048 行附近）：

```css
/* AI toggle button */
.ai-toggle-btn { ... }
.ai-toggle-btn:hover:not(:disabled) { ... }
.ai-toggle-btn.active { ... }
.ai-toggle-btn.pulsing { ... }
@keyframes ai-pulse { ... }
```

整段删除。

- [ ] **Step 4: 调整控制栏 min-width**

找到 `.control-bar` 的 `min-width: 380px`（约第 877 行），改为：

```css
  min-width: 320px;
```

（按钮少了，栏宽可缩小。）

- [ ] **Step 5: 删除 prefers-reduced-motion 内的 ai-toggle-btn 规则**

找到 `@media (prefers-reduced-motion: reduce)` 块（约第 1207 行），删除 `.ai-toggle-btn.pulsing { animation: none; }` 这一行（无其它 ai 引用时整行删除）。

- [ ] **Step 6: 手测验证**

Run: `cd frontend && npm run dev`
确认：
- 控制栏右侧无 AI 按钮
- 右侧栏「问答」tab 仍能正常打开 AiTutorPanel
- Live2D 看板娘仍正常加载（提示脚本无 .ai-toggle-btn 时无副作用）

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/SingleFileShell.vue
git commit -m "feat(shell): remove AI 问答 toggle button (entry only via right tab)"
```

---

## 验收清单（执行后手测）

| 项 | 期望 |
|---|---|
| 算法知识库「查找与搜索」类目 | 6 个 anchor 全部可点击跳转 |
| 代码块字号 | 与正文一致 ~12px，圆角 + shadow |
| 标签 hover | translateY(-1px) + 阴影加深 |
| 树 / 堆 chip | 不透明背景，白字，z-index 高于 SVG 边 |
| 数组 range 高亮（快排） | 蓝框上下左右与格子边缘 1px 对齐 |
| chip 色板 | insert magenta / neutral amber，其它不变 |
| ModeBar | 单行；左侧切换按钮；右侧走马灯跑动 |
| Google Fonts 字体 | Inter / Archivo / Noto Sans SC / JetBrains Mono；中英文 fallback 正确 |
| AI 按钮 | 控制栏右侧无；「问答」tab 入口保留 |
| font-size 全局 | 未变 |

---

## Self-Review Checklist

- [x] **Spec coverage**: §4 (P1) / §5 (P2) / §6 (P4) / §7 (P3) / §8 (P5) / §9 (P5) / §10 (P5) — 全部对应 task
- [x] **Placeholder scan**: 无 TBD；每步都有具体代码 / 命令
- [x] **Type consistency**: `rangeRect(lo, hi, cellWidth, gap)` → `{left, width}` 全 plan 内统一
- [x] **Hex values**: insert `#d946ef` / neutral `#f59e0b` / 其它四色不变 — Task 3.2 明确写出
- [x] **Token values**: `--ak-*` / `--ds-strip-gap` 与 spec §4.3 / §6.3 一致
- [x] **Gap math**: rangeRect 公式 `lo*(cw+gap)` 与 spec §6.2 一致