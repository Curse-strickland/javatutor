#!/bin/bash
# ============================================================
# logs.sh — JavaTutor 日志查询辅助脚本（阶段 2：让开发者"查得方便"）
# 服务器路径：/opt/javatutor/logs.sh（随 deploy.sh 一起推送）
#
# 用法：
#   ./logs.sh                       # 实时 tail request.log，jq 美化（有 jq 时）
#   ./logs.sh grep <requestId>      # 按 request-id 查一次交互的全部记录
#   ./logs.sh slow [N]              # 列出最慢的 N 个请求（默认 20）
#   ./logs.sh status [code]         # 按状态码过滤（默认 500）
#   ./logs.sh path <关键字>         # 按接口路径/关键字过滤
#   ./logs.sh app [N]               # 实时 tail 应用日志 app.log（默认 100 行）
#
# 依赖：jq（可选，未安装时输出原始 JSON 行）。安装：apt-get install -y jq
# ============================================================
set -euo pipefail

LOG_DIR="${JAVATUTOR_LOG_DIR:-/opt/javatutor/logs}"
REQ="$LOG_DIR/request.log"

# jq 可选：有则美化输出，无则原样输出 JSON 行
JQ=(cat)
if command -v jq >/dev/null 2>&1; then
    JQ=(jq -C .)
fi

case "${1:-}" in
  grep)
    : "${2:?用法: $0 grep <requestId>}"
    grep -h -- "$2" "$LOG_DIR"/request*.log | "${JQ[@]}"
    ;;
  slow)
    N="${2:-20}"
    grep -h '"durationMs"' "$LOG_DIR"/request*.log \
      | jq -s "sort_by(.durationMs) | reverse | .[0:$N][] | {ts, requestId, method, path, status, durationMs}"
    ;;
  status)
    C="${2:-500}"
    grep -h "\"status\":$C" "$LOG_DIR"/request*.log | "${JQ[@]}"
    ;;
  path)
    : "${2:?用法: $0 path <关键字>}"
    grep -h -- "$2" "$LOG_DIR"/request*.log | "${JQ[@]}"
    ;;
  app)
    N="${2:-100}"
    tail -n "$N" -f "$LOG_DIR/app.log"
    ;;
  ""|-h|--help|help)
    echo "用法: $0 {grep <id> | slow [N] | status [code] | path <kw> | app [N]}"
    echo "无参数 = 实时 tail request.log（按 Ctrl+C 退出）"
    tail -f "$REQ" | "${JQ[@]}"
    ;;
  *)
    echo "未知命令: $1" >&2
    echo "用法: $0 {grep <id> | slow [N] | status [code] | path <kw> | app [N]}" >&2
    exit 1
    ;;
esac
