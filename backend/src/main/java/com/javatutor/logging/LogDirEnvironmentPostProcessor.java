package com.javatutor.logging;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.env.EnvironmentPostProcessor;
import org.springframework.core.env.ConfigurableEnvironment;
import org.springframework.core.env.MapPropertySource;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.HashMap;
import java.util.Map;

/**
 * 日志目录不可写时降级到临时目录，不让「日志写不出去」升级成「整个应用起不来」。
 *
 * <p>背景：{@code logback-spring.xml} 里的两个 {@code RollingFileAppender} 若打不开日志文件，
 * 会以 ERROR 状态结束配置；{@code LogbackLoggingSystem.reportConfigurationErrorsIfNecessary}
 * 会把 <b>任何</b> logback 配置 ERROR 升级为启动失败 —— 于是「少写几条日志」变成「进程 exit 1」，
 * 外部表现为 nginx 对全部 {@code /api/*} 返回 502。线上出现过一次：部署脚本用 root 建
 * {@code /opt/javatutor/logs}，systemd 却以非 root 用户运行。
 *
 * <p>部署侧已在 {@code deploy.yml} 里 chown 该目录（防复发的主手段，见 T3）；本类是<b>最后一道</b>
 * 防线，覆盖部署脚本够不着的路径：换机器、改路径、磁盘满、权限被 reset。取舍：降级后日志落到
 * {@code java.io.tmpdir}（可能被系统清理、也不是运维预期位置），但服务是活的 —— 对「教学站点
 * 整站不可用」而言这个交换划算。
 *
 * <p>注册于 {@code META-INF/spring.factories}。未实现 {@code Ordered}，故取默认的
 * {@code LOWEST_PRECEDENCE}：晚于 {@code ConfigDataEnvironmentPostProcessor}，
 * 因此能读到 {@code application.properties} 解析后的值（含 {@code JAVATUTOR_LOG_DIR} 占位符）。
 * 本类在 logback 初始化<b>之前</b>运行（LoggingApplicationListener 更晚），所以覆盖属性对
 * {@code <springProperty source="javatutor.logging.dir">} 生效。
 */
public class LogDirEnvironmentPostProcessor implements EnvironmentPostProcessor {

    static final String PROP = "javatutor.logging.dir";

    @Override
    public void postProcessEnvironment(ConfigurableEnvironment environment, SpringApplication application) {
        String configured = environment.getProperty(PROP);
        if (configured == null || configured.isBlank()) {
            return;
        }
        Path dir = Paths.get(configured).toAbsolutePath();
        if (isUsable(dir)) {
            return;
        }

        Path fallback = Paths.get(System.getProperty("java.io.tmpdir"), "javatutor-logs");
        if (!isUsable(fallback)) {
            // 临时目录也写不了，无从降级：保持原值，让 logback 按原样报错（至少错误信息是真实的）
            System.err.println("[WARN] 日志目录不可写，且临时目录同样不可写，保持原配置：" + dir);
            return;
        }

        Map<String, Object> override = new HashMap<>();
        override.put(PROP, fallback.toString());
        // addFirst：优先级高于 application.properties，确保 <springProperty> 读到降级后的值
        environment.getPropertySources().addFirst(new MapPropertySource("javatutorLogDirFallback", override));
        System.err.println("[WARN] 日志目录不可写，已降级到 " + fallback + "（原配置：" + dir
                + "）。日志不会被长期保留，请修正目录属主/权限后重启服务。");
    }

    /**
     * 目录可建且可写。用 {@code createDirectories} 顺带探测父目录可创建性
     * （目录不存在时只探 {@code isWritable} 会漏判）。
     */
    static boolean isUsable(Path dir) {
        try {
            Files.createDirectories(dir);
            return Files.isDirectory(dir) && Files.isWritable(dir);
        } catch (Exception e) {
            return false;
        }
    }
}
