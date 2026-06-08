package com.javatutor.compiler;

import java.util.ArrayList;
import java.util.List;
import java.util.LinkedHashMap;
import java.util.Map;
import java.lang.reflect.Array;

public class TraceEngine {
    private static List<Map<String,Object>> steps = new ArrayList<>();
    private static volatile boolean disabled = false;

    public static void record(int step, int line, Map<String,Object> vars) {
        if (disabled) return;
        LinkedHashMap<String,Object> record = new LinkedHashMap<String, Object>();
        record.put("step", step);
        record.put("line", line);
        LinkedHashMap<String,Object> varsCopy = new LinkedHashMap<>();
        for (Map.Entry<String,Object> e : vars.entrySet()) {
            Object v = e.getValue();
            if (v != null && v.getClass().isArray()) {
                int len = Array.getLength(v);
                List<Object> copy = new ArrayList<>(len);
                for (int i = 0; i < len; i++) copy.add(Array.get(v, i));
                varsCopy.put(e.getKey(), copy);
            } else {
                varsCopy.put(e.getKey(), v);
            }
        }
        record.put("variables", varsCopy);
        steps.add(record);
    }

    public static void reset() {
        steps.clear();
        disabled = false;
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
