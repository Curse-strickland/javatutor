package com.javatutor.compiler;

import org.junit.jupiter.api.Test;

import javax.tools.JavaFileObject;

import java.io.OutputStream;

import static org.junit.jupiter.api.Assertions.*;

class ClassFileObjectTest {

    @Test
    void constructorShouldCreateValidClassObject() {
        ClassFileObject cfo = new ClassFileObject("TestClass");
        assertEquals(JavaFileObject.Kind.CLASS, cfo.getKind());
    }

    @Test
    void openOutputStreamShouldReturnNonNullStream() {
        ClassFileObject cfo = new ClassFileObject("TestClass");
        OutputStream os = cfo.openOutputStream();
        assertNotNull(os);
    }

    @Test
    void getBytesShouldReturnWrittenContent() throws Exception {
        ClassFileObject cfo = new ClassFileObject("TestClass");
        OutputStream os = cfo.openOutputStream();
        byte[] data = {1, 2, 3, 4, 5};
        os.write(data);
        os.close();
        assertArrayEquals(data, cfo.getBytes());
    }

    @Test
    void getBytesShouldReturnEmptyForNoWrites() {
        ClassFileObject cfo = new ClassFileObject("Empty");
        byte[] bytes = cfo.getBytes();
        assertNotNull(bytes);
        assertEquals(0, bytes.length);
    }
}
