package com.javatutor.sandbox;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class SandboxValidatorTest {

    @Test
    void simpleCodeShouldPass() {
        String code = "public class UserCode { public static void main(String[] a) { int x = 1; } }";
        SandboxValidator.Result r = SandboxValidator.validate(code);
        assertTrue(r.allowed, "simple code should pass, got: " + r.reason);
    }

    @Test
    void allowedImportShouldPass() {
        String code = "import java.util.List;\npublic class UserCode { List<String> items; }";
        SandboxValidator.Result r = SandboxValidator.validate(code);
        assertTrue(r.allowed, "java.util import should pass");
    }

    @Test
    void systemExitShouldBeRejected() {
        String code = "public class UserCode { public static void main(String[] a) { System.exit(0); } }";
        SandboxValidator.Result r = SandboxValidator.validate(code);
        assertFalse(r.allowed, "System.exit should be rejected");
        assertTrue(r.reason.contains("System.exit") || r.reason.contains("exit"));
    }

    @Test
    void runtimeExecShouldBeRejected() {
        String code = "public class UserCode { public static void main(String[] a) throws Exception " +
            "{ Runtime.getRuntime().exec(\"rm -rf /\"); } }";
        SandboxValidator.Result r = SandboxValidator.validate(code);
        assertFalse(r.allowed, "Runtime.exec should be rejected");
    }

    @Test
    void threadCreationShouldBeRejected() {
        String code = "public class UserCode { public static void main(String[] a) { new Thread(); } }";
        SandboxValidator.Result r = SandboxValidator.validate(code);
        assertFalse(r.allowed, "Thread creation should be rejected");
        assertTrue(r.reason.contains("Thread") || r.reason.contains("不支持"));
    }

    @Test
    void fileCreationShouldBeRejected() {
        String code = "import java.io.File;\npublic class UserCode { File f = new File(\"/etc/passwd\"); }";
        SandboxValidator.Result r = SandboxValidator.validate(code);
        assertFalse(r.allowed, "File creation should be rejected");
    }

    @Test
    void socketCreationShouldBeRejected() {
        String code = "import java.net.Socket;\npublic class UserCode { Socket s; }";
        SandboxValidator.Result r = SandboxValidator.validate(code);
        assertFalse(r.allowed, "Socket import should be rejected");
    }

    @Test
    void classForNameShouldBeRejected() {
        String code = "public class UserCode { public static void main(String[] a) throws Exception " +
            "{ Class.forName(\"evil\"); } }";
        SandboxValidator.Result r = SandboxValidator.validate(code);
        assertFalse(r.allowed, "Class.forName should be rejected");
    }

    @Test
    void reflectionGetDeclaredMethodShouldBeRejected() {
        String code = "public class UserCode { public static void main(String[] a) throws Exception " +
            "{ String.class.getDeclaredMethod(\"x\"); } }";
        SandboxValidator.Result r = SandboxValidator.validate(code);
        assertFalse(r.allowed, "getDeclaredMethod should be rejected");
    }

    @Test
    void blankCodeShouldPass() {
        SandboxValidator.Result r = SandboxValidator.validate("");
        assertTrue(r.allowed);
    }

    @Test
    void codeWithOnlyCommentsShouldPass() {
        String code = "// just a comment\n/* block */";
        SandboxValidator.Result r = SandboxValidator.validate(code);
        assertTrue(r.allowed);
    }

    @Test
    void processBuilderShouldBeRejected() {
        String code = "public class UserCode { ProcessBuilder pb = new ProcessBuilder(); }";
        SandboxValidator.Result r = SandboxValidator.validate(code);
        assertFalse(r.allowed, "ProcessBuilder should be rejected");
    }

    @Test
    void forLoopCodeShouldPass() {
        String code = "public class UserCode { public static void main(String[] a) { " +
            "for(int i=0;i<10;i++){ int x = i; } } }";
        SandboxValidator.Result r = SandboxValidator.validate(code);
        assertTrue(r.allowed, "for loop should pass");
    }

    @Test
    void importPositionErrorShouldBeDetected() {
        String code = "public class UserCode { }\nimport java.util.List;";
        SandboxValidator.Result r = SandboxValidator.validate(code);
        assertFalse(r.allowed, "import after class should be rejected");
        assertTrue(r.reason.contains("import") && r.reason.contains("文件顶部"));
    }
}
