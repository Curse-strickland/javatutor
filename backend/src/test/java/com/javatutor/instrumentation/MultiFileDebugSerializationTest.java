package com.javatutor.instrumentation;

import com.javatutor.compiler.InMemoryCompiler;
import com.javatutor.controller.RunController;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 验证多文件调试的「串台」问题：跨文件 step 编号是否全局唯一/单调、堆对象是否按文件隔离。
 *
 * 背景：单文件调试时，instrument() 内部的 int[] counter 只服务一个文件，step 全局递增；
 *       但多文件模式下每个文件各自 instrument() 一次，counter 各自从 1 开始，
 *       而 TraceEngine.steps 是按「执行顺序」追加的 —— 于是跨文件 step 会重复/乱序。
 *
 *       同理，TraceEngine.heapObjects 是全局静态 Map，key 是「裸变量名」（如 "arr"），
 *       两个文件各有一个 int[] arr 时，后分配者会覆盖先分配者 → 堆对象串台。
 *
 * 本测试直接读取 RunController 中生产用的 TraceEngine 源码，走真实多文件流程，
 * 通过断言把上述缺陷显式暴露出来（当前预期会失败 = 证明「会串」）。
 */
class MultiFileDebugSerializationTest {

    /**
     * 三个文件，其中 Helper.reverse() 与 Other.reverse() 同名方法，
     * 且 Main / Helper / Other 各自都有局部变量 int[] arr（三个不同数组实例）。
     */
    @Test
    void testCrossFileStepAndHeapSerialization() throws Exception {
        String traceSource = readProductionTraceEngineSource();

        LinkedHashMap<String, String> files = new LinkedHashMap<>();
        files.put("Main.java",
            "public class Main {\n" +
            "    public static void main(String[] args) {\n" +
            "        int[] arr = {9, 8, 7};\n" +
            "        int[] a = Helper.reverse();\n" +
            "        int[] b = Other.reverse();\n" +
            "        System.out.println(a[0]);\n" +
            "    }\n" +
            "}\n");
        files.put("Helper.java",
            "public class Helper {\n" +
            "    public static int[] reverse() {\n" +
            "        int[] arr = {1, 2, 3};\n" +
            "        int n = arr.length;\n" +
            "        for (int i = 0; i < n / 2; i++) {\n" +
            "            int t = arr[i];\n" +
            "            arr[i] = arr[n - 1 - i];\n" +
            "            arr[n - 1 - i] = t;\n" +
            "        }\n" +
            "        return arr;\n" +
            "    }\n" +
            "}\n");
        files.put("Other.java",
            "public class Other {\n" +
            "    public static int[] reverse() {\n" +
            "        int[] arr = {5, 6};\n" +
            "        int n = arr.length;\n" +
            "        for (int i = 0; i < n / 2; i++) {\n" +
            "            int t = arr[i];\n" +
            "            arr[i] = arr[n - 1 - i];\n" +
            "            arr[n - 1 - i] = t;\n" +
            "        }\n" +
            "        return arr;\n" +
            "    }\n" +
            "}\n");

        List<Map<String, Object>> steps = runMultiFile(traceSource, files, "Main");

        // ── 打印完整证据 ──
        System.out.println("=== 多文件运行 steps (" + steps.size() + " 步) ===");
        for (Map<String, Object> s : steps) {
            @SuppressWarnings("unchecked")
            Map<String, Object> heap = (Map<String, Object>) s.get("heap");
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> frames = (List<Map<String, Object>>) s.get("stackFrames");
            StringBuilder frameDesc = new StringBuilder("[");
            if (frames != null) {
                for (int i = 0; i < frames.size(); i++) {
                    if (i > 0) frameDesc.append(", ");
                    frameDesc.append(frames.get(i).get("method"));
                }
            }
            frameDesc.append("]");
            System.out.printf("  step=%2s  file=%-10s line=%2s  vars=%s  heapKeys=%s  frames=%s%n",
                s.get("step"), s.get("file"), s.get("line"),
                ((Map<?, ?>) s.get("variables")).keySet(),
                heap == null ? "null" : heap.keySet(),
                frameDesc);
        }
        System.out.println("==========================================");

        // ── 断言 A：step 应全局唯一且单调递增（当前多文件会串号）──
        List<Integer> stepValues = new ArrayList<>();
        for (Map<String, Object> s : steps) {
            stepValues.add(((Number) s.get("step")).intValue());
        }
        long uniqueCount = new HashSet<>(stepValues).size();
        System.out.println("[诊断] step 序列: " + stepValues);
        System.out.println("[诊断] step 唯一数 = " + uniqueCount + " / 总步数 = " + stepValues.size());

        boolean monotonic = true;
        for (int i = 1; i < stepValues.size(); i++) {
            if (stepValues.get(i) <= stepValues.get(i - 1)) { monotonic = false; break; }
        }
        assertEquals(stepValues.size(), uniqueCount,
            "step 值出现重复 → 多文件插桩的 counter 未全局共享，step 串号");
        assertTrue(monotonic, "step 值未单调递增 → 跨文件执行时 step 乱序");

        // ── 断言 B：每个栈帧应能归属到文件（当前帧只有 method 名，跨类同名方法会串）──
        for (Map<String, Object> s : steps) {
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> frames = (List<Map<String, Object>>) s.get("stackFrames");
            if (frames == null) continue;
            for (Map<String, Object> f : frames) {
                assertTrue(f.containsKey("file"),
                    "栈帧缺少 file 归属，无法区分不同类中的同名方法: " + f.get("method"));
            }
        }
    }

    // ---- 辅助 ----

    /** 反射读取 RunController 中生产用的 TraceEngine 源码（保证测试与生产一致） */
    private String readProductionTraceEngineSource() throws Exception {
        Field f = RunController.class.getDeclaredField("TRACE_ENGINE_SOURCE");
        f.setAccessible(true);
        Object v = f.get(null);
        assertNotNull(v, "未能从 RunController 读取 TRACE_ENGINE_SOURCE");
        return (String) v;
    }

    /** 模拟 runProject 的核心流程：逐个插桩 → 内存编译 → 运行入口 main → 取 steps */
    private List<Map<String, Object>> runMultiFile(String traceSource,
                                                   Map<String, String> files,
                                                   String entryClass) throws Exception {
        Instrumenter instrumenter = new Instrumenter();
        Map<String, String> sources = new LinkedHashMap<>();
        sources.put("TraceEngine", traceSource);

        for (Map.Entry<String, String> e : files.entrySet()) {
            String name = e.getKey();
            String code = e.getValue();
            String className = classNameOf(code);
            String instrumented = instrumenter.instrument(code, name);
            instrumented = removePackageDeclaration(instrumented);
            sources.put(className, instrumented);
        }

        InMemoryCompiler compiler = new InMemoryCompiler();
        Map<String, byte[]> bytecode = compiler.compile(sources);

        ClassLoader cl = new MapClassLoader(bytecode);
        Class<?> trace = cl.loadClass("TraceEngine");
        Class<?> entry = cl.loadClass(entryClass);
        trace.getMethod("reset").invoke(null);
        entry.getMethod("main", String[].class).invoke(null, (Object) new String[0]);

        @SuppressWarnings("unchecked")
        List<Map<String, Object>> steps =
            (List<Map<String, Object>>) trace.getMethod("getSteps").invoke(null);
        return steps;
    }

    private String classNameOf(String code) {
        // 极简：取第一个 public class 名
        java.util.regex.Matcher m =
            java.util.regex.Pattern.compile("public\\s+class\\s+(\\w+)").matcher(code);
        if (m.find()) return m.group(1);
        throw new IllegalArgumentException("未找到 public class");
    }

    private String removePackageDeclaration(String code) {
        return code.replaceFirst("(?m)^package\\s+[^;]+;\\s*", "");
    }

    private static class MapClassLoader extends ClassLoader {
        private final Map<String, byte[]> data;

        MapClassLoader(Map<String, byte[]> data) { this.data = data; }

        @Override
        protected Class<?> findClass(String name) throws ClassNotFoundException {
            byte[] bytes = data.get(name);
            if (bytes != null) return defineClass(name, bytes, 0, bytes.length);
            throw new ClassNotFoundException(name);
        }
    }
}
