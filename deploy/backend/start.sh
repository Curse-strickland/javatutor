#!/bin/bash
# ============================================================
# start.sh — 服务器上启动后端
# 放到 /opt/javatutor/ 目录下
# 使用 systemd 管理更佳，这里保留最传统的 nohup 方式
# ============================================================
cd "$(dirname "$0")"

JAR="javatutor-backend-0.1.0.jar"
LOG="backend.log"
PID_FILE="javatutor.pid"

# 检查是否已在运行
if [ -f "$PID_FILE" ]; then
    PID=$(cat "$PID_FILE")
    if kill -0 "$PID" 2>/dev/null; then
        echo "后端已在运行 (PID: $PID)"
        exit 1
    fi
    rm -f "$PID_FILE"
fi

echo "启动 JavaTutor 后端 ..."
nohup java -jar "$JAR" \
    --spring.config.additional-location=file:./application-prod.properties \
    > "$LOG" 2>&1 &

PID=$!
echo $PID > "$PID_FILE"
echo "已启动 (PID: $PID)"
echo "日志: $LOG"
