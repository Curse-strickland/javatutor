@echo off
setlocal enabledelayedexpansion
title JavaTutor Launcher

:: ============================================================
:: JavaTutor Quick Start (Windows)
:: Auto-downloads JDK 17 + Node.js if not installed
:: ============================================================

set "PROJECT_ROOT=%~dp0"
set "PROJECT_ROOT=%PROJECT_ROOT:~0,-1%"
cd /d "%PROJECT_ROOT%"

chcp 65001 >nul 2>nul

echo =============================================
echo   JavaTutor - Starting...
echo =============================================
echo.

:: ============================================================
:: Runtime directory (~/.javatutor/runtime)
:: ============================================================
set "RUNTIME=%USERPROFILE%\.javatutor\runtime"
if not exist "%RUNTIME%" mkdir "%RUNTIME%"

:: ============================================================
:: 1. Find or download JDK 17+
:: ============================================================
set "JAVA_CMD="
set "JDK_HOME=%RUNTIME%\jdk-17"
set "JDK_ZIP=%RUNTIME%\jdk-17.zip"

:: 1a. Check JAVA_HOME
if defined JAVA_HOME (
    if exist "%JAVA_HOME%\bin\java.exe" (
        for /f "tokens=3" %%v in ('""%JAVA_HOME%\bin\java.exe" -version 2>&1 | findstr /i "version""') do set "JV=%%v"
        set "JV=!JV:"=!"
        for /f "tokens=1-3 delims=." %%a in ("!JV!") do (
            if "%%a"=="1" (set "JM=%%b") else (set "JM=%%a")
        )
        if !JM! GEQ 17 (
            set "JAVA_CMD=%JAVA_HOME%\bin\java.exe"
            set "JAVA_VER=!JV!"
            goto :java_ok
        )
    )
)

:: 1b. Check PATH
for /f "delims=" %%i in ('where java 2^>nul') do set "PATH_JAVA=%%i"
if defined PATH_JAVA (
    for /f "tokens=3" %%v in ('"java -version 2>&1 | findstr /i version"') do set "JV=%%v"
    set "JV=!JV:"=!
    for /f "tokens=1-3 delims=." %%a in ("!JV!") do (
        if "%%a"=="1" (set "JM=%%b") else (set "JM=%%a")
    )
    if !JM! GEQ 17 (
        set "JAVA_CMD=java"
        for /f "delims=" %%i in ('where java') do set "JAVA_HOME=%%~dpi\.."
        set "JAVA_VER=!JV!"
        goto :java_ok
    )
    echo [INFO] System Java is !JV! (needs 17+), checking other locations...
)

:: 1c. Check common locations
for %%d in (
    "%ProgramFiles%\Java\jdk-17*" "%ProgramFiles%\Java\jdk-21*" "%ProgramFiles%\Java\jdk-22*"
    "%ProgramFiles%\Eclipse Adoptium\jdk-17*" "%ProgramFiles%\Eclipse Adoptium\jdk-21*"
    "%ProgramFiles%\Microsoft\jdk-17*" "%ProgramFiles%\Semeru\jdk-17*"
) do (
    for /d %%j in (%%d) do (
        if exist "%%j\bin\java.exe" (
            for /f "tokens=3" %%v in ('""%%j\bin\java.exe" -version 2>&1 | findstr /i version"') do set "JV=%%v"
            set "JV=!JV:"=!
            for /f "tokens=1-3 delims=." %%a in ("!JV!") do (
                if "%%a"=="1" (set "JM=%%b") else (set "JM=%%a")
            )
            if !JM! GEQ 17 (
                set "JAVA_CMD=%%j\bin\java.exe"
                set "JAVA_HOME=%%j"
                set "JAVA_VER=!JV!"
                goto :java_ok
            )
        )
    )
)

:: 1d. Check previously auto-downloaded JDK
if exist "%JDK_HOME%\bin\java.exe" (
    for /f "tokens=3" %%v in ('""%JDK_HOME%\bin\java.exe" -version 2>&1 | findstr /i version"') do set "JV=%%v"
    set "JAVA_CMD=%JDK_HOME%\bin\java.exe"
    set "JAVA_HOME=%JDK_HOME%"
    set "JAVA_VER=!JV:"=!"
    goto :java_ok
)

:: 1e. Auto-download JDK 17
echo.
echo [SETUP] JDK 17+ not found. Downloading Eclipse Temurin JDK 17...
echo         This is a one-time download (~180 MB). Please wait...
echo.
powershell -Command "& {[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://api.adoptium.net/v3/binary/latest/17/ga/windows/x64/jdk/hotspot/normal/eclipse' -OutFile '%JDK_ZIP%'}" 2>&1
if %ERRORLEVEL% NEQ 0 goto :jdk_dl_fail

if not exist "%JDK_ZIP%" goto :jdk_dl_fail

echo [SETUP] Extracting JDK...
:: Remove old JDK dir if exists
if exist "%JDK_HOME%" rmdir /s /q "%JDK_HOME%"
powershell -Command "& {Expand-Archive -Path '%JDK_ZIP%' -DestinationPath '%RUNTIME%' -Force}" 2>nul
if %ERRORLEVEL% NEQ 0 (
    tar -xf "%JDK_ZIP%" -C "%RUNTIME%" 2>nul
)

:: Temurin extracts to a versioned dir like jdk-17.0.9+9 — find it
for /d %%d in ("%RUNTIME%\jdk-17*" "%RUNTIME%\OpenJDK*" "%RUNTIME%\temurin*") do (
    if exist "%%d\bin\java.exe" (
        rename "%%d" "jdk-17" >nul 2>&1 || (
            :: Can't rename (e.g. dir already exists) — use it directly
            set "JDK_HOME=%%d"
        )
    )
)
del "%JDK_ZIP%" 2>nul

if not exist "%JDK_HOME%\bin\java.exe" goto :jdk_dl_fail

set "JAVA_CMD=%JDK_HOME%\bin\java.exe"
set "JAVA_HOME=%JDK_HOME%"
for /f "tokens=3" %%v in ('""%JAVA_CMD%" -version 2>&1 | findstr /i version"') do set "JAVA_VER=%%v"
set "JAVA_VER=!JAVA_VER:"=!"
echo [OK] JDK installed: !JAVA_VER!
goto :java_ok

:jdk_dl_fail
echo [ERROR] Failed to download or extract JDK 17.
echo  Please install JDK 17+ manually from: https://adoptium.net/
echo  Then re-run start.bat
pause
exit /b 1

:java_ok
echo [OK] Java: %JAVA_VER%
set "PATH=%JAVA_HOME%\bin;%PATH%"

:: ============================================================
:: 2. Maven (via mvnw — auto-downloads if needed)
:: ============================================================
set "MVNW=%PROJECT_ROOT%\backend\mvnw.cmd"
if not exist "%MVNW%" (
    echo [ERROR] mvnw.cmd not found at: %MVNW%
    pause
    exit /b 1
)
echo [OK] Maven: wrapper (auto-downloads when needed)

:: ============================================================
:: 3. Find or download Node.js
:: ============================================================
set "NODE_CMD="
set "NODE_HOME=%RUNTIME%\node"
set "NODE_ZIP=%RUNTIME%\node.zip"

:: 3a. Check PATH / common locations
where node >nul 2>nul && set "NODE_CMD=node"
if "%NODE_CMD%"=="" if exist "%ProgramFiles%\nodejs\node.exe" (
    set "NODE_CMD=%ProgramFiles%\nodejs\node.exe"
    set "PATH=%ProgramFiles%\nodejs;%PATH%"
)
if "%NODE_CMD%"=="" if exist "%ProgramFiles(x86)%\nodejs\node.exe" (
    set "NODE_CMD=%ProgramFiles(x86)%\nodejs\node.exe"
    set "PATH=%ProgramFiles(x86)%\nodejs;%PATH%"
)
:: 3b. Previously auto-downloaded
if "%NODE_CMD%"=="" if exist "%NODE_HOME%\node.exe" (
    set "NODE_CMD=%NODE_HOME%\node.exe"
    set "PATH=%NODE_HOME%;%PATH%"
)

:: 3c. Auto-download Node.js
if "%NODE_CMD%"=="" (
    echo.
    echo [SETUP] Node.js not found. Downloading Node.js LTS...
    echo         This is a one-time download (~30 MB). Please wait...
    echo.
    powershell -Command "& {[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.18.1/node-v20.18.1-win-x64.zip' -OutFile '%NODE_ZIP%'}" 2>&1
    if %ERRORLEVEL% NEQ 0 goto :node_dl_fail
    if not exist "%NODE_ZIP%" goto :node_dl_fail

    echo [SETUP] Extracting Node.js...
    if exist "%NODE_HOME%" rmdir /s /q "%NODE_HOME%"
    powershell -Command "& {Expand-Archive -Path '%NODE_ZIP%' -DestinationPath '%RUNTIME%' -Force}" 2>nul
    if %ERRORLEVEL% NEQ 0 (
        tar -xf "%NODE_ZIP%" -C "%RUNTIME%" 2>nul
    )
    :: Node zip extracts to node-v20.18.1-win-x64 — rename to node
    for /d %%d in ("%RUNTIME%\node-v*") do (
        rename "%%d" "node" >nul 2>&1 || set "NODE_HOME=%%d"
    )
    del "%NODE_ZIP%" 2>nul

    if not exist "%NODE_HOME%\node.exe" goto :node_dl_fail
    set "NODE_CMD=%NODE_HOME%\node.exe"
    set "PATH=%NODE_HOME%;%PATH%"
    echo [OK] Node.js installed.
    goto :node_ok
)

:node_dl_fail
echo [ERROR] Failed to download or extract Node.js.
echo  Please install Node.js 18+ from: https://nodejs.org/
echo  Then re-run start.bat
pause
exit /b 1

:node_ok
for /f "tokens=*" %%v in ('node -v 2^>^&1') do echo [OK] Node.js: %%v

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
    echo [NOTE] No ZHIPU_API_KEY in .env — AI features will ask for a key.
    echo        Free keys: https://open.bigmodel.cn
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
start "JavaTutor-Backend" cmd /c "set ZHIPU_API_KEY=%ZHIPU_API_KEY% && set JAVA_HOME=%JAVA_HOME% && set PATH=%JAVA_HOME%\bin;%PATH% && cd /d "%PROJECT_ROOT%\backend" && call "%MVNW%" spring-boot:run"

echo [2/2] Starting frontend (Vite :5173)...
start "JavaTutor-Frontend" cmd /c "set PATH=%PATH% && cd /d "%PROJECT_ROOT%\frontend" && npm run dev"

:: ============================================================
:: 7. Open browser
:: ============================================================
echo.
echo Waiting for services to start...
timeout /t 10 /nobreak >nul
start http://localhost:5173

echo.
echo =============================================
echo   Done! Opened http://localhost:5173
echo   To stop: double-click stop.bat
echo =============================================
pause
endlocal
