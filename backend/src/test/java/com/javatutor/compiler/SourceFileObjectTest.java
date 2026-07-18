package com.javatutor.compiler;

import org.junit.jupiter.api.Test;

import javax.tools.JavaFileObject;

import static org.junit.jupiter.api.Assertions.*;

class SourceFileObjectTest {

    @Test
    void constructorShouldCreateValidSourceObject() {
        String className = "TestClass";
        String code = "public class TestClass {}";
        SourceFileObject sfo = new SourceFileObject(className, code);
        assertEquals(JavaFileObject.Kind.SOURCE, sfo.getKind());
    }

    @Test
    void getCharContentShouldReturnOriginalCode() {
        String code = "public class TestClass { int x = 1; }";
        SourceFileObject sfo = new SourceFileObject("TestClass", code);
        CharSequence content = sfo.getCharContent(false);
        assertEquals(code, content.toString());
    }

    @Test
    void constructorShouldCreateCorrectUri() {
        SourceFileObject sfo = new SourceFileObject("com.example.MyClass", "code");
        String uri = sfo.toUri().toString();
        assertTrue(uri.endsWith(".java"), "URI should end with .java: " + uri);
        assertTrue(uri.contains("MyClass"), "URI should contain class name");
    }
}
