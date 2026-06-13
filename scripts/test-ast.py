#!/usr/bin/env python3
"""AST 插桩自动化验收 — H-M 组，25 条"""
import urllib.request, urllib.error, json, time

BASE = "http://localhost:8080/api/run"
PASS, FAIL, TOTAL = 0, 0, 0

def call(code, timeout=8):
    """返回 (success, error, steps_count)"""
    try:
        body = json.dumps({"code": code}).encode("utf-8")
        req = urllib.request.Request(BASE, data=body,
            headers={"Content-Type": "application/json"}, method="POST")
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            data = json.loads(resp.read().decode("utf-8"))
            return data.get("success", False), data.get("error", ""), len(data.get("steps", []))
    except Exception as e:
        return False, str(e), 0

def test(id, code, checks):
    """checks: dict with 'success', 'min_steps', 'no_error_contains'"""
    global PASS, FAIL, TOTAL
    TOTAL += 1
    success, error, steps = call(code)

    ok = True
    reason = ""
    if "success" in checks:
        if success != checks["success"]:
            ok = False
            reason = f"expected success={checks['success']}, got {success}"
    if "min_steps" in checks and success:
        if steps < checks["min_steps"]:
            ok = False
            reason = f"expected ≥{checks['min_steps']} steps, got {steps}"
    if "no_error_contains" in checks and not success:
        for kw in checks["no_error_contains"].split("|"):
            if kw in error:
                ok = False
                reason = f"should not contain '{kw}' in error"
                break

    if ok:
        print(f"  PASS  {id}  (steps={steps})")
        PASS += 1
    else:
        print(f"  FAIL  {id} — {reason} | error={error[:120]}")
        FAIL += 1


# ================================================================
print("=" * 50)
print("  H 组：正常算法 (3)")
print("=" * 50)

test("H1", """public class UserCode {
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
}""", {"success": True, "min_steps": 1})

test("H2", """public class UserCode {
    public static void main(String[] args) {
        int n = 10;
        int result = fib(n);
    }
    public static int fib(int n) {
        if (n <= 1) return n;
        return fib(n - 1) + fib(n - 2);
    }
}""", {"success": True, "min_steps": 1})

test("H3", """public class UserCode {
    public static void main(String[] args) {
        int a = 1;
        int b = 2;
        int c = a + b;
    }
}""", {"success": True, "min_steps": 3})

# ================================================================
print("\n" + "=" * 50)
print("  I 组：控制流 (8)")
print("=" * 50)

test("I1", """public class UserCode {
    public static void main(String[] args) {
        int x = 5;
        if (x > 3) { x = 10; } else { x = 0; }
    }
}""", {"success": True, "min_steps": 2})

test("I2", """public class UserCode {
    public static void main(String[] args) {
        int s = 0;
        for (int i = 0; i < 5; i++) { s = s + i; }
    }
}""", {"success": True, "min_steps": 2})

test("I3", """public class UserCode {
    public static void main(String[] args) {
        int s = 0;
        for (int i = 0; i < 5; i++)
            s = s + i;
    }
}""", {"success": True, "min_steps": 1})

test("I4", """public class UserCode {
    public static void main(String[] args) {
        int i = 0;
        while (i < 3) { i++; }
    }
}""", {"success": True, "min_steps": 2})

test("I5", """public class UserCode {
    public static void main(String[] args) {
        int i = 0;
        do { i++; } while (i < 3);
    }
}""", {"success": True, "min_steps": 2})

test("I6", """import java.util.List;
public class UserCode {
    public static void main(String[] args) {
        int sum = 0;
        for (int x : List.of(1, 2, 3)) { sum = sum + x; }
    }
}""", {"success": True, "min_steps": 1})

test("I7", """public class UserCode {
    public static void main(String[] args) {
        int s = 0;
        for (int i = 0; i < 3; i++) {
            for (int j = 0; j < 3; j++) { s = s + 1; }
        }
    }
}""", {"success": True, "min_steps": 1})

test("I8", """public class UserCode {
    public static void main(String[] args) {
        int s = 0;
        for (int i = 0; i < 3; i++)
            for (int j = 0; j < 3; j++)
                s = s + 1;
    }
}""", {"success": True, "min_steps": 1, "no_error_contains": "找不到|无法访问"})

# ================================================================
print("\n" + "=" * 50)
print("  J 组：return 语句 (3)")
print("=" * 50)

test("J1", """public class UserCode {
    public static void main(String[] args) {
        int x = check(3);
    }
    public static int check(int n) {
        if (n > 0) return 1;
        return 0;
    }
}""", {"success": True, "min_steps": 1, "no_error_contains": "无法访问的语句|unreachable"})

test("J2", """public class UserCode {
    public static void main(String[] args) {
        int x = foo();
    }
    public static int foo() {
        int a = 1;
        return a;
    }
}""", {"success": True, "min_steps": 1, "no_error_contains": "无法访问的语句|unreachable"})

test("J3", """public class UserCode {
    public static void main(String[] args) {
        int x = fib(5);
    }
    public static int fib(int n) {
        if (n == 0) return 0;
        if (n == 1) return 1;
        return fib(n - 1) + fib(n - 2);
    }
}""", {"success": True, "min_steps": 1, "no_error_contains": "无法访问的语句|unreachable"})

# ================================================================
print("\n" + "=" * 50)
print("  K 组：自增自减 (5)")
print("=" * 50)

test("K1", """public class UserCode {
    public static void main(String[] args) {
        int i = 0;
        i++;
    }
}""", {"success": True, "min_steps": 2})

test("K2", """public class UserCode {
    public static void main(String[] args) {
        int i = 5;
        i--;
    }
}""", {"success": True, "min_steps": 2})

test("K3", """public class UserCode {
    public static void main(String[] args) {
        int i = 0;
        ++i;
    }
}""", {"success": True, "min_steps": 2})

test("K4", """public class UserCode {
    public static void main(String[] args) {
        int i = 5;
        --i;
    }
}""", {"success": True, "min_steps": 2})

test("K5", """public class UserCode {
    public static void main(String[] args) {
        int c = 0;
        for (int i = 0; i < 5; i++) { c++; }
    }
}""", {"success": True, "min_steps": 3})

# ================================================================
print("\n" + "=" * 50)
print("  L 组：多变量 (1)")
print("=" * 50)

test("L1", """public class UserCode {
    public static void main(String[] args) {
        int v0 = 0, v1 = 1, v2 = 2, v3 = 3, v4 = 4;
        int v5 = 5, v6 = 6, v7 = 7, v8 = 8, v9 = 9;
        int v10 = 10, v11 = 11;
        v0 = v0 + v11;
    }
}""", {"success": True, "min_steps": 1, "no_error_contains": "找不到符号|cannot find symbol"})

# ================================================================
print("\n" + "=" * 50)
print("  M 组：边界 (2)")
print("=" * 50)

test("M1", """public class UserCode {
    public static void main(String[] args) {
    }
}""", {"success": True})

test("M2", """public class UserCode {
    public static void main(String[] args) {
        int x = 0;
        int y = 1;
    }
}""", {"success": True, "min_steps": 2})

# ================================================================
print("\n" + "=" * 50)
print(f"  结果: {PASS}/{TOTAL} 通过, {FAIL}/{TOTAL} 失败")
if FAIL == 0:
    print("  全部通过！")
else:
    print("  请检查以上 FAIL 条目。")
print("=" * 50)
print()
print("手动必测项（浏览器 localhost:5173 逐步播放验证）：")
print("  H1 冒泡排序 — 变量卡片逐步变化")
print("  I1 if/else — 条件判断行高亮")
print("  I3 for 无括号单语句 — 循环体变量可见")
print("  I4 while — i++ 行高亮")
print("  I8 嵌套非块体 — 内层变量有记录")
print("  K1-K5 自增自减 — ++/-- 行有高亮")
print("  L1 多变量 — 12+ 变量卡片正常显示")
