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

These run Gradle **`bundleRelease`** / **`assembleRelease`** via `mobile/scripts/gradle-android.mjs` (works on Windows and Unix).

### Output locations

- **AAB:** `mobile/android/app/build/outputs/bundle/release/app-release.aab`
- **APK:** `mobile/android/app/build/outputs/apk/release/app-release.apk`

## Signing (Play Store vs internal)

The template **`mobile/android/app/build.gradle`** currently wires **release** to the **debug** keystore for convenience. That is **not** acceptable for production Play uploads.

Before store release:

1. Create an **upload keystore** (Google Play App Signing can hold the app signing key).
2. Add a **release** `signingConfigs` entry (do not commit secrets; use env vars or a local `keystore.properties` that is gitignored).
3. Set `buildTypes.release.signingConfig` to that release config.

See [React Native signed APK](https://reactnative.dev/docs/signed-apk-android) and Play Console documentation.

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
