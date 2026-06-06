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

    public static List<Map<String,Object>> getSteps() {
        return steps;
    }
}
