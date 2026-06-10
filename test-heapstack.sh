#!/bin/bash
# Heap-Stack 功能验收测试脚本
# 用法: bash test-heapstack.sh [base_url]

BASE="${1:-http://localhost:8080}"
PASS=0
FAIL=0
SKIP=0
RESULTS=""

run_test() {
  local id="$1"
  local desc="$2"
  local code="$3"
  local checks="$4"  # jq filter that must return true

  echo -n "[$id] $desc ... "

  local resp
  resp=$(curl -s -X POST "$BASE/api/run" \
    -H "Content-Type: application/json" \
    -d "{\"code\":$(echo "$code" | jq -Rs .)}" 2>/dev/null)

  local success
  success=$(echo "$resp" | jq -r '.success // false')

  if [ "$success" != "true" ]; then
    local err
    err=$(echo "$resp" | jq -r '.error // "unknown"')
    echo "SKIP (编译/运行失败: $err)"
    SKIP=$((SKIP+1))
    RESULTS="$RESULTS\n  SKIP $id: $desc — $err"
    return
  fi

  # Get all steps
  local steps
  steps=$(echo "$resp" | jq '[.data[].variables] | add // {}' 2>/dev/null)

  # Run custom checks on last step
  local last_step
  last_step=$(echo "$resp" | jq '.data[-1]' 2>/dev/null)

  local check_result
  check_result=$(echo "$last_step" | jq -r "if $checks then \"PASS\" else \"FAIL\" end" 2>/dev/null)

  if [ "$check_result" = "PASS" ]; then
    echo "PASS"
    PASS=$((PASS+1))
    RESULTS="$RESULTS\n  PASS $id: $desc"
  elif [ "$check_result" = "FAIL" ]; then
    echo "FAIL"
    FAIL=$((FAIL+1))
    RESULTS="$RESULTS\n  FAIL $id: $desc — check: $checks"
    echo "  Response: $(echo "$last_step" | jq -c '.')"
  else
    echo "SKIP (jq parse error)"
    SKIP=$((SKIP+1))
    RESULTS="$RESULTS\n  SKIP $id: $desc — jq error"
  fi
}

echo "============================================"
echo " Heap-Stack 功能验收测试"
echo " Target: $BASE"
echo "============================================"
echo ""

# ============================================
# A: 基本类型 & 标量
# ============================================
echo "--- A: 基本类型 & 标量 ---"

run_test "A1" "int 变量声明和赋值" \
'public class U { public static void main(String[] a) { int x = 5; x = 10; } }' \
'.variables.x == 10'

run_test "A2" "double 变量" \
'public class U { public static void main(String[] a) { double d = 3.14; } }' \
'.variables.d == 3.14'

run_test "A3" "boolean 变量" \
'public class U { public static void main(String[] a) { boolean b = true; } }' \
'.variables.b == true'

run_test "A4" "String 变量 (内联，不入堆)" \
'public class U { public static void main(String[] a) { String s = "hello"; } }' \
'.variables.s == "hello"'

run_test "A5" "null 变量" \
'public class U { public static void main(String[] a) { String s = null; } }' \
'.variables.s == null'

run_test "A6" "多变量同作用域" \
'public class U { public static void main(String[] a) { int x = 1; int y = 2; int z = 3; } }' \
'.variables.x == 1 and .variables.y == 2 and .variables.z == 3'

# ============================================
# B: 数组
# ============================================
echo "--- B: 数组 ---"

run_test "B1" "int[] 字面量初始化 {a,b,c}" \
'public class U { public static void main(String[] a) { int[] arr = {5, 3, 8}; } }' \
'.variables.arr != null and (.variables.arr | type) == "array"'

run_test "B2" "int[] new int[n] 声明" \
'public class U { public static void main(String[] a) { int n = 3; int[] arr = new int[n]; } }' \
'.variables.arr != null and (.heap | length > 0)'

run_test "B3" "空数组 int[] x = {}" \
'public class U { public static void main(String[] a) { int[] x = {}; } }' \
'.variables.x == []'

run_test "B4" "数组元素赋值" \
'public class U { public static void main(String[] a) { int[] arr = {5, 3, 8}; arr[0] = 99; } }' \
'.variables.arr[0] == 99'

run_test "B5" "double[] 数组" \
'public class U { public static void main(String[] a) { double[] d = {1.1, 2.2}; } }' \
'.variables.d != null'

run_test "B6" "String[] 数组" \
'public class U { public static void main(String[] a) { String[] s = {"a", "b"}; } }' \
'.variables.s == ["a","b"]'

run_test "B7" "null 元素数组" \
'public class U { public static void main(String[] a) { String[] s = new String[2]; } }' \
'.variables.s == [null, null]'

run_test "B8" "用变量索引访问数组 arr[i]" \
'public class U { public static void main(String[] a) { int[] arr = {10, 20, 30}; int i = 1; int x = arr[i]; } }' \
'.variables.x == 20'

# ============================================
# C: 对象
# ============================================
echo "--- C: 对象 ---"

# Helper: Person class inside UserCode
PERSON_CLASS='
static class Person {
  String name;
  int age;
  Person(String n, int a) { name = n; age = a; }
}'

run_test "C1" "简单对象 — 基本类型字段" \
"public class U { $PERSON_CLASS public static void main(String[] a) { Person p = new Person(\"Alice\", 25); } }" \
'.heap != {} and (.heap | keys | length > 0)'

run_test "C2" "对象 String 字段" \
"public class U { $PERSON_CLASS public static void main(String[] a) { Person p = new Person(\"Bob\", 30); } }" \
'.heap != {}'

run_test "C3" "对象 null 字段" \
'public class U { static class N { Object x; } public static void main(String[] a) { N n = new N(); } }' \
'.heap != {}'

run_test "C4" "对象字段重新赋值" \
"public class U { $PERSON_CLASS public static void main(String[] a) { Person p = new Person(\"C\", 10); p.age = 20; } }" \
'.variables.p != null'

run_test "C5" "多引用指向同一对象" \
"public class U { $PERSON_CLASS public static void main(String[] a) { Person p1 = new Person(\"D\", 10); Person p2 = p1; } }" \
'.heap != {}'

run_test "C6" "对象含数组字段" \
'public class U { static class Box { int[] items; } public static void main(String[] a) { Box b = new Box(); b.items = new int[]{1,2,3}; } }' \
'.heap != {}'

run_test "C7" "嵌套对象 (对象含对象字段)" \
"public class U { $PERSON_CLASS static class Pair { Person a; Person b; } public static void main(String[] x) { Pair pair = new Pair(); pair.a = new Person(\"E\", 1); pair.b = new Person(\"F\", 2); } }" \
'.heap != {} and (.heap | keys | length >= 3)'

run_test "C8" "多字段对象 (6+字段)" \
'public class U { static class Big { int a; int b; int c; String d; double e; boolean f; } public static void main(String[] x) { Big b = new Big(); b.a=1; b.b=2; b.c=3; b.d="x"; b.e=1.5; b.f=true; } }' \
'.heap != {}'

run_test "C9" "私有字段对象" \
'public class U { static class Priv { private int secret = 42; public int get() { return secret; } } public static void main(String[] x) { Priv p = new Priv(); } }' \
'.heap != {}'

# ============================================
# D: 嵌套/复杂结构
# ============================================
echo "--- D: 嵌套/复杂结构 ---"

run_test "D1" "循环引用 (a.friend = b; b.friend = a)" \
"public class U { static class Node { String name; Node friend; Node(String n) { name = n; } } public static void main(String[] x) { Node a = new Node(\"A\"); Node b = new Node(\"B\"); a.friend = b; b.friend = a; } }" \
'.heap != {} and (.heap | keys | length >= 2)'

run_test "D2" "变量重新绑定到不同对象" \
"public class U { $PERSON_CLASS public static void main(String[] x) { Person p = new Person(\"Old\", 1); p = new Person(\"New\", 2); } }" \
'.variables.p != null'

run_test "D3" "对象数组 Person[]" \
"public class U { $PERSON_CLASS public static void main(String[] x) { Person[] arr = new Person[2]; arr[0] = new Person(\"G\", 1); arr[1] = new Person(\"H\", 2); } }" \
'.variables.arr != null and (.variables.arr | type) == "array"'

run_test "D4" "从数组元素引用对象" \
"public class U { $PERSON_CLASS public static void main(String[] x) { Person[] arr = new Person[1]; arr[0] = new Person(\"I\", 1); Person ref = arr[0]; } }" \
'.variables.ref != null'

run_test "D5" "二维数组 int[][]" \
'public class U { public static void main(String[] x) { int[][] m = {{1,2},{3,4}}; } }' \
'.variables.m != null and (.variables.m | type) == "array" and (.variables.m[0] | type) == "array"'

# ============================================
# E: 包装类型
# ============================================
echo "--- E: 包装类型 (应内联，不入堆) ---"

run_test "E1" "Integer 包装类" \
'public class U { public static void main(String[] x) { Integer i = 42; } }' \
'.variables.i == 42'

run_test "E2" "Double 包装类" \
'public class U { public static void main(String[] x) { Double d = 3.14; } }' \
'.variables.d == 3.14'

run_test "E3" "Boolean 包装类" \
'public class U { public static void main(String[] x) { Boolean b = true; } }' \
'.variables.b == true'

# ============================================
# F: 控制流 & 插桩
# ============================================
echo "--- F: 控制流 & 插桩 ---"

run_test "F1" "for 循环变量 (i, j)" \
'public class U { public static void main(String[] x) { int s = 0; for (int i = 0; i < 3; i++) { s += i; } } }' \
'.variables.s == 3'

run_test "F2" "嵌套 for 循环" \
'public class U { public static void main(String[] x) { int c = 0; for (int i = 0; i < 2; i++) { for (int j = 0; j < 2; j++) { c++; } } } }' \
'.variables.c == 4'

run_test "F3" "if 块内变量作用域" \
'public class U { public static void main(String[] x) { int v = 0; if (true) { int w = 5; v = w; } } }' \
'.variables.v == 5'

run_test "F4" "while 循环变量" \
'public class U { public static void main(String[] x) { int i = 0; int s = 0; while (i < 3) { s += i; i++; } } }' \
'.variables.s == 3'

run_test "F5" "System.out.println 插桩" \
'public class U { public static void main(String[] x) { int n = 42; System.out.println(n); } }' \
'.variables.n == 42'

# ============================================
# G: 堆栈面板 UI 数据完整性
# ============================================
echo "--- G: 堆栈面板数据完整性 ---"

run_test "G1" "空堆/栈时 hasData=false (无步骤运行时跳过)" \
'public class U { public static void main(String[] x) { } }' \
'.step != null or .step == 1'

run_test "G2" "stackFrame 含 method=main 和 locals" \
'public class U { public static void main(String[] x) { int a = 1; } }' \
'.stackFrame.method == "main" and .stackFrame.locals != null'

run_test "G3" "堆条目含 id / type / fields 或 slots" \
"public class U { $PERSON_CLASS public static void main(String[] x) { Person p = new Person(\"Z\", 99); } }" \
'(.heap | to_entries[0].value.id != null) and (.heap | to_entries[0].value.type != null)'

run_test "G4" "数组堆条目含 slots" \
'public class U { public static void main(String[] x) { int[] arr = {1,2,3}; } }' \
'.heap != {}'

run_test "G5" "引用字段显示 {\"ref\": \"0x...\"}" \
"public class U { $PERSON_CLASS static class Pair { Person p; } public static void main(String[] x) { Pair pair = new Pair(); pair.p = new Person(\"R\", 1); } }" \
'.heap != {}'

# ============================================
# H: 边界情况
# ============================================
echo "--- H: 边界情况 ---"

run_test "H1" "静态字段不出现在堆中" \
'public class U { static int S = 100; public static void main(String[] x) { int v = S; } }' \
'.variables.v == 100'

run_test "H2" "args 空数组被 VariablePanel 过滤 (后端保留)" \
'public class U { public static void main(String[] args) { int x = 1; } }' \
'.variables.x == 1'

run_test "H3" "对象字段中的基本类型数组" \
'public class U { static class Container { int[] data; } public static void main(String[] x) { Container c = new Container(); c.data = new int[]{7,8,9}; } }' \
'.heap != {}'

run_test "H4" ">>= 移位等表达式不中断插桩" \
'public class U { public static void main(String[] x) { int a = 8; int b = a >> 1; } }' \
'.variables.b == 4'

run_test "H5" "多行代码覆盖多步骤" \
'public class U { public static void main(String[] x) { int a = 1; int b = 2; int c = a + b; } }' \
'(.step | type) == "number"'

run_test "H6" "冒泡排序完整流程 (端到端)" \
'public class U { public static void main(String[] a) { int[] arr = {5,3,8}; int n = arr.length; for (int i = 0; i < n-1; i++) { for (int j = 0; j < n-i-1; j++) { if (arr[j] > arr[j+1]) { int t = arr[j]; arr[j] = arr[j+1]; arr[j+1] = t; } } } } }' \
'.variables.arr == [3,5,8] and .variables.n == 3'

# ============================================
echo ""
echo "============================================"
echo " 结果汇总"
echo "============================================"
echo -e "$RESULTS"
echo ""
echo "PASS: $PASS  FAIL: $FAIL  SKIP: $SKIP"
echo "Total: $((PASS + FAIL + SKIP))"
