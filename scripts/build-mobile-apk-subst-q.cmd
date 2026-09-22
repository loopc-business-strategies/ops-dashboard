@echo off
setlocal EnableExtensions
REM Builds Nexa Android release APK: SUBST Q: for short npm cwd + junction C:\nexa-r -> repo root
REM so Gradle uses C:\nexa-r\mobile\android and Metro can resolve monorepo shared/ on the same short tree.
REM Run from Explorer double-click, or:  scripts\build-mobile-apk-subst-q.cmd
REM Requires: same Admin vs non-Admin session for subst; mklink /J usually needs Administrator once.
REM Do not use C:\nexa-r for anything else while this script runs (it is removed at the end).

pushd "%~dp0.." || exit /b 1
set "REPO=%CD%"

if not exist "%REPO%\mobile\android\gradlew.bat" (
  echo ERROR: Expected repo root with mobile\android. Current: %REPO%
  popd
  exit /b 1
)

echo Repo: %REPO%
echo Removing old Q: mapping if present...
subst Q: /d >nul 2>&1
echo Mapping Q: -^> %REPO%
subst Q: "%REPO%"
if errorlevel 1 (
  echo ERROR: subst failed. Try closing apps using Q: or pick another letter in this script.
  popd
  exit /b 1
)
subst

cd /d Q:\
if not exist "mobile\android\gradlew.bat" (
  echo ERROR: Q:\mobile\android not visible. Check subst output above.
  cd /d "%REPO%"
  subst Q: /d >nul 2>&1
  popd
  exit /b 1
)

echo OK: Q:\mobile\android exists
dir "mobile\android\gradlew.bat"

set "REPO_JUNC=C:\nexa-r"
set "REPO_JUNC_CREATED="
if exist "%REPO_JUNC%" (
  echo Removing stale junction %REPO_JUNC% ...
  rmdir "%REPO_JUNC%" 2>nul
)
echo Creating junction %REPO_JUNC% -^> "%REPO%"
mklink /J "%REPO_JUNC%" "%REPO%"
if errorlevel 1 (
  echo WARNING: mklink /J failed. Gradle will use full repo path — enable Windows long paths if Ninja reports MAX_PATH.
  set "OPS_MOBILE_JUNCTION_ROOT="
  set "OPS_DASHBOARD_REPO_ROOT=%REPO%"
) else (
  set "REPO_JUNC_CREATED=1"
  set "OPS_MOBILE_JUNCTION_ROOT=%REPO_JUNC%\mobile"
  set "OPS_DASHBOARD_REPO_ROOT=%REPO_JUNC%"
  echo OK: Gradle will run from %REPO_JUNC%\mobile\android ^(short path^).
)

echo.
REM Typical physical phones are arm64; fewer ABIs = faster build and fewer Windows/Ninja issues.
set OPS_REACT_NATIVE_ARCHS=arm64-v8a
REM Local release APK targets production API (app.config requires URL when EAS_BUILD_PROFILE != production).
set EAS_BUILD_PROFILE=production
set EXPO_PUBLIC_API_URL=https://api.loopcstrategies.com
echo Running: npm run mobile:build:android:local:apk
echo.
call npm run mobile:build:android:local:apk
set "ERR=%ERRORLEVEL%"

cd /d "%REPO%"
if "%REPO_JUNC_CREATED%"=="1" (
  if exist "%REPO_JUNC%" (
    echo Removing junction %REPO_JUNC% ...
    rmdir "%REPO_JUNC%"
  )
)
echo Removing Q: mapping...
subst Q: /d >nul 2>&1

echo.
echo APK ^(if build succeeded^):
echo   %REPO%\mobile\android\app\build\outputs\apk\release\app-release.apk
echo Exit code: %ERR%
popd
exit /b %ERR%
