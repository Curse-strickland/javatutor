@echo off
title JavaTutor Launcher

set JAVA_HOME=C:\Users\h2624\.jdks\ms-17.0.19
set PATH=%JAVA_HOME%\bin;%PATH%

echo ========================================
echo   JavaTutor — Starting...
echo ========================================
echo.

echo [1/2] Starting backend (Spring Boot :8080)...
start "JavaTutor-Backend" cmd /k "cd /d d:\CHome\Documents\EL\JavaTutor\backend && C:\Users\h2624\apache-maven-3.9.9\bin\mvn spring-boot:run"

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
