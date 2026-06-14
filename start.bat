@echo off
title JavaTutor Launcher

set JAVA_HOME=C:\Users\h2624\.jdks\ms-17.0.19
set PATH=%JAVA_HOME%\bin;%PATH%

REM Load .env if present (ZHIPU_API_KEY)
set ZHIPU_API_KEY=
if exist .env for /f "tokens=1,2 delims==" %%a in (.env) do if "%%a"=="ZHIPU_API_KEY" set ZHIPU_API_KEY=%%b
if "%ZHIPU_API_KEY%"=="" (
  echo [WARNING] .env not found or ZHIPU_API_KEY not set — AI features will fail
  echo Create a .env file in the project root with: ZHIPU_API_KEY=your-key
  echo.
)

echo ========================================
echo   JavaTutor — Starting...
echo ========================================
echo.

echo [1/2] Starting backend (Spring Boot :8080)...
start "JavaTutor-Backend" cmd /k "set ZHIPU_API_KEY=%ZHIPU_API_KEY% && cd /d d:\CHome\Documents\EL\JavaTutor\backend && C:\Users\h2624\apache-maven-3.9.9\bin\mvn spring-boot:run"

echo [2/2] Starting frontend (Vite :5173)...
start "JavaTutor-Frontend" cmd /k "cd /d d:\CHome\Documents\EL\JavaTutor\frontend && npm run dev"

echo.
echo Waiting for services to be ready...
timeout /t 8 /nobreak >nul
start http://localhost:5173

echo.
echo ========================================
echo   Done! Browser opened to localhost:5173
echo   Close this window — services keep running
echo ========================================
pause
