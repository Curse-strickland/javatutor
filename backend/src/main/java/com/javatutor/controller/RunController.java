package com.javatutor.controller;

import com.javatutor.compiler.InMemoryCompiler;
import com.javatutor.instrumentation.Instrumenter;
import com.javatutor.model.RunRequest;
import com.javatutor.model.RunResponse;
import com.github.javaparser.StaticJavaParser;
import com.github.javaparser.ast.CompilationUnit;
import org.springframework.web.bind.annotation.*;
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
        "public class TraceEngine {\n" +
        "    private static List<Map<String,Object>> steps = new ArrayList<>();\n" +
        "    private static Object deepCopyValue(Object v) {\n" +
        "        if (v == null) return null;\n" +
        "        Class<?> cls = v.getClass();\n" +
        "        if (cls.isArray()) {\n" +
        "            int len = Array.getLength(v);\n" +
        "            List<Object> copy = new ArrayList<>(len);\n" +
        "            for (int i = 0; i < len; i++) { copy.add(Array.get(v, i)); }\n" +
        "            return copy;\n" +
        "        }\n" +
        "        return v;\n" +
        "    }\n" +
        "    public static void record(int step, int line, Map<String,Object> vars) {\n" +
        "        LinkedHashMap<String,Object> record = new LinkedHashMap<>();\n" +
        "        record.put(\"step\", step);\n" +
        "        record.put(\"line\", line);\n" +
        "        LinkedHashMap<String,Object> varsCopy = new LinkedHashMap<>();\n" +
        "        for (Map.Entry<String,Object> e : vars.entrySet()) {\n" +
        "            varsCopy.put(e.getKey(), deepCopyValue(e.getValue()));\n" +
        "        }\n" +
        "        record.put(\"variables\", varsCopy);\n" +
        "        steps.add(record);\n" +
        "    }\n" +
        "    public static boolean recordCondition(boolean cond, int step, int line, Map<String,?> vars) {\n" +
        "        LinkedHashMap<String,Object> map = new LinkedHashMap<>();\n" +
        "        for (Map.Entry<String,?> e : vars.entrySet()) { map.put(e.getKey(), e.getValue()); }\n" +
        "        record(step, line, map);\n" +
        "        return cond;\n" +
        "    }\n" +
        "    public static void reset() { steps.clear(); }\n" +
        "    public static List<Map<String,Object>> getSteps() { return steps; }\n" +
        "}\n";


    //当前端发 POST http://localhost:8080/api/run 时，Spring Boot 调用这个方法。
    @PostMapping("/run")
    public RunResponse run(@RequestBody RunRequest request){
        //① 拿到用户代码 + 生成 runId（UUID）
        String userCode = request.getCode();
        String runId = UUID.randomUUID().toString();
       
        try{
            // ② 从代码里提取类名
            String className = extractClassName(userCode);

            // ③ 插桩 ast instrumentation
            String instrumentedCode = instrumenter.instrument(userCode);

            // ④ 去掉 package
            instrumentedCode = removePackageDeclaration(instrumentedCode);

            //inmemorycompile
            Map<String , String> sources = new LinkedHashMap<>();

            //放入traceEngine的源码
            sources.put("TraceEngine" , TRACE_ENGINE_SOURCE);
            //放入当前类和插桩后的usercode
            sources.put( className , instrumentedCode);

            // ⑤ 编译（TraceEngine + 用户代码一起）
            Map<String , byte[]> bytecodeMap = compiler.compile(sources);

            // ⑥ ClassLoader 加载字节码
            InMemoryClassLoader classLoader = new InMemoryClassLoader(bytecodeMap);
            Class<?> traceEngineClass = classLoader.loadClass("TraceEngine");
            Class<?> userClass = classLoader.loadClass(className);

            // ⑦ 反射调用 TraceEngine.reset() 清空记录

            traceEngineClass.getMethod("reset").invoke(null);

            // ⑧ 反射调用 UserCode.main() → 新线程 + 5秒超时
            // ╔══════════════════════════════════════════════════════════╗
            // ║  🔒 [占位] 安全沙箱 — 待 @后端同学 接入                    ║
            // ║  当前：单线程 + 5秒超时（基础防护）                       ║
            // ║  待加：SecurityManager / 文件访问限制 / 网络隔离 /        ║
            // ║        反射黑名单 / 内存限制 等                           ║
            // ╚══════════════════════════════════════════════════════════╝

            //新线程
            ExecutorService executor = Executors.newSingleThreadExecutor();
            //执行用户代码，超时报错
            Future<?> future = executor.submit(() -> {
                //查找main方法
                try{
                    Method main = userClass.getMethod("main" , String[].class);
                    main.invoke(null , (Object) new String[0]);
                } catch (Exception e){
                    throw new RuntimeException(e);
                }
            });

            try{
                future.get(5 , TimeUnit.SECONDS);
            }catch (TimeoutException e){
                future.cancel(true);
                executor.shutdownNow();
                return RunResponse.fail("Runtime Error");
            }
            executor.shutdownNow();


            // ⑨ 反射调用 TraceEngine.getSteps() 取步骤
            @SuppressWarnings("unchecked")
            List<Map<String , Object>> steps = (List<Map<String , Object>>) 
                traceEngineClass.getMethod("getSteps")
                                    .invoke(null);
            
            // ⑩ 返回 RunResponse.ok(runId, steps)
            return RunResponse.ok(runId, steps);

        }catch(Exception e){
            return RunResponse.fail(e.getMessage());
        }
    }

    //辅助方法区域

    private String extractClassName(String code){
        CompilationUnit cu = StaticJavaParser.parse(code);
        return cu.getType(0).getNameAsString();
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
