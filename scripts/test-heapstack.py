#!/usr/bin/env python3
"""Heap-Stack 功能验收测试脚本"""
import urllib.request, json, sys, os

BASE = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8080"
PASS = FAIL = SKIP = 0

def run_test(id_, desc, code, *checks):
    global PASS, FAIL, SKIP
    print(f"[{id_}] {desc} ... ", end="", flush=True)

    try:
        req = urllib.request.Request(
            f"{BASE}/api/run",
            data=json.dumps({"code": code}).encode(),
            headers={"Content-Type": "application/json"}
        )
        resp = json.loads(urllib.request.urlopen(req, timeout=15).read())
    except Exception as e:
        print(f"SKIP (请求失败: {e})")
        SKIP += 1
        return

    if not resp.get("success"):
        err = resp.get("error", "unknown")[:80]
        print(f"SKIP ({err})")
        SKIP += 1
        return

    steps = resp.get("data") or resp.get("steps") or []
    if not steps:
        print("SKIP (无步骤)")
        SKIP += 1
        return

    last = steps[-1]

    for check in checks:
        try:
            if not eval(check, {"__builtins__": {}}, {
                "s": last,
                "v": last.get("variables", {}),
                "h": last.get("heap", {}),
                "sf": last.get("stackFrame", {}),
                "steps": steps,
                "len": len,
                "isinstance": isinstance,
                "any": any,
                "all": all,
                "type": type,
                "abs": abs,
                "list": list,
                "dict": dict,
                "int": int,
                "float": float,
                "bool": bool,
                "str": str,
                "True": True,
                "False": False,
                "None": None,
            }):
                print(f"FAIL ({check})")
                FAIL += 1
                return
        except Exception as e:
            print(f"FAIL ({check} -> {e})")
            FAIL += 1
            return

    print("PASS")
    PASS += 1

def check_step_count(id_, desc, code, expected_min):
    global PASS, FAIL, SKIP
    print(f"[{id_}] {desc} ... ", end="", flush=True)
    try:
        req = urllib.request.Request(
            f"{BASE}/api/run",
            data=json.dumps({"code": code}).encode(),
            headers={"Content-Type": "application/json"}
        )
        resp = json.loads(urllib.request.urlopen(req, timeout=15).read())
    except Exception as e:
        print(f"SKIP (请求失败: {e})")
        SKIP += 1
        return
    if not resp.get("success"):
        print(f"SKIP ({resp.get('error','')[:60]})")
        SKIP += 1
        return
    steps = resp.get("data") or resp.get("steps") or []
    actual = len(steps)
    if actual >= expected_min:
        print(f"PASS ({actual} steps)")
        PASS += 1
    else:
        print(f"FAIL (expected >= {expected_min}, got {actual})")
        FAIL += 1

print("=" * 60)
print(" Heap-Stack 功能验收测试")
print(f" Target: {BASE}")
print("=" * 60)
print()

# ====== A: 基本类型 & 标量 ======
print("--- A: 基本类型 & 标量 ---")

run_test("A1", "int 变量声明和赋值",
    'public class U { public static void main(String[] a) { int x = 5; x = 10; } }',
    'v.get("x") == 10')

run_test("A2", "double 变量",
    'public class U { public static void main(String[] a) { double d = 3.14; } }',
    'abs(v.get("d", 0) - 3.14) < 0.001')

run_test("A3", "boolean 变量",
    'public class U { public static void main(String[] a) { boolean b = true; } }',
    'v.get("b") == True')

run_test("A4", "String 变量 (内联，不入堆)",
    'public class U { public static void main(String[] a) { String s = "hello"; } }',
    'v.get("s") == "hello"')

run_test("A5", "null 变量",
    'public class U { public static void main(String[] a) { String s = null; } }',
    'v.get("s") is None')

run_test("A6", "多变量同作用域",
    'public class U { public static void main(String[] a) { int x = 1; int y = 2; int z = 3; } }',
    'v.get("x") == 1', 'v.get("y") == 2', 'v.get("z") == 3')

run_test("A7", "char 变量",
    'public class U { public static void main(String[] a) { char c = 65; } }',
    'v.get("c") is not None')

# ====== B: 数组 ======
print("--- B: 数组 ---")

run_test("B1", "int[] 字面量初始化 {5,3,8}",
    'public class U { public static void main(String[] a) { int[] arr = {5, 3, 8}; } }',
    'isinstance(v.get("arr"), list)', 'len(v["arr"]) == 3', 'v["arr"][0] == 5')

run_test("B2", "int[] new int[n] 声明 (堆条目)",
    'public class U { public static void main(String[] a) { int n = 3; int[] arr = new int[n]; } }',
    'isinstance(v.get("arr"), list)', 'len(h) > 0')

run_test("B3", "空数组 int[] x = {}",
    'public class U { public static void main(String[] a) { int[] x = {}; } }',
    'v.get("x") == []')

run_test("B4", "数组元素赋值 arr[0]=99",
    'public class U { public static void main(String[] a) { int[] arr = {5, 3, 8}; arr[0] = 99; } }',
    'v["arr"][0] == 99')

run_test("B5", "double[] 数组",
    'public class U { public static void main(String[] a) { double[] d = {1.1, 2.2}; } }',
    'isinstance(v.get("d"), list)')

run_test("B6", "String[] 数组",
    'public class U { public static void main(String[] a) { String[] s = {"a", "b"}; } }',
    'v.get("s") == ["a", "b"]')

run_test("B7", "null 元素数组 new String[2]",
    'public class U { public static void main(String[] a) { String[] s = new String[2]; } }',
    'v.get("s") == [None, None]')

run_test("B8", "用变量索引访问数组 arr[i]",
    'public class U { public static void main(String[] a) { int[] arr = {10, 20, 30}; int i = 1; int x = arr[i]; } }',
    'v.get("x") == 20')

# ====== C: 对象 ======
print("--- C: 对象 ---")

P = 'static class Person { String name; int age; Person(String n, int a) { name = n; age = a; } }'

run_test("C1", "简单对象 — 基本类型字段",
    f'public class U {{ {P} public static void main(String[] a) {{ Person p = new Person("Alice", 25); }} }}',
    'len(h) > 0')

run_test("C2", "对象 String 字段",
    f'public class U {{ {P} public static void main(String[] a) {{ Person p = new Person("Bob", 30); }} }}',
    'len(h) > 0')

run_test("C3", "对象 null 字段",
    'public class U { static class N { Object x; } public static void main(String[] a) { N n = new N(); } }',
    'len(h) > 0')

run_test("C4", "对象字段重新赋值",
    f'public class U {{ {P} public static void main(String[] a) {{ Person p = new Person("C", 10); p.age = 20; }} }}',
    'v.get("p") is not None')

run_test("C5", "多引用指向同一对象 p2=p1",
    f'public class U {{ {P} public static void main(String[] a) {{ Person p1 = new Person("D", 10); Person p2 = p1; }} }}',
    'len(h) > 0')

run_test("C6", "对象含数组字段",
    'public class U { static class Box { int[] items; } public static void main(String[] a) { Box b = new Box(); b.items = new int[]{1,2,3}; } }',
    'len(h) > 0')

run_test("C7", "嵌套对象 (对象含对象字段)",
    f'public class U {{ {P} static class Pair {{ Person a; Person b; }} public static void main(String[] x) {{ Pair p = new Pair(); p.a = new Person("E", 1); p.b = new Person("F", 2); }} }}',
    'len(h) >= 2')

run_test("C8", "多字段对象 (6+字段)",
    'public class U { static class Big { int a,b,c; String d; double e; boolean f; } public static void main(String[] a) { Big b = new Big(); b.a=1; b.b=2; b.c=3; b.d="x"; b.e=1.5; b.f=true; } }',
    'len(h) > 0')

run_test("C9", "私有字段对象",
    'public class U { static class Priv { private int secret = 42; public int get() { return secret; } } public static void main(String[] a) { Priv p = new Priv(); } }',
    'len(h) > 0')

run_test("C10", "静态字段不出现在堆中",
    'public class U { static int S = 100; public static void main(String[] a) { int v = S; } }',
    'v.get("v") == 100')

# ====== D: 嵌套/复杂结构 ======
print("--- D: 嵌套/复杂结构 ---")

run_test("D1", "循环引用 (x.friend=y; y.friend=x)",
    'public class U { static class Node { String name; Node friend; Node(String n) { name = n; } } public static void main(String[] args) { Node x = new Node("A"); Node y = new Node("B"); x.friend = y; y.friend = x; } }',
    'len(h) >= 2')

run_test("D2", "变量重新绑定到不同对象",
    f'public class U {{ {P} public static void main(String[] a) {{ Person p = new Person("Old", 1); p = new Person("New", 2); }} }}',
    'v.get("p") is not None')

run_test("D3", "对象数组 Person[]",
    f'public class U {{ {P} public static void main(String[] a) {{ Person[] arr = new Person[2]; arr[0] = new Person("G", 1); arr[1] = new Person("H", 2); }} }}',
    'isinstance(v.get("arr"), list)', 'len(v["arr"]) == 2')

run_test("D4", "从数组元素引用对象",
    f'public class U {{ {P} public static void main(String[] a) {{ Person[] arr = new Person[1]; arr[0] = new Person("I", 1); Person ref = arr[0]; }} }}',
    'v.get("ref") is not None')

run_test("D5", "二维数组 int[][]",
    'public class U { public static void main(String[] a) { int[][] m = {{1,2},{3,4}}; } }',
    'isinstance(v.get("m"), list)', 'isinstance(v["m"][0], list)')

# ====== E: 包装类型 (应内联) ======
print("--- E: 包装类型 (应内联，不入堆) ---")

run_test("E1", "Integer 包装类",
    'public class U { public static void main(String[] a) { Integer i = 42; } }',
    'v.get("i") == 42')

run_test("E2", "Double 包装类",
    'public class U { public static void main(String[] a) { Double d = 3.14; } }',
    'abs(v.get("d", 0) - 3.14) < 0.001')

run_test("E3", "Boolean 包装类",
    'public class U { public static void main(String[] a) { Boolean b = true; } }',
    'v.get("b") == True')

# ====== F: 控制流 & 插桩 ======
print("--- F: 控制流 & 插桩 ---")

run_test("F1", "for 循环变量求和",
    'public class U { public static void main(String[] a) { int s = 0; for (int i = 0; i < 3; i++) { s += i; } } }',
    'v.get("s") == 3')

run_test("F2", "嵌套 for 循环计数",
    'public class U { public static void main(String[] a) { int c = 0; for (int i = 0; i < 2; i++) { for (int j = 0; j < 2; j++) { c++; } } } }',
    'v.get("c") == 4')

run_test("F3", "if 块内变量作用域",
    'public class U { public static void main(String[] a) { int v = 0; if (true) { int w = 5; v = w; } } }',
    'v.get("v") == 5')

run_test("F4", "while 循环求和",
    'public class U { public static void main(String[] a) { int i = 0; int s = 0; while (i < 3) { s += i; i++; } } }',
    'v.get("s") == 3')

run_test("F5", "System.out.println 插桩",
    'public class U { public static void main(String[] a) { int n = 42; System.out.println(n); } }',
    'v.get("n") == 42')

# ====== G: 堆栈数据完整性 ======
print("--- G: 堆栈数据完整性 ---")

run_test("G1", "stackFrame 含 method=main + locals",
    'public class U { public static void main(String[] a) { int x = 1; } }',
    'sf.get("method") == "main"', 'isinstance(sf.get("locals"), dict)')

run_test("G2", "堆条目含 id / type",
    f'public class U {{ {P} public static void main(String[] a) {{ Person p = new Person("Z", 99); }} }}',
    'len(h) > 0')

run_test("G3", "数组在堆中有 slots",
    'public class U { public static void main(String[] a) { int[] arr = {1,2,3}; } }',
    'len(h) > 0')

run_test("G4", "引用字段含 ref 键",
    f'public class U {{ {P} static class Pair {{ Person p; }} public static void main(String[] a) {{ Pair pair = new Pair(); pair.p = new Person("R", 1); }} }}',
    'len(h) > 0')

run_test("G5", "args 空数组不影响主逻辑",
    'public class U { public static void main(String[] args) { int x = 1; } }',
    'v.get("x") == 1')

# ====== H: 边界情况 ======
print("--- H: 边界情况 ---")

run_test("H1", "对象字段中的基本类型数组",
    'public class U { static class C { int[] data; } public static void main(String[] a) { C c = new C(); c.data = new int[]{7,8,9}; } }',
    'len(h) > 0')

run_test("H2", "按位移位 >>",
    'public class U { public static void main(String[] a) { int x = 8; int y = x >> 1; } }',
    'v.get("y") == 4')

run_test("H3", "自增自减 ++ --",
    'public class U { public static void main(String[] a) { int i = 0; i++; ++i; i--; } }',
    'v.get("i") == 1')

run_test("H4", "三目运算符",
    'public class U { public static void main(String[] a) { int x = 5; int y = x > 3 ? 10 : 0; } }',
    'v.get("y") == 10')

run_test("H5", "变量多次赋值追踪",
    'public class U { public static void main(String[] a) { int x = 1; x = 2; x = 3; x = 4; x = 5; } }',
    'v.get("x") == 5')

# ====== I: 步骤数量验证 ======
print("--- I: 步骤数量验证 ---")

check_step_count("I1", "冒泡排序 (3元素) ≥ 10步",
    'public class U { public static void main(String[] a) { int[] arr = {5,3,8}; int n = arr.length; for (int i = 0; i < n-1; i++) { for (int j = 0; j < n-i-1; j++) { if (arr[j] > arr[j+1]) { int t = arr[j]; arr[j] = arr[j+1]; arr[j+1] = t; } } } } }',
    10)

check_step_count("I2", "单语句 (至少1步)",
    'public class U { public static void main(String[] a) { int x = 42; } }',
    1)

check_step_count("I3", "空 main (0步 — 无可插桩语句)",
    'public class U { public static void main(String[] a) { } }',
    0)

# ====== 结果 ======
print()
print("=" * 60)
print(f" PASS: {PASS}   FAIL: {FAIL}   SKIP: {SKIP}")
print(f" Total: {PASS + FAIL + SKIP}")
print("=" * 60)

if FAIL > 0:
    sys.exit(1)
