<template>
  <div class="classic-panel">
    <button class="classic-toggle-all" :class="{ active: !allExpanded }" @click="toggleAll">
      <svg class="classic-toggle-chevron" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <polyline v-if="allExpanded" points="18 15 12 9 6 15" />
        <polyline v-else points="6 9 12 15 18 9" />
      </svg>
      <span class="classic-toggle-label">{{ allExpanded ? '收起全部' : '展开全部' }}</span>
    </button>
    <div v-for="group in groups" :key="group.label" class="classic-group">
      <div class="classic-group-header" @click="toggleGroup(group.label)">
        <div class="flex items-center gap-2">
          <span class="classic-dot" />
          <span class="classic-group-label">{{ group.label }}</span>
        </div>
        <svg class="classic-chevron" :class="{ rotated: !collapsed[group.label] }" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </div>
      <div class="classic-list-wrap" :class="{ collapsed: collapsed[group.label] }">
        <div class="classic-list-inner">
          <div class="classic-list">
        <button
          v-for="item in group.items" :key="item.name"
          class="classic-item"
          @click="$emit('loadCode', { name: item.name + '.java', code: item.code })"
        >
          <div class="classic-item-name">{{ item.name }}</div>
          <div class="classic-item-desc">{{ item.desc }}</div>
        </button>
      </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, computed } from 'vue'

defineEmits(['loadCode'])

const collapsed = reactive({})

function toggleGroup(label) {
  collapsed[label] = !collapsed[label]
}

const allExpanded = computed(() => {
  return groups.every(g => !collapsed[g.label])
})

function toggleAll() {
  if (allExpanded.value) {
    groups.forEach(g => collapsed[g.label] = true)
  } else {
    Object.keys(collapsed).forEach(k => delete collapsed[k])
  }
}

const groups = [
  // ==================== 1. 数学算法 ====================
  {
    label: '数学算法',
    items: [
      {
        name: '最大公约数',
        desc: 'GCD — 辗转相除法 O(log n)',
        code: `public class GCD {
    public static void main(String[] args) {
        int a = 48, b = 18;
        // 欧几里得算法：gcd(a,b) = gcd(b, a%b)
        while (b != 0) {
            int temp = b;
            b = a % b;
            a = temp;
        }
        System.out.println("GCD = " + a);
    }
}`,
      },
      {
        name: '判断质数',
        desc: 'Prime Check — O(√n)',
        code: `public class PrimeCheck {
    public static void main(String[] args) {
        int n = 97;
        boolean isPrime = n > 1;
        // 只需检查到 √n
        for (int i = 2; i * i <= n; i++) {
            if (n % i == 0) {
                isPrime = false;
                break;
            }
        }
        System.out.println(n + " is prime: " + isPrime);
    }
}`,
      },
      {
        name: '快速幂',
        desc: 'Fast Power — O(log n)',
        code: `public class FastPow {
    public static void main(String[] args) {
        double x = 2.0;
        int n = 10;
        double result = myPow(x, n);
        System.out.println(x + "^" + n + " = " + result);
    }

    static double myPow(double x, int n) {
        long N = n;
        if (N < 0) { x = 1 / x; N = -N; }
        double ans = 1.0;
        // 快速幂：二分指数
        while (N > 0) {
            if ((N & 1) == 1) ans *= x;  // 当前位为1则乘入
            x *= x;                        // x 翻倍
            N >>= 1;                       // 指数右移
        }
        return ans;
    }
}`,
      },
      {
        name: '埃氏筛法',
        desc: 'Sieve of Eratosthenes — O(n log log n)',
        code: `public class CountPrimes {
    public static void main(String[] args) {
        int n = 30;
        boolean[] isPrime = new boolean[n];
        for (int i = 2; i < n; i++) isPrime[i] = true;
        // 埃氏筛：标记所有合数
        for (int i = 2; i * i < n; i++) {
            if (isPrime[i]) {
                for (int j = i * i; j < n; j += i) {
                    isPrime[j] = false;
                }
            }
        }
        // 输出所有质数
        for (int i = 2; i < n; i++) {
            if (isPrime[i]) System.out.print(i + " ");
        }
    }
}`,
      },
    ],
  },

  // ==================== 2. 常用数据结构 ====================
  {
    label: '常用数据结构',
    items: [
      {
        name: '前缀和',
        desc: 'Prefix Sum — 区间和 O(1)',
        code: `public class PrefixSum {
    public static void main(String[] args) {
        int[] nums = {1, 2, 3, 4, 5};
        int n = nums.length;
        int[] prefix = new int[n + 1];
        // 构建前缀和数组
        for (int i = 0; i < n; i++) {
            prefix[i + 1] = prefix[i] + nums[i];
        }
        // 查询区间 [2, 4] 的和（0-indexed）
        int sum = prefix[5] - prefix[2];
        System.out.println("sum[2..4] = " + sum); // 3+4+5=12
    }
}`,
      },
      {
        name: '并查集',
        desc: 'Union Find — 近似 O(1)',
        code: `public class UnionFind {
    static int[] parent;
    static int[] rank;

    public static void main(String[] args) {
        int n = 6;
        parent = new int[n];
        rank = new int[n];
        for (int i = 0; i < n; i++) parent[i] = i;
        // 合并操作
        union(0, 1);
        union(1, 2);
        union(3, 4);
        System.out.println("0-2 connected: " + (find(0) == find(2))); // true
        System.out.println("0-3 connected: " + (find(0) == find(3))); // false
        union(2, 3);
        System.out.println("0-3 connected: " + (find(0) == find(3))); // true
    }

    static int find(int x) {
        // 路径压缩
        if (parent[x] != x) parent[x] = find(parent[x]);
        return parent[x];
    }

    static void union(int x, int y) {
        int rx = find(x), ry = find(y);
        if (rx == ry) return;
        // 按秩合并
        if (rank[rx] < rank[ry]) parent[rx] = ry;
        else if (rank[rx] > rank[ry]) parent[ry] = rx;
        else { parent[ry] = rx; rank[rx]++; }
    }
}`,
      },
      {
        name: '栈',
        desc: 'Stack — 后进先出 LIFO O(1)',
        code: `public class StackDemo {
    public static void main(String[] args) {
        java.util.Stack<Integer> stack = new java.util.Stack<>();
        // 入栈 push
        stack.push(1);
        stack.push(2);
        stack.push(3);
        // 查看栈顶 peek
        System.out.println("top: " + stack.peek()); // 3
        // 出栈 pop（后进先出 LIFO）
        while (!stack.isEmpty()) {
            System.out.print(stack.pop() + " "); // 3 2 1
        }
    }
}`,
      },
      {
        name: '队列',
        desc: 'Queue — 先进先出 FIFO O(1)',
        code: `public class QueueDemo {
    public static void main(String[] args) {
        java.util.Queue<Integer> queue = new java.util.LinkedList<>();
        // 入队 offer
        queue.offer(1);
        queue.offer(2);
        queue.offer(3);
        // 查看队首 peek
        System.out.println("front: " + queue.peek()); // 1
        // 出队 poll（先进先出 FIFO）
        while (!queue.isEmpty()) {
            System.out.print(queue.poll() + " "); // 1 2 3
        }
    }
}`,
      },
    ],
  },

  // ==================== 3. 排序算法 ====================
  {
    label: '排序算法',
    items: [
      {
        name: '冒泡排序',
        desc: 'Bubble Sort — O(n²)',
        code: `public class BubbleSort {
    public static void main(String[] args) {
        int[] arr = {5, 3, 8, 1, 2};
        int n = arr.length;
        // 外层循环：每轮将最大值冒泡到末尾
        for (int i = 0; i < n - 1; i++) {
            for (int j = 0; j < n - i - 1; j++) {
                if (arr[j] > arr[j + 1]) {
                    // 交换相邻元素
                    int temp = arr[j];
                    arr[j] = arr[j + 1];
                    arr[j + 1] = temp;
                }
            }
        }
    }
}`,
      },
      {
        name: '选择排序',
        desc: 'Selection Sort — O(n²)',
        code: `public class SelectionSort {
    public static void main(String[] args) {
        int[] arr = {9, 6, 1, 4, 7};
        int n = arr.length;
        for (int i = 0; i < n - 1; i++) {
            // 找到未排序部分的最小元素
            int minIdx = i;
            for (int j = i + 1; j < n; j++) {
                if (arr[j] < arr[minIdx]) {
                    minIdx = j;
                }
            }
            // 将最小元素交换到已排序末尾
            int temp = arr[i];
            arr[i] = arr[minIdx];
            arr[minIdx] = temp;
        }
    }
}`,
      },
      {
        name: '插入排序',
        desc: 'Insertion Sort — O(n²)',
        code: `public class InsertionSort {
    public static void main(String[] args) {
        int[] arr = {7, 2, 5, 1, 8};
        int n = arr.length;
        // 将每个元素插入到已排序部分的正确位置
        for (int i = 1; i < n; i++) {
            int key = arr[i];
            int j = i - 1;
            while (j >= 0 && arr[j] > key) {
                arr[j + 1] = arr[j];
                j--;
            }
            arr[j + 1] = key;
        }
    }
}`,
      },
      {
        name: '快速排序',
        desc: 'Quick Sort — O(n log n)',
        code: `public class QuickSort {
    public static void main(String[] args) {
        int[] arr = {8, 3, 5, 1, 9, 2};
        quickSort(arr, 0, arr.length - 1);
    }

    static void quickSort(int[] a, int low, int high) {
        if (low >= high) return;
        // 选取最右元素为基准
        int pivot = a[high];
        int i = low - 1;
        // 分区：小于基准的放左边
        for (int j = low; j < high; j++) {
            if (a[j] <= pivot) {
                i++;
                int t = a[i];
                a[i] = a[j];
                a[j] = t;
            }
        }
        // 将基准放到正确位置
        int t = a[i + 1];
        a[i + 1] = a[high];
        a[high] = t;
        // 递归排序左右子数组
        quickSort(a, low, i);
        quickSort(a, i + 2, high);
    }
}`,
      },
      {
        name: '归并排序',
        desc: 'Merge Sort — O(n log n)',
        code: `public class MergeSort {
    public static void main(String[] args) {
        int[] arr = {8, 4, 5, 1, 3, 7, 6, 2};
        int[] temp = new int[arr.length];
        mergeSort(arr, temp, 0, arr.length - 1);
    }

    static void mergeSort(int[] a, int[] tmp, int left, int right) {
        if (left >= right) return;
        int mid = left + (right - left) / 2;
        // 分治：递归排序左右半区
        mergeSort(a, tmp, left, mid);
        mergeSort(a, tmp, mid + 1, right);
        // 合并两个有序数组
        int i = left, j = mid + 1, k = left;
        while (i <= mid && j <= right) {
            tmp[k++] = (a[i] <= a[j]) ? a[i++] : a[j++];
        }
        while (i <= mid) tmp[k++] = a[i++];
        while (j <= right) tmp[k++] = a[j++];
        for (i = left; i <= right; i++) a[i] = tmp[i];
    }
}`,
      },
      {
        name: '堆排序',
        desc: 'Heap Sort — O(n log n)',
        code: `public class HeapSort {
    public static void main(String[] args) {
        int[] arr = {9, 4, 7, 1, 6, 2, 8, 3, 5};
        int n = arr.length;
        // 建堆：从最后一个非叶节点向下调整（大顶堆）
        for (int i = n / 2 - 1; i >= 0; i--) {
            heapify(arr, n, i);
        }
        // 依次将堆顶（最大值）与末尾交换，并缩小堆
        for (int end = n - 1; end > 0; end--) {
            int t = arr[0];
            arr[0] = arr[end];
            arr[end] = t;
            heapify(arr, end, 0);
        }
    }

    static void heapify(int[] a, int n, int i) {
        int largest = i;
        int left = 2 * i + 1;
        int right = 2 * i + 2;
        // 找出父节点与左右子节点中的最大值
        if (left < n && a[left] > a[largest]) largest = left;
        if (right < n && a[right] > a[largest]) largest = right;
        if (largest != i) {
            int t = a[i];
            a[i] = a[largest];
            a[largest] = t;
            heapify(a, n, largest);
        }
    }
}`,
      },
      {
        name: '希尔排序',
        desc: 'Shell Sort — O(n log n)',
        code: `public class ShellSort {
    public static void main(String[] args) {
        int[] arr = {9, 1, 5, 3, 7, 2, 8, 4, 6};
        int n = arr.length;
        // 增量序列：gap 每次减半
        for (int gap = n / 2; gap > 0; gap /= 2) {
            // 对每个分组做插入排序
            for (int i = gap; i < n; i++) {
                int key = arr[i];
                int j = i;
                while (j >= gap && arr[j - gap] > key) {
                    arr[j] = arr[j - gap];
                    j -= gap;
                }
                arr[j] = key;
            }
        }
    }
}`,
      },
    ],
  },

  // ==================== 4. 查找算法 ====================
  {
    label: '查找算法',
    items: [
      {
        name: '顺序查找',
        desc: 'Linear Search — O(n)',
        code: `public class LinearSearch {
    public static void main(String[] args) {
        int[] arr = {3, 8, 1, 9, 4, 7};
        int target = 9;
        int index = -1;
        // 从左到右逐一比对
        for (int i = 0; i < arr.length; i++) {
            if (arr[i] == target) {
                index = i;
                break;
            }
        }
        System.out.println("index: " + index);
    }
}`,
      },
      {
        name: '哈希查找',
        desc: 'Hash Search — O(1)',
        code: `public class HashSearch {
    public static void main(String[] args) {
        int[] arr = {3, 8, 1, 9, 4, 7};
        int target = 9;
        // 构建哈希表：值 -> 下标
        java.util.Map<Integer, Integer> map = new java.util.HashMap<>();
        for (int i = 0; i < arr.length; i++) {
            map.put(arr[i], i);
        }
        // O(1) 查询
        Integer index = map.get(target);
        System.out.println("index: " + (index == null ? -1 : index));
    }
}`,
      },
      {
        name: '二分查找',
        desc: 'Binary Search — O(log n)',
        code: `public class BinarySearch {
    public static void main(String[] args) {
        int[] arr = {2, 5, 8, 12, 16, 23, 38, 45};
        int target = 16;
        int left = 0, right = arr.length - 1;
        int result = -1;
        while (left <= right) {
            int mid = left + (right - left) / 2;
            if (arr[mid] == target) {
                result = mid;
                break;
            } else if (arr[mid] < target) {
                left = mid + 1;
            } else {
                right = mid - 1;
            }
        }
        System.out.println("index: " + result);
    }
}`,
      },
      {
        name: '搜索旋转排序数组',
        desc: 'Search in Rotated Array — O(log n)',
        code: `public class SearchRotated {
    public static void main(String[] args) {
        int[] nums = {4, 5, 6, 7, 0, 1, 2};
        int target = 0;
        int left = 0, right = nums.length - 1;
        int result = -1;
        while (left <= right) {
            int mid = left + (right - left) / 2;
            if (nums[mid] == target) {
                result = mid;
                break;
            }
            // 判断哪半边是有序的
            if (nums[left] <= nums[mid]) {
                // 左半有序
                if (nums[left] <= target && target < nums[mid]) {
                    right = mid - 1;
                } else {
                    left = mid + 1;
                }
            } else {
                // 右半有序
                if (nums[mid] < target && target <= nums[right]) {
                    left = mid + 1;
                } else {
                    right = mid - 1;
                }
            }
        }
        System.out.println("index: " + result);
    }
}`,
      },
      {
        name: '寻找峰值',
        desc: 'Find Peak Element — O(log n)',
        code: `public class FindPeak {
    public static void main(String[] args) {
        int[] nums = {1, 2, 3, 1};
        int left = 0, right = nums.length - 1;
        while (left < right) {
            int mid = left + (right - left) / 2;
            // 峰值一定在较大的那一侧
            if (nums[mid] > nums[mid + 1]) {
                right = mid;
            } else {
                left = mid + 1;
            }
        }
        System.out.println("peak index: " + left);
    }
}`,
      },
      {
        name: 'KMP字符串匹配',
        desc: 'KMP — O(n+m)',
        code: `public class KMP {
    public static void main(String[] args) {
        String text = "ababcabcabababd";
        String pattern = "ababd";
        int[] next = buildNext(pattern);
        int j = 0; // pattern 指针
        for (int i = 0; i < text.length(); i++) {
            // 失配时根据 next 数组回退
            while (j > 0 && text.charAt(i) != pattern.charAt(j)) {
                j = next[j - 1];
            }
            if (text.charAt(i) == pattern.charAt(j)) j++;
            if (j == pattern.length()) {
                System.out.println("found at " + (i - j + 1));
                j = next[j - 1];
            }
        }
    }

    static int[] buildNext(String p) {
        int m = p.length();
        int[] next = new int[m];
        int j = 0; // 前缀末尾
        for (int i = 1; i < m; i++) {
            while (j > 0 && p.charAt(i) != p.charAt(j)) {
                j = next[j - 1];
            }
            if (p.charAt(i) == p.charAt(j)) j++;
            next[i] = j;
        }
        return next;
    }
}`,
      },
      {
        name: '最长公共前缀',
        desc: 'Longest Common Prefix — O(S)',
        code: `public class LongestCommonPrefix {
    public static void main(String[] args) {
        String[] strs = {"flower", "flow", "flight"};
        if (strs.length == 0) return;
        String prefix = strs[0];
        // 逐个比较，不断缩短前缀
        for (int i = 1; i < strs.length; i++) {
            while (strs[i].indexOf(prefix) != 0) {
                prefix = prefix.substring(0, prefix.length() - 1);
                if (prefix.isEmpty()) break;
            }
        }
        System.out.println("prefix: " + prefix);
    }
}`,
      },
      {
        name: '字符串转整数',
        desc: 'String to Integer (atoi)',
        code: `public class MyAtoi {
    public static void main(String[] args) {
        String s = "   -42 with words";
        int i = 0, n = s.length();
        // 跳过前导空格
        while (i < n && s.charAt(i) == ' ') i++;
        // 处理符号
        int sign = 1;
        if (i < n && (s.charAt(i) == '+' || s.charAt(i) == '-')) {
            sign = (s.charAt(i) == '-') ? -1 : 1;
            i++;
        }
        // 逐位解析数字
        int result = 0;
        while (i < n && s.charAt(i) >= '0' && s.charAt(i) <= '9') {
            int digit = s.charAt(i) - '0';
            // 溢出检查
            if (result > (Integer.MAX_VALUE - digit) / 10) {
                result = (sign == 1) ? Integer.MAX_VALUE : Integer.MIN_VALUE;
                break;
            }
            result = result * 10 + digit;
            i++;
        }
        System.out.println("result: " + (result * sign));
    }
}`,
      },
    ],
  },

  // ==================== 5. 双指针与滑动窗口 ====================
  {
    label: '双指针与滑动窗口',
    items: [
      {
        name: '两数之和II',
        desc: 'Two Sum II — 有序数组双指针 O(n)',
        code: `public class TwoSumII {
    public static void main(String[] args) {
        int[] nums = {2, 7, 11, 15};
        int target = 9;
        int left = 0, right = nums.length - 1;
        // 双指针相向移动
        while (left < right) {
            int sum = nums[left] + nums[right];
            if (sum == target) break;
            else if (sum < target) left++;
            else right--;
        }
        System.out.println(left + ", " + right);
    }
}`,
      },
      {
        name: '盛最多水的容器',
        desc: 'Container With Most Water — O(n)',
        code: `public class MaxArea {
    public static void main(String[] args) {
        int[] height = {1, 8, 6, 2, 5, 4, 8, 3, 7};
        int left = 0, right = height.length - 1;
        int maxArea = 0;
        while (left < right) {
            // 计算当前容器面积
            int h = Math.min(height[left], height[right]);
            int area = h * (right - left);
            maxArea = Math.max(maxArea, area);
            // 移动较矮的一侧
            if (height[left] < height[right]) left++;
            else right--;
        }
        System.out.println("max area: " + maxArea);
    }
}`,
      },
      {
        name: '最长无重复子串',
        desc: 'Longest Substring — 滑动窗口 O(n)',
        code: `public class LongestSubstring {
    public static void main(String[] args) {
        String s = "abcabcbb";
        int[] lastPos = new int[128];
        int left = 0, maxLen = 0;
        // 滑动窗口：right 逐格右移，left 跳过重复字符
        for (int right = 0; right < s.length(); right++) {
            char c = s.charAt(right);
            left = Math.max(left, lastPos[c]);
            maxLen = Math.max(maxLen, right - left + 1);
            lastPos[c] = right + 1;
        }
        System.out.println("max length: " + maxLen);
    }
}`,
      },
      {
        name: '三数之和',
        desc: '3Sum — 排序 + 双指针 O(n²)',
        code: `public class ThreeSum {
    public static void main(String[] args) {
        int[] nums = {-1, 0, 1, 2, -1, -4};
        int n = nums.length;
        // 先排序，方便去重和双指针
        java.util.Arrays.sort(nums);
        for (int i = 0; i < n - 2; i++) {
            if (i > 0 && nums[i] == nums[i - 1]) continue; // 跳过重复
            int left = i + 1, right = n - 1;
            while (left < right) {
                int sum = nums[i] + nums[left] + nums[right];
                if (sum == 0) {
                    System.out.println(nums[i] + "," + nums[left] + "," + nums[right]);
                    left++; right--;
                    while (left < right && nums[left] == nums[left - 1]) left++;
                    while (left < right && nums[right] == nums[right + 1]) right--;
                } else if (sum < 0) left++;
                else right--;
            }
        }
    }
}`,
      },
    ],
  },

  // ==================== 6. 链表 ====================
  {
    label: '链表',
    items: [
      {
        name: '链表反转',
        desc: 'Reverse Linked List — O(n)',
        code: `public class ReverseList {
    static class ListNode {
        int val;
        ListNode next;
        ListNode(int v) { val = v; }
    }

    public static void main(String[] args) {
        // 构建链表 1→2→3→4→5
        ListNode head = new ListNode(1);
        head.next = new ListNode(2);
        head.next.next = new ListNode(3);
        head.next.next.next = new ListNode(4);
        head.next.next.next.next = new ListNode(5);
        // 迭代反转
        ListNode prev = null;
        ListNode curr = head;
        while (curr != null) {
            ListNode next = curr.next; // 暂存下一个节点
            curr.next = prev;          // 反转指针
            prev = curr;               // 前移
            curr = next;               // 前移
        }
        head = prev; // 新头节点
    }
}`,
      },
      {
        name: '单向链表',
        desc: 'Singly Linked List — 头插 O(1)',
        code: `public class SinglyList {
    static class ListNode {
        int val;
        ListNode next;
        ListNode(int v) { val = v; }
    }

    public static void main(String[] args) {
        ListNode head = null;
        // 头插法：依次插入 3 → 2 → 1，最终 1→2→3
        head = insertHead(head, 3);
        head = insertHead(head, 2);
        head = insertHead(head, 1);
        // 遍历链表
        ListNode cur = head;
        while (cur != null) {
            System.out.print(cur.val + " ");
            cur = cur.next;
        }
    }

    static ListNode insertHead(ListNode head, int val) {
        ListNode node = new ListNode(val);
        node.next = head;
        return node;
    }
}`,
      },
      {
        name: '双向链表',
        desc: 'Doubly Linked List — 双向指针',
        code: `public class DoublyList {
    static class ListNode {
        int val;
        ListNode next;
        ListNode prev;
        ListNode(int v) { val = v; }
    }

    public static void main(String[] args) {
        ListNode head = null;
        // 头插法构建 1↔2↔3
        head = insertHead(head, 3);
        head = insertHead(head, 2);
        head = insertHead(head, 1);
        // 正向遍历
        ListNode cur = head;
        while (cur != null) {
            System.out.print(cur.val + " ");
            cur = cur.next;
        }
    }

    static ListNode insertHead(ListNode head, int val) {
        ListNode node = new ListNode(val);
        node.next = head;
        if (head != null) head.prev = node; // 维护前驱指针
        return node;
    }
}`,
      },
      {
        name: '环形链表检测',
        desc: 'Linked List Cycle — 快慢指针 O(n)',
        code: `public class HasCycle {
    static class ListNode {
        int val;
        ListNode next;
        ListNode(int v) { val = v; }
    }

    public static void main(String[] args) {
        // 构建带环链表 3→2→0→-4→2
        ListNode head = new ListNode(3);
        head.next = new ListNode(2);
        head.next.next = new ListNode(0);
        head.next.next.next = new ListNode(-4);
        head.next.next.next.next = head.next; // 成环
        // 快慢指针：快指针每次2步，慢指针每次1步
        ListNode slow = head, fast = head;
        boolean hasCycle = false;
        while (fast != null && fast.next != null) {
            slow = slow.next;
            fast = fast.next.next;
            if (slow == fast) {
                hasCycle = true;
                break;
            }
        }
        System.out.println("has cycle: " + hasCycle);
    }
}`,
      },
      {
        name: '环形链表 II（找环入口）',
        desc: 'Linked List Cycle II — 快慢指针 O(n)',
        code: `public class DetectCycle {
    static class ListNode {
        int val;
        ListNode next;
        ListNode(int v) { val = v; }
    }

    public static void main(String[] args) {
        // 构建带环链表 3→2→0→-4→2
        ListNode head = new ListNode(3);
        head.next = new ListNode(2);
        head.next.next = new ListNode(0);
        head.next.next.next = new ListNode(-4);
        head.next.next.next.next = head.next; // 成环，入口为 2
        // 快慢指针找相遇点
        ListNode slow = head, fast = head;
        while (fast != null && fast.next != null) {
            slow = slow.next;
            fast = fast.next.next;
            if (slow == fast) break;
        }
        if (fast == null || fast.next == null) {
            System.out.println("no cycle");
            return;
        }
        // 一指针回到头，另一指针从相遇点同步前进，再次相遇即入口
        ListNode p = head;
        while (p != slow) {
            p = p.next;
            slow = slow.next;
        }
        System.out.println("cycle entry: " + p.val);
    }
}`,
      },
      {
        name: '链表相交',
        desc: 'Intersection — 双指针 O(n+m)',
        code: `public class Intersection {
    static class ListNode {
        int val;
        ListNode next;
        ListNode(int v) { val = v; }
    }

    public static void main(String[] args) {
        // 公共尾部：8 → 4 → 5
        ListNode c1 = new ListNode(8);
        c1.next = new ListNode(4);
        c1.next.next = new ListNode(5);
        // 链表A：4 → 1 → 8 → 4 → 5
        ListNode headA = new ListNode(4);
        headA.next = new ListNode(1);
        headA.next.next = c1;
        // 链表B：5 → 6 → 1 → 8 → 4 → 5
        ListNode headB = new ListNode(5);
        headB.next = new ListNode(6);
        headB.next.next = new ListNode(1);
        headB.next.next.next = c1;
        // 双指针：走完自己后从另一条链头继续，相遇点即交点
        ListNode pA = headA, pB = headB;
        while (pA != pB) {
            pA = (pA == null) ? headB : pA.next;
            pB = (pB == null) ? headA : pB.next;
        }
        System.out.println("intersection: " + (pA == null ? "none" : pA.val));
    }
}`,
      },
      {
        name: '约瑟夫问题',
        desc: 'Josephus — 递推 O(n)',
        code: `public class Josephus {
    public static void main(String[] args) {
        int n = 10; // 总人数
        int m = 3;  // 报到 m 出圈
        // 递推：f(1)=0，f(n)=(f(n-1)+m)%n（0 下标）
        int survivor = 0;
        for (int i = 2; i <= n; i++) {
            survivor = (survivor + m) % i;
        }
        // 转回 1 下标
        System.out.println("survivor: " + (survivor + 1));
    }
}`,
      },
    ],
  },

  // ==================== 7. 单调栈 ====================
  {
    label: '单调栈',
    items: [
      {
        name: '每日温度',
        desc: 'Daily Temperatures — 单调递减栈 O(n)',
        code: `public class DailyTemp {
    public static void main(String[] args) {
        int[] temps = {73, 74, 75, 71, 69, 72, 76, 73};
        int n = temps.length;
        int[] ans = new int[n];
        java.util.Stack<Integer> stack = new java.util.Stack<>();
        // 单调递减栈：栈存索引，遇到更高温度则出栈
        for (int i = 0; i < n; i++) {
            while (!stack.isEmpty() && temps[i] > temps[stack.peek()]) {
                int prev = stack.pop();
                ans[prev] = i - prev;
            }
            stack.push(i);
        }
    }
}`,
      },
      {
        name: '柱状图最大矩形',
        desc: 'Largest Rectangle — 单调递增栈 O(n)',
        code: `public class LargestRectangle {
    public static void main(String[] args) {
        int[] heights = {2, 1, 5, 6, 2, 3};
        int n = heights.length;
        int maxArea = 0;
        java.util.Stack<Integer> stack = new java.util.Stack<>();
        // 单调递增栈：遇到更矮的柱子则计算面积
        for (int i = 0; i <= n; i++) {
            int h = (i == n) ? 0 : heights[i];
            while (!stack.isEmpty() && h < heights[stack.peek()]) {
                int height = heights[stack.pop()];
                int width = stack.isEmpty() ? i : i - stack.peek() - 1;
                maxArea = Math.max(maxArea, height * width);
            }
            stack.push(i);
        }
        System.out.println("max area: " + maxArea);
    }
}`,
      },
    ],
  },

  // ==================== 8. 树（堆） ====================
  {
    label: '树（堆）',
    items: [
      {
        name: '二叉树遍历',
        desc: 'Tree Traversal — 前/中/后序',
        code: `public class TreeTraversal {
    static class TreeNode {
        int val;
        TreeNode left, right;
        TreeNode(int v) { val = v; }
    }

    public static void main(String[] args) {
        // 构建二叉树：1 → left:2, right:3
        TreeNode root = new TreeNode(1);
        root.left = new TreeNode(2);
        root.right = new TreeNode(3);
        root.left.left = new TreeNode(4);
        root.left.right = new TreeNode(5);
        // 前序遍历：根→左→右
        preorder(root);
        System.out.println();
        // 中序遍历：左→根→右
        inorder(root);
        System.out.println();
        // 后序遍历：左→右→根
        postorder(root);
    }

    static void preorder(TreeNode node) {
        if (node == null) return;
        System.out.print(node.val + " ");
        preorder(node.left);
        preorder(node.right);
    }

    static void inorder(TreeNode node) {
        if (node == null) return;
        inorder(node.left);
        System.out.print(node.val + " ");
        inorder(node.right);
    }

    static void postorder(TreeNode node) {
        if (node == null) return;
        postorder(node.left);
        postorder(node.right);
        System.out.print(node.val + " ");
    }
}`,
      },
      {
        name: '层序遍历',
        desc: 'Level Order — BFS O(n)',
        code: `public class LevelOrder {
    static class TreeNode {
        int val;
        TreeNode left, right;
        TreeNode(int v) { val = v; }
    }

    public static void main(String[] args) {
        // 构建二叉树：1 → left:2, right:3
        TreeNode root = new TreeNode(1);
        root.left = new TreeNode(2);
        root.right = new TreeNode(3);
        root.left.left = new TreeNode(4);
        root.left.right = new TreeNode(5);
        // 层序遍历：用队列逐层访问
        java.util.Queue<TreeNode> q = new java.util.LinkedList<>();
        q.add(root);
        while (!q.isEmpty()) {
            TreeNode node = q.poll();
            System.out.print(node.val + " ");
            if (node.left != null) q.add(node.left);
            if (node.right != null) q.add(node.right);
        }
    }
}`,
      },
      {
        name: '最小堆-PriorityQueue',
        desc: 'Min Heap — TopK O(n log k)',
        code: `public class TopK {
    public static void main(String[] args) {
        int[] nums = {3, 1, 4, 1, 5, 9, 2, 6};
        int k = 3;
        // 大顶堆维护最小的 k 个数
        java.util.PriorityQueue<Integer> maxHeap
            = new java.util.PriorityQueue<>((a, b) -> b - a);
        for (int num : nums) {
            maxHeap.add(num);
            if (maxHeap.size() > k) maxHeap.poll();
        }
        // 堆中即为最小的 k 个元素
        System.out.println("top " + k + " smallest: " + maxHeap);
    }
}`,
      },
      {
        name: '优先队列',
        desc: 'Priority Queue — 堆 O(log n)',
        code: `public class PriorityQueueDemo {
    public static void main(String[] args) {
        // 默认小顶堆：最小值优先出队
        java.util.PriorityQueue<Integer> pq = new java.util.PriorityQueue<>();
        pq.offer(5);
        pq.offer(2);
        pq.offer(8);
        pq.offer(1);
        // 每次 poll 出当前最小元素
        while (!pq.isEmpty()) {
            System.out.print(pq.poll() + " "); // 1 2 5 8
        }
    }
}`,
      },
      {
        name: '全排列',
        desc: 'Permutations — 回溯 O(n!)',
        code: `public class Permutations {
    public static void main(String[] args) {
        int[] nums = {1, 2, 3};
        boolean[] used = new boolean[nums.length];
        java.util.List<Integer> path = new java.util.ArrayList<>();
        backtrack(nums, used, path);
    }

    static void backtrack(int[] nums, boolean[] used,
                          java.util.List<Integer> path) {
        // 找到一个排列
        if (path.size() == nums.length) {
            System.out.println(path);
            return;
        }
        for (int i = 0; i < nums.length; i++) {
            if (used[i]) continue;
            // 做选择
            used[i] = true;
            path.add(nums[i]);
            backtrack(nums, used, path);
            // 撤销选择（回溯）
            path.remove(path.size() - 1);
            used[i] = false;
        }
    }
}`,
      }
    ],
  },

  // ==================== 9. 图论算法 ====================
  {
    label: '图论算法',
    items: [
      {
        name: '课程表-拓扑排序',
        desc: 'Course Schedule — BFS 拓扑排序 O(V+E)',
        code: `public class CourseSchedule {
    public static void main(String[] args) {
        int numCourses = 4;
        int[][] prereqs = {{1, 0}, {2, 1}, {3, 2}};
        // 统计每门课的入度
        int[] indegree = new int[numCourses];
        for (int[] p : prereqs) {
            indegree[p[0]]++;
        }
        // 入度为0的课入队
        java.util.Queue<Integer> q = new java.util.LinkedList<>();
        for (int i = 0; i < numCourses; i++) {
            if (indegree[i] == 0) q.add(i);
        }
        // BFS：依次修完可达课程
        int finished = 0;
        while (!q.isEmpty()) {
            int course = q.poll();
            finished++;
            for (int[] p : prereqs) {
                if (p[1] == course) {
                    indegree[p[0]]--;
                    if (indegree[p[0]] == 0) q.add(p[0]);
                }
            }
        }
        System.out.println("can finish: " + (finished == numCourses));
    }
}`,
      },
      {
        name: 'Dijkstra最短路径',
        desc: 'Dijkstra — 优先队列 O((V+E)logV)',
        code: `public class Dijkstra {
    public static void main(String[] args) {
        int n = 5; // 节点数
        int[][] edges = {
            {0, 1, 4}, {0, 2, 1}, {1, 3, 1},
            {2, 1, 2}, {2, 3, 5}, {3, 4, 3}
        };
        int start = 0;
        // 邻接矩阵
        int[][] g = new int[n][n];
        for (int[] e : edges) g[e[0]][e[1]] = e[2];
        // dist 数组初始化为无穷大
        int[] dist = new int[n];
        boolean[] visited = new boolean[n];
        for (int i = 0; i < n; i++) dist[i] = Integer.MAX_VALUE;
        dist[start] = 0;
        // 贪心选择最近未访问节点
        for (int i = 0; i < n; i++) {
            int u = -1;
            for (int j = 0; j < n; j++) {
                if (!visited[j] && (u == -1 || dist[j] < dist[u])) u = j;
            }
            if (u == -1) break;
            visited[u] = true;
            // 松弛操作
            for (int v = 0; v < n; v++) {
                if (g[u][v] > 0 && dist[u] + g[u][v] < dist[v]) {
                    dist[v] = dist[u] + g[u][v];
                }
            }
        }
        System.out.println("dist[4] = " + dist[4]);
    }
}`,
      },
      {
        name: 'Floyd最短路径',
        desc: 'Floyd-Warshall — 全源最短路 O(V³)',
        code: `public class Floyd {
    public static void main(String[] args) {
        int n = 4; // 节点数 0..3
        int INF = Integer.MAX_VALUE / 2;
        int[][] dist = {
            {0, 3, INF, 7},
            {8, 0, 2, INF},
            {5, INF, 0, 1},
            {2, INF, INF, 0}
        };
        // 三重循环：用每个中间点 k 松弛 i->j
        for (int k = 0; k < n; k++) {
            for (int i = 0; i < n; i++) {
                for (int j = 0; j < n; j++) {
                    if (dist[i][k] + dist[k][j] < dist[i][j]) {
                        dist[i][j] = dist[i][k] + dist[k][j];
                    }
                }
            }
        }
        System.out.println("dist[1][3] = " + dist[1][3]);
    }
}`,
      },
      {
        name: '网络流',
        desc: 'Max Flow — Edmonds-Karp O(VE²)',
        code: `public class MaxFlow {
    public static void main(String[] args) {
        int n = 6; // 节点数 0..5
        int[][] capacity = new int[n][n];
        // 有向边：capacity[from][to] = 容量
        capacity[0][1] = 16; capacity[0][2] = 13;
        capacity[1][2] = 10; capacity[1][3] = 12;
        capacity[2][1] = 4;  capacity[2][4] = 14;
        capacity[3][2] = 9;  capacity[3][5] = 20;
        capacity[4][3] = 7;  capacity[4][5] = 4;
        int source = 0, sink = 5;
        System.out.println("max flow: " + edmondsKarp(capacity, source, sink, n));
    }

    // Edmonds-Karp：BFS 找增广路径 + 更新残量网络
    static int edmondsKarp(int[][] cap, int s, int t, int n) {
        int[][] flow = new int[n][n];
        int maxFlow = 0;
        while (true) {
            int[] parent = new int[n];
            java.util.Arrays.fill(parent, -1);
            parent[s] = s;
            java.util.Queue<Integer> q = new java.util.LinkedList<>();
            q.add(s);
            while (!q.isEmpty() && parent[t] == -1) {
                int u = q.poll();
                for (int v = 0; v < n; v++) {
                    if (parent[v] == -1 && cap[u][v] - flow[u][v] > 0) {
                        parent[v] = u;
                        q.add(v);
                    }
                }
            }
            if (parent[t] == -1) break; // 无增广路径，结束
            int push = Integer.MAX_VALUE; // 瓶颈容量
            for (int v = t; v != s; v = parent[v]) {
                push = Math.min(push, cap[parent[v]][v] - flow[parent[v]][v]);
            }
            for (int v = t; v != s; v = parent[v]) {
                flow[parent[v]][v] += push;
                flow[v][parent[v]] -= push;
            }
            maxFlow += push;
        }
        return maxFlow;
    }
}`,
      },
      {
        name: '有向图',
        desc: 'Directed Graph — DFS O(V+E)',
        code: `public class DirectedGraph {
    public static void main(String[] args) {
        int n = 6; // 节点数 0..5
        java.util.List<java.util.List<Integer>> adj = new java.util.ArrayList<>();
        for (int i = 0; i < n; i++) adj.add(new java.util.ArrayList<>());
        // 有向边：adj[from].add(to)
        adj.get(0).add(1); adj.get(0).add(2);
        adj.get(1).add(3);
        adj.get(2).add(3); adj.get(2).add(4);
        adj.get(3).add(5);
        adj.get(4).add(5);
        // DFS 深度优先遍历
        boolean[] visited = new boolean[n];
        dfs(adj, 0, visited);
    }

    static void dfs(java.util.List<java.util.List<Integer>> adj, int u, boolean[] visited) {
        visited[u] = true;
        System.out.print(u + " ");
        for (int v : adj.get(u)) {
            if (!visited[v]) dfs(adj, v, visited);
        }
    }
}`,
      },
      {
        name: '无向图',
        desc: 'Undirected Graph — BFS O(V+E)',
        code: `public class UndirectedGraph {
    public static void main(String[] args) {
        int n = 6; // 节点数 0..5
        java.util.List<java.util.List<Integer>> adj = new java.util.ArrayList<>();
        for (int i = 0; i < n; i++) adj.add(new java.util.ArrayList<>());
        // 无向边：双向添加
        addEdge(adj, 0, 1); addEdge(adj, 0, 2);
        addEdge(adj, 1, 3); addEdge(adj, 2, 3);
        addEdge(adj, 3, 4); addEdge(adj, 4, 5);
        // BFS 广度优先遍历
        boolean[] visited = new boolean[n];
        java.util.Queue<Integer> q = new java.util.LinkedList<>();
        q.add(0);
        visited[0] = true;
        while (!q.isEmpty()) {
            int u = q.poll();
            System.out.print(u + " ");
            for (int v : adj.get(u)) {
                if (!visited[v]) {
                    visited[v] = true;
                    q.add(v);
                }
            }
        }
    }

    static void addEdge(java.util.List<java.util.List<Integer>> adj, int u, int v) {
        adj.get(u).add(v);
        adj.get(v).add(u);
    }
}`,
      },
    ],
  },

  // ==================== 10. 网格图 ====================
  {
    label: '网格图',
    items: [
      {
        name: '岛屿数量',
        desc: 'Number of Islands — DFS O(mn)',
        code: `public class NumIslands {
    public static void main(String[] args) {
        char[][] grid = {
            {'1','1','0','0','0'},
            {'1','1','0','0','0'},
            {'0','0','1','0','0'},
            {'0','0','0','1','1'}
        };
        int count = 0;
        for (int i = 0; i < grid.length; i++) {
            for (int j = 0; j < grid[0].length; j++) {
                if (grid[i][j] == '1') {
                    count++;
                    dfs(grid, i, j); // 淹没该岛屿
                }
            }
        }
        System.out.println("islands: " + count);
    }

    static void dfs(char[][] g, int r, int c) {
        if (r < 0 || r >= g.length || c < 0 || c >= g[0].length) return;
        if (g[r][c] != '1') return;
        g[r][c] = '0'; // 标记已访问
        dfs(g, r + 1, c);
        dfs(g, r - 1, c);
        dfs(g, r, c + 1);
        dfs(g, r, c - 1);
    }
}`,
      },
      {
        name: '网格最短路径',
        desc: 'Shortest Path in Grid — BFS O(mn)',
        code: `public class GridBFS {
    public static void main(String[] args) {
        int[][] grid = {
            {0, 0, 0},
            {0, 1, 0},
            {0, 0, 0}
        };
        int m = grid.length, n = grid[0].length;
        java.util.Queue<int[]> q = new java.util.LinkedList<>();
        q.add(new int[]{0, 0}); // 起点
        grid[0][0] = 1;         // 标记已访问和距离
        int[][] dirs = {{1,0},{-1,0},{0,1},{0,-1}};

        while (!q.isEmpty()) {
            int[] cur = q.poll();
            int r = cur[0], c = cur[1];
            if (r == m - 1 && c == n - 1) {
                System.out.println("distance: " + (grid[r][c] - 1));
                return;
            }
            for (int[] d : dirs) {
                int nr = r + d[0], nc = c + d[1];
                if (nr >= 0 && nr < m && nc >= 0 && nc < n && grid[nr][nc] == 0) {
                    grid[nr][nc] = grid[r][c] + 1;
                    q.add(new int[]{nr, nc});
                }
            }
        }
    }
}`,
      },
    ],
  },

  // ==================== 11. 动态规划 ====================
  {
    label: '动态规划',
    items: [
      {
        name: '爬楼梯',
        desc: 'Climbing Stairs — DP O(n)',
        code: `public class ClimbStairs {
    public static void main(String[] args) {
        int n = 10;
        int a = 1, b = 1; // a=dp[0], b=dp[1]
        // dp[i] = dp[i-1] + dp[i-2]
        for (int i = 2; i <= n; i++) {
            int c = a + b;
            a = b;
            b = c;
        }
        System.out.println("ways: " + b);
    }
}`,
      },
      {
        name: '最大子数组和',
        desc: 'Kadane — O(n)',
        code: `public class MaxSubarray {
    public static void main(String[] args) {
        int[] nums = {-2, 1, -3, 4, -1, 2, 1, -5, 4};
        int maxSum = nums[0];
        int curSum = nums[0];
        for (int i = 1; i < nums.length; i++) {
            // 决策：接上 or 重开
            curSum = Math.max(nums[i], curSum + nums[i]);
            maxSum = Math.max(maxSum, curSum);
        }
        System.out.println("max sum: " + maxSum);
    }
}`,
      },
      {
        name: '背包问题',
        desc: '0/1 Knapsack — DP O(nW)',
        code: `public class Knapsack {
    public static void main(String[] args) {
        int[] w = {2, 3, 4, 5};  // 重量
        int[] v = {3, 4, 5, 6};  // 价值
        int W = 8;
        int n = w.length;
        // dp[j]：容量 j 时的最大价值
        int[] dp = new int[W + 1];
        for (int i = 0; i < n; i++) {
            // 倒序遍历，保证每件物品只用一次
            for (int j = W; j >= w[i]; j--) {
                dp[j] = Math.max(dp[j], dp[j - w[i]] + v[i]);
            }
        }
        System.out.println("max value: " + dp[W]);
    }
}`,
      },
      {
        name: '打家劫舍',
        desc: 'House Robber — DP O(n)',
        code: `public class HouseRobber {
    public static void main(String[] args) {
        int[] nums = {2, 7, 9, 3, 1};
        if (nums.length == 0) return;
        int prev2 = 0;          // dp[i-2]
        int prev1 = nums[0];    // dp[i-1]
        // dp[i] = max(dp[i-1], dp[i-2] + nums[i])
        for (int i = 1; i < nums.length; i++) {
            int cur = Math.max(prev1, prev2 + nums[i]);
            prev2 = prev1;
            prev1 = cur;
        }
        System.out.println("max: " + prev1);
    }
}`,
      },
      {
        name: '最长递增子序列',
        desc: 'Longest Increasing Subsequence — DP O(n²)',
        code: `public class LIS {
    public static void main(String[] args) {
        int[] nums = {10, 9, 2, 5, 3, 7, 101, 18};
        int n = nums.length;
        // dp[i]：以 nums[i] 结尾的 LIS 长度
        int[] dp = new int[n];
        int maxLen = 0;
        for (int i = 0; i < n; i++) {
            dp[i] = 1;
            for (int j = 0; j < i; j++) {
                if (nums[j] < nums[i]) {
                    dp[i] = Math.max(dp[i], dp[j] + 1);
                }
            }
            maxLen = Math.max(maxLen, dp[i]);
        }
        System.out.println("LIS length: " + maxLen);
    }
}`,
      },
      {
        name: '编辑距离',
        desc: 'Edit Distance — DP O(mn)',
        code: `public class EditDistance {
    public static void main(String[] args) {
        String w1 = "horse";
        String w2 = "ros";
        int m = w1.length(), n = w2.length();
        int[][] dp = new int[m + 1][n + 1];
        // 初始化空串情况
        for (int i = 0; i <= m; i++) dp[i][0] = i;
        for (int j = 0; j <= n; j++) dp[0][j] = j;
        // dp[i][j] = w1[0..i) 转 w2[0..j) 的最少操作数
        for (int i = 1; i <= m; i++) {
            for (int j = 1; j <= n; j++) {
                if (w1.charAt(i - 1) == w2.charAt(j - 1)) {
                    dp[i][j] = dp[i - 1][j - 1];
                } else {
                    dp[i][j] = Math.min(dp[i - 1][j],
                        Math.min(dp[i][j - 1], dp[i - 1][j - 1])) + 1;
                }
            }
        }
        System.out.println("edit distance: " + dp[m][n]);
    }
}`,
      },
    ],
  },

  // ==================== 12. 贪心与思维 ====================
  {
    label: '贪心与思维',
    items: [
      {
        name: '跳跃游戏',
        desc: 'Jump Game — 贪心 O(n)',
        code: `public class JumpGame {
    public static void main(String[] args) {
        int[] nums = {2, 3, 1, 1, 4};
        int farthest = 0; // 当前能到达的最远位置
        for (int i = 0; i < nums.length; i++) {
            if (i > farthest) break; // 不可达
            farthest = Math.max(farthest, i + nums[i]);
        }
        System.out.println("can reach: " + (farthest >= nums.length - 1));
    }
}`,
      },
      {
        name: '分发饼干',
        desc: 'Assign Cookies — 贪心 O(n log n)',
        code: `public class FindContent {
    public static void main(String[] args) {
        int[] appetite = {1, 2, 3};  // 孩子胃口
        int[] cookies = {1, 1};      // 饼干尺寸
        java.util.Arrays.sort(appetite);
        java.util.Arrays.sort(cookies);
        int child = 0, cookie = 0;
        // 用最小的饼干满足胃口最小的孩子
        while (child < appetite.length && cookie < cookies.length) {
            if (cookies[cookie] >= appetite[child]) {
                child++;
            }
            cookie++;
        }
        System.out.println("satisfied: " + child);
    }
}`,
      },
      {
        name: '无重叠区间',
        desc: 'Non-overlapping Intervals — 贪心 O(n log n)',
        code: `public class EraseOverlap {
    public static void main(String[] args) {
        int[][] intervals = {{1,2},{2,3},{3,4},{1,3}};
        // 按结束时间排序
        java.util.Arrays.sort(intervals, (a, b) -> a[1] - b[1]);
        int count = 1;          // 保留的区间数
        int end = intervals[0][1];
        for (int i = 1; i < intervals.length; i++) {
            if (intervals[i][0] >= end) {
                count++;
                end = intervals[i][1];
            }
        }
        System.out.println("to remove: " + (intervals.length - count));
    }
}`,
      },
    ],
  },

  // ==================== 13. 位运算 ====================
  {
    label: '位运算',
    items: [
      {
        name: '只出现一次的数字',
        desc: 'Single Number — 异或 XOR O(n)',
        code: `public class SingleNumber {
    public static void main(String[] args) {
        int[] nums = {4, 1, 2, 1, 2};
        int result = 0;
        // a ^ a = 0, a ^ 0 = a
        for (int num : nums) {
            result ^= num;
        }
        System.out.println("single: " + result);
    }
}`,
      },
      {
        name: '位1的个数',
        desc: 'Number of 1 Bits — O(k)',
        code: `public class HammingWeight {
    public static void main(String[] args) {
        int n = 11; // 二进制 1011
        int count = 0;
        // n & (n-1) 消除最低位的 1
        while (n != 0) {
            n = n & (n - 1);
            count++;
        }
        System.out.println("1 bits: " + count);
    }
}`,
      },
      {
        name: '2的幂',
        desc: 'Power of Two — 位运算 O(1)',
        code: `public class PowerOfTwo {
    public static void main(String[] args) {
        int n = 16;
        // 2的幂的二进制只有1个1：10000 & 01111 = 0
        boolean isPower = (n > 0) && ((n & (n - 1)) == 0);
        System.out.println(n + " is power of 2: " + isPower);
    }
}`,
      },
    ],
  },
]
</script>

<style scoped>
.classic-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.classic-toggle-all {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 0;
  border: 1px solid var(--line-strong, var(--border));
  background: transparent;
  color: var(--text-muted);
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  cursor: pointer;
  clip-path: polygon(6px 0, 100% 0, 100% calc(100% - 6px), calc(100% - 6px) 100%, 0 100%, 0 6px);
  transition: all 0.3s cubic-bezier(.22,.9,.27,1);
  align-self: flex-end;
}
.classic-toggle-all:hover {
  color: var(--accent);
  border-color: var(--accent);
  background: var(--accent-bg);
}
.classic-toggle-all.active {
  color: var(--accent);
  border-color: var(--accent);
  background: var(--accent-bg);
}
.classic-toggle-chevron {
  transition: transform 0.35s cubic-bezier(.22,.9,.27,1);
  flex-shrink: 0;
}
.classic-toggle-all.active .classic-toggle-chevron {
  transform: rotate(180deg);
}
.classic-toggle-label {
  white-space: nowrap;
}

/* Smooth collapse: CSS grid trick */
.classic-list-wrap {
  display: grid;
  grid-template-rows: 1fr;
  transition: grid-template-rows 0.35s cubic-bezier(.22,.9,.27,1);
}
.classic-list-wrap.collapsed {
  grid-template-rows: 0fr;
}
.classic-list-inner {
  overflow: hidden;
}

.classic-group {
  border: 1px solid var(--border);
  border-radius: 0;
  overflow: hidden;
}

.classic-group-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  cursor: pointer;
  user-select: none;
  transition: background 0.15s;
}
.classic-group-header:hover {
  background: var(--code-bg);
}

.classic-dot {
  width: 7px; height: 7px;
  border-radius: 0;
  clip-path: polygon(0 0, 100% 0, 100% 70%, 70% 100%, 0 100%);
  background: var(--primary);
  opacity: 0.8;
  flex-shrink: 0;
}

.classic-group-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-h);
}

.classic-chevron {
  color: var(--text-muted);
  transition: transform 0.25s ease;
  flex-shrink: 0;
}
.classic-chevron.rotated {
  transform: rotate(90deg);
}

.classic-list {
  display: flex;
  flex-direction: column;
  gap: 1px;
  border-top: 1px solid var(--border);
  padding: 4px;
}

.classic-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 7px 8px;
  border-radius: 0;
  border: none;
  background: none;
  cursor: pointer;
  transition: background 0.15s;
  text-align: left;
  width: 100%;
}
.classic-item:hover {
  background: var(--accent-bg);
}

.classic-item-name {
  font-size: 12px;
  font-weight: 500;
  color: var(--text);
}
.classic-item-desc {
  font-size: 10px;
  color: var(--text-muted);
  font-family: var(--mono);
}

@media (prefers-reduced-motion: reduce) {
  .classic-toggle-chevron { transition: none; }
  .classic-toggle-all { transition: none; }
  .classic-list-wrap { transition: none; }
  .classic-chevron { transition: none; }
}
</style>
