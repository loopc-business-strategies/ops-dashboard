@echo off
setlocal EnableExtensions
REM Builds MG Ops Android release APK from a short SUBST path (avoids Windows MAX_PATH in native codegen).
REM Run from Explorer double-click, or:  scripts\build-mobile-apk-subst-q.cmd
REM Requires: same Admin vs non-Admin session for subst; Node/npm on PATH.

pushd "%~dp0.." || exit /b 1
set "REPO=%CD%"

if not exist "%REPO%\mobile\android\gradlew.bat" (
  echo ERROR: Expected repo root with mobile\android. Current: %REPO%
  popd
  exit /b 1
)

echo Repo: %REPO%
echo Removing old Q: mapping if present...
subst Q: /d 2>nul
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
  subst Q: /d 2>nul
  popd
  exit /b 1
)

echo OK: Q:\mobile\android exists
dir "mobile\android\gradlew.bat"

echo.
echo Running: npm run mobile:build:android:local:apk
echo.
call npm run mobile:build:android:local:apk
set "ERR=%ERRORLEVEL%"

cd /d "%REPO%"
echo Removing Q: mapping...
subst Q: /d 2>nul

echo.
echo APK ^(if build succeeded^):
echo   %REPO%\mobile\android\app\build\outputs\apk\release\app-release.apk
echo Exit code: %ERR%
popd
exit /b %ERR%
