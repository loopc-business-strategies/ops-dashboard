@echo off
setlocal EnableExtensions
REM Builds MG Floor Android release APK without EAS:
REM   SUBST Q: for short npm cwd + junction C:\mg-floor-m -> repo\mg-floor
REM so Gradle/Ninja use C:\mg-floor-m\android (short path on real C:, avoids errno 3 on Q: and MAX_PATH on Desktop).
REM Run from Explorer double-click, or:  scripts\build-mg-floor-apk-subst-q.cmd
REM Requires: first-time `npm run mg-floor:prebuild:android` so mg-floor\android exists.
REM Do not use C:\mg-floor-m for anything else while this script runs (it is removed at the end).

pushd "%~dp0.." || exit /b 1
set "REPO=%CD%"

if not exist "%REPO%\mg-floor\android\gradlew.bat" (
  echo ERROR: Expected mg-floor\android after prebuild. Current: %REPO%
  echo Run first: npm run mg-floor:prebuild:android
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
if not exist "mg-floor\android\gradlew.bat" (
  echo ERROR: Q:\mg-floor\android not visible. Check subst output above.
  cd /d "%REPO%"
  subst Q: /d >nul 2>&1
  popd
  exit /b 1
)

echo OK: Q:\mg-floor\android exists
dir "mg-floor\android\gradlew.bat"

set "MG_FLOOR_JUNC=C:\mg-floor-m"
set "MG_FLOOR_JUNC_CREATED="
if exist "%MG_FLOOR_JUNC%" (
  echo Removing stale junction %MG_FLOOR_JUNC% ...
  rmdir "%MG_FLOOR_JUNC%" 2>nul
)
echo Creating junction %MG_FLOOR_JUNC% -^> "%REPO%\mg-floor"
mklink /J "%MG_FLOOR_JUNC%" "%REPO%\mg-floor"
if errorlevel 1 (
  echo WARNING: mklink /J failed. Gradle will use full repo path — enable Windows long paths if Ninja reports MAX_PATH.
  set "OPS_MG_FLOOR_JUNCTION_ROOT="
  set "OPS_DASHBOARD_REPO_ROOT=%REPO%"
) else (
  set "MG_FLOOR_JUNC_CREATED=1"
  set "OPS_MG_FLOOR_JUNCTION_ROOT=%MG_FLOOR_JUNC%"
  set "OPS_DASHBOARD_REPO_ROOT="
  echo OK: Gradle will run from %MG_FLOOR_JUNC%\android ^(short path^).
)

echo.
REM Cover 32-bit and 64-bit factory tablets/phones (avoids UnsatisfiedLinkError on older devices).
set OPS_REACT_NATIVE_ARCHS=armeabi-v7a,arm64-v8a
REM Keep New Architecture enabled (required by RN 0.85 + Reanimated 4).
REM Use Node (not PowerShell) so GitHub Source ZIPs are less likely to trip Defender ML.
node -e "const fs=require('fs');const path=require('path');const root=process.env.REPO;if(!root){console.error('REPO env missing');process.exit(1);}const p=path.join(root,'mg-floor','android','gradle.properties');let t=fs.readFileSync(p,'utf8');t=t.replace(/newArchEnabled=false/g,'newArchEnabled=true');fs.writeFileSync(p,t);"
if errorlevel 1 (
  echo ERROR: failed to enable newArchEnabled in gradle.properties
  cd /d "%REPO%"
  if "%MG_FLOOR_JUNC_CREATED%"=="1" if exist "%MG_FLOOR_JUNC%" rmdir "%MG_FLOOR_JUNC%"
  subst Q: /d >nul 2>&1
  popd
  exit /b 1
)
echo Running: npm run mg-floor:build:android:local:apk
echo.
call npm run mg-floor:build:android:local:apk
set "ERR=%ERRORLEVEL%"

cd /d "%REPO%"
if "%MG_FLOOR_JUNC_CREATED%"=="1" (
  if exist "%MG_FLOOR_JUNC%" (
    echo Removing junction %MG_FLOOR_JUNC% ...
    rmdir "%MG_FLOOR_JUNC%"
  )
)
echo Removing Q: mapping...
subst Q: /d >nul 2>&1

echo.
echo APK ^(if build succeeded^):
echo   %REPO%\mg-floor\android\app\build\outputs\apk\release\app-release.apk
echo Exit code: %ERR%
popd
exit /b %ERR%
