package com.javatutor.compiler;

/*需要实现的功能：
 ① 把每个源码包成 SourceFileObject（编译器能读的格式）
 ② 为每个类建 ClassFileObject（空桶，接编译结果）
 ③ 告诉编译器：请把结果写到我的桶里
 ④ 调编译器执行编译
 ⑤ 从桶里取出 byte[]，装进 Map 返回
*/

import javax.tools.*;
import java.util.*;

public class InMemoryCompiler {
    private final JavaCompiler compiler;

    //构造
    public InMemoryCompiler() {
        this.compiler = ToolProvider.getSystemJavaCompiler();
        //检查 compiler 是否可用（如果运行环境是 JRE 而不是 JDK，compiler 会是 null）
        if (compiler == null) {
            throw new IllegalStateException("No Java compiler available. Make sure to run with a JDK, not a JRE.");
        }
    }

    //方法
    //入参从controller传入的，是usercode 插桩后的代码以及 traceengine() 方法合并的一个map
    public Map<String , byte[]> compile ( Map<String , String> sources){
        //包装源码
        List<SourceFileObject> sourceFiles = new ArrayList<>();
        for(Map.Entry<String , String> entry : sources.entrySet()){
            //把每一个entry中的 TraceEngine + userCode 包装成一个新的sourceFile
            //key -> traceEngine
            //value -> usercode
            sourceFiles.add(new SourceFileObject(entry.getKey() , entry.getValue()));
        }

        //创建新的classFileObject承接编译的字节码输出
        //注意：这里用Map不是List，因为后面拦截器需要靠类名查找桶
        Map<String, ClassFileObject> classFileMap = new HashMap<>();
        for(String className : sources.keySet()){
            //根据每一个className,创建对应的".class"容器
            classFileMap.put(className, new ClassFileObject(className));
        }

        //收集编译错误
        DiagnosticCollector<JavaFileObject> diagnostics = new DiagnosticCollector<>();

        //拦截编译输出（一般是输出到硬盘，这里需接入ClassFileObject中
        //JDK 提供了 ForwardingJavaFileManager，专门用来拦截编译器的文件操作。

        //这一步，拿到标准文件管理器
        StandardJavaFileManager stdManager = compiler.getStandardFileManager(null , null , null);
        //ForwardingJavaFileManager 不自己处理，而是把文件发给 stdManager处理
        JavaFileManager fileManager = new ForwardingJavaFileManager<StandardJavaFileManager>(stdManager){
            //重写，实现拦截
            @Override
            //先根据类名找到需要作为容器的classFielObject，利用hashMap检索
            public JavaFileObject getJavaFileForOutput(Location location , String className ,
                JavaFileObject.Kind kind , FileObject sibling){
                    //className可能带包名（如com.javatutor.compiler.TraceEngine），取最后一段短名
                    String shortName = className.contains(".")
                    ? className.substring(className.lastIndexOf(".") + 1)
                    : className;
                    ClassFileObject cfo = classFileMap.get(shortName);
                    if(cfo != null){
                        return cfo;
                    }
                    return classFileMap.get(className); //兜底：试试全名
                }
        };


        //执行编译
        JavaCompiler.CompilationTask task = compiler.getTask(
            null , fileManager , diagnostics , null , null , sourceFiles);
        boolean success = task.call(); //编译调用

        //编译失败？
        if(!success) {
            //container for collecting  errors
            StringBuilder errors = new StringBuilder();
            //遍历error info
            for(Diagnostic<? extends JavaFileObject> d : diagnostics.getDiagnostics() ){
                //collect specific error
                errors.append(d.getMessage(null)).append("\n");
            }
            throw new RuntimeException("Compilation failed:\n" + errors.toString());
        }

        //返回
        Map<String , byte[]> result = new HashMap<>();
        for(Map.Entry<String , ClassFileObject> entry : classFileMap.entrySet()){
            result.put(entry.getKey() , entry.getValue().getBytes());
        }
        return result;

    }

}
