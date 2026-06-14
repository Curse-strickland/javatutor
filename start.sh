#!/usr/bin/env bash
# ============================================================
# JavaTutor 一键启动 (Linux / macOS / Git Bash)
# 自动检测 Java / Maven / Node.js，无需手动配置
# ============================================================
set -e

# Project root = directory containing this script
PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_ROOT"

echo "========================================"
echo "  JavaTutor — Starting..."
echo "========================================"
echo ""

# ---- 1. Find Java 17+ ----
JAVA_CMD=""

# 1a. JAVA_HOME
if [ -n "$JAVA_HOME" ] && [ -x "$JAVA_HOME/bin/java" ]; then
    JAVA_CMD="$JAVA_HOME/bin/java"
fi

# 1b. PATH
if [ -z "$JAVA_CMD" ] && command -v java >/dev/null 2>&1; then
    JAVA_CMD="$(command -v java)"
fi

# 1c. Common locations
if [ -z "$JAVA_CMD" ]; then
    for d in \
        /usr/lib/jvm/java-17-* /usr/lib/jvm/java-21-* \
        /usr/lib/jvm/jdk-17* /usr/lib/jvm/jdk-21* \
        /Library/Java/JavaVirtualMachines/jdk-17*/Contents/Home \
        /Library/Java/JavaVirtualMachines/jdk-21*/Contents/Home \
        "$HOME/.jdks/"*-17* "$HOME/.jdks/"*-21* ; do
        if [ -x "$d/bin/java" ]; then
            JAVA_CMD="$d/bin/java"
            JAVA_HOME="$d"
            break
        fi
    done
fi

if [ -z "$JAVA_CMD" ]; then
    echo "[ERROR] Java 17+ not found."
    echo "  macOS:   brew install openjdk@17"
    echo "  Ubuntu:  sudo apt install openjdk-17-jdk"
    echo "  Manual:  https://adoptium.net/"
    exit 1
fi

JAVA_VER=$("$JAVA_CMD" -version 2>&1 | head -1)
echo "[OK] Java found: $JAVA_VER"
export JAVA_HOME="${JAVA_HOME:-$(dirname "$(dirname "$JAVA_CMD")")}"
export PATH="$JAVA_HOME/bin:$PATH"

# ---- 2. Find Maven (via mvnw — auto-downloads if needed) ----
MVNW="$PROJECT_ROOT/backend/mvnw"
if [ ! -f "$MVNW" ]; then
    echo "[ERROR] mvnw not found at: $MVNW"
    exit 1
fi
chmod +x "$MVNW" 2>/dev/null || true
echo "[OK] Maven: using wrapper (auto-downloads if not installed)"

# ---- 3. Find Node.js ----
NODE_CMD=""

if command -v node >/dev/null 2>&1; then
    NODE_CMD="$(command -v node)"
elif [ -x "/usr/local/bin/node" ]; then
    NODE_CMD="/usr/local/bin/node"
elif [ -x "/opt/homebrew/bin/node" ]; then
    NODE_CMD="/opt/homebrew/bin/node"
fi

if [ -z "$NODE_CMD" ]; then
    echo "[ERROR] Node.js not found."
    echo "  macOS:  brew install node"
    echo "  Ubuntu: sudo apt install nodejs npm"
    echo "  Manual: https://nodejs.org/"
    exit 1
fi
NODE_VER=$("$NODE_CMD" -v 2>&1)
echo "[OK] Node.js found: $NODE_VER"

# ---- 4. Load .env ----
if [ -f "$PROJECT_ROOT/.env" ]; then
    set -a
    # shellcheck disable=SC1091
    source "$PROJECT_ROOT/.env"
    set +a
fi

if [ -z "$ZHIPU_API_KEY" ]; then
    echo ""
    echo "[NOTE] No ZHIPU_API_KEY found in .env — AI features need a key."
    echo "       Get a free key at: https://open.bigmodel.cn"
    echo "       Then add it to .env: ZHIPU_API_KEY=your-key"
fi

# ---- 5. Check frontend dependencies ----
if [ ! -d "$PROJECT_ROOT/frontend/node_modules" ]; then
    echo ""
    echo "[SETUP] Installing frontend dependencies (one-time)..."
    cd "$PROJECT_ROOT/frontend"
    npm install
    cd "$PROJECT_ROOT"
fi

# ---- 6. Launch services ----
echo ""
echo "[1/2] Starting backend (Spring Boot :8080)..."
cd "$PROJECT_ROOT/backend"
"$MVNW" spring-boot:run &
BACKEND_PID=$!
cd "$PROJECT_ROOT"

echo "[2/2] Starting frontend (Vite :5173)..."
cd "$PROJECT_ROOT/frontend"
npm run dev &
FRONTEND_PID=$!
cd "$PROJECT_ROOT"

echo ""
echo "  Backend  PID: $BACKEND_PID"
echo "  Frontend PID: $FRONTEND_PID"
echo ""
echo "Waiting for services to start..."
sleep 6

# ---- 7. Open browser ----
if command -v open >/dev/null 2>&1; then
    open "http://localhost:5173"
elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "http://localhost:5173"
elif command -v start >/dev/null 2>&1; then
    start "http://localhost:5173"
else
    echo "Please open: http://localhost:5173"
fi

echo ""
echo "========================================"
echo "  Done! Browser opened to localhost:5173"
echo "  To stop: run stop.sh or Ctrl+C"
echo "========================================"

# Wait for background processes
trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
