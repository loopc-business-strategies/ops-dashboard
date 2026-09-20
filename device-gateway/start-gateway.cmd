@echo off
setlocal EnableExtensions
cd /d "%~dp0"

REM ============================================================
REM  MG Device Gateway — double-click launcher (factory PC)
REM  1) Copy gateway.local.env.example -> gateway.local.env
REM  2) Put MG JWT in gateway-token.txt (one line, no quotes)
REM  3) Double-click this file (optional arg: simulator | RS232)
REM ============================================================

where node >nul 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js not found. Install Node 24 from https://nodejs.org
  pause
  exit /b 1
)

if not exist "gateway.local.env" (
  echo [ERROR] Missing gateway.local.env
  echo.
  echo Copy gateway.local.env.example to gateway.local.env and edit if needed.
  if exist "gateway.local.env.example" copy /Y "gateway.local.env.example" "gateway.local.env" >nul
  if exist "gateway.local.env" (
    echo Created gateway.local.env from example — edit token file next.
  ) else (
    pause
    exit /b 1
  )
)

if not exist "gateway-token.txt" (
  echo [ERROR] Missing gateway-token.txt
  echo.
  echo Create gateway-token.txt in this folder with ONE line: your MG login JWT.
  echo Get a token by logging in as an MG user ^(X-Client: mg-floor^).
  echo.
  echo Do NOT commit gateway-token.txt to git.
  if not exist "gateway-token.txt" (
    echo. > "gateway-token.txt"
    echo Created empty gateway-token.txt — paste the token, save, run again.
  )
  pause
  exit /b 1
)

REM Defaults (overridden by gateway.local.env)
set "MG_GATEWAY_MODE=simulator"
set "MG_API_BASE_URL=https://api.loopcstrategies.com"
set "MG_XRF_MODE=disabled"
set "MG_GATEWAY_ID=MG-GATEWAY-001"
set "MG_GATEWAY_PORT=7077"

REM Load simple KEY=VALUE lines (ignore blank / # comments)
for /f "usebackq eol=# tokens=1,* delims==" %%A in ("gateway.local.env") do (
  if /i "%%A"=="MG_GATEWAY_MODE" set "MG_GATEWAY_MODE=%%B"
  if /i "%%A"=="MG_API_BASE_URL" set "MG_API_BASE_URL=%%B"
  if /i "%%A"=="MG_XRF_MODE" set "MG_XRF_MODE=%%B"
  if /i "%%A"=="MG_GATEWAY_ID" set "MG_GATEWAY_ID=%%B"
  if /i "%%A"=="MG_GATEWAY_PORT" set "MG_GATEWAY_PORT=%%B"
)

REM Optional CLI override: start-gateway.cmd RS232
if not "%~1"=="" set "MG_GATEWAY_MODE=%~1"

REM Token from dedicated file (JWT may contain = padding)
set "MG_GATEWAY_TOKEN="
set /p MG_GATEWAY_TOKEN=<"gateway-token.txt"
REM trim accidental spaces
for /f "tokens=* delims= " %%T in ("%MG_GATEWAY_TOKEN%") do set "MG_GATEWAY_TOKEN=%%T"

if "%MG_GATEWAY_TOKEN%"=="" (
  echo [ERROR] gateway-token.txt is empty. Paste an MG JWT on the first line.
  pause
  exit /b 1
)

if not exist "node_modules\" (
  echo Installing npm dependencies...
  call npm install
  if errorlevel 1 (
    echo [ERROR] npm install failed
    pause
    exit /b 1
  )
)

echo.
echo ========================================
echo  MG Device Gateway
echo ========================================
echo  Mode:    %MG_GATEWAY_MODE%
echo  API:     %MG_API_BASE_URL%
echo  XRF:     %MG_XRF_MODE%
echo  Health:  http://localhost:%MG_GATEWAY_PORT%/health
echo.
echo  Leave this window OPEN while scales are used.
echo  Close the window to stop the gateway.
echo ========================================
echo.

call npm start
set "EXITCODE=%ERRORLEVEL%"
echo.
if not "%EXITCODE%"=="0" (
  echo [ERROR] Gateway exited with code %EXITCODE%
) else (
  echo Gateway stopped.
)
pause
exit /b %EXITCODE%
