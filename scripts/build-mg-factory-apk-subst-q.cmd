@echo off
setlocal EnableExtensions
REM Builds MG Factory Android release APK without EAS.
REM OneDrive Desktop clones break CMake/Ninja ("build.ninja still dirty").
REM This script keeps a real short-path tree at C:\mgf (outside OneDrive):
REM   - syncs app source from the repo (NOT node_modules / NOT android build caches)
REM   - runs Gradle with OPS_MG_FACTORY_JUNCTION_ROOT=C:\mgf
REM Run:  scripts\build-mg-factory-apk-subst-q.cmd
REM First time: ensure C:\mgf has node_modules + android (see README), or run the
REM bootstrap block below once.

pushd "%~dp0.." || exit /b 1
set "REPO=%CD%"
set "BUILD_ROOT=C:\mgf"
set "ERR=1"

if not defined EXPO_PUBLIC_API_URL (
  set "EXPO_PUBLIC_API_URL=https://api.loopcstrategies.com"
)

if not defined JAVA_HOME (
  if exist "C:\Program Files\Android\Android Studio\jbr\bin\java.exe" (
    set "JAVA_HOME=C:\Program Files\Android\Android Studio\jbr"
  )
)
if not defined ANDROID_HOME (
  if exist "%LOCALAPPDATA%\Android\Sdk" (
    set "ANDROID_HOME=%LOCALAPPDATA%\Android\Sdk"
    set "ANDROID_SDK_ROOT=%LOCALAPPDATA%\Android\Sdk"
  )
)
if defined JAVA_HOME set "PATH=%JAVA_HOME%\bin;%PATH%"

if not exist "%REPO%\mg-factory\package.json" (
  echo ERROR: mg-factory not found at %REPO%\mg-factory
  popd
  exit /b 1
)

echo Repo: %REPO%
echo Build root: %BUILD_ROOT%
echo API: %EXPO_PUBLIC_API_URL%

if not exist "%BUILD_ROOT%" mkdir "%BUILD_ROOT%"

REM Sync source only — never copy node_modules or build outputs from OneDrive
REM (those bake absolute OneDrive paths into autolinking / CMake).
echo Syncing app source -^> %BUILD_ROOT% ...
robocopy "%REPO%\mg-factory\app" "%BUILD_ROOT%\app" /E /NFL /NDL /NJH /NJS /nc /ns /np
if %ERRORLEVEL% GEQ 8 goto :robo_fail
robocopy "%REPO%\mg-factory\src" "%BUILD_ROOT%\src" /E /NFL /NDL /NJH /NJS /nc /ns /np
if %ERRORLEVEL% GEQ 8 goto :robo_fail
robocopy "%REPO%\mg-factory\assets" "%BUILD_ROOT%\assets" /E /NFL /NDL /NJH /NJS /nc /ns /np
if %ERRORLEVEL% GEQ 8 goto :robo_fail
robocopy "%REPO%\mg-factory\scripts" "%BUILD_ROOT%\scripts" /E /NFL /NDL /NJH /NJS /nc /ns /np
if %ERRORLEVEL% GEQ 8 goto :robo_fail
copy /Y "%REPO%\mg-factory\package.json" "%BUILD_ROOT%\package.json" >nul
copy /Y "%REPO%\mg-factory\package-lock.json" "%BUILD_ROOT%\package-lock.json" >nul
copy /Y "%REPO%\mg-factory\app.config.ts" "%BUILD_ROOT%\app.config.ts" >nul
copy /Y "%REPO%\mg-factory\tsconfig.json" "%BUILD_ROOT%\tsconfig.json" >nul
copy /Y "%REPO%\mg-factory\babel.config.js" "%BUILD_ROOT%\babel.config.js" >nul
if exist "%REPO%\mg-factory\eas.json" copy /Y "%REPO%\mg-factory\eas.json" "%BUILD_ROOT%\eas.json" >nul
if exist "%REPO%\mg-factory\expo-env.d.ts" copy /Y "%REPO%\mg-factory\expo-env.d.ts" "%BUILD_ROOT%\expo-env.d.ts" >nul

if not exist "%BUILD_ROOT%\node_modules\expo\package.json" (
  echo node_modules missing under %BUILD_ROOT% — running npm ci...
  pushd "%BUILD_ROOT%"
  call npm ci
  set "NPMERR=%ERRORLEVEL%"
  popd
  if not "%NPMERR%"=="0" (
    echo ERROR: npm ci failed in %BUILD_ROOT%
    popd
    exit /b %NPMERR%
  )
)

if not exist "%BUILD_ROOT%\android\gradlew.bat" (
  echo android/ missing — running expo prebuild...
  pushd "%BUILD_ROOT%"
  call npx expo prebuild --platform android
  set "PBERR=%ERRORLEVEL%"
  popd
  if not "%PBERR%"=="0" (
    echo ERROR: expo prebuild failed
    popd
    exit /b %PBERR%
  )
)

REM Drop stale generated paths (often still point at OneDrive after a bad sync)
echo Cleaning generated android caches under %BUILD_ROOT%...
if exist "%BUILD_ROOT%\android\build" rmdir /s /q "%BUILD_ROOT%\android\build" 2>nul
if exist "%BUILD_ROOT%\android\app\build" rmdir /s /q "%BUILD_ROOT%\android\app\build" 2>nul
if exist "%BUILD_ROOT%\android\app\.cxx" rmdir /s /q "%BUILD_ROOT%\android\app\.cxx" 2>nul
if exist "%BUILD_ROOT%\android\.gradle" rmdir /s /q "%BUILD_ROOT%\android\.gradle" 2>nul
for /d %%D in ("%BUILD_ROOT%\node_modules\*\android\.cxx") do rmdir /s /q "%%D" 2>nul
for /d %%D in ("%BUILD_ROOT%\node_modules\@*\*\android\.cxx") do rmdir /s /q "%%D" 2>nul

set "OPS_MG_FACTORY_JUNCTION_ROOT=%BUILD_ROOT%"
set "OPS_DASHBOARD_REPO_ROOT="
set "OPS_REACT_NATIVE_ARCHS=arm64-v8a"
set "GRADLE_OPTS=-Dorg.gradle.vfs.watch=false"

powershell -NoProfile -Command ^
  "$p='%BUILD_ROOT%\android\gradle.properties';" ^
  "if (-not (Test-Path $p)) { exit 0 };" ^
  "$c=Get-Content $p;" ^
  "$c=$c -replace 'newArchEnabled=false','newArchEnabled=true';" ^
  "if ($c -notmatch 'reactNativeArchitectures=') { $c += 'reactNativeArchitectures=arm64-v8a' } else { $c=$c -replace 'reactNativeArchitectures=.*','reactNativeArchitectures=arm64-v8a' };" ^
  "if ($c -notmatch 'org.gradle.vfs.watch') { $c += 'org.gradle.vfs.watch=false' };" ^
  "Set-Content $p $c"

echo Running: npm run build:local:android:apk ^(from %BUILD_ROOT%^)
echo.
pushd "%BUILD_ROOT%"
call npm run build:local:android:apk
set "ERR=%ERRORLEVEL%"
popd

echo.
if "%ERR%"=="0" (
  if exist "%BUILD_ROOT%\android\app\build\outputs\apk\release\app-release.apk" (
    if not exist "%REPO%\mg-factory\android\app\build\outputs\apk\release" (
      mkdir "%REPO%\mg-factory\android\app\build\outputs\apk\release"
    )
    copy /Y "%BUILD_ROOT%\android\app\build\outputs\apk\release\app-release.apk" ^
      "%REPO%\mg-factory\android\app\build\outputs\apk\release\app-release.apk" >nul
    echo Copied APK to repo tree.
  )
)

echo APK ^(if build succeeded^):
echo   %REPO%\mg-factory\android\app\build\outputs\apk\release\app-release.apk
echo   %BUILD_ROOT%\android\app\build\outputs\apk\release\app-release.apk
echo Exit code: %ERR%
popd
exit /b %ERR%

:robo_fail
echo ERROR: robocopy failed
popd
exit /b 1
