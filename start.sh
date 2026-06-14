#!/usr/bin/env bash
# ============================================================
# JavaTutor Quick Start (Linux / macOS)
# Auto-downloads JDK 17 + Node.js if not installed
# ============================================================
set -e

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_ROOT"

RUNTIME="${HOME}/.javatutor/runtime"
mkdir -p "$RUNTIME"

echo "============================================="
echo "  JavaTutor - Starting..."
echo "============================================="
echo ""

# ---- helpers ----
check_java_version() {
    local ver
    ver=$("$1" -version 2>&1 | head -1 | grep -oP '"(\d+\.)?(\d+)[^"]*' | tr -d '"')
    local major
    major=$(echo "$ver" | cut -d. -f1)
    if [ "$major" = "1" ]; then
        major=$(echo "$ver" | cut -d. -f2)
    fi
    echo "$major"
}

# ================================================================
# 1. Find or download JDK 17+
# ================================================================
JAVA_CMD=""
JDK_HOME="${RUNTIME}/jdk-17"

# 1a. JAVA_HOME
if [ -n "$JAVA_HOME" ] && [ -x "$JAVA_HOME/bin/java" ]; then
    MAJOR=$(check_java_version "$JAVA_HOME/bin/java")
    if [ "$MAJOR" -ge 17 ] 2>/dev/null; then
        JAVA_CMD="$JAVA_HOME/bin/java"
    fi
fi

# 1b. PATH
if [ -z "$JAVA_CMD" ] && command -v java >/dev/null 2>&1; then
    MAJOR=$(check_java_version "$(command -v java)")
    if [ "$MAJOR" -ge 17 ] 2>/dev/null; then
        JAVA_CMD="$(command -v java)"
        JAVA_HOME="$(dirname "$(dirname "$JAVA_CMD")")"
    else
        echo "[INFO] System Java is too old (need 17+), checking elsewhere..."
    fi
fi

# 1c. Common locations
if [ -z "$JAVA_CMD" ]; then
    for d in \
        /usr/lib/jvm/java-17-* /usr/lib/jvm/java-21-* \
        /usr/lib/jvm/jdk-17* /usr/lib/jvm/jdk-21* \
        /Library/Java/JavaVirtualMachines/jdk-17*/Contents/Home \
        /Library/Java/JavaVirtualMachines/jdk-21*/Contents/Home \
        /opt/homebrew/opt/openjdk@17 \
        /usr/local/opt/openjdk@17 \
        "$HOME/.jdks/"*-17* "$HOME/.jdks/"*-21* ; do
        if [ -x "$d/bin/java" ]; then
            MAJOR=$(check_java_version "$d/bin/java")
            if [ "$MAJOR" -ge 17 ] 2>/dev/null; then
                JAVA_CMD="$d/bin/java"
                JAVA_HOME="$d"
                break
            fi
        fi
    done
fi

# 1d. Previously auto-downloaded
if [ -z "$JAVA_CMD" ] && [ -x "$JDK_HOME/bin/java" ]; then
    JAVA_CMD="$JDK_HOME/bin/java"
    JAVA_HOME="$JDK_HOME"
fi

# 1e. Auto-download JDK 17
if [ -z "$JAVA_CMD" ]; then
    echo ""
    echo "[SETUP] JDK 17+ not found. Downloading Eclipse Temurin JDK 17..."
    echo "        This is a one-time download (~180 MB). Please wait..."
    echo ""

    OS="$(uname -s)"
    ARCH="$(uname -m)"
    case "$OS" in
        Linux)  OS_NAME="linux" ;;
        Darwin) OS_NAME="mac" ;;
        *)      OS_NAME="linux" ;;
    esac
    case "$ARCH" in
        x86_64|amd64) ARCH_NAME="x64" ;;
        aarch64|arm64) ARCH_NAME="aarch64" ;;
        *) ARCH_NAME="x64" ;;
    esac

    JDK_URL="https://api.adoptium.net/v3/binary/latest/17/ga/${OS_NAME}/${ARCH_NAME}/jdk/hotspot/normal/eclipse"
    JDK_ARCHIVE="${RUNTIME}/jdk-17.tar.gz"

    if command -v curl >/dev/null 2>&1; then
        curl -L --progress-bar "$JDK_URL" -o "$JDK_ARCHIVE"
    elif command -v wget >/dev/null 2>&1; then
        wget -q --show-progress "$JDK_URL" -O "$JDK_ARCHIVE"
    else
        echo "[ERROR] Need curl or wget to download JDK."
        echo "  Install JDK 17+ manually: https://adoptium.net/"
        exit 1
    fi

    if [ ! -f "$JDK_ARCHIVE" ]; then
        echo "[ERROR] JDK download failed."
        echo "  Install manually: https://adoptium.net/"
        exit 1
    fi

    echo "[SETUP] Extracting JDK..."
    rm -rf "$JDK_HOME" 2>/dev/null || true
    mkdir -p "$JDK_HOME"

    if [[ "$JDK_ARCHIVE" == *.zip ]]; then
        unzip -qo "$JDK_ARCHIVE" -d "$RUNTIME/"
        # Temurin extracts to a versioned dir — move contents to jdk-17
        for d in "$RUNTIME"/jdk-17* "$RUNTIME"/OpenJDK* "$RUNTIME"/temurin*; do
            if [ -d "$d" ] && [ "$d" != "$JDK_HOME" ]; then
                mv "$d"/* "$JDK_HOME"/ 2>/dev/null && rm -rf "$d" && break
            fi
        done
    else
        tar -xzf "$JDK_ARCHIVE" -C "$RUNTIME/"
        for d in "$RUNTIME"/jdk-17* "$RUNTIME"/OpenJDK* "$RUNTIME"/temurin*; do
            if [ -d "$d" ] && [ "$d" != "$JDK_HOME" ]; then
                mv "$d"/* "$JDK_HOME"/ 2>/dev/null && rm -rf "$d" && break
            fi
        done
    fi
    rm -f "$JDK_ARCHIVE"

    if [ ! -x "$JDK_HOME/bin/java" ]; then
        echo "[ERROR] JDK extraction failed."
        echo "  Install JDK 17+ manually: https://adoptium.net/"
        exit 1
    fi
    JAVA_CMD="$JDK_HOME/bin/java"
    JAVA_HOME="$JDK_HOME"
    echo "[OK] JDK installed."
fi

JAVA_VER=$("$JAVA_CMD" -version 2>&1 | head -1)
echo "[OK] Java: $JAVA_VER"
export JAVA_HOME
export PATH="$JAVA_HOME/bin:$PATH"

# ================================================================
# 2. Maven (via mvnw — auto-downloads)
# ================================================================
MVNW="$PROJECT_ROOT/backend/mvnw"
if [ ! -f "$MVNW" ]; then
    echo "[ERROR] mvnw not found at: $MVNW"
    exit 1
fi
chmod +x "$MVNW" 2>/dev/null || true
echo "[OK] Maven: wrapper (auto-downloads when needed)"

# ================================================================
# 3. Find or download Node.js
# ================================================================
NODE_CMD=""
NODE_HOME="${RUNTIME}/node"

# 3a. PATH / common locations
if command -v node >/dev/null 2>&1; then
    NODE_CMD="$(command -v node)"
elif [ -x "/usr/local/bin/node" ]; then
    NODE_CMD="/usr/local/bin/node"
elif [ -x "/opt/homebrew/bin/node" ]; then
    NODE_CMD="/opt/homebrew/bin/node"
fi

# 3b. Previously auto-downloaded
if [ -z "$NODE_CMD" ] && [ -x "$NODE_HOME/bin/node" ]; then
    NODE_CMD="$NODE_HOME/bin/node"
    export PATH="$NODE_HOME/bin:$PATH"
fi

# 3c. Auto-download Node.js
if [ -z "$NODE_CMD" ]; then
    echo ""
    echo "[SETUP] Node.js not found. Downloading Node.js LTS..."
    echo "        This is a one-time download (~30 MB). Please wait..."
    echo ""

    NODE_VERSION="v20.18.1"
    OS="$(uname -s)"
    ARCH="$(uname -m)"
    case "$OS" in
        Darwin) NODE_OS="darwin" ;;
        *)      NODE_OS="linux" ;;
    esac
    case "$ARCH" in
        x86_64|amd64) NODE_ARCH="x64" ;;
        aarch64|arm64) NODE_ARCH="arm64" ;;
        *) NODE_ARCH="x64" ;;
    esac

    NODE_URL="https://nodejs.org/dist/${NODE_VERSION}/node-${NODE_VERSION}-${NODE_OS}-${NODE_ARCH}.tar.xz"
    NODE_ARCHIVE="${RUNTIME}/node.tar.xz"

    if command -v curl >/dev/null 2>&1; then
        curl -L --progress-bar "$NODE_URL" -o "$NODE_ARCHIVE"
    elif command -v wget >/dev/null 2>&1; then
        wget -q --show-progress "$NODE_URL" -O "$NODE_ARCHIVE"
    else
        echo "[ERROR] Need curl or wget to download Node.js."
        echo "  Install Node.js manually: https://nodejs.org/"
        exit 1
    fi

    echo "[SETUP] Extracting Node.js..."
    rm -rf "$NODE_HOME" 2>/dev/null || true
    mkdir -p "$NODE_HOME"
    tar -xJf "$NODE_ARCHIVE" -C "$RUNTIME/" --strip-components=1 2>/dev/null || \
    tar -xf "$NODE_ARCHIVE" -C "$RUNTIME/" --strip-components=1 2>/dev/null
    rm -f "$NODE_ARCHIVE"

    # The tar --strip-components=1 should extract directly to node/
    # If it extracted to a versioned dir, move it
    if [ ! -x "$NODE_HOME/bin/node" ]; then
        for d in "$RUNTIME"/node-v*; do
            if [ -d "$d" ]; then
                mv "$d"/* "$NODE_HOME"/ 2>/dev/null && rm -rf "$d" && break
            fi
        done
    fi

    if [ ! -x "$NODE_HOME/bin/node" ]; then
        echo "[ERROR] Node.js extraction failed."
        echo "  Install Node.js manually: https://nodejs.org/"
        exit 1
    fi
    NODE_CMD="$NODE_HOME/bin/node"
    export PATH="$NODE_HOME/bin:$PATH"
    echo "[OK] Node.js installed."
fi

NODE_VER=$("$NODE_CMD" -v 2>&1)
echo "[OK] Node.js: $NODE_VER"

# ================================================================
# 4. Load .env
# ================================================================
if [ -f "$PROJECT_ROOT/.env" ]; then
    set -a
    # shellcheck disable=SC1091
    source "$PROJECT_ROOT/.env"
    set +a
fi
if [ -z "$ZHIPU_API_KEY" ]; then
    echo ""
    echo "[NOTE] No ZHIPU_API_KEY in .env — AI features will ask for a key."
    echo "       Free keys: https://open.bigmodel.cn"
fi

# ================================================================
# 5. First-time npm install
# ================================================================
if [ ! -d "$PROJECT_ROOT/frontend/node_modules" ]; then
    echo ""
    echo "[SETUP] Installing frontend dependencies (one-time)..."
    cd "$PROJECT_ROOT/frontend"
    npm install
    cd "$PROJECT_ROOT"
fi

# ================================================================
# 6. Launch services
# ================================================================
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
sleep 8

# ================================================================
# 7. Open browser
# ================================================================
if command -v open >/dev/null 2>&1; then
    open "http://localhost:5173"
elif command -v xdg-open >/dev/null 2>&1; then
    xdg-open "http://localhost:5173"
else
    echo "Please open: http://localhost:5173"
fi

echo ""
echo "============================================="
echo "  Done! Opened http://localhost:5173"
echo "  To stop: run stop.sh or Ctrl+C"
echo "============================================="

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null; exit" INT TERM
wait
