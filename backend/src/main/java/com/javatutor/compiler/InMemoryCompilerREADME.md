这一部分是区别于一般的Java compiler过程的，有些值得记录的学习点：
在javatutor中我们采用的是内存编译，与一般的正常编译如下的区别：

平时编译 Java 代码是：
.java 文件 → [javac] → .class 文件写到磁盘

内存编译是：
.java 字符串 → [JavaCompiler API] → byte[] 字节数组在内存里

在实现过程中
### step1 使用公开的接口 javaCompiler 来编译 Java 代码，
public interface JavaCompiler extends Tool, OptionChecker {}

JavaCompiler 是 JDK提供的 javax.tools 包中的一个接口，提供了编译 Java 源代码的功能。通过 ToolProvider.getSystemJavaCompiler() 方法获取系统默认的 Java 编译器实例。
### step2 写两个simpleJavaFileObject 的子类来实现从字符串读源码和往 byte[] 写 class 的功能。
### step3 整合