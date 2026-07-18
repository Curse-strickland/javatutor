#!/bin/bash
# ============================================================
# deploy.sh — 部署推送脚本
# 用法：./deploy/scripts/deploy.sh <服务器地址>
# 示例：./deploy/scripts/deploy.sh root@your-server.com
# 作用：将构建产物 scp 到生产服务器
# ============================================================
set -e

if [ $# -lt 1 ]; then
    echo "用法: $0 <user@host>"
    echo "示例: $0 root@123.45.67.89"
    exit 1
fi

SERVER="$1"
DEPLOY_DIR="$(cd "$(dirname "$0")/.." && pwd)"
REMOTE_DIR="/opt/javatutor"
REMOTE_WEB_ROOT="/var/www/javatutor"

echo "=========================================="
echo " 部署到 $SERVER"
echo "=========================================="

# ---- 1. 推送后端 jar ----
echo ""
echo "[1/2] 推送后端 ..."
ssh "$SERVER" "mkdir -p $REMOTE_DIR"
scp "$DEPLOY_DIR/backend/javatutor-backend-0.1.0.jar" "$SERVER:$REMOTE_DIR/"
scp "$DEPLOY_DIR/backend/start.sh" "$SERVER:$REMOTE_DIR/"
scp "$DEPLOY_DIR/backend/stop.sh" "$SERVER:$REMOTE_DIR/"
scp "$DEPLOY_DIR/backend/application-prod.properties" "$SERVER:$REMOTE_DIR/"
echo "      ✓ 后端已推送至 $REMOTE_DIR"

# ---- 2. 推送前端静态文件 ----
echo ""
echo "[2/2] 推送前端 ..."
ssh "$SERVER" "mkdir -p $REMOTE_WEB_ROOT"
rsync -avz --delete "$DEPLOY_DIR/frontend/dist/" "$SERVER:$REMOTE_WEB_ROOT/" > /dev/null 2>&1
echo "      ✓ 前端已推送至 $REMOTE_WEB_ROOT"

# ---- 3. 重启后端 ----
echo ""
echo "重启后端服务 ..."
ssh "$SERVER" "cd $REMOTE_DIR && bash stop.sh && bash start.sh"

echo ""
echo "=========================================="
echo " 部署完成！"
echo " 前端: http://$SERVER"
echo " API: http://$SERVER/api"
echo "=========================================="
