package com.javatutor.compiler;
//装字节码
import javax.tools.SimpleJavaFileObject;
import java.net.URI;
import javax.tools.JavaFileObject;
import java.io.ByteArrayOutputStream;
import java.io.OutputStream;

public class ClassFileObject extends SimpleJavaFileObject {
    private final ByteArrayOutputStream byteArrayOutputStream; //存编译结果的字节码
    //构造
    public ClassFileObject(String className) {
        //捏造路径
        super(URI.create("string:///" + className.replace('.', '/') + ".class"), 
        //标识为class文件
        JavaFileObject.Kind.CLASS);
        //编译器会调用 openOutputStream() 方法获取一个输出流来写入编译结果，我们在这里返回一个 ByteArrayOutputStream 来存储字节码。
        //编译器通过 outputStream.write(字节码); 就可以写入
        this.byteArrayOutputStream = new ByteArrayOutputStream();
    }

    //方法 
    //编译器写入字节码
    @Override
    public OutputStream openOutputStream() {
        return byteArrayOutputStream;
    }

    //编译完成后取出
    public byte[] getBytes(){
        return byteArrayOutputStream.toByteArray();
    }
}
