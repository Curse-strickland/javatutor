# 安全沙箱验收清单

> 验证环境：浏览器打开 `http://localhost:5173`，在编辑器中写入代码，点运行，观察底部提示。
> 后端需已启动（端口 8080）。

---

## A 组：正常算法必须通过（冒烟测试）

### A1. 冒泡排序

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

**预期**：正常运行，右边显示变量卡片，底部无红色报错。

### A2. 斐波那契递归

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

**预期**：正常运行。

### A3. 白名单内 import（ArrayList + HashMap）

```java
import java.util.ArrayList;
import java.util.HashMap;

public class UserCode {
    public static void main(String[] args) {
        ArrayList<Integer> list = new ArrayList<>();
        list.add(1);
        list.add(2);
        HashMap<String, Integer> map = new HashMap<>();
        map.put("a", 1);
    }
}
```

**预期**：正常运行。

---

## B 组：AST 层 — import 白名单

### B1. 导入禁止包 java.io.File

```java
import java.io.File;

public class UserCode {
    public static void main(String[] args) {
        int x = 1;
    }
}
```

**预期**：报错 — `不允许导入: java.io.File`

### B2. 导入禁止包 java.net.Socket

```java
import java.net.Socket;

public class UserCode {
    public static void main(String[] args) {}
}
```

**预期**：报错 — `不允许导入: java.net.Socket`

### B3. 导入禁止包 java.lang.reflect.Method

```java
import java.lang.reflect.Method;

public class UserCode {
    public static void main(String[] args) {}
}
```

**预期**：报错 — `不允许导入: java.lang.reflect.Method`

### B4. import 位置错误（写在文件末尾）

打开默认冒泡排序代码，在最后一个 `}` 之后加一行：

```java
import java.util.ArrayList;
```

**预期**：报错 — `import 必须写在文件顶部（类声明之前），请移到文件开头`

### B5. import 写在类体内

在 `main` 方法内部加一行 `import java.util.ArrayList;`。

**预期**：报错 — `import 必须写在文件顶部（类声明之前），请移到文件开头`

---

## C 组：AST 层 — 方法调用黑名单

### C1. System.exit(0)

```java
public class UserCode {
    public static void main(String[] args) {
        System.exit(0);
    }
}
```

**预期**：报错 — `不能使用 System.exit() — 该操作会直接终止程序`

### C2. Runtime.getRuntime().exec()

```java
public class UserCode {
    public static void main(String[] args) throws Exception {
        Runtime.getRuntime().exec("calc.exe");
    }
}
```

**预期**：报错 — `不能使用 Runtime.exec() — 不允许执行外部命令`

### C3. Class.forName()

```java
public class UserCode {
    public static void main(String[] args) throws Exception {
        Class.forName("java.lang.String");
    }
}
```

**预期**：报错 — `不能使用 Class.forName() — 不允许动态加载类`

### C4. Method.invoke()

```java
import java.lang.reflect.Method;

public class UserCode {
    public static void main(String[] args) throws Exception {
        Method m = null;
        m.invoke(null);
    }
}
```

**预期**：报错 — 可能先被 import 拦截或被反射拦截，有任一拦截即通过。

### C5. Field.setAccessible()

```java
import java.lang.reflect.Field;

public class UserCode {
    public static void main(String[] args) throws Exception {
        Field f = null;
        f.setAccessible(true);
    }
}
```

**预期**：报错 — import 拦截或反射拦截。

### C6. getDeclaredMethod()

```java
import java.lang.reflect.Method;

public class UserCode {
    public static void main(String[] args) throws Exception {
        String.class.getDeclaredMethod("toString");
    }
}
```

**预期**：报错 — import 拦截或反射拦截。

### C7. newInstance()

```java
public class UserCode {
    public static void main(String[] args) throws Exception {
        String.class.newInstance();
    }
}
```

**预期**：报错 — `不能使用反射: newInstance() — 反射操作不允许执行`

---

## D 组：AST 层 — 类型实例化黑名单

以下全部用全限定名（绕过 import 白名单），测试类型黑名单是否生效。

### D1. FileWriter

```java
public class UserCode {
    public static void main(String[] args) {
        new java.io.FileWriter("a.txt");
    }
}
```

**预期**：报错 — `不能使用 FileWriter — 该类型不允许在沙箱中创建`

### D2. FileInputStream

```java
public class UserCode {
    public static void main(String[] args) {
        new java.io.FileInputStream("a.txt");
    }
}
```

**预期**：报错 — `不能使用 FileInputStream`

### D3. FileOutputStream

```java
public class UserCode {
    public static void main(String[] args) {
        new java.io.FileOutputStream("a.txt");
    }
}
```

**预期**：报错 — `不能使用 FileOutputStream`

### D4. FileReader

```java
public class UserCode {
    public static void main(String[] args) {
        new java.io.FileReader("a.txt");
    }
}
```

**预期**：报错 — `不能使用 FileReader`

### D5. RandomAccessFile

```java
public class UserCode {
    public static void main(String[] args) {
        new java.io.RandomAccessFile("a.txt", "r");
    }
}
```

**预期**：报错 — `不能使用 RandomAccessFile`

### D6. Socket

```java
public class UserCode {
    public static void main(String[] args) {
        new java.net.Socket();
    }
}
```

**预期**：报错 — `不能使用 Socket`

### D7. ServerSocket

```java
public class UserCode {
    public static void main(String[] args) {
        new java.net.ServerSocket();
    }
}
```

**预期**：报错 — `不能使用 ServerSocket`

### D8. ProcessBuilder

```java
public class UserCode {
    public static void main(String[] args) {
        new java.lang.ProcessBuilder("cmd");
    }
}
```

**预期**：报错 — `不能使用 ProcessBuilder`

### D9. Thread

```java
public class UserCode {
    public static void main(String[] args) {
        new Thread();
    }
}
```

**预期**：报错 — `不能使用 Thread`

---

## E 组：运行时 SecurityManager 层

### E1. 文件写入（全限定名 + 绕过 AST 类型黑名单）

由于 AST 层已覆盖大多数危险类型，SecurityManager 层在当前代码中较难从浏览器端触发。此项如需验证，需要临时修改 SandboxValidator 代码移除 FileWriter 后重启测试。

**预期**（修改后）：SecurityManager 的 checkWrite 拦截，报错 — `沙箱: 不允许写入文件`

### E2. System.exit(1)（非零状态码）

```java
public class UserCode {
    public static void main(String[] args) {
        System.exit(1);
    }
}
```

**预期**：被 AST 层拦截。若未来 AST 放行，SecurityManager 的 checkExit 会拒绝非零状态码。

---

## F 组：超时保护

### F1. 死循环 5 秒超时

```java
public class UserCode {
    public static void main(String[] args) {
        while (true) {}
    }
}
```

**预期**：约 5 秒后报错 — `运行超时（超过5秒）`

### F2. 正常代码不误杀

```java
public class UserCode {
    public static void main(String[] args) {
        int x = 1;
        x = x + 1;
    }
}
```

**预期**：立即运行结束，正常显示步骤。

---

## G 组：错误提示准确性

### G1. 缺少类声明

```java
public static void main(String[] args) {
    int x = 1;
}
```

**预期**：报错 — `代码格式错误：缺少 public class 声明，请确保代码包含完整的类定义`

### G2. Java 语法错误

```java
public class UserCode {
    public static void main(String[] args) {
        int x = ;
    }
}
```

**预期**：报错 — 包含编译失败的信息（InMemoryCompiler 的报错）。

### G3. 多处违规同时列出

```java
import java.io.File;
import java.net.Socket;

public class UserCode {
    public static void main(String[] args) {
        System.exit(0);
    }
}
```

**预期**：报错列出所有违规项（同时包含 import File、import Socket、System.exit 三条）。

---

## 汇总

| 组 | 用例数 | 覆盖范围 |
|----|--------|----------|
| A 正常算法 | 3 | 冒泡、斐波那契、合法 import |
| B import 白名单 | 5 | 禁止包 3 + 位置错误 2 |
| C 方法调用黑名单 | 7 | exit、exec、forName、invoke、setAccessible、getDeclaredMethod、newInstance |
| D 类型实例化黑名单 | 9 | 5 种文件 I/O + 2 种网络 + ProcessBuilder + Thread |
| E SecurityManager | 2 | 文件写入兜底、exit 非零 |
| F 超时保护 | 2 | 死循环拦截、正常不误杀 |
| G 错误提示 | 3 | 缺类声明、语法错误、多违规 |
| **合计** | **31** | |
