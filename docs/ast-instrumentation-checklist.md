# AST 插桩验收清单

> 验证环境：`http://localhost:5173` | 后端 `localhost:8080`
> 自动化：脚本调 API 判 `success` + `steps` 非空
> 手动：浏览器逐步播放，验证行高亮 + 变量卡片

---

## H 组：正常算法（冒烟）

### H1. 冒泡排序
```java
public class UserCode {
    public static void main(String[] args) {
        int[] arr = {5, 3, 8};
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
}
```
**预期**: success, steps 非空。**手动**: 逐步播放变量卡片正常变化。

### H2. 斐波那契（递归含 return）
```java
public class UserCode {
    public static void main(String[] args) {
        int n = 10;
        int result = fib(n);
    }
    public static int fib(int n) {
        if (n <= 1) return n;
        return fib(n - 1) + fib(n - 2);
    }
}
```
**预期**: success, steps 非空，不会报"无法访问的语句"。**手动**: return 行正常高亮。

### H3. 简单赋值
```java
public class UserCode {
    public static void main(String[] args) {
        int a = 1;
        int b = 2;
        int c = a + b;
    }
}
```
**预期**: success, 3 步以上。

---

## I 组：控制流

### I1. if/else
```java
public class UserCode {
    public static void main(String[] args) {
        int x = 5;
        if (x > 3) {
            x = 10;
        } else {
            x = 0;
        }
    }
}
```
**预期**: success。**手动**: if 条件行高亮。

### I2. for 循环（块体）
```java
public class UserCode {
    public static void main(String[] args) {
        int s = 0;
        for (int i = 0; i < 5; i++) {
            s = s + i;
        }
    }
}
```
**预期**: success。**手动**: 循环体内变量更新可见。

### I3. for 循环（无括号单语句）
```java
public class UserCode {
    public static void main(String[] args) {
        int s = 0;
        for (int i = 0; i < 5; i++)
            s = s + i;
    }
}
```
**预期**: success。**手动**: 单语句循环体仍能显示变量变化（I-1 修复）。

### I4. while 循环
```java
public class UserCode {
    public static void main(String[] args) {
        int i = 0;
        while (i < 3) {
            i++;
        }
    }
}
```
**预期**: success。**手动**: i++ 行高亮（I-3 修复）。

### I5. do-while 循环
```java
public class UserCode {
    public static void main(String[] args) {
        int i = 0;
        do {
            i++;
        } while (i < 3);
    }
}
```
**预期**: success。

### I6. foreach 循环
```java
import java.util.List;
public class UserCode {
    public static void main(String[] args) {
        int sum = 0;
        for (int x : List.of(1, 2, 3)) {
            sum = sum + x;
        }
    }
}
```
**预期**: success。

### I7. 嵌套循环（有括号）
```java
public class UserCode {
    public static void main(String[] args) {
        int s = 0;
        for (int i = 0; i < 3; i++) {
            for (int j = 0; j < 3; j++) {
                s = s + 1;
            }
        }
    }
}
```
**预期**: success。**手动**: 内层 j 的值正确变化。

### I8. 嵌套非块体循环
```java
public class UserCode {
    public static void main(String[] args) {
        int s = 0;
        for (int i = 0; i < 3; i++)
            for (int j = 0; j < 3; j++)
                s = s + 1;
    }
}
```
**预期**: success。**手动**: 内层循环有变量记录（I-1 修复）。

---

## J 组：return 语句

### J1. 中间 return（短路）
```java
public class UserCode {
    public static void main(String[] args) {
        int x = check(3);
    }
    public static int check(int n) {
        if (n > 0) return 1;
        return 0;
    }
}
```
**预期**: success，无"无法访问的语句"。

### J2. 末尾 return
```java
public class UserCode {
    public static void main(String[] args) {
        int x = foo();
    }
    public static int foo() {
        int a = 1;
        return a;
    }
}
```
**预期**: success。

### J3. 多 return（斐波那契变体）
```java
public class UserCode {
    public static void main(String[] args) {
        int x = fib(5);
    }
    public static int fib(int n) {
        if (n == 0) return 0;
        if (n == 1) return 1;
        return fib(n - 1) + fib(n - 2);
    }
}
```
**预期**: success。

---

## K 组：自增自减（I-3 修复）

### K1. i++ (后置++)
```java
public class UserCode {
    public static void main(String[] args) {
        int i = 0;
        i++;
    }
}
```
**预期**: success。**手动**: i++ 行高亮，变量从 0 → 1 可见。

### K2. i-- (后置--)
```java
public class UserCode {
    public static void main(String[] args) {
        int i = 5;
        i--;
    }
}
```
**预期**: success。**手动**: i-- 行高亮，变量从 5 → 4 可见。

### K3. ++i (前置++)
```java
public class UserCode {
    public static void main(String[] args) {
        int i = 0;
        ++i;
    }
}
```
**预期**: success。

### K4. --i (前置--)
```java
public class UserCode {
    public static void main(String[] args) {
        int i = 5;
        --i;
    }
}
```
**预期**: success。

### K5. 循环内的 ++
```java
public class UserCode {
    public static void main(String[] args) {
        int c = 0;
        for (int i = 0; i < 5; i++) {
            c++;
        }
    }
}
```
**预期**: success。**手动**: c++ 行每次迭代都会高亮。

---

## L 组：多变量（I-2 修复）

### L1. 12+ 变量声明后赋值
```java
public class UserCode {
    public static void main(String[] args) {
        int v0 = 0, v1 = 1, v2 = 2, v3 = 3, v4 = 4;
        int v5 = 5, v6 = 6, v7 = 7, v8 = 8, v9 = 9;
        int v10 = 10, v11 = 11;
        v0 = v0 + v11;
    }
}
```
**预期**: success，不会因 Map.of() 10 对上限而编译失败。

---

## M 组：边界

### M1. 空方法体
```java
public class UserCode {
    public static void main(String[] args) {
    }
}
```
**预期**: success, steps 空或近空。

### M2. 多行变量声明（全部初始化）
```java
public class UserCode {
    public static void main(String[] args) {
        int x = 0;
        int y = 1;
    }
}
```
**预期**: success, steps ≥ 2。

---

## 测试方式对照

| 验证项 | 自动化（脚本） | 手动（浏览器） |
|--------|:---:|:---:|
| success / error | ✅ | ✅ |
| steps 数量 > 0 | ✅ | — |
| 特定行高亮 | — | ✅ |
| 变量卡片值变化 | — | ✅ |
| 逐步播放流畅 | — | ✅ |
| ++/-- 行有 step | ✅ | ✅ |
| 12+ 变量不崩溃 | ✅ | — |

> **手动必测**（脚本无法覆盖）：H1 逐步播放、I1 if 高亮、I3 无括号体、I4 i++ 高亮、I8 嵌套无括号、K1-K5 自增行高亮、L1 多变量卡片
