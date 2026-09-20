@echo off
setlocal EnableExtensions
cd /d "%~dp0"

REM ============================================================
REM  MG Device Gateway — double-click launcher (factory PC)
REM  1) Copy gateway.local.env.example -> gateway.local.env
REM  2) Put gateway secret in gateway-secret.txt (preferred)
REM     JWT in gateway-token.txt only if MG_GATEWAY_ALLOW_JWT_FALLBACK=1 (dev)
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
    echo Created gateway.local.env from example — add gateway-secret.txt next.
  ) else (
    pause
    exit /b 1
  )
)

REM Defaults (overridden by gateway.local.env)
set "MG_GATEWAY_MODE=simulator"
set "MG_API_BASE_URL=https://api.loopcstrategies.com"
set "MG_XRF_MODE=disabled"
set "MG_GATEWAY_ID=MG-GATEWAY-001"
set "MG_GATEWAY_PORT=7077"
set "MG_GATEWAY_BIND=127.0.0.1"
set "MG_GATEWAY_ALLOW_JWT_FALLBACK="
set "MG_GATEWAY_LOCAL_TOKEN="

REM Load simple KEY=VALUE lines (ignore blank / # comments)
for /f "usebackq eol=# tokens=1,* delims==" %%A in ("gateway.local.env") do (
  if /i "%%A"=="MG_GATEWAY_MODE" set "MG_GATEWAY_MODE=%%B"
  if /i "%%A"=="MG_API_BASE_URL" set "MG_API_BASE_URL=%%B"
  if /i "%%A"=="MG_XRF_MODE" set "MG_XRF_MODE=%%B"
  if /i "%%A"=="MG_GATEWAY_ID" set "MG_GATEWAY_ID=%%B"
  if /i "%%A"=="MG_GATEWAY_PORT" set "MG_GATEWAY_PORT=%%B"
  if /i "%%A"=="MG_GATEWAY_BIND" set "MG_GATEWAY_BIND=%%B"
  if /i "%%A"=="MG_GATEWAY_ALLOW_JWT_FALLBACK" set "MG_GATEWAY_ALLOW_JWT_FALLBACK=%%B"
  if /i "%%A"=="MG_GATEWAY_LOCAL_TOKEN" set "MG_GATEWAY_LOCAL_TOKEN=%%B"
)

REM Optional CLI override: start-gateway.cmd RS232
if not "%~1"=="" set "MG_GATEWAY_MODE=%~1"

REM Preferred: dedicated gateway secret (matches backend MG_GATEWAY_SECRETS)
set "MG_GATEWAY_SECRET="
if exist "gateway-secret.txt" (
  set /p MG_GATEWAY_SECRET=<"gateway-secret.txt"
  for /f "tokens=* delims= " %%T in ("%MG_GATEWAY_SECRET%") do set "MG_GATEWAY_SECRET=%%T"
)

REM Optional JWT fallback (dev only — not for production)
set "MG_GATEWAY_TOKEN="
if exist "gateway-token.txt" (
  set /p MG_GATEWAY_TOKEN=<"gateway-token.txt"
  for /f "tokens=* delims= " %%T in ("%MG_GATEWAY_TOKEN%") do set "MG_GATEWAY_TOKEN=%%T"
)

if "%MG_GATEWAY_SECRET%"=="" (
  if not "%MG_GATEWAY_ALLOW_JWT_FALLBACK%"=="1" (
    echo [ERROR] Missing gateway-secret.txt
    echo.
    echo Create gateway-secret.txt with ONE line matching Railway MG_GATEWAY_SECRETS
    echo for this gateway id ^(%MG_GATEWAY_ID%^).
    echo.
    echo Example backend env: MG_GATEWAY_SECRETS=MG-GATEWAY-001=your-secret-here
    echo.
    echo Dev-only: set MG_GATEWAY_ALLOW_JWT_FALLBACK=1 and use gateway-token.txt JWT.
    if not exist "gateway-secret.txt" (
      echo. > "gateway-secret.txt"
      echo Created empty gateway-secret.txt — paste the secret, save, run again.
    )
    pause
    exit /b 1
  )
  if "%MG_GATEWAY_TOKEN%"=="" (
    echo [ERROR] JWT fallback enabled but gateway-token.txt is empty.
    pause
    exit /b 1
  )
  echo [WARN] Using JWT fallback — not for production.
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
echo  Bind:    %MG_GATEWAY_BIND%:%MG_GATEWAY_PORT%
if not "%MG_GATEWAY_SECRET%"=="" (
  echo  Auth:    gateway-secret
) else (
  echo  Auth:    jwt-fallback ^(dev^)
)
echo  Health:  http://127.0.0.1:%MG_GATEWAY_PORT%/health
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
