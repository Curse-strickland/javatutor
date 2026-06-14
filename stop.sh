#!/usr/bin/env bash
# ============================================================
# JavaTutor 一键停止 (Linux / macOS / Git Bash)
# ============================================================

echo "========================================"
echo "  JavaTutor — Stopping..."
echo "========================================"
echo ""

# Stop processes on port 8080 (backend)
if command -v lsof >/dev/null 2>&1; then
    # macOS / Linux with lsof
    PIDS=$(lsof -ti :8080 2>/dev/null)
    if [ -n "$PIDS" ]; then
        echo "Stopping backend (port 8080)..."
        for pid in $PIDS; do
            echo "  killing PID $pid"
            kill "$pid" 2>/dev/null
        done
    else
        echo "Backend (port 8080): not running"
    fi

    PIDS=$(lsof -ti :5173 2>/dev/null)
    if [ -n "$PIDS" ]; then
        echo "Stopping frontend (port 5173)..."
        for pid in $PIDS; do
            echo "  killing PID $pid"
            kill "$pid" 2>/dev/null
        done
    else
        echo "Frontend (port 5173): not running"
    fi
elif command -v ss >/dev/null 2>&1; then
    # Linux with ss
    PIDS=$(ss -tlnp 'sport = :8080' 2>/dev/null | grep -oP 'pid=\K[0-9]+')
    if [ -n "$PIDS" ]; then
        echo "Stopping backend (port 8080)..."
        for pid in $PIDS; do
            echo "  killing PID $pid"
            kill "$pid" 2>/dev/null
        done
    else
        echo "Backend (port 8080): not running"
    fi

    PIDS=$(ss -tlnp 'sport = :5173' 2>/dev/null | grep -oP 'pid=\K[0-9]+')
    if [ -n "$PIDS" ]; then
        echo "Stopping frontend (port 5173)..."
        for pid in $PIDS; do
            echo "  killing PID $pid"
            kill "$pid" 2>/dev/null
        done
    else
        echo "Frontend (port 5173): not running"
    fi
elif command -v netstat >/dev/null 2>&1; then
    # Fallback to netstat
    PIDS=$(netstat -tlnp 2>/dev/null | grep ':8080 ' | awk '{print $7}' | cut -d/ -f1)
    if [ -n "$PIDS" ]; then
        echo "Stopping backend (port 8080)..."
        for pid in $PIDS; do
            echo "  killing PID $pid"
            kill "$pid" 2>/dev/null
        done
    else
        echo "Backend (port 8080): not running"
    fi

    PIDS=$(netstat -tlnp 2>/dev/null | grep ':5173 ' | awk '{print $7}' | cut -d/ -f1)
    if [ -n "$PIDS" ]; then
        echo "Stopping frontend (port 5173)..."
        for pid in $PIDS; do
            echo "  killing PID $pid"
            kill "$pid" 2>/dev/null
        done
    else
        echo "Frontend (port 5173): not running"
    fi
fi

echo ""
echo "Done."
