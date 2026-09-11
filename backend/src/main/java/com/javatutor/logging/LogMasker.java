package com.javatutor.logging;

import java.util.regex.Pattern;

/**
 * 日志脱敏工具：把日志里可能出现的敏感字段值打码为 {@code ***}。
 *
 * <p>纯静态工具，便于单测。对 {@code null} / 空串直接原样返回。
 * 覆盖三类形态：JSON 带引号的键、表单/查询串的 {@code key=value}、以及
 * {@code Authorization: Bearer xxx} 头里的凭据。
 */
public final class LogMasker {

    private LogMasker() {}

    /** JSON 里带引号的敏感键，值整体替换为 ***。 */
    private static final Pattern JSON_SENSITIVE = Pattern.compile(
        "(?i)(\"(?:api[-_]?key|token|authorization|password|passwd|secret|access[-_]?key|access[-_]?token|session[-_]?id)\"\\s*:\\s*\")([^\"]*)(\")");

    /** Authorization: Bearer xxx / Basic xxx（冒号或等号分隔均支持），凭据替换为 ***。 */
    private static final Pattern AUTH_HEADER = Pattern.compile(
        "(?i)(authorization\\s*[:=]\\s*(?:bearer|basic)\\s+)([^\\s,;]+)");

    /** 非 JSON 形式 key=value / key: value 的敏感值（不含 authorization，已由 AUTH_HEADER 处理）。 */
    private static final Pattern KV_SENSITIVE = Pattern.compile(
        "(?i)\\b(api[-_]?key|token|password|passwd|secret|access[-_]?key|access[-_]?token)\\b(\\s*[=:]\\s*)([^&\\s\"',;]+)");

    public static String mask(String body) {
        if (body == null || body.isEmpty()) {
            return body;
        }
        String out = JSON_SENSITIVE.matcher(body).replaceAll("$1***$3");
        out = AUTH_HEADER.matcher(out).replaceAll("$1***");
        out = KV_SENSITIVE.matcher(out).replaceAll("$1$2***");
        return out;
    }

    /** 超长内容截断，末尾追加可读的省略标记。 */
    public static String truncate(String s, int maxChars) {
        if (s == null) {
            return null;
        }
        if (s.length() <= maxChars) {
            return s;
        }
        return s.substring(0, maxChars) + "…[truncated " + (s.length() - maxChars) + " chars]";
    }
}
