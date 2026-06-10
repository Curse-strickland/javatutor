package com.javatutor.controller;

import com.javatutor.compiler.InMemoryCompiler;
import com.javatutor.instrumentation.Instrumenter;
import com.javatutor.sandbox.SandboxValidator;
import com.javatutor.sandbox.SafeSecurityManager;
import com.javatutor.model.RunRequest;
import com.javatutor.model.RunResponse;
import com.github.javaparser.StaticJavaParser;
import com.github.javaparser.ast.CompilationUnit;
import org.springframework.web.bind.annotation.*;
import java.io.ByteArrayOutputStream;
import java.io.PrintStream;
import java.util.*;
import java.util.concurrent.*;
import java.lang.reflect.Method;

@RestController // 告诉 Spring：这个类处理 HTTP 请求，返回 JSON
@RequestMapping("/api")   // 所有接口路径以 /api 开头
@CrossOrigin(origins = "*") // 允许前端跨域访问

public class RunController {
    private final Instrumenter instrumenter = new Instrumenter();
    private final InMemoryCompiler compiler = new InMemoryCompiler();

    // TraceEngine 源码（注意：无 package 声明，和用户代码一起在默认包）
    //这里的关键设计：嵌入的 TRACE_ENGINE_SOURCE 没有 package 声明。
    // 所以运行时 TraceEngine 和用户代码都在默认包里，
    // 用户代码里的 TraceEngine.record(...) 跨类调用才能正常工作。
    private static final String TRACE_ENGINE_SOURCE =
        "import java.util.*;\n" +
        "import java.lang.reflect.Array;\n" +
        "import java.lang.reflect.Field;\n" +
        "import java.lang.reflect.Modifier;\n" +
        "import java.io.ByteArrayOutputStream;\n" +
        "public class TraceEngine {\n" +
        "    private static List<Map<String,Object>> steps = new ArrayList<>();\n" +
        "    private static volatile boolean disabled = false;\n" +
        "    private static ByteArrayOutputStream capturedOutput;\n" +
        "    private static int lastOutputPos = 0;\n" +
        "    private static LinkedHashMap<String,LinkedHashMap<String,Object>> heapObjects = new LinkedHashMap<>();\n" +
        "    private static int heapCounter = 0;\n" +
        "    private static List<Object[]> objRefList = new ArrayList<>();\n" +
        "    private static List<StackFrame> callStack = new ArrayList<>();\n" +
        "    private static int frameCounter = 0;\n" +
        "    public static class StackFrame {\n" +
        "        public String id, name;\n" +
        "        public Map<String, Object> variables;\n" +
        "        public Object returnValue;\n" +
        "        public StackFrame(String id, String name, Map<String, Object> vars) {\n" +
        "            this.id = id; this.name = name;\n" +
        "            this.variables = new LinkedHashMap<>(vars);\n" +
        "            this.returnValue = null;\n" +
        "        }\n" +
        "    }\n" +
        "    private static boolean isPrimitiveOrWrapper(Object v) {\n" +
        "        return v instanceof Boolean || v instanceof Byte || v instanceof Character ||\n" +
        "               v instanceof Short || v instanceof Integer || v instanceof Long ||\n" +
        "               v instanceof Float || v instanceof Double || v instanceof String;\n" +
        "    }\n" +
        "    private static String findRefByObj(Object obj) {\n" +
        "        for (Object[] pair : objRefList) { if (pair[0] == obj) return (String)pair[1]; }\n" +
        "        return null;\n" +
        "    }\n" +
        "    private static String registerObj(Object obj) {\n" +
        "        heapCounter++;\n" +
        "        String ref = \"h\" + heapCounter;\n" +
        "        objRefList.add(new Object[]{obj, ref});\n" +
        "        heapObjects.put(ref, new LinkedHashMap<>());\n" +
        "        return ref;\n" +
        "    }\n" +
        "    private static Object deepSerialize(Object obj, Set<Object> visited) {\n" +
        "        if (obj == null) return null;\n" +
        "        if (isPrimitiveOrWrapper(obj)) return obj;\n" +
        "        if (obj.getClass().isArray()) {\n" +
        "            int len = Array.getLength(obj);\n" +
        "            List<Object> list = new ArrayList<>(len);\n" +
        "            for (int i = 0; i < len; i++) list.add(deepSerialize(Array.get(obj, i), visited));\n" +
        "            return list;\n" +
        "        }\n" +
        "        if (visited.contains(obj)) return findRefByObj(obj);\n" +
        "        visited.add(obj);\n" +
        "        String ref = findRefByObj(obj);\n" +
        "        if (ref == null) ref = registerObj(obj);\n" +
        "        return ref;\n" +
        "    }\n" +
        "    private static void serializeFields(String ref, Object obj, Set<Object> visited) {\n" +
        "        LinkedHashMap<String,Object> entry = heapObjects.get(ref);\n" +
        "        if (entry == null) return;\n" +
        "        Class<?> cls = obj.getClass();\n" +
        "        while (cls != null && cls != Object.class) {\n" +
        "            for (Field f : cls.getDeclaredFields()) {\n" +
        "                if (Modifier.isStatic(f.getModifiers())) continue;\n" +
        "                f.setAccessible(true);\n" +
        "                try { entry.put(f.getName(), deepSerialize(f.get(obj), visited)); }\n" +
        "                catch (Exception ignored) {}\n" +
        "            }\n" +
        "            cls = cls.getSuperclass();\n" +
        "        }\n" +
        "    }\n" +
        "    public static void pushFrame(String methodName, Map<String, Object> params) {\n" +
        "        frameCounter++;\n" +
        "        callStack.add(new StackFrame(\"f\" + frameCounter, methodName, params));\n" +
        "    }\n" +
        "    public static void popFrame(Object returnValue) {\n" +
        "        if (!callStack.isEmpty()) {\n" +
        "            callStack.get(callStack.size() - 1).returnValue = returnValue;\n" +
        "        }\n" +
        "    }\n" +
        "    private static void attachCallStack(Map<String, Object> varsCopy) {\n" +
        "        if (callStack.isEmpty()) return;\n" +
        "        LinkedHashMap<String, Object> stackData = new LinkedHashMap<>();\n" +
        "        List<LinkedHashMap<String, Object>> framesList = new ArrayList<>();\n" +
        "        List<Integer> returningIndices = new ArrayList<>();\n" +
        "        for (int i = 0; i < callStack.size(); i++) {\n" +
        "            StackFrame frame = callStack.get(i);\n" +
        "            LinkedHashMap<String, Object> fm = new LinkedHashMap<>();\n" +
        "            fm.put(\"id\", frame.id);\n" +
        "            fm.put(\"name\", frame.name);\n" +
        "            fm.put(\"variables\", frame.variables);\n" +
        "            fm.put(\"returnValue\", frame.returnValue);\n" +
        "            framesList.add(fm);\n" +
        "            if (frame.returnValue != null) returningIndices.add(i);\n" +
        "        }\n" +
        "        stackData.put(\"frames\", framesList);\n" +
        "        stackData.put(\"activeFrameIndex\", callStack.size() - 1);\n" +
        "        stackData.put(\"returningFrameIndices\", returningIndices);\n" +
        "        varsCopy.put(\"_recursionStack_\", stackData);\n" +
        "    }\n" +
        "    private static void clearHeapPerStep() {\n" +
        "        heapObjects.clear();\n" +
        "        heapCounter = 0;\n" +
        "        objRefList.clear();\n" +
        "    }\n" +
        "    public static void record(int step, int line, Map<String,Object> vars) {\n" +
        "        if (disabled) return;\n" +
        "        LinkedHashMap<String,Object> record = new LinkedHashMap<>();\n" +
        "        record.put(\"step\", step);\n" +
        "        record.put(\"line\", line);\n" +
        "        clearHeapPerStep();\n" +
        "        Set<Object> visited = new HashSet<>();\n" +
        "        LinkedHashMap<String,Object> varsCopy = new LinkedHashMap<>();\n" +
        "        for (Map.Entry<String,Object> e : vars.entrySet()) {\n" +
        "            varsCopy.put(e.getKey(), deepSerialize(e.getValue(), visited));\n" +
        "        }\n" +
        "        int done = 0;\n" +
        "        List<String> keys = new ArrayList<>(heapObjects.keySet());\n" +
        "        while (done < keys.size()) {\n" +
        "            String ref = keys.get(done);\n" +
        "            Object obj = null;\n" +
        "            for (Object[] pair : objRefList) { if (pair[1].equals(ref)) { obj = pair[0]; break; } }\n" +
        "            if (obj != null) serializeFields(ref, obj, new HashSet<>());\n" +
        "            done++;\n" +
        "            keys = new ArrayList<>(heapObjects.keySet());\n" +
        "        }\n" +
        "        attachCallStack(varsCopy);\n" +
        "        record.put(\"variables\", varsCopy);\n" +
        "        if (!heapObjects.isEmpty()) {\n" +
        "            record.put(\"heap\", new LinkedHashMap<>(heapObjects));\n" +
        "        }\n" +
        "        if (capturedOutput != null) {\n" +
        "            String outStr = capturedOutput.toString();\n" +
        "            int pos = outStr.length();\n" +
        "            if (pos > lastOutputPos) {\n" +
        "                String raw = outStr.substring(lastOutputPos);\n" +
        "                record.put(\"output\", raw.replace(\"\\r\\n\", \"\\n\"));\n" +
        "                lastOutputPos = pos;\n" +
        "            }\n" +
        "        }\n" +
        "        steps.add(record);\n" +
        "    }\n" +
        "    public static boolean recordCondition(boolean cond, int step, int line, Map<String,?> vars) {\n" +
        "        if (disabled) return cond;\n" +
        "        LinkedHashMap<String,Object> map = new LinkedHashMap<>();\n" +
        "        for (Map.Entry<String,?> e : vars.entrySet()) { map.put(e.getKey(), e.getValue()); }\n" +
        "        record(step, line, map);\n" +
        "        return cond;\n" +
        "    }\n" +
        "    public static void setOutputStream(ByteArrayOutputStream out) { capturedOutput = out; lastOutputPos = 0; }\n" +
        "    public static void reset() {\n" +
        "        steps.clear();\n" +
        "        disabled = false;\n" +
        "        lastOutputPos = 0;\n" +
        "        callStack.clear();\n" +
        "        frameCounter = 0;\n" +
        "        heapObjects.clear();\n" +
        "        heapCounter = 0;\n" +
        "        objRefList.clear();\n" +
        "    }\n" +
        "    public static void disable() { disabled = true; }\n" +
        "    public static Map<String,Object> buildMap(Object... pairs) {\n" +
        "        LinkedHashMap<String,Object> m = new LinkedHashMap<>();\n" +
        "        for (int i = 0; i < pairs.length; i += 2) { m.put((String) pairs[i], pairs[i + 1]); }\n" +
        "        return m;\n" +
        "    }\n" +
        "    public static List<Map<String,Object>> getSteps() { return steps; }\n" +
        "}\n";


    //当前端发 POST http://localhost:8080/api/run 时，Spring Boot 调用这个方法。
    @PostMapping("/run")
    public RunResponse run(@RequestBody RunRequest request){
        //① 拿到用户代码 + 生成 runId（UUID）
        String userCode = request.getCode();
        if (userCode == null || userCode.isBlank()) {
            return RunResponse.fail("代码不能为空");
        }
        String runId = UUID.randomUUID().toString();
       
        try{
            // ② AST 黑名单扫描（插桩前拦截，最先执行）
            SandboxValidator.Result validation = SandboxValidator.validate(userCode);
            if (!validation.allowed) {
                return RunResponse.fail(validation.reason);
            }

            // ③ 从代码里提取类名
            String className = extractClassName(userCode);

            // ④ 插桩 ast instrumentation
            String instrumentedCode = instrumenter.instrument(userCode);

            // ⑤ 去掉 package 声明，使 TraceEngine 和用户类在同一默认包
            instrumentedCode = removePackageDeclaration(instrumentedCode);

            //inmemorycompile
            Map<String , String> sources = new LinkedHashMap<>();

            //放入traceEngine的源码
            sources.put("TraceEngine" , TRACE_ENGINE_SOURCE);
            //放入当前类和插桩后的usercode
            sources.put( className , instrumentedCode);

            // ⑥ 编译（TraceEngine + 用户代码一起）
            Map<String , byte[]> bytecodeMap = compiler.compile(sources);

            // ⑦ ClassLoader 加载字节码
            InMemoryClassLoader classLoader = new InMemoryClassLoader(bytecodeMap);
            Class<?> traceEngineClass = classLoader.loadClass("TraceEngine");
            Class<?> userClass = classLoader.loadClass(className);

            // ⑧ 反射调用 TraceEngine.reset() 清空记录
            traceEngineClass.getMethod("reset").invoke(null);

            // ⑨ 安装运行时安全沙箱 + 重定向 System.out 捕获控制台输出
            SecurityManager originalSM = System.getSecurityManager();
            System.setSecurityManager(new SafeSecurityManager());
            PrintStream originalOut = System.out;
            ByteArrayOutputStream capturedOut = new ByteArrayOutputStream();
            System.setOut(new PrintStream(capturedOut, true));
            traceEngineClass.getMethod("setOutputStream", ByteArrayOutputStream.class).invoke(null, capturedOut);
            String userOutput = "";
            try {
                ExecutorService executor = Executors.newSingleThreadExecutor();
                try {
                    Future<?> future = executor.submit(() -> {
                        try {
                            Method main = userClass.getMethod("main", String[].class);
                            main.invoke(null, (Object) new String[0]);
                        } catch (Exception e) {
                            throw new RuntimeException(e);
                        }
                    });

                    try {
                        future.get(5, TimeUnit.SECONDS);
                    } catch (TimeoutException e) {
                        traceEngineClass.getMethod("disable").invoke(null);
                        future.cancel(true);
                        return RunResponse.fail("运行超时（超过5秒）");
                    }
                } finally {
                    executor.shutdownNow();
                }
            } finally {
                System.out.flush(); // 确保 StreamEncoder 缓冲区全部写入 capturedOut
                System.setOut(originalOut);
                userOutput = capturedOut.toString().replace("\r\n", "\n");
                System.setSecurityManager(originalSM);
            }


            // ⑩ 反射调用 TraceEngine.getSteps() 取步骤
            @SuppressWarnings("unchecked")
            List<Map<String , Object>> steps = (List<Map<String , Object>>)
                traceEngineClass.getMethod("getSteps")
                                    .invoke(null);

            // ⑪ 返回 RunResponse.ok(runId, steps, output)
            return RunResponse.ok(runId, steps, userOutput);

        }catch(Exception e){
            // 解包 InvocationTargetException 以获取根因
            Throwable root = e;
            while (root.getCause() != null && root.getCause() != root) {
                root = root.getCause();
            }
            return RunResponse.fail(root.getClass().getSimpleName() + ": " + root.getMessage());
        }
    }

    //辅助方法区域

    private String extractClassName(String code){
        try {
            CompilationUnit cu = StaticJavaParser.parse(code);
            return cu.getType(0).getNameAsString();
        } catch (Exception e) {
            if (code.matches("(?s).*\\bpublic\\s+class\\s+\\w+.*")) {
                // 有 public class 但解析失败 → 语法错误，只取第一行关键信息
                String msg = e.getMessage();
                if (msg != null) {
                    int cut = msg.indexOf("Problem stacktrace");
                    if (cut < 0) cut = msg.indexOf("\n\tat ");
                    if (cut < 0) cut = msg.indexOf("\n\n");
                    if (cut > 0) msg = msg.substring(0, cut).trim();
                    // 去掉 "(line X,col Y) Parse error. Found ...expected one of..." 中冗余的 expected 列表
                    int exp = msg.indexOf("expected");
                    if (exp > 0) msg = msg.substring(0, exp).trim();
                    // 去掉开头的 "Parse error. " 冗余前缀
                    msg = msg.replaceAll("^(Parse error\\.\\s*)+", "");
                }
                throw new RuntimeException("代码语法错误：" + (msg != null ? msg : "解析失败"));
            }
            throw new RuntimeException("代码格式错误：缺少 public class 声明，请确保代码包含完整的类定义");
        }
    }

    private String removePackageDeclaration(String code){
        CompilationUnit cu = StaticJavaParser.parse(code);
        // 如果没有 package 声明，直接返回原始代码
        // 避免 cu.toString() 对多类型声明的重新排序破坏编译
        if (cu.getPackageDeclaration().isEmpty()) {
            return code;
        }
        cu.getPackageDeclaration().get().remove();
        return cu.toString();
    }


    //内部ClassLoader类
    private static class InMemoryClassLoader extends ClassLoader {
        private final Map<String ,byte[]> classData;

        InMemoryClassLoader(Map<String , byte[]> classData){
            this.classData = classData;
        }

        @Override
        protected Class<?> findClass(String name) throws ClassNotFoundException{
            byte[] bytes = classData.get(name);
            if(bytes != null){
                return defineClass(name , bytes , 0 , bytes.length);
            }
            throw  new ClassNotFoundException(name);
        }

    }





}
