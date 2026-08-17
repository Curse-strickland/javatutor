# 控制台输出验收清单

> 验证环境：`http://localhost:5173` | 后端 `localhost:8080`
> 自动化：调 `POST /api/run` 判 `output` 在 steps 中的分布
> 手动：浏览器逐步播放，观察控制台面板行为

---

## O 组：基本输出捕获（自动化）

### O1. 单次 println
```java
public class UserCode {
    public static void main(String[] args) {
        int x = 1;
        System.out.println("hello");
        x = 2;
    }
}
```
**预期**: step 更新后在控制台中看到 `hello`，O1 对应的脚本验证通过。

### O2. 连续 print
```java
public class UserCode {
    public static void main(String[] args) {
        int x = 1;
        System.out.print("a");
        System.out.print("b");
        x = 2;
    }
}
```
**预期**: 控制台显示 `ab`（无换行分隔）。脚本验证通过。

### O3. 循环内打印
```java
public class UserCode {
    public static void main(String[] args) {
        int x = 1;
        for (int i = 1; i <= 3; i++) {
            System.out.println("line " + i);
        }
        x = 2;
    }
}
```
**预期**: 控制台显示 3 行（`line 1`、`line 2`、`line 3`）。脚本验证通过。

### O4. 无 println 的代码
```java
public class UserCode {
    public static void main(String[] args) {
        int[] arr = {5, 3, 8};
        int n = arr.length;
    }
}
```
**预期**: 控制台面板不显示（无输出时不出现）。脚本验证通过。

---

## P 组：按步骤实时显示（手动）

### P1. 输出跟随步骤出现
O1 代码，逐步播放：
- Step 1（`int x = 1`）→ 控制台不显示
- Step 2（`x = 2`，println 执行后）→ 控制台显示 `hello`
- **预期**: 输出在 println 之后的 step 出现，不是一次性全部显示

### P2. 回退步骤时输出消失
同上，步入 Step 2 看到 `hello` 后：
- 点"上一步"回到 Step 1 → 控制台应变为空（`hello` 消失）
- 再点"下一步"回到 Step 2 → `hello` 重现
- **预期**: 控制台输出与 currentStep 严格对应，回退即消失

### P3. 多行输出逐步累积
```java
public class UserCode {
    public static void main(String[] args) {
        int x = 1;
        System.out.println("first");
        x = 2;
        System.out.println("second");
        x = 3;
    }
}
```
逐步播放：
- Step 2 → 控制台显示 `first`
- Step 3 → 控制台显示 `first\nsecond`
- **预期**: 输出逐行累积，不覆盖之前的输出

---

## U 组：UI 交互（手动）

### U1. 展开/折叠
O1 代码运行后控制台面板出现：
- 点击标题行"控制台输出" → 内容折叠隐藏，chevron 回正
- 再次点击 → 内容展开，chevron 旋转 180°
- **预期**: 折叠/展开流畅，无跳动

### U2. 面板进出动画
从无 println 代码切换到有 println 代码：
- 刚运行时无控制台 → 运行 O1 → 控制台淡入滑下
- 再次运行无 println 代码 → 控制台淡出
- **预期**: 进入/退出有 0.2-0.3s 过渡，不生硬

### U3. 长输出滚动
```java
public class UserCode {
    public static void main(String[] args) {
        for (int i = 1; i <= 50; i++) {
            System.out.println("line " + i);
        }
    }
}
```
- **预期**: 控制台高度不超过 220px，内容超出时可滚动

### U4. 特殊字符
```java
public class UserCode {
    public static void main(String[] args) {
        System.out.println("中文测试");
        System.out.println("!@#$%^&*()");
        System.out.println("line1\nline2");
    }
}
```
- **预期**: 中文、特殊字符、转义换行均正常显示

---

## R 组：回归验证

### R1. 冒泡排序正常运行
**预期**: success，变量卡片正常，控制台不显示

### R2. 沙箱拦截 B-G 组全通过
**预期**: `test-sandbox.py` 全部 30 条通过

### R3. 单元测试
**预期**: `mvn test` 3/3 通过

---

## 测试方式对照

| 验证项 | 自动化 | 手动 |
|--------|:---:|:---:|
| println 输出包含预期字符串 | O1-O4 | — |
| 输出跟随步骤出现（非一次性） | — | P1 |
| 回退步骤输出消失 | — | P2 |
| 多行累积显示 | — | P3 |
| 折叠/展开交互 | — | U1 |
| 面板进出动画 | — | U2 |
| 长输出滚动 | — | U3 |
| 特殊字符 | — | U4 |
| 冒泡排序无回归 | R1 | — |

---

## 汇总

| 组 | 用例数 | 类型 |
|----|--------|------|
| O 基本输出 | 4 | 自动化 |
| P 按步显示 | 3 | 手动 |
| U UI 交互 | 4 | 手动 |
| R 回归 | 3 | 自动化/手动 |
| **合计** | **14** | |
