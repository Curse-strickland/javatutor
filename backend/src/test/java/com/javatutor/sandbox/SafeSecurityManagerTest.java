package com.javatutor.sandbox;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.security.Permission;

import static org.junit.jupiter.api.Assertions.*;

class SafeSecurityManagerTest {

    private SafeSecurityManager ssm;

    @BeforeEach
    void setUp() {
        ssm = new SafeSecurityManager();
    }

    @Test
    void checkPermissionShouldNotThrow() {
        Permission perm = new RuntimePermission("setSecurityManager");
        assertDoesNotThrow(() -> ssm.checkPermission(perm));
        assertDoesNotThrow(() -> ssm.checkPermission(perm, null));
    }

    @Test
    void checkExecShouldThrow() {
        SecurityException ex = assertThrows(SecurityException.class,
            () -> ssm.checkExec("rm -rf /"));
        assertTrue(ex.getMessage().contains("沙箱"));
        assertTrue(ex.getMessage().contains("外部命令"));
    }

    @Test
    void checkWriteShouldThrow() {
        SecurityException ex = assertThrows(SecurityException.class,
            () -> ssm.checkWrite("/etc/passwd"));
        assertTrue(ex.getMessage().contains("沙箱"));
    }

    @Test
    void checkWriteWithNullShouldNotThrow() {
        assertDoesNotThrow(() -> ssm.checkWrite((String) null));
    }

    @Test
    void checkDeleteShouldThrow() {
        SecurityException ex = assertThrows(SecurityException.class,
            () -> ssm.checkDelete("/tmp/foo"));
        assertTrue(ex.getMessage().contains("沙箱"));
    }

    @Test
    void checkDeleteWithNullShouldNotThrow() {
        assertDoesNotThrow(() -> ssm.checkDelete((String) null));
    }

    @Test
    void checkReadShouldNotThrow() {
        assertDoesNotThrow(() -> ssm.checkRead("/etc/passwd"));
    }

    @Test
    void checkExitShouldThrow() {
        SecurityException ex = assertThrows(SecurityException.class,
            () -> ssm.checkExit(0));
        assertTrue(ex.getMessage().contains("System.exit"));
    }

    @Test
    void checkConnectToExternalHostShouldThrow() {
        SecurityException ex = assertThrows(SecurityException.class,
            () -> ssm.checkConnect("evil.com", 80));
        assertTrue(ex.getMessage().contains("外部网络连接"));
    }

    @Test
    void checkConnectWithContextToExternalHostShouldThrow() {
        SecurityException ex = assertThrows(SecurityException.class,
            () -> ssm.checkConnect("evil.com", 80, null));
        assertTrue(ex.getMessage().contains("外部网络连接"));
    }

    @Test
    void checkConnectToLocalhostShouldNotThrow() {
        assertDoesNotThrow(() -> ssm.checkConnect("localhost", 8080));
        assertDoesNotThrow(() -> ssm.checkConnect("127.0.0.1", 8080));
        assertDoesNotThrow(() -> ssm.checkConnect("::1", 8080));
    }

    @Test
    void checkListenShouldNotThrow() {
        assertDoesNotThrow(() -> ssm.checkListen(8080));
    }

    @Test
    void checkAcceptShouldNotThrow() {
        assertDoesNotThrow(() -> ssm.checkAccept("localhost", 8080));
    }

    @Test
    void checkExecRejectsAllCommands() {
        assertThrows(SecurityException.class, () -> ssm.checkExec("cmd"));
        assertThrows(SecurityException.class, () -> ssm.checkExec("powershell"));
        assertThrows(SecurityException.class, () -> ssm.checkExec("bash"));
    }
}
