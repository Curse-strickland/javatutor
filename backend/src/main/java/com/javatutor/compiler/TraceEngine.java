package com.javatutor.compiler;

import java.util.*;
import java.lang.reflect.Array;
import java.lang.reflect.Field;
import java.lang.reflect.Modifier;
import java.io.ByteArrayOutputStream;

/**
 * TraceEngine — 运行时步骤记录引擎（磁盘副本，与 RunController.TRACE_ENGINE_SOURCE 同步）。
 *
 * 核心设计：
 * - 每个复杂对象（ListNode等）分配到 heap 表，分配唯一 ref id（h1,h2,…）
 * - 变量中只存 ref id 字符串（如 head="h1"）
 * - heap 表是扁平 Map，每个 entry 包含对象的序列化字段（val/next/...）
 * - 每步 record() 清空 heap 重算，确保 next 指针变化被准确捕获
 * - 前端从 heap 读取所有节点，根据 next ref 画箭头
 */
public class TraceEngine {
    private static List<Map<String,Object>> steps = new ArrayList<>();
    private static volatile boolean disabled = false;
    private static ByteArrayOutputStream capturedOutput;
    private static int lastOutputPos = 0;
    private static LinkedHashMap<String,LinkedHashMap<String,Object>> heapObjects = new LinkedHashMap<>();
    private static int heapCounter = 0;
    private static List<Object[]> objRefList = new ArrayList<>();
    private static List<StackFrame> callStack = new ArrayList<>();
    private static int frameCounter = 0;

    public static class StackFrame {
        public String id, name;
        public Map<String, Object> variables;
        public Object returnValue;
        public StackFrame(String id, String name, Map<String, Object> vars) {
            this.id = id; this.name = name;
            this.variables = new LinkedHashMap<>(vars);
            this.returnValue = null;
        }
    }

    private static boolean isPrimitiveOrWrapper(Object v) {
        return v instanceof Boolean || v instanceof Byte || v instanceof Character ||
               v instanceof Short || v instanceof Integer || v instanceof Long ||
               v instanceof Float || v instanceof Double || v instanceof String;
    }

    private static String findRefByObj(Object obj) {
        for (Object[] pair : objRefList) { if (pair[0] == obj) return (String)pair[1]; }
        return null;
    }

    private static String registerObj(Object obj) {
        heapCounter++;
        String ref = "h" + heapCounter;
        objRefList.add(new Object[]{obj, ref});
        heapObjects.put(ref, new LinkedHashMap<>());
        return ref;
    }

    private static Object deepSerialize(Object obj, Set<Object> visited) {
        if (obj == null) return null;
        if (isPrimitiveOrWrapper(obj)) return obj;
        if (obj.getClass().isArray()) {
            int len = Array.getLength(obj);
            List<Object> list = new ArrayList<>(len);
            for (int i = 0; i < len; i++) list.add(deepSerialize(Array.get(obj, i), visited));
            return list;
        }
        if (visited.contains(obj)) return findRefByObj(obj);
        visited.add(obj);
        String ref = findRefByObj(obj);
        if (ref == null) ref = registerObj(obj);
        return ref;
    }

    private static void serializeFields(String ref, Object obj, Set<Object> visited) {
        LinkedHashMap<String,Object> entry = heapObjects.get(ref);
        if (entry == null) return;
        Class<?> cls = obj.getClass();
        while (cls != null && cls != Object.class) {
            for (Field f : cls.getDeclaredFields()) {
                if (Modifier.isStatic(f.getModifiers())) continue;
                f.setAccessible(true);
                try { entry.put(f.getName(), deepSerialize(f.get(obj), visited)); }
                catch (Exception ignored) {}
            }
            cls = cls.getSuperclass();
        }
    }

    public static void pushFrame(String methodName, Map<String, Object> params) {
        frameCounter++;
        callStack.add(new StackFrame("f" + frameCounter, methodName, params));
    }

    public static void popFrame(Object returnValue) {
        if (!callStack.isEmpty()) {
            callStack.get(callStack.size() - 1).returnValue = returnValue;
        }
    }

    private static void attachCallStack(Map<String, Object> varsCopy) {
        if (callStack.isEmpty()) return;
        LinkedHashMap<String, Object> stackData = new LinkedHashMap<>();
        List<LinkedHashMap<String, Object>> framesList = new ArrayList<>();
        List<Integer> returningIndices = new ArrayList<>();
        for (int i = 0; i < callStack.size(); i++) {
            StackFrame frame = callStack.get(i);
            LinkedHashMap<String, Object> fm = new LinkedHashMap<>();
            fm.put("id", frame.id);
            fm.put("name", frame.name);
            fm.put("variables", frame.variables);
            fm.put("returnValue", frame.returnValue);
            framesList.add(fm);
            if (frame.returnValue != null) returningIndices.add(i);
        }
        stackData.put("frames", framesList);
        stackData.put("activeFrameIndex", callStack.size() - 1);
        stackData.put("returningFrameIndices", returningIndices);
        varsCopy.put("_recursionStack_", stackData);
    }

    private static void clearHeapPerStep() {
        heapObjects.clear();
        heapCounter = 0;
        objRefList.clear();
    }

    public static void record(int step, int line, Map<String,Object> vars) {
        if (disabled) return;
        LinkedHashMap<String,Object> record = new LinkedHashMap<>();
        record.put("step", step);
        record.put("line", line);
        clearHeapPerStep();
        Set<Object> visited = new HashSet<>();
        LinkedHashMap<String,Object> varsCopy = new LinkedHashMap<>();
        for (Map.Entry<String,Object> e : vars.entrySet()) {
            varsCopy.put(e.getKey(), deepSerialize(e.getValue(), visited));
        }
        // 动态遍历：serializeFields 可能注册新对象，while 循环自动追上
        int done = 0;
        List<String> keys = new ArrayList<>(heapObjects.keySet());
        while (done < keys.size()) {
            String ref = keys.get(done);
            Object obj = null;
            for (Object[] pair : objRefList) { if (pair[1].equals(ref)) { obj = pair[0]; break; } }
            if (obj != null) serializeFields(ref, obj, new HashSet<>());
            done++;
            keys = new ArrayList<>(heapObjects.keySet());
        }
        attachCallStack(varsCopy);
        record.put("variables", varsCopy);
        if (!heapObjects.isEmpty()) {
            record.put("heap", new LinkedHashMap<>(heapObjects));
        }
        if (capturedOutput != null) {
            String outStr = capturedOutput.toString();
            int pos = outStr.length();
            if (pos > lastOutputPos) {
                String raw = outStr.substring(lastOutputPos);
                record.put("output", raw.replace("\r\n", "\n"));
                lastOutputPos = pos;
            }
        }
        steps.add(record);
    }

    public static boolean recordCondition(boolean cond, int step, int line, Map<String,?> vars) {
        if (disabled) return cond;
        LinkedHashMap<String,Object> map = new LinkedHashMap<>();
        for (Map.Entry<String,?> e : vars.entrySet()) { map.put(e.getKey(), e.getValue()); }
        record(step, line, map);
        return cond;
    }

    public static void setOutputStream(ByteArrayOutputStream out) { capturedOutput = out; lastOutputPos = 0; }

    public static void reset() {
        steps.clear();
        disabled = false;
        lastOutputPos = 0;
        callStack.clear();
        frameCounter = 0;
        heapObjects.clear();
        heapCounter = 0;
        objRefList.clear();
    }

    public static void disable() { disabled = true; }

    public static Map<String,Object> buildMap(Object... pairs) {
        LinkedHashMap<String,Object> m = new LinkedHashMap<>();
        for (int i = 0; i < pairs.length; i += 2) { m.put((String) pairs[i], pairs[i + 1]); }
        return m;
    }

    public static List<Map<String,Object>> getSteps() { return steps; }
}
