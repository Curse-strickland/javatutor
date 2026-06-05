package com.javatutor.compiler;
//装源码
//import javax 自带的基类
import javax.tools.SimpleJavaFileObject; 
//URI = Uniform Resource Identifier 是统一资源标识符 用于标识文件对象的位置
import java.net.URI;

import javax.tools.JavaFileObject;


public class SourceFileObject extends SimpleJavaFileObject {
    //父类需要构造参数 
    private String code;
    public SourceFileObject(String className, String code) {
        //造文件路径
        super(URI.create("string:///" + className.replace('.', '/') + ".java"), 
        //kind.source 告诉编译器这是源码文件
        javax.tools.JavaFileObject.Kind.SOURCE);
        this.code = code; //存SourceCode源码
    }

    //重写父类的 getCharContent 方法 返回源码内容
    @Override
    public CharSequence getCharContent(boolean ignoreEncodingErrors) {
        return code;
    }
    /**why override getCharContent?      
     * 因为我们借用了外部的编译器，
     * 父类默认操作的是硬盘文件，我们重写是让它改为操作内存里的字符串。
     * ClassFileObject 同理——父类默认把编译结果写到硬盘上，我们重写让它写到内存的 byte[] 里。
     * 编译器（javax.tools.JavaCompiler）内部是这样写的（伪代码）：
        // JDK 内部逻辑
        public void compile(JavaFileObject file) {
            String sourceCode = file.getCharContent();  // ← 它只认 getCharContent
            // ... 解析、编译 ...
        }
    */
    
}
