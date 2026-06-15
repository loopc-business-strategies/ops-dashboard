# MG Ops mobile — local Android builds (no EAS)

Use this path when you want **Play-ready AAB** or **sideload APK** from your own machine or CI **without Expo Application Services (EAS)**. The app stays an **Expo SDK** project; only the **cloud build / submit** step is skipped.

For **local Metro / Expo Go** (also no EAS) vs **EAS Build / Update** billing, see **[MOBILE-NO-EAS.md](./MOBILE-NO-EAS.md)**.

## Prerequisites

- **Node** (match repo; see root `.nvmrc` and `docs/WINDOWS-DEV.md`).
- **JDK 17** (Android Gradle plugin expects a supported Java version).
- **Android SDK** — install Android Studio or command-line tools; set **`ANDROID_HOME`** (or `ANDROID_SDK_ROOT`) so Gradle can find the SDK.
- From **`mobile/`**: `npm install`.

## Sync native project after dependency or config changes

The repo tracks **`mobile/android/`**. If you pull changes that touch Expo plugins or native config, refresh:

```powershell
cd mobile
npm install
npx expo prebuild --clean --platform android
```

Omit `--clean` for a lighter sync if you know you have no local-only edits under `android/` (prefer committing intentional native changes).

## Build artifacts (recommended commands)

From **repository root**:

| Output | Command |
|--------|---------|
| **AAB** (Google Play upload) | `npm run mobile:build:android:local:bundle` |
| **APK** (direct install / internal testing) | `npm run mobile:build:android:local:apk` |

From **`mobile/`**:

```powershell
npm run build:local:android:bundle
npm run build:local:android:apk
```

These run Gradle **`bundleRelease`** / **`assembleRelease`** via `mobile/scripts/gradle-android.mjs` (works on Windows and Unix). By default the script sets **`SENTRY_DISABLE_AUTO_UPLOAD=true`** and **`SENTRY_DISABLE_NATIVE_DEBUG_UPLOAD=true`** when those variables are unset, so local release builds do not require Sentry org credentials (same idea as `eas.json` env). To upload source maps from a local build, set those to `false` and provide `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, and `SENTRY_PROJECT` (see `mobile/README.md`).

### Output locations

- **AAB:** `mobile/android/app/build/outputs/bundle/release/app-release.aab`
- **APK:** `mobile/android/app/build/outputs/apk/release/app-release.apk`

## Sideload and internal APK

1. **Update sources:** on **`main`**, run `git pull` (or clone/checkout **`main`** so you match what you intend to ship).
2. **Build** from **repository root** (after `cd mobile && npm install` if deps changed):
   - **Windows (long path / `Desktop\...`):** run **`scripts\build-mobile-apk-subst-q.cmd`** — maps `Q:`, runs **`npm run mobile:build:android:local:apk`**, removes `Q:`.
   - **Any machine / short path:** run **`npm run mobile:build:android:local:apk`** (same Gradle task as the script).
3. **Install** the new artifact: **`mobile/android/app/build/outputs/apk/release/app-release.apk`**
   - **USB + ADB (fastest for dev):** install [Android Platform Tools](https://developer.android.com/tools/releases/platform-tools), enable **Developer options** → **USB debugging** on the phone, connect USB, then from repo root:  
     `adb install -r mobile\android\app\build\outputs\apk\release\app-release.apk`  
     (`-r` keeps data when upgrading the same app id.)
   - **No cable:** email/Drive/USB stick the APK to the phone, open the file, tap **Install**. You must allow installs from that source (e.g. **Chrome** / **Files** / **My Files** → **Install unknown apps** on Android 8+; wording varies by OEM).
   - If Android blocks the install, open **Settings → Security** (or **Apps → Special access**) and allow **Install unknown apps** for the app you used to open the APK.

Pushing to Git **does not** update an already-installed APK; you need a **new build** and install step for each release you sideload.

## Signing (Play Store vs internal)

### Option A — Play upload keystore (production)

1. Create an upload keystore (see [Play App Signing](https://support.google.com/googleplay/android-developer/answer/9842756)).
2. Copy [`mobile/android/keystore.properties.example`](../mobile/android/keystore.properties.example) to **`mobile/android/keystore.properties`** (this path is **gitignored**).
3. Set `storeFile` relative to the **`mobile/android/`** directory (e.g. `app/my-upload-key.jks` if you place the `.jks` under `android/app/`).
4. Run `bundleRelease` / `assembleRelease` again.

If **`keystore.properties` is missing**, release builds still succeed: `release` signing **inherits the debug keystore** (`initWith signingConfigs.debug`). That is fine for **internal QA** only; **do not** upload those AABs to Play production.

### Option B — Internal only

Skip `keystore.properties` and use the release-signed-with-debug artifact for sideload / device testing.

## Troubleshooting

### Windows: `Filename longer than 260 characters` (Ninja / CMake)

Release builds compile native codegen under `android/app/.cxx/...` with paths that can exceed the **classic Windows MAX_PATH** limit when the repo lives under a long directory (for example `C:\\Users\\...\\Desktop\\...`).

**Why not `CMAKE_OBJECT_PATH_MAX` in `app/build.gradle`?** React Native’s **autolinked Fabric codegen** runs separate CMake/Ninja graphs for libraries like `react-native-safe-area-context` and `react-native-gesture-handler`. Those graphs do **not** reliably inherit `defaultConfig.externalNativeBuild.cmake.arguments` from the app module, so Windows can still hit MAX_PATH until long paths are enabled or you build on Linux CI.

**Fix one of:**

1. **Enable long paths in Windows** (recommended): run **PowerShell as Administrator** from the repo:
   `mobile/scripts/Enable-WindowsLongPaths.ps1`  
   Then **reboot**. Or apply the policy manually: [Maximum Path Length Limitation](https://learn.microsoft.com/en-us/windows/win32/fileio/maximum-file-path-limitation).
2. **Clone the repo to a short path**, for example `C:\\src\\ops-dashboard`, then run the same Gradle commands from `mobile/`.
3. **`SUBST` a drive letter** (often works without admin or reboot): `subst Q: C:\\full\\path\\to\\ops-dashboard`, open a new shell, `cd Q:\\`, then run `npm run mobile:build:android:local:bundle` from the repo root so native build paths stay under `Q:\\...`. Remove the mapping with `subst Q: /d` when finished. **One-shot helper (Windows):** run **[`scripts/build-mobile-apk-subst-q.cmd`](../scripts/build-mobile-apk-subst-q.cmd)** — it maps **`Q:`** for npm, creates a **junction `C:\\mgops-m` → `…\\repo\\mobile`**, sets **`OPS_MOBILE_JUNCTION_ROOT`** so Gradle runs from **`C:\\mgops-m\\android`** (short **`C:\\`** path: avoids **JVM errno 3** on **`Q:\\`** and **Ninja MAX_PATH** under Desktop), runs **`npm run mobile:build:android:local:apk`**, then removes junction and **`Q:`**. If **`mklink /J`** fails, run **`cmd` as Administrator**; the script then falls back to **`OPS_DASHBOARD_REPO_ROOT`** (full path) — use **long paths** (item 1) or a **short clone** (item 2). **`gradle-android.mjs`** uses a **temp `.bat`** for **`cmd`** quoting (see **syntax is incorrect** below).
4. **Build on Linux CI:** run workflow **[Mobile Android bundle (local Gradle)](../../.github/workflows/mobile-android-bundle.yml)** in GitHub (**Actions** tab, **Run workflow**). When it finishes, download the **mg-ops-android-release-aab** artifact (debug-signed release keystore unless you add CI secrets for `keystore.properties` later).

### Windows: `Could not set process working directory to 'Q:\\mobile\\android'` (errno 3)

**Gradle’s JVM** often cannot use a **SUBST** drive as a working directory even when **`cmd`** can **`cd`** there. **[`scripts/build-mobile-apk-subst-q.cmd`](../scripts/build-mobile-apk-subst-q.cmd)** creates **`C:\\mgops-m`** as a **junction** to **`…\\mobile`** and sets **`OPS_MOBILE_JUNCTION_ROOT`** so **`gradle-android.mjs`** runs **`gradlew`** under **`C:\\mgops-m\\android`**. If you **`subst`** manually, set **`OPS_MOBILE_JUNCTION_ROOT`** to a short junction target (or **`OPS_DASHBOARD_REPO_ROOT`** to the real repo root and accept long paths / enable long paths), or run **`gradlew.bat`** from **`mobile/android`** on a normal drive letter.

Manual fallback (same task as the npm script):

```bat
cd /d C:\full\path\to\ops-dashboard\mobile\android
gradlew.bat assembleRelease
```

Use the same **`SENTRY_*`** env vars as `mobile/package.json` `build:local:android:*` scripts if Sentry blocks the build.

### Windows: `The filename, directory name, or volume label syntax is incorrect`

Usually a bad **`cmd /c`** command line. **`gradle-android.mjs`** avoids a single **`/c "cd … && gradlew…"`** string (Node’s Windows quoting can break **`&&`** / nested quotes) and instead runs a **short-lived temp `.bat`** (`cd /d` then **`call gradlew.bat`**). Pull the latest **`mobile/scripts/gradle-android.mjs`**, or run **`gradlew.bat`** manually from **`mobile/android`** as in the errno 3 section above.

## Sentry / Gradle

Release builds apply Sentry Gradle integration. For local builds without Sentry auth, align with existing EAS env behavior if Gradle complains (see `mobile/android/sentry.properties` and comments in `mobile/README.md`).

## iOS later (same repo, no EAS)

On **macOS** from `mobile/`:

```bash
npm install
npx expo prebuild --platform ios
```

Open **`mobile/ios/*.xcworkspace`** in Xcode, configure signing team, **Product → Archive**, distribute via TestFlight or App Store. The repo may not yet track **`ios/`** if it was never generated from a Mac; commit `ios/` once generated so the team can reproduce builds.

## Optional: EAS and OTA

EAS Build / Submit / `eas update` remain **optional** scripts in `mobile/package.json` for teams that want cloud builds or OTA. Local Gradle builds do not require `eas login` or an EAS bill for producing AAB/APK on your hardware.
