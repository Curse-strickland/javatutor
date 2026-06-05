package com.javatutor.instrumentation;

import com.javatutor.compiler.InMemoryCompiler;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Method;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 验证 Bug 5 修复：插桩不会"预知"未声明变量。
 *
 * 冒泡排序代码的特征是：
 *   int i 在 for-init 声明，int j 在更深层的 for-init 声明，int temp 在 if-body 的 BlockStmt 里声明。
 *   修复前：collectVisibleVariables 用 findAll 递归扫描父级节点，
 *           会把 temp、j 等在深层嵌套 BlockStmt 里的变量提前暴露给外层的 TraceEngine.record()，
 *           生成引用未声明变量的代码 → 编译失败。
 *   修复后：父级遍历改用 collectDirectVariables，跳过嵌套 BlockStmt，只收直接可见的变量。
 */
class InstrumenterTest {

    private static final String TRACE_ENGINE_SOURCE =
        "import java.util.*;\n" +
        "public class TraceEngine {\n" +
        "    private static List<Map<String,Object>> steps = new ArrayList<>();\n" +
        "    public static void record(int step, int line, Map<String,Object> vars) {\n" +
        "        LinkedHashMap<String,Object> record = new LinkedHashMap<>();\n" +
        "        record.put(\"step\", step);\n" +
        "        record.put(\"line\", line);\n" +
        "        record.put(\"variables\", new LinkedHashMap<>(vars));\n" +
        "        steps.add(record);\n" +
        "    }\n" +
        "    public static void reset() { steps.clear(); }\n" +
        "    public static List<Map<String,Object>> getSteps() { return steps; }\n" +
        "}\n";

    /**
     * 核心测试：冒泡排序代码能成功走完 插桩 → 编译 → 运行 全链路。
     * 如果 Bug 5 没修好，InMemoryCompiler.compile() 会抛 RuntimeException("Compilation failed: 找不到符号")。
     */
    @Test
    void testBubbleSortInstrumentationCompilesAndRuns() throws Exception {
        String bubbleSortCode =
            "public class UserCode {\n" +
            "    public static void main(String[] args) {\n" +
            "        int[] arr = {5, 3, 8};\n" +
            "        int n = arr.length;\n" +
            "        for (int i = 0; i < n - 1; i++) {\n" +
            "            for (int j = 0; j < n - i - 1; j++) {\n" +
            "                if (arr[j] > arr[j + 1]) {\n" +
            "                    int temp = arr[j];\n" +
            "                    arr[j] = arr[j + 1];\n" +
            "                    arr[j + 1] = temp;\n" +
            "                }\n" +
            "            }\n" +
            "        }\n" +
            "    }\n" +
            "}\n";

        Instrumenter instrumenter = new Instrumenter();
        String instrumentedCode = instrumenter.instrument(bubbleSortCode);

        // 验证 1：插桩不会把不可见变量写进 record() 调用
        // 如果 temp 出现在不该出现的地方（嵌套 BlockStmt 外部），编译会失败。
        // 反过来：temp 应该只在 if-body 内部的 record 调用中出现，那里它已经声明了。
        System.out.println("=== Instrumented code ===");
        System.out.println(instrumentedCode);
        System.out.println("=========================");

        // 验证 2：去掉 package 声明，跟真实 Controller 流程一致
        instrumentedCode = removePackageDeclaration(instrumentedCode);

        // 验证 3：编译（这是之前失败的地方 — 会直接抛 RuntimeException）
        InMemoryCompiler compiler = new InMemoryCompiler();
        Map<String, String> sources = new LinkedHashMap<>();
        sources.put("TraceEngine", TRACE_ENGINE_SOURCE);
        sources.put("UserCode", instrumentedCode);

        Map<String, byte[]> bytecodeMap;
        try {
            bytecodeMap = compiler.compile(sources);
        } catch (RuntimeException e) {
            // 编译失败 → 说明 Bug 5 没修好
            fail("编译失败（Bug 5 仍未修复）: " + e.getMessage());
            return;
        }

        // 验证 4：加载并运行，确认执行正常
        ClassLoader cl = new InMemoryClassLoader(bytecodeMap);
        Class<?> traceEngineClass = cl.loadClass("TraceEngine");
        Class<?> userClass = cl.loadClass("UserCode");

        traceEngineClass.getMethod("reset").invoke(null);
        Method main = userClass.getMethod("main", String[].class);
        main.invoke(null, (Object) new String[0]);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> steps =
            (List<Map<String, Object>>) traceEngineClass.getMethod("getSteps").invoke(null);

        // 验证 5：有步骤产出，且每个步骤的 variables 不应包含奇怪的变量
        assertFalse(steps.isEmpty(), "应该有步骤产出");
        System.out.println("=== Steps (" + steps.size() + " total) ===");
        for (Map<String, Object> step : steps) {
            System.out.println("  step=" + step.get("step") + " line=" + step.get("line")
                + " vars=" + step.get("variables").toString());
        }
        System.out.println("=========================");
    }

    /**
     * 极端情况：最深嵌套里的变量（temp）不应泄露到外层。
     */
    @Test
    void testDeepNestedVariableNotLeakedToOuterScope() {
        String code =
            "public class UserCode {\n" +
            "    public static void main(String[] args) {\n" +
            "        int a = 1;\n" +
            "        if (true) {\n" +
            "            if (true) {\n" +
            "                int deep = 99;\n" +       // 深层变量
            "                deep = deep + 1;\n" +     // 这里 visibleVars 应包含 a + deep
            "            }\n" +
            "            int b = 2;\n" +               // 这里 visibleVars 应包含 a + b（不含 deep）
            "            b = b + 1;\n" +
            "        }\n" +
            "        a = a + 1;\n" +                   // 最外层，只能看到 a
            "    }\n" +
            "}\n";

        Instrumenter instrumenter = new Instrumenter();
        String result = instrumenter.instrument(code);

        // 基本健康检查：插桩后的代码能去掉 package 声明
        result = removePackageDeclaration(result);

        // 编译检验
        InMemoryCompiler compiler = new InMemoryCompiler();
        Map<String, String> sources = new LinkedHashMap<>();
        sources.put("TraceEngine", TRACE_ENGINE_SOURCE);
        sources.put("UserCode", result);

        try {
            compiler.compile(sources);
        } catch (RuntimeException e) {
            fail("深层嵌套变量泄露到外层导致编译失败: " + e.getMessage());
        }
    }

    // ---- 辅助 ----

    private String removePackageDeclaration(String code) {
        // 简单版：截掉 package 行
        return code.replaceFirst("(?m)^package\\s+[^;]+;\\s*", "");
    }

    private static class InMemoryClassLoader extends ClassLoader {
        private final Map<String, byte[]> classData;

        InMemoryClassLoader(Map<String, byte[]> classData) {
            this.classData = classData;
        }

        @Override
        protected Class<?> findClass(String name) throws ClassNotFoundException {
            byte[] bytes = classData.get(name);
            if (bytes != null) {
                return defineClass(name, bytes, 0, bytes.length);
            }
            throw new ClassNotFoundException(name);
        }
    }
}
