package com.javatutor.logging;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.core.env.MapPropertySource;
import org.springframework.core.env.StandardEnvironment;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 守卫「日志目录不可写 → 降级到临时目录」这条最后防线（T6）。
 *
 * <p>为什么值得测：这条分支一旦失效，故障就是「整站 /api/* 502」而不是「日志丢了」——
 * 代价极不对称，所以哪怕它只是兜底也必须有回归保护。
 */
class LogDirEnvironmentPostProcessorTest {

    private static StandardEnvironment envWith(String dir) {
        StandardEnvironment env = new StandardEnvironment();
        env.getPropertySources().addFirst(
                new MapPropertySource("test", Map.of(LogDirEnvironmentPostProcessor.PROP, dir)));
        return env;
    }

    @Test
    void keepsConfiguredDirWhenWritable(@TempDir Path tmp) {
        Path good = tmp.resolve("logs");
        StandardEnvironment env = envWith(good.toString());

        new LogDirEnvironmentPostProcessor().postProcessEnvironment(env, null);

        assertEquals(good.toString(), env.getProperty(LogDirEnvironmentPostProcessor.PROP),
                "目录可用时不得改写配置");
        assertTrue(Files.isDirectory(good), "可用目录应被就地创建（logback 依赖父目录存在）");
    }

    @Test
    void degradesToTempDirWhenConfiguredDirUnusable(@TempDir Path tmp) throws Exception {
        // 拿一个普通文件当父目录 → createDirectories 必然失败，等价于「目录不可写」
        Path file = tmp.resolve("not-a-dir");
        Files.writeString(file, "x");
        String bad = file.resolve("logs").toString();
        StandardEnvironment env = envWith(bad);

        new LogDirEnvironmentPostProcessor().postProcessEnvironment(env, null);

        String resolved = env.getProperty(LogDirEnvironmentPostProcessor.PROP);
        assertNotEquals(bad, resolved, "不可用目录必须被覆盖，否则 logback 仍会判配置错误");
        assertTrue(resolved.endsWith("javatutor-logs"), "应降级到 <tmpdir>/javatutor-logs，实际：" + resolved);
    }
}
