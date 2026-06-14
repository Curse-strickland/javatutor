@echo off
title JavaTutor Shutdown

echo ========================================
echo   JavaTutor - Stopping...
echo ========================================
echo.

:: Stop backend (port 8080)
set "FOUND="
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr /r ":8080 .*LISTENING"') do (
    echo Stopping backend (PID %%a)...
    taskkill /PID %%a /F >nul 2>&1
    set FOUND=1
)
if "%FOUND%"=="" (
    echo Backend (port 8080): not running
)

:: Stop frontend (port 5173)
set "FOUND="
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr /r ":5173 .*LISTENING"') do (
    echo Stopping frontend (PID %%a)...
    taskkill /PID %%a /F >nul 2>&1
    set FOUND=1
)
if "%FOUND%"=="" (
    echo Frontend (port 5173): not running
)

:: Also try by window title
taskkill /FI "WINDOWTITLE eq JavaTutor-Backend" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq JavaTutor-Frontend" /F >nul 2>&1

echo.
echo Done.
pause
