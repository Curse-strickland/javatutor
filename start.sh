#!/bin/bash
# JavaTutor 一键启动 (bash 终端用)
# 用法: ./start.sh

export JAVA_HOME="C:/Users/h2624/.jdks/ms-17.0.19"
export PATH="C:/Users/h2624/.jdks/ms-17.0.19/bin:$PATH"
MVN="C:/Users/h2624/apache-maven-3.9.9/bin/mvn"

echo "=== JavaTutor 启动 ==="

echo "[1/2] 启动后端..."
(cd "d:/CHome/Documents/EL/JavaTutor/backend" && "$MVN" spring-boot:run) &
BACKEND_PID=$!

echo "[2/2] 启动前端..."
(cd "d:/CHome/Documents/EL/JavaTutor/frontend" && npm run dev) &
FRONTEND_PID=$!

echo "后端 PID=$BACKEND_PID  前端 PID=$FRONTEND_PID"
echo "等待就绪... localhost:5173"
sleep 6
start http://localhost:5173 2>/dev/null || echo "请手动打开 http://localhost:5173"

wait
