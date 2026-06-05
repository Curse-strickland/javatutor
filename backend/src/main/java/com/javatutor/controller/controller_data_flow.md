前端 POST /api/run {code: "public class UserCode {...}"}
     │
     ▼
① 提取类名（如 "UserCode"）
     │
     ▼
② Instrumenter.instrument(code)  → 插桩后的源码
     │
     ▼
③ 去掉用户代码中的 package 声明（如果有）
     │
     ▼
④ InMemoryCompiler.compile({
      "TraceEngine" → TraceEngine源码（无package版本）
      "UserCode"    → 插桩后源码
   })  → Map<类名, byte[]>
     │
     ▼
⑤ InMemoryClassLoader 加载 byte[]  → Class 对象
     │
     ▼
⑥ 反射调用 TraceEngine.reset()  →  清空上次记录
     │
     ▼
⑦ 新线程反射调用 UserCode.main()  →  5秒超时
     │
     ▼
⑧ 反射调用 TraceEngine.getSteps()  →  List<Map>
     │
     ▼
⑨ RunResponse.ok(runId, steps)  →  JSON 返回前端
