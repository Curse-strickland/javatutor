package com.javatutor.controller;

import com.javatutor.compiler.InMemoryCompiler;
import com.javatutor.instrumentation.Instrumenter;
import com.javatutor.sandbox.SandboxValidator;
import com.javatutor.sandbox.SafeSecurityManager;
import com.javatutor.model.RunRequest;
import com.javatutor.model.RunResponse;
import com.github.javaparser.StaticJavaParser;
import com.github.javaparser.ast.CompilationUnit;
import com.github.javaparser.ast.body.MethodDeclaration;
import com.github.javaparser.ast.body.Parameter;
import org.springframework.web.bind.annotation.*;
import java.io.ByteArrayOutputStream;
import java.io.PrintStream;
import java.util.*;
import java.util.concurrent.*;
import java.lang.reflect.Method;
import java.util.regex.Pattern;
import java.util.regex.Matcher;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")

public class RunController {
    private final Instrumenter instrumenter = new Instrumenter();
    private final InMemoryCompiler compiler = new InMemoryCompiler();

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
        "    private static List<String> callStack = new ArrayList<>();\n" +
        "    private static List<LinkedHashMap<String,Object>> frameLocals = new ArrayList<>();\n" +
        "    private static List<LinkedHashMap<String,Object>> frameArgs = new ArrayList<>();\n" +
        "    public static String pushFrame(String name) { callStack.add(name); frameLocals.add(new LinkedHashMap<>()); frameArgs.add(new LinkedHashMap<>()); return name; }\n" +
        "    public static String pushFrame(String name, Object... pairs) {\n" +
        "        callStack.add(name);\n" +
        "        frameLocals.add(new LinkedHashMap<>());\n" +
        "        LinkedHashMap<String,Object> args = new LinkedHashMap<>();\n" +
        "        for (int i = 0; i < pairs.length; i += 2) {\n" +
        "            String pn = (String)pairs[i];\n" +
        "            Object pv = pairs[i+1];\n" +
        "            if (pv != null && isComplexObject(pv)) {\n" +
        "                String eid = findHeapIdByRef(pv);\n" +
        "                args.put(pn, eid != null ? eid : ensureHeapObject(pn, pv));\n" +
        "            } else if (pv != null && pv.getClass().isArray()) {\n" +
        "                args.put(pn, pn);\n" +
        "            } else if (pv != null && pv instanceof java.util.Collection) {\n" +
        "                args.put(pn, pn);\n" +
        "            } else { args.put(pn, pv); }\n" +
        "        }\n" +
        "        frameArgs.add(args);\n" +
        "        return name;\n" +
        "    }\n" +
        "    public static String popFrame() { if (callStack.isEmpty()) return \"???\"; frameLocals.remove(frameLocals.size()-1); frameArgs.remove(frameArgs.size()-1); return callStack.remove(callStack.size()-1); }\n" +
        "    private static List<Object> deepCopyArray(Object arr) {\n" +
        "        int len = Array.getLength(arr);\n" +
        "        if (len > 200) {\n" +
        "            List<Object> copy = new ArrayList<>(1);\n" +
        "            copy.add(\"[\" + arr.getClass().getComponentType().getSimpleName() + \"[\" + len + \"]]\");\n" +
        "            return copy;\n" +
        "        }\n" +
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
        "        if (cls.isPrimitive() || cls.isArray()) return false;\n" +
        "        if (cls == String.class || Number.class.isAssignableFrom(cls) || cls == Boolean.class || cls == Character.class) return false;\n" +
        "        String pkg = cls.getPackageName();\n" +
        "        if (pkg.startsWith(\"java.\") || pkg.startsWith(\"jdk.\") || pkg.startsWith(\"sun.\")) return false;\n" +
        "        return true;\n" +
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
        "    private static String findHeapNameByRef(Object obj) {\n" +
        "        for (Map.Entry<String,Map<String,Object>> e : heapObjects.entrySet()) {\n" +
        "            if (e.getValue().get(\"_objRef\") == obj) return e.getKey();\n" +
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
        "        obj.put(\"category\", \"array\");\n" +
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
        "        heapObj.put(\"category\", categorize(obj));\n" +
        "        heapObj.put(\"_objRef\", obj);\n" +
        "        heapObjects.put(name, heapObj);\n" +
        "        return id;\n" +
        "    }\n" +
        "    private static String categorize(Object obj) {\n" +
        "        if (obj == null) return \"object\";\n" +
        "        Class<?> cls = obj.getClass();\n" +
        "        if (cls.isArray()) return \"array\";\n" +
        "        if (java.util.Map.class.isAssignableFrom(cls)) return \"map\";\n" +
        "        if (java.util.Set.class.isAssignableFrom(cls)) return \"set\";\n" +
        "        String n = cls.getSimpleName();\n" +
        "        if (n.equals(\"ArrayList\") || n.equals(\"Vector\")) return \"list\";\n" +
        "        if (n.equals(\"LinkedList\")) return \"linkedlist\";\n" +
        "        if (n.equals(\"Stack\") || n.equals(\"ArrayDeque\")) return \"stack\";\n" +
        "        if (java.util.Collection.class.isAssignableFrom(cls)) return \"collection\";\n" +
        "        return \"object\";\n" +
        "    }\n" +
        "    private static void ensureHeapEntry(String name, Object obj) {\n" +
        "        if (heapObjects.containsKey(name)) {\n" +
        "            if (!heapObjects.get(name).containsKey(\"category\")) {\n" +
        "                heapObjects.get(name).put(\"category\", categorize(obj));\n" +
        "            }\n" +
        "            return;\n" +
        "        }\n" +
        "        allocObject(name, obj);\n" +
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
        "        updateHeapFields(name, obj, new java.util.HashSet<>());\n" +
        "    }\n" +
        "    private static void updateHeapFields(String name, Object obj, java.util.Set<Object> visited) {\n" +
        "        if (visited.contains(obj)) return;\n" +
        "        visited.add(obj);\n" +
        "        if (!heapObjects.containsKey(name)) allocObject(name, obj);\n" +
        "        Map<String,Object> heapObj = heapObjects.get(name);\n" +
        "        if (heapObj.get(\"_objRef\") != obj) { visited.remove(obj); return; }\n" +
        "        LinkedHashMap<String,Object> fields = new LinkedHashMap<>();\n" +
        "        Class<?> cls = obj.getClass();\n" +
        "        while (cls != null && cls != Object.class) {\n" +
        "            for (Field f : cls.getDeclaredFields()) {\n" +
        "                if (Modifier.isStatic(f.getModifiers())) continue;\n" +
        "                try {\n" +
        "                    f.setAccessible(true);\n" +
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
        "                            for (Map.Entry<String,Map<String,Object>> he : heapObjects.entrySet()) {\n" +
        "                                if (he.getValue().get(\"_objRef\") == fv) {\n" +
        "                                    updateHeapFields(he.getKey(), fv, visited);\n" +
        "                                    break;\n" +
        "                                }\n" +
        "                            }\n" +
        "                        } else {\n" +
        "                            String refName = name + \".\" + f.getName();\n" +
        "                            ensureHeapObject(refName, fv);\n" +
        "                            updateHeapFields(refName, fv, visited);\n" +
        "                        }\n" +
        "                        String refId = findHeapIdByRef(fv);\n" +
        "                        LinkedHashMap<String,Object> ref = new LinkedHashMap<>();\n" +
        "                        ref.put(\"ref\", refId != null ? refId : \"0x????\");\n" +
        "                        fields.put(f.getName(), ref);\n" +
        "                    } else { fields.put(f.getName(), fv); }\n" +
        "                } catch (Exception ex) { fields.put(f.getName(), \"<error>\"); }\n" +
        "            }\n" +
        "            cls = cls.getSuperclass();\n" +
        "        }\n" +
        "        heapObj.put(\"fields\", fields);\n" +
        "        visited.remove(obj);\n" +
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
        "                if (len > 200) {\n" +
        "                    varsCopy.put(e.getKey(), \"[\" + v.getClass().getComponentType().getSimpleName() + \"[\" + len + \"]]\");\n" +
        "                } else {\n" +
        "                    List<Object> copy = new ArrayList<>(len);\n" +
        "                    for (int i = 0; i < len; i++) {\n" +
        "                        Object elem = Array.get(v, i);\n" +
        "                        if (elem != null && isComplexObject(elem)) {\n" +
        "                            String name = e.getKey() + \"[\" + i + \"]\";\n" +
        "                            String elemId = ensureHeapObject(name, elem);\n" +
        "                            copy.add(elemId);\n" +
        "                            if (heapObjects.containsKey(name) && heapObjects.get(name).get(\"_objRef\") == elem) {\n" +
        "                                updateHeapFields(name, elem);\n" +
        "                            }\n" +
        "                        } else if (elem != null && elem.getClass().isArray()) {\n" +
        "                            copy.add(deepCopyArray(elem));\n" +
        "                        } else { copy.add(elem); }\n" +
        "                    }\n" +
        "                    varsCopy.put(e.getKey(), copy);\n" +
        "                    updateHeapSlots(e.getKey(), copy);\n" +
        "                }\n" +
        "            } else if (isComplexObject(v)) {\n" +
        "                String id = ensureHeapObject(e.getKey(), v);\n" +
        "                varsCopy.put(e.getKey(), id);\n" +
        "                if (heapObjects.containsKey(e.getKey())) {\n" +
        "                    updateHeapFields(e.getKey(), v);\n" +
        "                } else {\n" +
        "                    String existingName = findHeapNameByRef(v);\n" +
        "                    if (existingName != null) {\n" +
        "                        updateHeapFields(existingName, v);\n" +
        "                    }\n" +
        "                }\n" +
        "            } else if (v instanceof java.util.Collection<?>) {\n" +
        "                java.util.Collection<?> coll = (java.util.Collection<?>) v;\n" +
        "                ensureHeapEntry(e.getKey(), v);\n" +
        "                int size = coll.size();\n" +
        "                int displaySize = size > 200 ? 200 : size;\n" +
        "                List<Object> copy = new ArrayList<>(displaySize + (size > 200 ? 1 : 0));\n" +
        "                int count = 0;\n" +
        "                for (Object elem : coll) { if (count >= displaySize) break; copy.add(elem); count++; }\n" +
        "                if (size > 200) copy.add(\"...(共\" + size + \"个元素)\");\n" +
        "                varsCopy.put(e.getKey(), copy);\n" +
        "                updateHeapSlots(e.getKey(), copy);\n" +
        "            } else if (v instanceof java.util.Map<?,?>) {\n" +
        "                java.util.Map<?,?> map = (java.util.Map<?,?>) v;\n" +
        "                int size = map.size();\n" +
        "                int displaySize = size > 200 ? 200 : size;\n" +
        "                LinkedHashMap<String,Object> mapCopy = new LinkedHashMap<>();\n" +
        "                int count = 0;\n" +
        "                for (java.util.Map.Entry<?,?> entry : map.entrySet()) {\n" +
        "                    if (count >= displaySize) break;\n" +
        "                    mapCopy.put(String.valueOf(entry.getKey()), entry.getValue());\n" +
        "                    count++;\n" +
        "                }\n" +
        "                if (size > 200) mapCopy.put(\"...(共\" + size + \"个键值对)\", null);\n" +
        "                varsCopy.put(e.getKey(), mapCopy);\n" +
        "            } else { varsCopy.put(e.getKey(), v); }\n" +
        "        }\n" +
        "        record.put(\"variables\", varsCopy);\n" +
        "        record.put(\"heap\", deepCopyHeap());\n" +
        "        if (!callStack.isEmpty()) {\n" +
        "            frameLocals.set(frameLocals.size()-1, new LinkedHashMap<>(varsCopy));\n" +
        "        }\n" +
        "        java.util.List<Map<String,Object>> stackFrames = new java.util.ArrayList<>();\n" +
        "        for (int i = 0; i < callStack.size(); i++) {\n" +
        "            LinkedHashMap<String,Object> frame = new LinkedHashMap<>();\n" +
        "            frame.put(\"method\", callStack.get(i));\n" +
        "            frame.put(\"locals\", new LinkedHashMap<>(frameLocals.get(i)));\n" +
        "            frame.put(\"args\", new LinkedHashMap<>(frameArgs.get(i)));\n" +
        "            stackFrames.add(frame);\n" +
        "        }\n" +
        "        record.put(\"stackFrames\", stackFrames);\n" +
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
        "    public static void reset() { steps.clear(); heapObjects.clear(); callStack.clear(); frameLocals.clear(); frameArgs.clear(); disabled = false; lastOutputPos = 0; }\n" +
        "    public static void disable() { disabled = true; }\n" +
        "    public static Map<String,Object> buildMap(Object... pairs) {\n" +
        "        LinkedHashMap<String,Object> m = new LinkedHashMap<>();\n" +
        "        for (int i = 0; i < pairs.length; i += 2) { m.put((String) pairs[i], pairs[i + 1]); }\n" +
        "        return m;\n" +
        "    }\n" +
        "    public static List<Map<String,Object>> getSteps() { return steps; }\n" +
        "}\n";


    @PostMapping("/run")
    public RunResponse run(@RequestBody RunRequest request){
        String userCode = request.getCode();
        if (userCode == null || userCode.isBlank()) return RunResponse.fail("代码不能为空");
        String runId = UUID.randomUUID().toString();
        boolean isTestMode = "test".equals(request.getMode());

        try{
            SandboxValidator.Result validation = SandboxValidator.validate(userCode);
            if (!validation.allowed) return RunResponse.fail(validation.reason);

            String className = extractClassName(userCode);
            String instrumentedCode, launcherCode = null, methodName = null, methodSignature = null;

            if (isTestMode) {
                MethodInfo methodInfo = findMethodInfo(userCode);
                methodName = methodInfo.name;
                methodSignature = buildSignature(methodInfo);
                launcherCode = generateLauncherClass(methodInfo, request.getTestCases());
                instrumentedCode = instrumenter.instrument(userCode);
                instrumentedCode = removePackageDeclaration(instrumentedCode);
                instrumentedCode = instrumentedCode.replaceFirst("import\\s+java\\.util\\.\\*;\\s*", "");
                instrumentedCode = "import java.util.*;\n" + instrumentedCode;
                launcherCode = removePackageDeclaration(launcherCode);
            } else {
                instrumentedCode = instrumenter.instrument(userCode);
                instrumentedCode = removePackageDeclaration(instrumentedCode);
            }

            Map<String,String> sources = new LinkedHashMap<>();
            sources.put("TraceEngine", TRACE_ENGINE_SOURCE);
            if (isTestMode) {
                for (Map.Entry<String,String> e : extractCommentedClasses(request.getCode()).entrySet())
                    sources.put(e.getKey(), e.getValue());
            }
            sources.put(className, instrumentedCode);
            if (launcherCode != null) sources.put("Launcher", launcherCode);

            Map<String,byte[]> bytecodeMap = compiler.compile(sources);
            InMemoryClassLoader classLoader = new InMemoryClassLoader(bytecodeMap);
            Class<?> traceEngineClass = classLoader.loadClass("TraceEngine");
            Class<?> entryClass = (launcherCode != null) ? classLoader.loadClass("Launcher") : classLoader.loadClass(className);
            traceEngineClass.getMethod("reset").invoke(null);

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
                        try { entryClass.getMethod("main", String[].class).invoke(null, (Object) new String[0]); }
                        catch (Exception ex) { throw new RuntimeException(ex); }
                    });
                    try { future.get(5, TimeUnit.SECONDS); }
                    catch (TimeoutException e) {
                        traceEngineClass.getMethod("disable").invoke(null);
                        future.cancel(true);
                        return RunResponse.fail("运行超时（超过5秒）");
                    }
                } finally { executor.shutdownNow(); }
            } finally {
                System.out.flush();
                System.setOut(originalOut);
                userOutput = capturedOut.toString().replace("\r\n", "\n");
                System.setSecurityManager(originalSM);
            }

            @SuppressWarnings("unchecked")
            List<Map<String,Object>> steps = (List<Map<String,Object>>)
                traceEngineClass.getMethod("getSteps").invoke(null);
            return RunResponse.ok(runId, steps, userOutput, methodName, methodSignature);

        } catch(Exception e){
            Throwable root = e;
            while (root.getCause() != null && root.getCause() != root) root = root.getCause();
            return RunResponse.fail(root.getClass().getSimpleName() + ": " + root.getMessage());
        }
    }

    private String extractClassName(String code){
        try {
            return StaticJavaParser.parse(code).getType(0).getNameAsString();
        } catch (Exception e) {
            if (code.matches("(?s).*\\bpublic\\s+class\\s+\\w+.*")) {
                String msg = e.getMessage();
                if (msg != null) {
                    int cut = msg.indexOf("Problem stacktrace");
                    if (cut < 0) cut = msg.indexOf("\n\tat ");
                    if (cut < 0) cut = msg.indexOf("\n\n");
                    if (cut > 0) msg = msg.substring(0, cut).trim();
                    int exp = msg.indexOf("expected");
                    if (exp > 0) msg = msg.substring(0, exp).trim();
                    msg = msg.replaceAll("^(Parse error\\.\\s*)+", "");
                }
                throw new RuntimeException("代码语法错误：" + (msg != null ? msg : "解析失败"));
            }
            throw new RuntimeException("代码格式错误：缺少 public class 声明");
        }
    }

    private String removePackageDeclaration(String code){
        CompilationUnit cu = StaticJavaParser.parse(code);
        cu.getPackageDeclaration().ifPresent(pkg -> pkg.remove());
        return cu.toString();
    }

    // ========== 测试模式辅助方法 ==========

    private String autoImportMissing(String code) {
        CompilationUnit cu = StaticJavaParser.parse(code);
        boolean hasUtil = cu.getImports().stream().anyMatch(i -> {
            String n = i.getNameAsString();
            return n.equals("java.util") || n.startsWith("java.util.");
        });
        if (!hasUtil) cu.addImport("java.util", false, true);
        return cu.toString();
    }

    private Map<String,String> extractCommentedClasses(String code) {
        Map<String,String> classes = new LinkedHashMap<>();
        Matcher m = Pattern.compile("/\\*.*?\\*/", Pattern.DOTALL).matcher(code);
        while (m.find()) {
            String body = m.group();
            body = body.substring(2, body.length() - 2).replaceAll("(?m)^\\s*\\*\\s?", "").trim();
            Matcher cm = Pattern.compile("public\\s+class\\s+(\\w+)").matcher(body);
            while (cm.find()) {
                String cn = cm.group(1);
                if (classes.containsKey(cn)) continue;
                int braceStart = body.indexOf('{', cm.start());
                if (braceStart < 0) continue;
                int depth = 1, pos = braceStart + 1;
                while (pos < body.length() && depth > 0) {
                    char c = body.charAt(pos);
                    if (c == '{') depth++; else if (c == '}') depth--;
                    pos++;
                }
                if (depth == 0) classes.put(cn, body.substring(cm.start(), pos).trim());
            }
        }
        return classes;
    }

    private MethodInfo findMethodInfo(String code) {
        CompilationUnit cu = StaticJavaParser.parse(code);
        if (cu.getTypes().isEmpty()) throw new RuntimeException("未找到类定义");
        var typeDecl = cu.getType(0).asClassOrInterfaceDeclaration();
        MethodDeclaration target = null;
        for (var m : typeDecl.getMembers()) {
            if (m.isMethodDeclaration()) {
                var md = m.asMethodDeclaration();
                if (!md.getNameAsString().equals(typeDecl.getNameAsString()) && md.isPublic())
                { target = md; break; }
            }
        }
        if (target == null)
            for (var m : typeDecl.getMembers())
                if (m.isMethodDeclaration() && !m.asMethodDeclaration().getNameAsString().equals(typeDecl.getNameAsString()))
                { target = m.asMethodDeclaration(); break; }
        if (target == null) throw new RuntimeException("Solution 类中未找到可调用的方法");
        MethodInfo info = new MethodInfo();
        info.name = target.getNameAsString();
        info.returnType = target.getType().asString();
        info.isStatic = target.isStatic();
        info.params = new ArrayList<>();
        for (Parameter p : target.getParameters()) {
            ParamInfo pi = new ParamInfo();
            pi.name = p.getNameAsString();
            pi.type = p.getType().asString();
            info.params.add(pi);
        }
        return info;
    }

    private String buildSignature(MethodInfo info) {
        StringBuilder sb = new StringBuilder();
        sb.append(info.returnType).append(" ").append(info.name).append("(");
        for (int i = 0; i < info.params.size(); i++) {
            if (i > 0) sb.append(", ");
            sb.append(info.params.get(i).type).append(" ").append(info.params.get(i).name);
        }
        return sb.append(")").toString();
    }

    private String generateLauncherClass(MethodInfo info, List<String> testCases) {
        StringBuilder sb = new StringBuilder();
        sb.append("import java.util.*;\npublic class Launcher {\n    public static void main(String[] args) {\n");
        List<String> tcl = testCases != null ? testCases : Collections.emptyList();
        for (int i = 0; i < info.params.size(); i++) {
            ParamInfo pi = info.params.get(i);
            String tc = i < tcl.size() ? tcl.get(i) : "";
            if ("TreeNode".equals(pi.type)) sb.append(generateTreeBuilder(i, tc));
            else if ("ListNode".equals(pi.type)) sb.append(generateListBuilder(i, tc));
            else sb.append("        ").append(pi.type).append(" p").append(i)
                   .append(" = ").append(generateValueExpr(pi.type, tc)).append(";\n");
        }
        sb.append("        ");
        if (!"void".equals(info.returnType)) sb.append(info.returnType).append(" result = ");
        sb.append(info.isStatic ? "Solution." : "new Solution().").append(info.name).append("(");
        for (int i = 0; i < info.params.size(); i++) {
            if (i > 0) sb.append(", ");
            sb.append("p").append(i);
        }
        sb.append(");\n");
        if (!"void".equals(info.returnType)) {
            if (info.returnType.endsWith("[]")) {
                int dims = countArrayDimensions(info.returnType);
                sb.append("        System.out.println(\"Result: \" + java.util.Arrays.")
                  .append(dims == 1 ? "toString" : "deepToString").append("(result));\n");
            } else sb.append("        System.out.println(\"Result: \" + result);\n");
        }
        return sb.append("    }\n}\n").toString();
    }

    private String generateValueExpr(String type, String testCase) {
        String tc = testCase != null ? testCase.trim() : "";
        if (tc.isEmpty()) return defaultValue(type);
        if (type.endsWith("[]")) {
            int typeDepth = countArrayDimensions(type), tcDepth = countBracketDepth(tc);
            if (tcDepth != typeDepth) throw new RuntimeException(
                "用例维度不匹配：参数类型 " + type + " 是 " + typeDepth + " 维数组，但用例 "
                + truncate(tc, 40) + " 是 " + tcDepth + " 维。"
                + (tcDepth > typeDepth ? "请减少嵌套层数。" : "请增加嵌套层数。"));
            return "new " + type + " " + convertArrayLiteral(tc);
        }
        if (type.equals("List") || type.startsWith("List<")) {
            String inner = convertArrayLiteral(tc);
            if (inner.startsWith("{") && inner.endsWith("}")) inner = inner.substring(1, inner.length()-1);
            return "Arrays.asList(" + inner + ")";
        }
        if (type.equals("String") || type.equals("java.lang.String"))
            return tc.startsWith("\"") && tc.endsWith("\"") ? tc : "\"" + tc + "\"";
        if (type.equals("int") || type.equals("Integer") || type.equals("long") || type.equals("Long")
            || type.equals("double") || type.equals("Double") || type.equals("float") || type.equals("Float")
            || type.equals("short") || type.equals("Short") || type.equals("byte") || type.equals("Byte")) return tc;
        if (type.equals("boolean") || type.equals("Boolean")) return tc;
        if (type.equals("char") || type.equals("Character"))
            return tc.startsWith("'") && tc.endsWith("'") ? tc : "'" + tc + "'";
        return "null /* TODO: 自定义类型 " + type + "，请手动构造 */";
    }

    private String generateTreeBuilder(int idx, String testCase) {
        StringBuilder sb = new StringBuilder();
        String tc = testCase != null ? testCase.trim() : "";
        if (tc.isEmpty()) { sb.append("        TreeNode p").append(idx).append(" = null;\n"); return sb.toString(); }
        sb.append("        Integer[] _tv").append(idx).append(" = new Integer[] ").append(convertArrayLiteral(tc)).append(";\n");
        sb.append("        TreeNode p").append(idx).append(" = null;\n");
        sb.append("        if (_tv").append(idx).append(".length > 0 && _tv").append(idx).append("[0] != null) {\n");
        sb.append("            p").append(idx).append(" = new TreeNode(_tv").append(idx).append("[0]);\n");
        sb.append("            Queue<TreeNode> _q").append(idx).append(" = new LinkedList<>();\n");
        sb.append("            _q").append(idx).append(".offer(p").append(idx).append(");\n");
        sb.append("            int _i").append(idx).append(" = 1;\n");
        sb.append("            while (_i").append(idx).append(" < _tv").append(idx).append(".length) {\n");
        sb.append("                TreeNode _n").append(idx).append(" = _q").append(idx).append(".poll();\n");
        sb.append("                if (_tv").append(idx).append("[_i").append(idx).append("] != null) {\n");
        sb.append("                    _n").append(idx).append(".left = new TreeNode(_tv").append(idx).append("[_i").append(idx).append("]);\n");
        sb.append("                    _q").append(idx).append(".offer(_n").append(idx).append(".left);\n");
        sb.append("                }\n                _i").append(idx).append("++;\n");
        sb.append("                if (_i").append(idx).append(" < _tv").append(idx).append(".length && _tv").append(idx).append("[_i").append(idx).append("] != null) {\n");
        sb.append("                    _n").append(idx).append(".right = new TreeNode(_tv").append(idx).append("[_i").append(idx).append("]);\n");
        sb.append("                    _q").append(idx).append(".offer(_n").append(idx).append(".right);\n");
        sb.append("                }\n                _i").append(idx).append("++;\n");
        sb.append("            }\n        }\n");
        return sb.toString();
    }

    private String generateListBuilder(int idx, String testCase) {
        StringBuilder sb = new StringBuilder();
        String tc = testCase != null ? testCase.trim() : "";
        if (tc.isEmpty()) { sb.append("        ListNode p").append(idx).append(" = null;\n"); return sb.toString(); }
        sb.append("        int[] _lv").append(idx).append(" = new int[] ").append(convertArrayLiteral(tc)).append(";\n");
        sb.append("        ListNode p").append(idx).append(" = null;\n");
        sb.append("        if (_lv").append(idx).append(".length > 0) {\n");
        sb.append("            p").append(idx).append(" = new ListNode(_lv").append(idx).append("[0]);\n");
        sb.append("            ListNode _c").append(idx).append(" = p").append(idx).append(";\n");
        sb.append("            for (int _j").append(idx).append(" = 1; _j").append(idx).append(" < _lv").append(idx).append(".length; _j").append(idx).append("++) {\n");
        sb.append("                _c").append(idx).append(".next = new ListNode(_lv").append(idx).append("[_j").append(idx).append("]);\n");
        sb.append("                _c").append(idx).append(" = _c").append(idx).append(".next;\n");
        sb.append("            }\n        }\n");
        return sb.toString();
    }

    private String defaultValue(String type) {
        if (type.endsWith("[]")) return "new " + type + "[0]";
        if (type.equals("String") || type.equals("java.lang.String")) return "\"\"";
        if (type.equals("int") || type.equals("Integer") || type.equals("long") || type.equals("Long")
            || type.equals("double") || type.equals("Double") || type.equals("float") || type.equals("Float")) return "0";
        if (type.equals("boolean") || type.equals("Boolean")) return "false";
        return "null";
    }

    private String convertArrayLiteral(String text) { return text.replace('[', '{').replace(']', '}'); }
    private int countArrayDimensions(String type) { int c=0; for(int i=0;i<type.length();i++) if(type.charAt(i)=='[')c++; return c; }
    private int countBracketDepth(String s) { int max=0,d=0; for(int i=0;i<s.length();i++){if(s.charAt(i)=='['){d++;if(d>max)max=d;}else if(s.charAt(i)==']')d--;} return max; }
    private String truncate(String s, int max) { return s.length()<=max?s:s.substring(0,max)+"..."; }

    private static class MethodInfo { String name, returnType; boolean isStatic; List<ParamInfo> params; }
    private static class ParamInfo { String name, type; }

    private static class InMemoryClassLoader extends ClassLoader {
        private final Map<String,byte[]> classData;
        InMemoryClassLoader(Map<String,byte[]> d){ this.classData = d; }
        @Override protected Class<?> findClass(String name) throws ClassNotFoundException {
            byte[] b = classData.get(name);
            if(b != null) return defineClass(name, b, 0, b.length);
            throw new ClassNotFoundException(name);
        }
    }
}
