#!/bin/bash
# ============================================================
# stop.sh — 服务器上停止后端
# ============================================================
cd "$(dirname "$0")"

PID_FILE="javatutor.pid"

if [ ! -f "$PID_FILE" ]; then
    echo "未找到 $PID_FILE，尝试用 pkill ..."
    pkill -f "javatutor-backend" 2>/dev/null || echo "后端未运行"
    exit 0
fi

PID=$(cat "$PID_FILE")
if kill -0 "$PID" 2>/dev/null; then
    echo "停止后端 (PID: $PID) ..."
    kill "$PID"
    sleep 2
    # 强制杀死
    if kill -0 "$PID" 2>/dev/null; then
        echo "强制停止 ..."
        kill -9 "$PID" 2>/dev/null
    fi
    echo "已停止"
else
    echo "后端未运行"
fi
rm -f "$PID_FILE"
