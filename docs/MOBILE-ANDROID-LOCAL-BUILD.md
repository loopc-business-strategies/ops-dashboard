# MG Ops mobile — local Android builds (no EAS)

Use this path when you want **Play-ready AAB** or **sideload APK** from your own machine or CI **without Expo Application Services (EAS)**. The app stays an **Expo SDK** project; only the **cloud build / submit** step is skipped.

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

**Fix one of:**

1. **Enable long paths in Windows** (recommended): Settings or Group Policy **“Enable Win32 long paths”**, or registry `HKLM\\SYSTEM\\CurrentControlSet\\Control\\FileSystem` → `LongPathsEnabled` = `1` (then reboot). See [Microsoft: Maximum Path Length Limitation](https://learn.microsoft.com/en-us/windows/win32/fileio/maximum-file-path-limitation).
2. **Clone the repo to a short path**, for example `C:\\src\\ops-dashboard`, then run the same Gradle commands from `mobile/`.

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
