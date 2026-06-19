# Nexa MG mobile — avoid EAS billing and queues

This doc is the **recommended default workflow** for the Nexa MG mobile app when you want **no Expo Application Services (EAS) build queue**, **no EAS Update (OTA) usage**, and **no dependency on Expo cloud** for day-to-day work.

## Which path should I use?

| Situation | Recommended |
|-----------|---------------|
| You are coding and want fast reload | **`npm run dev:mobile`** + **Expo Go** (or press `a` / `i` in the Expo terminal). If the QR fails: same Wi‑Fi, Windows firewall **TCP 8081**, try **`npx expo start --tunnel`** from `mobile/`, update **Expo Go** for SDK 56, or **`adb reverse tcp:8081 tcp:8081`**. |
| QA or a device without your Metro server | **Sideload / internal APK:** pull **`main`**, then from repo root run [`scripts/build-mobile-apk-subst-q.cmd`](../scripts/build-mobile-apk-subst-q.cmd) (Windows long paths) **or** `npm run mobile:build:android:local:apk`, then install **`app-release.apk`** (see [Sideload and internal APK](./MOBILE-ANDROID-LOCAL-BUILD.md#sideload-and-internal-apk) in [MOBILE-ANDROID-LOCAL-BUILD.md](./MOBILE-ANDROID-LOCAL-BUILD.md)). |
| Google Play upload | **Local AAB:** `npm run mobile:build:android:local:bundle`, or the **Mobile Android bundle** GitHub Actions workflow on Linux. |
| Frequent JS-only updates without a new store binary | **EAS Update** (`npm run mobile:update:production` / preview after `eas login`) — **optional**; uses Expo cloud. Skip if you want zero EAS. |

**Default for this repo:** dev + Expo Go for daily work; local APK/AAB when distributing; OTA only if you explicitly adopt EAS Update.

## What uses Expo cloud (queue / limits / possible billing)

- **`eas build`** — cloud macOS/Linux builders; queue and plan limits on free tiers.
- **`eas update`** — over-the-air JavaScript delivery to binaries that were built with `expo-updates` and EAS channels.
- **`eas submit`** — optional Play/App Store upload through Expo.

See [`mobile/eas.json`](../mobile/eas.json) for profiles and channels if you ever opt in.

## What does not use EAS

- **`npm start`** (from `mobile/`) or **`npm run dev:mobile`** (from repo root) — **Metro runs on your machine**. JS loads to **Expo Go** or a dev client over LAN/USB. This is ordinary local development, not EAS Update.
- **`npx expo run:android`** (from `mobile/`) — **local Gradle** installs a dev binary; Metro can still be local. No `eas build` required.

**Misconception:** “Expo dev” is not the same as “EAS Update billing.” Only **cloud** EAS commands consume EAS build/update/submit capacity.

## Recommended development loop (zero EAS)

1. Install deps: `cd mobile && npm install`
2. Optional: set `mobile/.env` with `EXPO_PUBLIC_API_URL=...` for a local backend (see [`mobile/README.md`](../mobile/README.md)).
3. Start Metro: `npm run dev:mobile` from repo root, or `npm start` from `mobile/`.
4. Open **Expo Go** on a phone (same Wi‑Fi) and scan the QR code, or press **`a`** for the Android emulator.

If you outgrow Expo Go, use **`npx expo run:android`** after `mobile/android/` is in sync (see [`mobile/README.md`](../mobile/README.md) prebuild notes).

## Recommended release loop (zero EAS)

1. Build on your machine (or CI without EAS):  
   - **AAB (Play):** `npm run mobile:build:android:local:bundle` from repo root  
   - **APK (sideload / internal):** pull **`main`**, then **`scripts\build-mobile-apk-subst-q.cmd`** (Windows long paths) **or** **`npm run mobile:build:android:local:apk`**, then install **`mobile/android/app/build/outputs/apk/release/app-release.apk`** — step-by-step: [Sideload and internal APK](./MOBILE-ANDROID-LOCAL-BUILD.md#sideload-and-internal-apk) in [`docs/MOBILE-ANDROID-LOCAL-BUILD.md`](./MOBILE-ANDROID-LOCAL-BUILD.md) (also covers signing, Windows long paths, GitHub Actions).
2. Upload the **AAB** in **Google Play Console** yourself (or distribute the **APK** directly). **Do not use** `eas submit` if you want to stay off EAS.

**Updates without EAS Update:** ship a **new APK/AAB** (or a new Play release). Do not run `npm run mobile:update:preview` / `mobile:update:production` unless you intentionally use OTA.

## Commands to skip unless you accept EAS

- `eas build`, `eas update`, `eas submit`
- Root / mobile scripts that wrap them, for example:  
  `npm run mobile:build:android:preview`, `npm run mobile:build:android`, `npm run mobile:build:ios`, `npm run mobile:update:preview`, `npm run mobile:update:production`, `npm run submit:android`, `npm run submit:ios` (see [`mobile/package.json`](../mobile/package.json)).

## Optional later: remove EAS Update from the project (separate refactor)

Only do this if you are **sure** you will never ship OTA updates via Expo. It touches native config and requires a **new** store/binary release to change behavior.

High-level checklist (not executed in this doc):

1. Remove **`expo-updates`** from [`mobile/package.json`](../mobile/package.json) and delete **`npm run mobile:update:*`** scripts if desired.
2. Remove **`updates`** / **`runtimeVersion`** (and any EAS Update URL) from [`mobile/app.config.ts`](../mobile/app.config.ts).
3. Adjust [`mobile/eas.json`](../mobile/eas.json) or stop using EAS entirely for this app.
4. Run `npx expo prebuild` (or refresh `android/` / `ios/`) and verify release builds; re-test push notifications and Sentry if applicable.

Until that refactor, **simply not running** `eas update` is enough to avoid OTA billing.

## Related docs

- [`mobile/README.md`](../mobile/README.md) — tabs, run commands, Sentry, iOS notes  
- [`docs/MOBILE-ANDROID-LOCAL-BUILD.md`](./MOBILE-ANDROID-LOCAL-BUILD.md) — local Gradle AAB/APK  
- [`mobile/STORE_RELEASE.md`](../mobile/STORE_RELEASE.md) — optional EAS path when you explicitly want cloud builds
