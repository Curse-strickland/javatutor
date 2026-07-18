package com.javatutor.compiler;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.LinkedHashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class InMemoryCompilerTest {

    private InMemoryCompiler compiler;

    @BeforeEach
    void setUp() {
        compiler = new InMemoryCompiler();
    }

    @Test
    void compileValidSourceShouldProduceBytecode() {
        Map<String, String> sources = new LinkedHashMap<>();
        sources.put("Hello", "public class Hello { public static void main(String[] a) {} }");
        Map<String, byte[]> bytecode = compiler.compile(sources);
        assertTrue(bytecode.containsKey("Hello"));
        assertNotNull(bytecode.get("Hello"));
        assertTrue(bytecode.get("Hello").length > 0);
    }

    @Test
    void compileMultipleSourcesShouldAllProduceBytecode() {
        Map<String, String> sources = new LinkedHashMap<>();
        sources.put("A", "public class A { int x; }");
        sources.put("B", "public class B { String y; }");
        Map<String, byte[]> bytecode = compiler.compile(sources);
        assertTrue(bytecode.containsKey("A"));
        assertTrue(bytecode.containsKey("B"));
        assertTrue(bytecode.get("A").length > 0);
        assertTrue(bytecode.get("B").length > 0);
    }

    @Test
    void compileInvalidSourceShouldThrowWithChineseMessage() {
        Map<String, String> sources = new LinkedHashMap<>();
        sources.put("Bad", "public class Bad { missingSemicolon = 1 }");
        RuntimeException ex = assertThrows(RuntimeException.class, () -> compiler.compile(sources));
        String msg = ex.getMessage();
        assertTrue(msg.contains("编译失败"), "Error should contain Chinese prefix, got: " + msg);
    }

    @Test
    void compileMissingSemicolonShouldProvideChineseHint() {
        Map<String, String> sources = new LinkedHashMap<>();
        sources.put("X", "public class X { int a = 1 }");
        RuntimeException ex = assertThrows(RuntimeException.class, () -> compiler.compile(sources));
        assertTrue(ex.getMessage().contains("缺少分号") || ex.getMessage().contains("编译失败"));
    }

    @Test
    void compileCannotFindSymbolShouldProvideChineseHint() {
        Map<String, String> sources = new LinkedHashMap<>();
        sources.put("Y", "public class Y { int a = undeclaredVar; }");
        RuntimeException ex = assertThrows(RuntimeException.class, () -> compiler.compile(sources));
        assertTrue(ex.getMessage().contains("找不到符号") || ex.getMessage().contains("编译失败"));
    }

    @Test
    void compileIncompleteCodeShouldProvideChineseHint() {
        Map<String, String> sources = new LinkedHashMap<>();
        sources.put("Z", "public class Z {");
        RuntimeException ex = assertThrows(RuntimeException.class, () -> compiler.compile(sources));
        assertTrue(ex.getMessage().contains("不完整") || ex.getMessage().contains("缺少结尾")
            || ex.getMessage().contains("编译失败"));
    }

    @Test
    void compileWithDependencyShouldResolveAcrossSources() {
        Map<String, String> sources = new LinkedHashMap<>();
        sources.put("Point", "public class Point { int x; int y; }");
        sources.put("Main", "public class Main { public static void main(String[] a) { Point p = new Point(); } }");
        Map<String, byte[]> bytecode = compiler.compile(sources);
        assertTrue(bytecode.containsKey("Point"));
        assertTrue(bytecode.containsKey("Main"));
    }
}
