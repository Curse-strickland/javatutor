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
        "    private static LinkedHashMap<String,Map<String,Object>> heapObjects = new LinkedHashMap<>();\n" +
        "    private static List<Object> deepCopyArray(Object arr) {\n" +
        "        int len = Array.getLength(arr);\n" +
        "        List<Object> copy = new ArrayList<>(len);\n" +
        "        for (int i = 0; i < len; i++) {\n" +
        "            Object elem = Array.get(arr, i);\n" +
        "            if (elem != null && elem.getClass().isArray()) {\n" +
        "                copy.add(deepCopyArray(elem));\n" +
        "            } else if (elem != null && isComplexObject(elem)) {\n" +
        "                copy.add(ensureHeapObject(\"nested[\" + i + \"]\", elem));\n" +
        "            } else { copy.add(elem); }\n" +
        "        }\n" +
        "        return copy;\n" +
        "    }\n" +
        "    private static boolean isComplexObject(Object v) {\n" +
        "        if (v == null) return false;\n" +
        "        Class<?> cls = v.getClass();\n" +
        "        return !cls.isPrimitive() && !cls.isArray() && cls != String.class && !Number.class.isAssignableFrom(cls) && cls != Boolean.class && cls != Character.class;\n" +
        "    }\n" +
        "    private static String ensureHeapObject(String name, Object obj) {\n" +
        "        if (heapObjects.containsKey(name)) {\n" +
        "            if (heapObjects.get(name).get(\"_objRef\") == obj) return (String) heapObjects.get(name).get(\"id\");\n" +
        "            String existingId = findHeapIdByRef(obj);\n" +
        "            if (existingId != null) return existingId;\n" +
        "            heapObjects.remove(name);\n" +
        "            return allocObject(name, obj);\n" +
        "        }\n" +
        "        String existingId = findHeapIdByRef(obj);\n" +
        "        if (existingId != null) return existingId;\n" +
        "        return allocObject(name, obj);\n" +
        "    }\n" +
        "    private static String findHeapIdByRef(Object obj) {\n" +
        "        for (Map.Entry<String,Map<String,Object>> e : heapObjects.entrySet()) {\n" +
        "            if (e.getValue().get(\"_objRef\") == obj) return (String) e.getValue().get(\"id\");\n" +
        "        }\n" +
        "        return null;\n" +
        "    }\n" +
        "    public static String allocArray(String name, int length) {\n" +
        "        if (disabled) return \"0x0000\";\n" +
        "        String id = \"0x\" + Integer.toHexString((Math.abs(name.hashCode()) + heapObjects.size() + 1) & 0xFFFF).toUpperCase();\n" +
        "        LinkedHashMap<String,Object> obj = new LinkedHashMap<>();\n" +
        "        obj.put(\"type\", \"int[\" + length + \"]\");\n" +
        "        obj.put(\"length\", length);\n" +
        "        obj.put(\"id\", id);\n" +
        "        obj.put(\"name\", name);\n" +
        "        obj.put(\"slots\", new ArrayList<>());\n" +
        "        heapObjects.put(name, obj);\n" +
        "        return id;\n" +
        "    }\n" +
        "    public static String allocObject(String name, Object obj) {\n" +
        "        if (disabled) return \"0x0000\";\n" +
        "        String id = \"0x\" + Integer.toHexString((Math.abs(name.hashCode()) + heapObjects.size() + 1) & 0xFFFF).toUpperCase();\n" +
        "        LinkedHashMap<String,Object> heapObj = new LinkedHashMap<>();\n" +
        "        heapObj.put(\"type\", obj.getClass().getSimpleName());\n" +
        "        heapObj.put(\"id\", id);\n" +
        "        heapObj.put(\"name\", name);\n" +
        "        heapObj.put(\"fields\", new LinkedHashMap<>());\n" +
        "        heapObj.put(\"_objRef\", obj);\n" +
        "        heapObjects.put(name, heapObj);\n" +
        "        return id;\n" +
        "    }\n" +
        "    private static void updateHeapSlots(String name, List<Object> arrayCopy) {\n" +
        "        if (!heapObjects.containsKey(name)) { allocArray(name, arrayCopy.size()); }\n" +
        "        Map<String,Object> obj = heapObjects.get(name);\n" +
        "        List<Map<String,Object>> slots = new ArrayList<>();\n" +
        "        for (int i = 0; i < arrayCopy.size(); i++) {\n" +
        "            LinkedHashMap<String,Object> slot = new LinkedHashMap<>();\n" +
        "            slot.put(\"index\", i);\n" +
        "            slot.put(\"value\", arrayCopy.get(i));\n" +
        "            slots.add(slot);\n" +
        "        }\n" +
        "        obj.put(\"slots\", slots);\n" +
        "    }\n" +
        "    private static void updateHeapFields(String name, Object obj) {\n" +
        "        if (!heapObjects.containsKey(name)) allocObject(name, obj);\n" +
        "        Map<String,Object> heapObj = heapObjects.get(name);\n" +
        "        LinkedHashMap<String,Object> fields = new LinkedHashMap<>();\n" +
        "        Class<?> cls = obj.getClass();\n" +
        "        while (cls != null && cls != Object.class) {\n" +
        "            for (Field f : cls.getDeclaredFields()) {\n" +
        "                if (Modifier.isStatic(f.getModifiers())) continue;\n" +
        "                f.setAccessible(true);\n" +
        "                try {\n" +
        "                    Object fv = f.get(obj);\n" +
        "                    if (fv == null) { fields.put(f.getName(), null); }\n" +
        "                    else if (fv.getClass().isArray()) {\n" +
        "                        String arrName = name + \".\" + f.getName();\n" +
        "                        if (!heapObjects.containsKey(arrName)) allocArray(arrName, Array.getLength(fv));\n" +
        "                        List<Object> arrCopy = new ArrayList<>();\n" +
        "                        for (int i = 0; i < Array.getLength(fv); i++) arrCopy.add(Array.get(fv, i));\n" +
        "                        updateHeapSlots(arrName, arrCopy);\n" +
        "                        LinkedHashMap<String,Object> ref = new LinkedHashMap<>();\n" +
        "                        ref.put(\"ref\", heapObjects.get(arrName).get(\"id\"));\n" +
        "                        fields.put(f.getName(), ref);\n" +
        "                    } else if (isComplexObject(fv)) {\n" +
        "                        String existingId = findHeapIdByRef(fv);\n" +
        "                        if (existingId != null) {\n" +
        "                            LinkedHashMap<String,Object> ref = new LinkedHashMap<>();\n" +
        "                            ref.put(\"ref\", existingId);\n" +
        "                            fields.put(f.getName(), ref);\n" +
        "                        } else {\n" +
        "                            String refName = name + \".\" + f.getName();\n" +
        "                            ensureHeapObject(refName, fv);\n" +
        "                            updateHeapFields(refName, fv);\n" +
        "                            LinkedHashMap<String,Object> ref = new LinkedHashMap<>();\n" +
        "                            ref.put(\"ref\", heapObjects.get(refName).get(\"id\"));\n" +
        "                            fields.put(f.getName(), ref);\n" +
        "                        }\n" +
        "                    } else { fields.put(f.getName(), fv); }\n" +
        "                } catch (Exception ex) { fields.put(f.getName(), \"<error>\"); }\n" +
        "            }\n" +
        "            cls = cls.getSuperclass();\n" +
        "        }\n" +
        "        heapObj.put(\"fields\", fields);\n" +
        "    }\n" +
        "    private static LinkedHashMap<String,Object> deepCopyHeap() {\n" +
        "        LinkedHashMap<String,Object> copy = new LinkedHashMap<>();\n" +
        "        for (Map.Entry<String,Map<String,Object>> e : heapObjects.entrySet()) {\n" +
        "            LinkedHashMap<String,Object> shallow = new LinkedHashMap<>(e.getValue());\n" +
        "            shallow.remove(\"_objRef\");\n" +
        "            copy.put(e.getKey(), shallow);\n" +
        "        }\n" +
        "        return copy;\n" +
        "    }\n" +
        "    public static void record(int step, int line, Map<String,Object> vars) {\n" +
        "        if (disabled) return;\n" +
        "        LinkedHashMap<String,Object> record = new LinkedHashMap<>();\n" +
        "        record.put(\"step\", step);\n" +
        "        record.put(\"line\", line);\n" +
        "        LinkedHashMap<String,Object> varsCopy = new LinkedHashMap<>();\n" +
        "        for (Map.Entry<String,Object> e : vars.entrySet()) {\n" +
        "            Object v = e.getValue();\n" +
        "            if (v == null) { varsCopy.put(e.getKey(), null); }\n" +
        "            else if (v.getClass().isArray()) {\n" +
        "                int len = Array.getLength(v);\n" +
        "                List<Object> copy = new ArrayList<>(len);\n" +
        "                for (int i = 0; i < len; i++) {\n" +
        "                    Object elem = Array.get(v, i);\n" +
        "                    if (elem != null && isComplexObject(elem)) {\n" +
        "                        String name = e.getKey() + \"[\" + i + \"]\";\n" +
        "                        boolean existed = heapObjects.containsKey(name);\n" +
        "                        String elemId = ensureHeapObject(name, elem);\n" +
        "                        copy.add(elemId);\n" +
        "                        if (heapObjects.containsKey(name) && heapObjects.get(name).get(\"_objRef\") == elem) {\n" +
        "                            updateHeapFields(name, elem);\n" +
        "                        } else if (!existed) {\n" +
        "                            updateHeapFields(name, elem);\n" +
        "                        }\n" +
        "                    } else if (elem != null && elem.getClass().isArray()) {\n" +
        "                        copy.add(deepCopyArray(elem));\n" +
        "                    } else { copy.add(elem); }\n" +
        "                }\n" +
        "                varsCopy.put(e.getKey(), copy);\n" +
        "                updateHeapSlots(e.getKey(), copy);\n" +
        "            } else if (isComplexObject(v)) {\n" +
        "                String id = ensureHeapObject(e.getKey(), v);\n" +
        "                varsCopy.put(e.getKey(), id);\n" +
        "                if (heapObjects.containsKey(e.getKey())) {\n" +
        "                    updateHeapFields(e.getKey(), v);\n" +
        "                }\n" +
        "            } else { varsCopy.put(e.getKey(), v); }\n" +
        "        }\n" +
        "        record.put(\"variables\", varsCopy);\n" +
        "        record.put(\"heap\", deepCopyHeap());\n" +
        "        LinkedHashMap<String,Object> stackFrame = new LinkedHashMap<>();\n" +
        "        stackFrame.put(\"method\", \"main\");\n" +
        "        stackFrame.put(\"locals\", new LinkedHashMap<>(varsCopy));\n" +
        "        record.put(\"stackFrame\", stackFrame);\n" +
        "        if (capturedOutput != null) {\n" +
        "            String outStr = capturedOutput.toString();\n" +
        "            int pos = outStr.length();\n" +
        "            if (pos > lastOutputPos) { record.put(\"output\", outStr.substring(lastOutputPos).replace(\"\\r\\n\",\"\\n\")); lastOutputPos = pos; }\n" +
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
        "    public static void reset() { steps.clear(); heapObjects.clear(); disabled = false; lastOutputPos = 0; }\n" +
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
        cu.getPackageDeclaration().ifPresent(pkg -> pkg.remove()); //不出意外的又是用到optional
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
