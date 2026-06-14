@echo off
setlocal enabledelayedexpansion

:: ============================================================
:: JavaTutor Maven Wrapper — finds or downloads Maven 3.9.9
:: ============================================================

set "MAVEN_VERSION=3.9.9"
set "MAVEN_ZIP=apache-maven-%MAVEN_VERSION%-bin.zip"
set "MAVEN_URL=https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/%MAVEN_VERSION%/%MAVEN_ZIP%"
set "MAVEN_HOME=%USERPROFILE%\.m2\wrapper\apache-maven-%MAVEN_VERSION%"

:: ---- 1. Try mvn on PATH ----
where mvn >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    mvn %*
    exit /b %ERRORLEVEL%
)

:: ---- 2. Try MAVEN_HOME env var ----
if defined MAVEN_HOME (
    if exist "%MAVEN_HOME%\bin\mvn.cmd" (
        call "%MAVEN_HOME%\bin\mvn.cmd" %*
        exit /b %ERRORLEVEL%
    )
)

:: ---- 3. Try common install locations ----
for %%d in (
    "C:\Program Files\apache-maven-*"
    "C:\apache-maven-*"
    "%USERPROFILE%\apache-maven-*"
) do (
    for /d %%m in (%%d) do (
        if exist "%%m\bin\mvn.cmd" (
            call "%%m\bin\mvn.cmd" %*
            exit /b %ERRORLEVEL%
        )
    )
)

:: ---- 4. Check if wrapper already downloaded ----
if exist "%MAVEN_HOME%\bin\mvn.cmd" (
    call "%MAVEN_HOME%\bin\mvn.cmd" %*
    exit /b %ERRORLEVEL%
)

:: ---- 5. Auto-download Maven ----
echo.
echo [JavaTutor] Maven not found. Downloading Maven %MAVEN_VERSION%...
echo [JavaTutor] This is a one-time setup (~10 MB).
echo.

set "MAVEN_ZIP_PATH=%TEMP%\%MAVEN_ZIP%"

powershell -Command "& {[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '%MAVEN_URL%' -OutFile '%MAVEN_ZIP_PATH%'}" 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Failed to download Maven. Please install it manually:
    echo         https://maven.apache.org/download.cgi
    echo         Or ensure 'mvn' is available on your PATH.
    exit /b 1
)

echo [JavaTutor] Extracting Maven...
powershell -Command "& {Expand-Archive -Path '%MAVEN_ZIP_PATH%' -DestinationPath '%USERPROFILE%\.m2\wrapper' -Force}" 2>nul
if %ERRORLEVEL% NEQ 0 (
    :: Fallback: try tar (available in Windows 10 build 17063+)
    tar -xf "%MAVEN_ZIP_PATH%" -C "%USERPROFILE%\.m2\wrapper" 2>nul
)
del "%MAVEN_ZIP_PATH%" 2>nul

if not exist "%MAVEN_HOME%\bin\mvn.cmd" (
    echo [ERROR] Maven extraction failed. Please install Maven manually:
    echo         https://maven.apache.org/download.cgi
    exit /b 1
)

echo [JavaTutor] Maven %MAVEN_VERSION% installed successfully.
echo.
call "%MAVEN_HOME%\bin\mvn.cmd" %*
exit /b %ERRORLEVEL%
