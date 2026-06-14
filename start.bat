@echo off
setlocal enabledelayedexpansion
title JavaTutor Launcher

:: ============================================================
:: JavaTutor Quick Start (Windows)
:: ============================================================
chcp 65001 >nul 2>nul

set "PROJECT_ROOT=%~dp0"
set "PROJECT_ROOT=%PROJECT_ROOT:~0,-1%"

cd /d "%PROJECT_ROOT%"

echo ========================================
echo   JavaTutor - Starting...
echo ========================================
echo.

:: ============================================================
:: 1. Find Java 17+
:: ============================================================
set "JAVA_CMD="

:: 1a. Check JAVA_HOME env var
if defined JAVA_HOME (
    if exist "%JAVA_HOME%\bin\java.exe" (
        set "JAVA_CMD=%JAVA_HOME%\bin\java.exe"
    )
)

:: 1b. Check PATH
if "%JAVA_CMD%"=="" (
    where java >nul 2>nul
    if !ERRORLEVEL! EQU 0 (
        for /f "delims=" %%i in ('where java 2^>nul') do set "JAVA_CMD=%%i"
    )
)

:: 1c. Common install locations
if "%JAVA_CMD%"=="" (
    for %%d in (
        "%ProgramFiles%\Java\jdk-17*"
        "%ProgramFiles%\Java\jdk-21*"
        "%ProgramFiles%\Java\jdk-22*"
        "%ProgramFiles%\Java\jdk-23*"
        "%ProgramFiles%\Eclipse Adoptium\jdk-17*"
        "%ProgramFiles%\Eclipse Adoptium\jdk-21*"
        "%ProgramFiles%\Microsoft\jdk-17*"
        "%ProgramFiles%\Semeru\jdk-17*"
        "%USERPROFILE%\.jdks\*-17*"
        "%USERPROFILE%\.jdks\*-21*"
    ) do (
        for /d %%j in (%%d) do (
            if exist "%%j\bin\java.exe" (
                set "JAVA_CMD=%%j\bin\java.exe"
                set "JAVA_HOME=%%j"
                goto :java_found
            )
        )
    )
)

:java_found
if "%JAVA_CMD%"=="" (
    echo [ERROR] Java 17+ not found.
    echo  Please install JDK 17+ from: https://adoptium.net/
    echo  Or set JAVA_HOME to your JDK directory.
    pause
    exit /b 1
)

:: Verify version
for /f "tokens=3" %%v in ('""%JAVA_CMD%" -version 2>&1 | findstr /i "version""') do set "JAVA_VER=%%v"
set "JAVA_VER=%JAVA_VER:"=%"
echo [OK] Java found: %JAVA_VER%
set "PATH=%JAVA_HOME%\bin;%PATH%"

:: ============================================================
:: 2. Maven (via mvnw.cmd - auto-downloads if not installed)
:: ============================================================
set "MVNW=%PROJECT_ROOT%\backend\mvnw.cmd"
if not exist "%MVNW%" (
    echo [ERROR] mvnw.cmd not found at: %MVNW%
    pause
    exit /b 1
)
echo [OK] Maven: using wrapper

:: ============================================================
:: 3. Find Node.js
:: ============================================================
set "NODE_CMD="

where node >nul 2>nul
if !ERRORLEVEL! EQU 0 (
    for /f "delims=" %%i in ('where node 2^>nul') do set "NODE_CMD=%%i"
)

if "%NODE_CMD%"=="" (
    if exist "%ProgramFiles%\nodejs\node.exe" (
        set "NODE_CMD=%ProgramFiles%\nodejs\node.exe"
    )
)

if "%NODE_CMD%"=="" (
    echo [ERROR] Node.js not found.
    echo  Please install Node.js 18+ from: https://nodejs.org/
    pause
    exit /b 1
)
for /f "tokens=*" %%v in ('node -v 2^>^&1') do echo [OK] Node.js found: %%v

:: ============================================================
:: 4. Load .env
:: ============================================================
set "ZHIPU_API_KEY="
if exist "%PROJECT_ROOT%\.env" (
    for /f "usebackq tokens=1,2 delims==" %%a in ("%PROJECT_ROOT%\.env") do (
        if "%%a"=="ZHIPU_API_KEY" set "ZHIPU_API_KEY=%%b"
    )
)

if "%ZHIPU_API_KEY%"=="" (
    echo.
    echo [NOTE] No ZHIPU_API_KEY found in .env file.
    echo        Get a free key at: https://open.bigmodel.cn
    echo        Then add: ZHIPU_API_KEY=your-key to .env
)

:: ============================================================
:: 5. First-time npm install
:: ============================================================
if not exist "%PROJECT_ROOT%\frontend\node_modules" (
    echo.
    echo [SETUP] Installing frontend dependencies (one-time)...
    cd /d "%PROJECT_ROOT%\frontend"
    call npm install
    cd /d "%PROJECT_ROOT%"
)

:: ============================================================
:: 6. Launch services
:: ============================================================
echo.
echo [1/2] Starting backend (Spring Boot :8080)...
start "JavaTutor-Backend" cmd /c "set ZHIPU_API_KEY=%ZHIPU_API_KEY% && set JAVA_HOME=%JAVA_HOME% && cd /d "%PROJECT_ROOT%\backend" && call "%MVNW%" spring-boot:run"

echo [2/2] Starting frontend (Vite :5173)...
start "JavaTutor-Frontend" cmd /c "cd /d "%PROJECT_ROOT%\frontend" && npm run dev"

:: ============================================================
:: 7. Open browser
:: ============================================================
echo.
echo Waiting for services to start...
timeout /t 8 /nobreak >nul
start http://localhost:5173

echo.
echo ========================================
echo   Done! Opened http://localhost:5173
echo   Close this window - services keep running
echo   To stop: double-click stop.bat
echo ========================================
pause
endlocal
