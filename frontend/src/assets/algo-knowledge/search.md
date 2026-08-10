# 二分查找

在**有序**数组（或具有单调性的答案空间）上，每次排除一半区间，将 O(n) 线性扫描降为 O(log n)。

## 二分查找

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

## 边界与变体

| 问题 | 思路 |
|------|------|
| 第一个 ≥ x 的位置 | `hi = mid` 或 `lo = mid + 1`，看 `a[mid] < x` |
| 最后一个 ≤ x 的位置 | 对称写法 |
| 答案在实数域 | 对答案二分，写 `check(mid)` 判定可行性 |

**常见错误**：`mid = (lo + hi) / 2` 溢出（用 `lo + (hi-lo)/2`）；死循环（`lo/hi` 更新未严格缩小区间）。

---

> 本文为 JavaTutor 项目原创教学摘要。延伸阅读：[oi.wiki 二分查找](https://oi.wiki/basic/binary/)，遵循 **CC-BY-SA** 协议。
