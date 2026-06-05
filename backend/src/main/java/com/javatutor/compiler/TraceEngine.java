package com.javatutor.compiler;

import java.util.ArrayList;
import java.util.List;
import java.util.LinkedHashMap;
import java.util.Map;
import java.lang.reflect.Array;
public class TraceEngine {
    private static List<Map<String,Object>> steps = new ArrayList<>();
    
    //无需构造方法
    //用户代码里是直接 TraceEngine.record(...) 调用的，不需要 new 对象。
    // 而且整个执行过程只有一个 TraceEngine，用静态变量保证全局唯一。

    //方法
    //record() 方法每次被调用的时候就向list中追加记录
    public static void record(int step , int line , Map<String,Object> vars){
        LinkedHashMap<String,Object> record = new LinkedHashMap<String, Object>();
        record.put("step", step);
        record.put("line", line);
        //前端写的getter读取数据的格式是：state.steps[state.currentStep]?.variables   // ← 找的是 "variables"
        // 对变量值做浅层深拷贝：如果是数组则转换为 List，避免后续对同一数组的修改影响已记录步骤
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

    

    //reset() 方法在执行完后清空记录
    public static void reset(){
        steps.clear();
    }
    //getSteps() 方法在执行完后返回记录
    public static List<Map<String,Object>> getSteps(){
        return steps;
    }


}
