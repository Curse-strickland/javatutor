package com.javatutor.sandbox;

import java.security.Permission;

/**
 * 运行时安全沙箱：继承 SecurityManager，在执行用户代码期间拦截危险操作。
 *
 * Java 17 中 SecurityManager 标记为 deprecated，但仍可用。
 * 该管理器仅作用于用户代码执行线程，执行完毕立即恢复原管理器。
 *
 * 关键设计：重写 checkPermission 为完全放行，仅通过 checkXxx 拦截指定操作。
 * 如果不放行 checkPermission，安装 SecurityManager 后 JVM 会对所有权限做全量检查，
 * 连 Tomcat 正常的 setContextClassLoader、类加载等都会被阻断。
 *
 * 拦截范围：
 *   - 文件写入/删除：禁止
 *   - 外部网络连接：禁止（localhost 放行，否则 Tomcat 无法通信）
 *   - 外部进程执行：禁止
 *   - System.exit：一律拒绝
 *   - 文件读取/网络监听/连接接受：放行（AST 层已覆盖，运行时拦截会误伤 Tomcat）
 */
public class SafeSecurityManager extends SecurityManager {

    /**
     * 默认放行所有权限。
     * 只通过重写的 checkXxx 方法拦截特定操作。
     */
    @Override
    public void checkPermission(Permission perm) {
        // 放行
    }

    @Override
    public void checkPermission(Permission perm, Object context) {
        // 放行
    }

    @Override
    public void checkExec(String cmd) {
        throw new SecurityException("沙箱: 不允许执行外部命令: " + cmd);
    }

    @Override
    public void checkWrite(String file) {
        if (file != null) {
            throw new SecurityException("沙箱: 不允许写入文件: " + file);
        }
    }

    @Override
    public void checkDelete(String file) {
        if (file != null) {
            throw new SecurityException("沙箱: 不允许删除文件: " + file);
        }
    }

    /**
     * 不拦截文件读取 — AST 层 FileInputStream/FileReader 类型黑名单已覆盖。
     */
    @Override
    public void checkRead(String file) {
        // 放行
    }

    /**
     * 放行 localhost，只拦截外部网络连接。
     * 必须放行 localhost，否则 Tomcat 无法处理 HTTP 请求。
     */
    @Override
    public void checkConnect(String host, int port) {
        if (!isLocal(host)) {
            throw new SecurityException("沙箱: 不允许外部网络连接: " + host + ":" + port);
        }
    }

    @Override
    public void checkConnect(String host, int port, Object context) {
        checkConnect(host, port);
    }

    @Override
    public void checkListen(int port) {
        // 放行，Tomcat 需要监听端口
    }

    @Override
    public void checkAccept(String host, int port) {
        // 放行，Tomcat 需要接受 HTTP 连接
    }

    @Override
    public void checkExit(int status) {
        throw new SecurityException("沙箱: 不允许调用 System.exit(" + status + ")");
    }

    private boolean isLocal(String host) {
        return "localhost".equals(host) || "127.0.0.1".equals(host) || "::1".equals(host);
    }
}
