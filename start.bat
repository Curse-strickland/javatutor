@echo off
setlocal enabledelayedexpansion
title JavaTutor Launcher
chcp 65001 >nul 2>nul

set "PROJECT_ROOT=%~dp0"
set "PROJECT_ROOT=%PROJECT_ROOT:~0,-1%"
cd /d "%PROJECT_ROOT%"

set "RUNTIME=%USERPROFILE%\.javatutor\runtime"
if not exist "%RUNTIME%" mkdir "%RUNTIME%"

echo =============================================
echo   JavaTutor - Starting...
echo =============================================
echo.

:: ============================================================
:: 1. Find or download JDK 17+
:: ============================================================
set "FOUND_JDK=%RUNTIME%\jdk-17"
set "PF=%ProgramFiles%"
set "PF86=%ProgramFiles(x86)%"

:: 1a. JAVA_HOME
if defined JAVA_HOME (
    if exist "%JAVA_HOME%\bin\java.exe" (
        call :check_java "%JAVA_HOME%\bin\java.exe" && goto :java_ok
    )
)

:: 1b. PATH
where java >nul 2>nul
if !ERRORLEVEL! EQU 0 (
    call :check_java java && goto :java_ok
)

:: 1c. JetBrains / IntelliJ JDKs
if exist "%USERPROFILE%\.jdks\" (
    for /f "delims=" %%j in ('dir /b /ad "%USERPROFILE%\.jdks\*17*" 2^>nul') do (
        if exist "%USERPROFILE%\.jdks\%%j\bin\java.exe" (
            call :check_java "%USERPROFILE%\.jdks\%%j\bin\java.exe" && (
                set "JAVA_HOME=%USERPROFILE%\.jdks\%%j"
                goto :java_ok
            )
        )
    )
    for /f "delims=" %%j in ('dir /b /ad "%USERPROFILE%\.jdks\*21*" 2^>nul') do (
        if exist "%USERPROFILE%\.jdks\%%j\bin\java.exe" (
            call :check_java "%USERPROFILE%\.jdks\%%j\bin\java.exe" && (
                set "JAVA_HOME=%USERPROFILE%\.jdks\%%j"
                goto :java_ok
            )
        )
    )
)

:: 1d. Common locations
for %%d in (
    "%PF%\Java\jdk-17*" "%PF%\Java\jdk-21*"
    "%PF%\Eclipse Adoptium\jdk-17*" "%PF%\Eclipse Adoptium\jdk-21*"
    "%PF%\Microsoft\jdk-17*" "%PF%\Semeru\jdk-17*"
) do (
    for /d %%j in (%%d) do (
        if exist "%%j\bin\java.exe" (
            call :check_java "%%j\bin\java.exe" && (
                set "JAVA_HOME=%%j"
                goto :java_ok
            )
        )
    )
)

:: 1e. Auto-downloaded
if exist "%FOUND_JDK%\bin\java.exe" (
    call :check_java "%FOUND_JDK%\bin\java.exe" && (
        set "JAVA_HOME=%FOUND_JDK%"
        goto :java_ok
    )
)

:: 1f. Download JDK
echo [SETUP] JDK 17+ not found. Downloading Eclipse Temurin JDK 17...
echo         One-time download (~180 MB). Please wait...
echo.
set "JDK_ZIP=%RUNTIME%\jdk-17.zip"
powershell -Command "Invoke-WebRequest -Uri 'https://api.adoptium.net/v3/binary/latest/17/ga/windows/x64/jdk/hotspot/normal/eclipse' -OutFile '%JDK_ZIP%'"
if not exist "%JDK_ZIP%" goto :jdk_fail

echo [SETUP] Extracting JDK...
if exist "%FOUND_JDK%" rmdir /s /q "%FOUND_JDK%"
powershell -Command "Expand-Archive -Path '%JDK_ZIP%' -DestinationPath '%RUNTIME%' -Force"
del "%JDK_ZIP%" 2>nul
for /d %%d in ("%RUNTIME%\jdk-17*" "%RUNTIME%\OpenJDK*" "%RUNTIME%\temurin*") do (
    if exist "%%d\bin\java.exe" if not "%%d"=="%FOUND_JDK%" move "%%d" "%FOUND_JDK%" >nul 2>&1
)
if not exist "%FOUND_JDK%\bin\java.exe" goto :jdk_fail
set "JAVA_HOME=%FOUND_JDK%"
echo [OK] JDK installed.

:java_ok
set "PATH=%JAVA_HOME%\bin;%PATH%"
for /f "tokens=3" %%v in ('""%JAVA_HOME%\bin\java.exe" -version 2>&1 | findstr /i version"') do set "JV=%%v"
echo [OK] Java: %JV:"=%

:: ============================================================
:: 2. Maven (via mvnw.cmd)
:: ============================================================
set "MVNW=%PROJECT_ROOT%\backend\mvnw.cmd"
if not exist "%MVNW%" (
    echo [ERROR] mvnw.cmd not found
    pause & exit /b 1
)
echo [OK] Maven: wrapper

:: ============================================================
:: 3. Find or download Node.js
:: ============================================================
set "NODE_CMD="
set "FOUND_NODE=%RUNTIME%\node"
:: 3a. Check known install locations (single-line if â€?no blocks)
if exist "%PF%\nodejs\node.exe" set "NODE_CMD=%PF%\nodejs\node.exe"
if "%NODE_CMD%"=="" if exist "!PF86!\nodejs\node.exe" set "NODE_CMD=!PF86!\nodejs\node.exe"
if "%NODE_CMD%"=="" if exist "%FOUND_NODE%\node.exe" set "NODE_CMD=%FOUND_NODE%\node.exe"

:: 3b. Try PATH
if "%NODE_CMD%"=="" node -v >nul 2>nul && set "NODE_CMD=node"

:: 3c. Download if still not found
if not "%NODE_CMD%"=="" goto :node_ok

echo.
echo [SETUP] Node.js not found. Downloading Node.js LTS...
echo         One-time download (~30 MB). Please wait...
echo.
set "NODE_ZIP=%RUNTIME%\node.zip"
powershell -Command "Invoke-WebRequest -Uri 'https://nodejs.org/dist/v20.18.1/node-v20.18.1-win-x64.zip' -OutFile '!NODE_ZIP!'"
if not exist "!NODE_ZIP!" goto :node_fail

echo [SETUP] Extracting Node.js...
if exist "%FOUND_NODE%" rmdir /s /q "%FOUND_NODE%"
powershell -Command "Expand-Archive -Path '!NODE_ZIP!' -DestinationPath '%RUNTIME%' -Force"
del "!NODE_ZIP!" 2>nul
for /d %%d in ("%RUNTIME%\node-v*") do if exist "%%d\node.exe" move "%%d" "%FOUND_NODE%" >nul 2>&1
if not exist "%FOUND_NODE%\node.exe" goto :node_fail

set "NODE_CMD=%FOUND_NODE%\node.exe"
echo [OK] Node.js installed.
goto :node_ok

:node_fail
echo [ERROR] Failed to set up Node.js. Install manually: https://nodejs.org/
pause & exit /b 1

:node_ok
if "%NODE_CMD%"=="node" (for /f "tokens=*" %%v in ('node -v 2^>^&1') do echo [OK] Node.js: %%v) else echo [OK] Node.js: %NODE_CMD%

:: ============================================================
:: 4. Load .env
:: ============================================================
set "ZHIPU_API_KEY="
if exist "%PROJECT_ROOT%\.env" for /f "usebackq tokens=1,2 delims==" %%a in ("%PROJECT_ROOT%\.env") do (
    if "%%a"=="ZHIPU_API_KEY" set "ZHIPU_API_KEY=%%b"
)
if "%ZHIPU_API_KEY%"=="" (
    echo.
    echo [NOTE] No ZHIPU_API_KEY in .env - AI features will ask for a key.
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
:: 6. Launch
:: ============================================================
echo.
echo [1/2] Starting backend (Spring Boot :8080)...
start "JavaTutor-Backend" cmd /c "set ZHIPU_API_KEY=%ZHIPU_API_KEY% && set JAVA_HOME=%JAVA_HOME% && set PATH=%JAVA_HOME%\bin;%PATH% && cd /d "%PROJECT_ROOT%\backend" && call "%MVNW%" spring-boot:run"

echo [2/2] Starting frontend (Vite :5173)...
start "JavaTutor-Frontend" cmd /c "set PATH=%PATH% && cd /d "%PROJECT_ROOT%\frontend" && npm run dev"

:: ============================================================
:: 7. Browser
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
exit /b 0

:: ============================================================
:: Helper: check Java version >= 17
:: Usage: call :check_java "path\to\java.exe" && echo OK
:: ============================================================
:check_java
for /f "tokens=3" %%v in ('"%~1 -version 2>&1 | findstr /i version"') do set "JV=%%v"
set "JV=%JV:"=%"
for /f "tokens=1-3 delims=." %%a in ("%JV%") do (
    if "%%a"=="1" (set "JM=%%b") else (set "JM=%%a")
)
if %JM% GEQ 17 (
    set "JAVA_CMD=%~1"
    if "%~1"=="java" (
        for /f "delims=" %%i in ('where java') do set "JAVA_HOME=%%~dpi\.."
    )
    exit /b 0
)
echo [INFO] Java %JV% is too old (need 17+)
exit /b 1
