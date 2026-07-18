#!/bin/bash
# ============================================================
# build.sh — 本地构建脚本
# 用法：在本地开发机上执行 ./deploy/scripts/build.sh
# 作用：编译前端 + 后端，产物输出到 deploy/ 目录
# ============================================================
set -e

PROJECT_DIR="$(cd "$(dirname "$0")/../.." && pwd)"
DEPLOY_DIR="$PROJECT_DIR/deploy"
FRONTEND_DIR="$PROJECT_DIR/javatutor/frontend"
BACKEND_DIR="$PROJECT_DIR/javatutor/backend"

echo "=========================================="
echo " JavaTutor 构建脚本"
echo "=========================================="

# ---- 1. 构建前端 ----
echo ""
echo "[1/2] 构建前端 ..."
cd "$FRONTEND_DIR"
npm install --silent
npm run build
rm -rf "$DEPLOY_DIR/frontend/dist"
cp -r dist "$DEPLOY_DIR/frontend/dist"
echo "      ✓ 前端产物 → deploy/frontend/dist/"

# ---- 2. 构建后端 ----
echo ""
echo "[2/2] 构建后端 ..."
cd "$BACKEND_DIR"
mvn clean package -DskipTests -q
cp target/javatutor-backend-0.1.0.jar "$DEPLOY_DIR/backend/"
echo "      ✓ 后端产物 → deploy/backend/javatutor-backend-0.1.0.jar"

echo ""
echo "=========================================="
echo " 构建完成！产物在 deploy/ 目录下"
echo " 运行 ./deploy/scripts/deploy.sh 推送到服务器"
echo "=========================================="
