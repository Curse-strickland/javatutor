<template>
  <div class="classic-panel">
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
      <div v-show="!collapsed[group.label]" class="classic-list">
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
</template>

<script setup>
import { reactive } from 'vue'

defineEmits(['loadCode'])

const collapsed = reactive({})

function toggleGroup(label) {
  collapsed[label] = !collapsed[label]
}

const groups = [
  {
    label: '排序算法',
    items: [
      { name: '冒泡排序', desc: 'Bubble Sort — O(n²)', code: `public class BubbleSort {
  public static void main(String[] args) {
    int[] arr = {5, 3, 8, 1, 2};
    int n = arr.length;
    for (int i = 0; i < n - 1; i++) {
      for (int j = 0; j < n - i - 1; j++) {
        if (arr[j] > arr[j + 1]) {
          int temp = arr[j];
          arr[j] = arr[j + 1];
          arr[j + 1] = temp;
        }
      }
    }
  }
}` },
      { name: '选择排序', desc: 'Selection Sort — O(n²)', code: `public class SelectionSort {
  public static void main(String[] args) {
    int[] arr = {9, 6, 1, 4, 7};
    int n = arr.length;
    for (int i = 0; i < n - 1; i++) {
      int minIdx = i;
      for (int j = i + 1; j < n; j++) {
        if (arr[j] < arr[minIdx]) minIdx = j;
      }
      int temp = arr[i];
      arr[i] = arr[minIdx];
      arr[minIdx] = temp;
    }
  }
}` },
      { name: '插入排序', desc: 'Insertion Sort — O(n²)', code: `public class InsertionSort {
  public static void main(String[] args) {
    int[] arr = {7, 2, 5, 1, 8};
    int n = arr.length;
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
}` },
      { name: '快速排序', desc: 'Quick Sort — O(n log n)', code: `public class QuickSort {
  public static void main(String[] args) {
    int[] arr = {8, 3, 5, 1, 9, 2};
    quickSort(arr, 0, arr.length - 1);
  }
  static void quickSort(int[] a, int low, int high) {
    if (low >= high) return;
    int pivot = a[high], i = low - 1;
    for (int j = low; j < high; j++) {
      if (a[j] <= pivot) { i++; int t = a[i]; a[i] = a[j]; a[j] = t; }
    }
    int t = a[i + 1]; a[i + 1] = a[high]; a[high] = t;
    quickSort(a, low, i);
    quickSort(a, i + 2, high);
  }
}` },
    ]
  },
  {
    label: '查找算法',
    items: [
      { name: '二分查找', desc: 'Binary Search — O(log n)', code: `public class BinarySearch {
  public static void main(String[] args) {
    int[] arr = {2, 5, 8, 12, 16, 23, 38, 45};
    int target = 16;
    int left = 0, right = arr.length - 1, result = -1;
    while (left <= right) {
      int mid = left + (right - left) / 2;
      if (arr[mid] == target) { result = mid; break; }
      else if (arr[mid] < target) left = mid + 1;
      else right = mid - 1;
    }
    System.out.println("index: " + result);
  }
}` },
      { name: '线性查找', desc: 'Linear Search — O(n)', code: `public class LinearSearch {
  public static void main(String[] args) {
    int[] arr = {12, 45, 7, 23, 56, 89};
    int target = 23, result = -1;
    for (int i = 0; i < arr.length; i++) {
      if (arr[i] == target) { result = i; break; }
    }
    System.out.println("index: " + result);
  }
}` },
    ]
  },
  {
    label: '递归与数学',
    items: [
      { name: '斐波那契数列', desc: 'Fibonacci — 迭代 O(n)', code: `public class Fibonacci {
  public static void main(String[] args) {
    int n = 10, a = 0, b = 1;
    for (int i = 0; i < n; i++) {
      int next = a + b;
      a = b;
      b = next;
    }
  }
}` },
      { name: '阶乘', desc: 'Factorial — O(n)', code: `public class Factorial {
  public static void main(String[] args) {
    int n = 5, result = 1;
    for (int i = 1; i <= n; i++) result *= i;
    System.out.println("5! = " + result);
  }
}` },
      { name: '最大公约数', desc: 'GCD — 辗转相除法', code: `public class GCD {
  public static void main(String[] args) {
    int a = 48, b = 18;
    while (b != 0) {
      int temp = b;
      b = a % b;
      a = temp;
    }
    System.out.println("GCD = " + a);
  }
}` },
      { name: '判断质数', desc: 'Prime Check — O(√n)', code: `public class PrimeCheck {
  public static void main(String[] args) {
    int n = 97;
    boolean isPrime = n > 1;
    for (int i = 2; i * i <= n; i++) {
      if (n % i == 0) { isPrime = false; break; }
    }
    System.out.println(n + " is prime: " + isPrime);
  }
}` },
    ]
  },
  {
    label: '数据结构',
    items: [
      { name: '链表反转', desc: 'Reverse Linked List — O(n)', code: `public class ReverseList {
  static class ListNode { int val; ListNode next; ListNode(int v) { val = v; } }
  public static void main(String[] args) {
    ListNode head = new ListNode(1);
    head.next = new ListNode(2);
    head.next.next = new ListNode(3);
    ListNode prev = null, curr = head;
    while (curr != null) {
      ListNode next = curr.next;
      curr.next = prev;
      prev = curr;
      curr = next;
    }
    head = prev;
  }
}` },
      { name: '二叉树遍历', desc: 'Tree Traversal', code: `public class TreeTraversal {
  static class TreeNode { int val; TreeNode left, right; TreeNode(int v) { val = v; } }
  public static void main(String[] args) {
    TreeNode root = new TreeNode(1);
    root.left = new TreeNode(2);
    root.right = new TreeNode(3);
    preorder(root);
  }
  static void preorder(TreeNode node) {
    if (node == null) return;
    System.out.print(node.val + " ");
    preorder(node.left);
    preorder(node.right);
  }
}` },
      { name: '栈的应用', desc: 'Stack — 括号匹配', code: `public class BracketMatch {
  public static void main(String[] args) {
    String s = "({[]})";
    java.util.Stack<Character> stack = new java.util.Stack<>();
    for (char c : s.toCharArray()) {
      if (c == '(' || c == '{' || c == '[') stack.push(c);
      else if (!stack.isEmpty() && matches(stack.peek(), c)) stack.pop();
      else { stack.push(c); break; }
    }
    System.out.println("valid: " + stack.isEmpty());
  }
  static boolean matches(char open, char close) {
    return (open == '(' && close == ')') || (open == '{' && close == '}') || (open == '[' && close == ']');
  }
}` },
      { name: '队列应用', desc: 'Queue — 约瑟夫环', code: `public class Josephus {
  public static void main(String[] args) {
    int n = 7, k = 3;
    java.util.Queue<Integer> q = new java.util.LinkedList<>();
    for (int i = 1; i <= n; i++) q.add(i);
    while (q.size() > 1) {
      for (int i = 0; i < k - 1; i++) q.add(q.poll());
      q.poll();
    }
    System.out.println("survivor: " + q.peek());
  }
}` },
    ]
  },
  {
    label: '动态规划',
    items: [
      { name: '爬楼梯', desc: 'Climbing Stairs — DP O(n)', code: `public class ClimbStairs {
  public static void main(String[] args) {
    int n = 10, a = 1, b = 1;
    for (int i = 2; i <= n; i++) {
      int c = a + b;
      a = b;
      b = c;
    }
    System.out.println("ways: " + b);
  }
}` },
      { name: '最大子数组和', desc: 'Kadane — O(n)', code: `public class MaxSubarray {
  public static void main(String[] args) {
    int[] nums = {-2, 1, -3, 4, -1, 2, 1, -5, 4};
    int maxSum = nums[0], curSum = nums[0];
    for (int i = 1; i < nums.length; i++) {
      curSum = Math.max(nums[i], curSum + nums[i]);
      maxSum = Math.max(maxSum, curSum);
    }
    System.out.println("max sum: " + maxSum);
  }
}` },
      { name: '背包问题', desc: '0/1 Knapsack — DP O(nW)', code: `public class Knapsack {
  public static void main(String[] args) {
    int[] w = {2, 3, 4, 5}, v = {3, 4, 5, 6};
    int W = 8, n = w.length;
    int[] dp = new int[W + 1];
    for (int i = 0; i < n; i++)
      for (int j = W; j >= w[i]; j--)
        dp[j] = Math.max(dp[j], dp[j - w[i]] + v[i]);
    System.out.println("max value: " + dp[W]);
  }
}` },
    ]
  },
]
</script>

<style scoped>
.classic-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.classic-group {
  border: 1px solid var(--border);
  border-radius: 10px;
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
  background: rgba(255,255,255,0.03);
}

.classic-dot {
  width: 7px; height: 7px;
  border-radius: 50%;
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
  border-radius: 6px;
  border: none;
  background: none;
  cursor: pointer;
  transition: background 0.15s;
  text-align: left;
  width: 100%;
}
.classic-item:hover {
  background: rgba(255,255,255,0.04);
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
</style>
