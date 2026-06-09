package com.javatutor.compiler;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
import java.lang.reflect.Array;
import java.lang.reflect.Field;
import java.lang.reflect.Modifier;
import java.io.ByteArrayOutputStream;

public class TraceEngine {
    private static List<Map<String,Object>> steps = new ArrayList<>();
    private static volatile boolean disabled = false;
    private static ByteArrayOutputStream capturedOutput;
    private static int lastOutputPos = 0;

    // 堆对象注册表：变量名 → 对象信息（类型、ID、slots数组）
    private static LinkedHashMap<String, Map<String, Object>> heapObjects = new LinkedHashMap<>();

    public static void record(int step, int line, Map<String,Object> vars) {
        if (disabled) return;
        LinkedHashMap<String,Object> record = new LinkedHashMap<String, Object>();
        record.put("step", step);
        record.put("line", line);
        LinkedHashMap<String,Object> varsCopy = new LinkedHashMap<>();
        for (Map.Entry<String,Object> e : vars.entrySet()) {
            Object v = e.getValue();
            if (v == null) {
                varsCopy.put(e.getKey(), null);
            } else if (v.getClass().isArray()) {
                int len = Array.getLength(v);
                List<Object> copy = new ArrayList<>(len);
                for (int i = 0; i < len; i++) {
                    Object elem = Array.get(v, i);
                    if (elem != null && isComplexObject(elem)) {
                        String name = e.getKey() + "[" + i + "]";
                        boolean existed = heapObjects.containsKey(name);
                        String elemId = ensureHeapObject(name, elem);
                        copy.add(elemId);
                        // 只有当堆条目存在且 _objRef 匹配当前对象时，才更新字段
                        // 如果引用被重新绑定（arr[0] = arr[1]），旧条目不应被更新
                        if (heapObjects.containsKey(name) && heapObjects.get(name).get("_objRef") == elem) {
                            updateHeapFields(name, elem);
                        } else if (!existed) {
                            // 新注册的条目（ensureHeapObject 中 allocObject 创建的）
                            updateHeapFields(name, elem);
                        }
                    } else if (elem != null && elem.getClass().isArray()) {
                        // 嵌套数组（如 int[][] 的内层 int[]）：递归深拷贝
                        copy.add(deepCopyArray(elem));
                    } else {
                        copy.add(elem);
                    }
                }
                varsCopy.put(e.getKey(), copy);
                // 同步更新堆对象中的 slots 快照
                updateHeapSlots(e.getKey(), copy);
            } else if (isComplexObject(v)) {
                // 复杂对象：注册到堆，栈里只存引用 ID
                String id = ensureHeapObject(e.getKey(), v);
                varsCopy.put(e.getKey(), id);
                // 只有当对象真正新注册时才更新字段（复用的引用不重复创建堆条目）
                if (heapObjects.containsKey(e.getKey())) {
                    updateHeapFields(e.getKey(), v);
                }
            } else {
                varsCopy.put(e.getKey(), v);
            }
        }
        record.put("variables", varsCopy);
        // 堆快照
        record.put("heap", deepCopyHeap());
        // 栈帧信息
        LinkedHashMap<String, Object> stackFrame = new LinkedHashMap<>();
        stackFrame.put("method", "main");
        stackFrame.put("locals", new LinkedHashMap<>(varsCopy));
        record.put("stackFrame", stackFrame);
        // 输出捕获
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

    // 递归深拷贝嵌套数组（处理 int[][] 等）
    private static List<Object> deepCopyArray(Object arr) {
        int len = Array.getLength(arr);
        List<Object> copy = new ArrayList<>(len);
        for (int i = 0; i < len; i++) {
            Object elem = Array.get(arr, i);
            if (elem != null && elem.getClass().isArray()) {
                copy.add(deepCopyArray(elem));
            } else if (elem != null && isComplexObject(elem)) {
                copy.add(ensureHeapObject("nested[" + i + "]", elem));
            } else {
                copy.add(elem);
            }
        }
        return copy;
    }

    // 判断是否为复杂对象（非基本类型、非包装类、非 String、非数组）
    private static boolean isComplexObject(Object v) {
        if (v == null) return false;
        Class<?> cls = v.getClass();
        return !cls.isPrimitive()
            && !cls.isArray()
            && cls != String.class
            && !Number.class.isAssignableFrom(cls)
            && cls != Boolean.class
            && cls != Character.class;
    }

    // 确保对象在堆中已注册，返回堆 ID
    // 若对象已通过其他名称注册，复用已有 ID 避免循环引用
    private static String ensureHeapObject(String name, Object obj) {
        if (heapObjects.containsKey(name)) {
            // 检查该名称下的 _objRef 是否还指向当前对象（引用可能被重新绑定）
            if (heapObjects.get(name).get("_objRef") == obj) {
                return (String) heapObjects.get(name).get("id");
            }
            // _objRef 不匹配：该名称已被重新绑定到另一个对象，查新对象的现有 ID
            String existingId = findHeapIdByRef(obj);
            if (existingId != null) return existingId;
            // 新对象也未注册，为此名称重新注册
            heapObjects.remove(name);
            return allocObject(name, obj);
        }
        // 按引用查找是否已注册（用于循环引用 dedup）
        String existingId = findHeapIdByRef(obj);
        if (existingId != null) return existingId;
        return allocObject(name, obj);
    }

    // 分配对象到堆
    public static String allocObject(String name, Object obj) {
        if (disabled) return "0x0000";
        String id = "0x" + Integer.toHexString(
            (Math.abs(name.hashCode()) + heapObjects.size() + 1) & 0xFFFF
        ).toUpperCase();
        LinkedHashMap<String, Object> heapObj = new LinkedHashMap<>();
        heapObj.put("type", obj.getClass().getSimpleName());
        heapObj.put("id", id);
        heapObj.put("name", name);
        heapObj.put("fields", new LinkedHashMap<String, Object>());
        heapObj.put("_objRef", obj);  // 保存引用用于 dedup
        heapObjects.put(name, heapObj);
        return id;
    }

    // 按对象引用查找已注册堆 ID
    private static String findHeapIdByRef(Object obj) {
        for (Map.Entry<String, Map<String, Object>> e : heapObjects.entrySet()) {
            if (e.getValue().get("_objRef") == obj) {
                return (String) e.getValue().get("id");
            }
        }
        return null;
    }

    // 快照对象字段：只取浅层字段值，引用型字段存目标堆 ID 打断循环
    private static void updateHeapFields(String name, Object obj) {
        updateHeapFields(name, obj, new HashSet<>());
    }

    private static void updateHeapFields(String name, Object obj, Set<Object> visited) {
        if (visited.contains(obj)) return; // 打断循环引用
        visited.add(obj);
        if (!heapObjects.containsKey(name)) {
            allocObject(name, obj);
        }
        Map<String, Object> heapObj = heapObjects.get(name);
        // 如果该条目已注册不同对象，跳过（由引用去重逻辑处理）
        if (heapObj.get("_objRef") != obj) { visited.remove(obj); return; }
        LinkedHashMap<String, Object> fields = new LinkedHashMap<>();
        Class<?> cls = obj.getClass();
        while (cls != null && cls != Object.class) {
            for (Field f : cls.getDeclaredFields()) {
                if (Modifier.isStatic(f.getModifiers())) continue;
                f.setAccessible(true);
                try {
                    Object fv = f.get(obj);
                    if (fv == null) {
                        fields.put(f.getName(), null);
                    } else if (fv.getClass().isArray()) {
                        String arrName = name + "." + f.getName();
                        if (!heapObjects.containsKey(arrName)) {
                            allocArray(arrName, Array.getLength(fv));
                        }
                        List<Object> arrCopy = new ArrayList<>();
                        int len = Array.getLength(fv);
                        for (int i = 0; i < len; i++) arrCopy.add(Array.get(fv, i));
                        updateHeapSlots(arrName, arrCopy);
                        String arrId = (String) heapObjects.get(arrName).get("id");
                        LinkedHashMap<String, Object> refEntry = new LinkedHashMap<>();
                        refEntry.put("ref", arrId);
                        fields.put(f.getName(), refEntry);
                    } else if (isComplexObject(fv)) {
                        // 引用型字段：确保目标对象字段已填充，同时用 visited 打断循环
                        String existingId = findHeapIdByRef(fv);
                        if (existingId != null) {
                            // 找到该对象在堆中的注册名，填充字段（若 visited 中已有则跳过）
                            for (Map.Entry<String, Map<String, Object>> he : heapObjects.entrySet()) {
                                if (he.getValue().get("_objRef") == fv) {
                                    updateHeapFields(he.getKey(), fv, visited);
                                    break;
                                }
                            }
                        } else {
                            String refName = name + "." + f.getName();
                            ensureHeapObject(refName, fv);
                            updateHeapFields(refName, fv, visited);
                        }
                        String refId = findHeapIdByRef(fv);
                        LinkedHashMap<String, Object> refEntry = new LinkedHashMap<>();
                        refEntry.put("ref", refId != null ? refId : "0x????");
                        fields.put(f.getName(), refEntry);
                    } else {
                        fields.put(f.getName(), fv);
                    }
                } catch (IllegalAccessException ex) {
                    fields.put(f.getName(), "<inaccessible>");
                }
            }
            cls = cls.getSuperclass();
        }
        heapObj.put("fields", fields);
        visited.remove(obj);
    }

    // 分配数组到堆，返回伪地址 ID
    public static String allocArray(String name, int length) {
        if (disabled) return "0x0000";
        String id = "0x" + Integer.toHexString(
            (Math.abs(name.hashCode()) + heapObjects.size() + 1) & 0xFFFF
        ).toUpperCase();
        LinkedHashMap<String, Object> obj = new LinkedHashMap<>();
        obj.put("type", "int[" + length + "]");
        obj.put("length", length);
        obj.put("id", id);
        obj.put("name", name);
        obj.put("slots", new ArrayList<>());
        heapObjects.put(name, obj);
        return id;
    }

    // 更新堆对象的 slots 快照
    private static void updateHeapSlots(String name, List<Object> arrayCopy) {
        if (!heapObjects.containsKey(name)) {
            // 数组未通过 allocArray 注册（例如 {5,3,8} 字面量），在此自动注册
            allocArray(name, arrayCopy.size());
        }
        Map<String, Object> obj = heapObjects.get(name);
        List<Map<String, Object>> slots = new ArrayList<>();
        for (int i = 0; i < arrayCopy.size(); i++) {
            LinkedHashMap<String, Object> slot = new LinkedHashMap<>();
            slot.put("index", i);
            slot.put("value", arrayCopy.get(i));
            slots.add(slot);
        }
        obj.put("slots", slots);
    }

    // 深拷贝堆对象表（移除内部 _objRef 避免 Jackson 序列化异常）
    private static LinkedHashMap<String, Object> deepCopyHeap() {
        LinkedHashMap<String, Object> copy = new LinkedHashMap<>();
        for (Map.Entry<String, Map<String, Object>> e : heapObjects.entrySet()) {
            LinkedHashMap<String, Object> shallow = new LinkedHashMap<>(e.getValue());
            shallow.remove("_objRef");
            copy.put(e.getKey(), shallow);
        }
        return copy;
    }

    public static void setOutputStream(ByteArrayOutputStream out) {
        capturedOutput = out;
        lastOutputPos = 0;
    }

    public static void reset() {
        steps.clear();
        heapObjects.clear();
        disabled = false;
        lastOutputPos = 0;
    }

    public static void disable() {
        disabled = true;
    }

    // 接受平铺数组 [k1, v1, k2, v2, ...] 构建 Map，突破 Map.of() 的 10 对上限
    public static Map<String, Object> buildMap(Object... pairs) {
        LinkedHashMap<String, Object> m = new LinkedHashMap<>();
        for (int i = 0; i < pairs.length; i += 2) {
            m.put((String) pairs[i], pairs[i + 1]);
        }
        return m;
    }

    public static List<Map<String,Object>> getSteps() {
        return steps;
    }
}
