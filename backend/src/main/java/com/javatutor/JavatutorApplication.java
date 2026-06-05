/**
 * 这个文件是 Spring Boot 的启动入口，整个后端程序从这开始跑。

每一行的意思：

@SpringBootApplication — 告诉 Spring："我这个类是启动类，请自动扫描同目录下所有 @Controller、@Service 等组件，帮我自动配好"
main(String[] args) — 和所有 Java 程序一样，这是 JVM 调用的入口
SpringApplication.run(...) — 启动嵌入式的 Tomcat 服务器，监听 8080 端口
类比：就像你写 C 语言的 int main(){}，没有它程序跑不起来。

 */
package com.javatutor;

// Maven 通过 pom.xml 下载的 Spring Boot jar 包解开来，里面就包含这些 org.springframework.boot.XXX 类。

//SpringBoot 提供的类 ，这里需要run()方法，用来启动 Spring Boot 应用
import org.springframework.boot.SpringApplication;
//SpringBoot 提供的注解@SpringBootApplication，这里需要自动扫描配置
import org.springframework.boot.autoconfigure.SpringBootApplication;
@SpringBootApplication
public class JavatutorApplication {
    public static void main(String[] args){
        SpringApplication.run(JavatutorApplication.class ,args);
    }
}

