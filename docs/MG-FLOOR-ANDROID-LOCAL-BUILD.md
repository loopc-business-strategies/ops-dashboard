# MG Floor — local Android builds (no EAS)

Use this path for **factory tablet APKs** and **Play Store AABs** without Expo Application Services.

Related: [MG-FLOOR.md](./MG-FLOOR.md), Nexa equivalent [MOBILE-ANDROID-LOCAL-BUILD.md](./MOBILE-ANDROID-LOCAL-BUILD.md).

## Prerequisites

- Node 24.x, JDK 17+, Android SDK / Android Studio
- `EXPO_PUBLIC_API_URL` set for the target environment (do not point production APKs at localhost)

## First time — generate native project

```bash
# from repo root
set EXPO_PUBLIC_API_URL=https://api.loopcstrategies.com
npm run mg-floor:prebuild:android
```

Or from `mg-floor/`:

```bash
npm run prebuild:android
```

This creates `mg-floor/android/` (Gradle wrapper). Re-run after changing native plugins in `app.config.ts`.

## Factory tablets — release APK (sideload)

**Windows (recommended if Desktop paths hit MAX_PATH):**

```bat
scripts\build-mg-floor-apk-subst-q.cmd
```

**Any OS / short path:**

```bash
npm run mg-floor:build:android:local:apk
```

Output:

`mg-floor/android/app/build/outputs/apk/release/app-release.apk`

Install on the phone/tablet (allow unknown sources). Without `android/keystore.properties`, the build uses **debug signing** (internal QA only).

## Play Store later — AAB

```bash
npm run mg-floor:build:android:local:bundle
```

Output:

`mg-floor/android/app/build/outputs/bundle/release/app-release.aab`

Upload in Google Play Console. For store signing, add `mg-floor/android/keystore.properties` (same pattern as Nexa).

## Daily development (no APK)

```bash
cd mg-floor
set EXPO_PUBLIC_API_URL=http://localhost:5000
npm start
# or
npm run android
```

Metro / `expo run:android` does **not** use EAS credits.

## What does not use EAS

| Command | EAS? |
|---------|------|
| `npm run dev:mg-floor` / `expo start` | No |
| `mg-floor:prebuild:android` | No |
| `mg-floor:build:android:local:apk` | No |
| `mg-floor:build:android:local:bundle` | No |
| `eas build` / `eas update` | Yes — skip for MG Floor |

## Package IDs

- Android: `com.loopc.mgfloor`
- App name: MG Floor
