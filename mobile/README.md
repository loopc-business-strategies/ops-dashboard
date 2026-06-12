# MG Ops Mobile

Read-only MG companion app (iOS / Android) for the ops-dashboard platform.

## Tabs

- **Home** — ERP dashboard cards (margins, fixing, bank, cash flow, expenses, volume, AP/AR, chat preview, alerts). Live Gold / Silver / Platinum spot prices are shown in the **tab header** (same `/metal-rates/live` API as the web MG dashboard, MT4-backed when the bridge feed is fresh).
- **ERP** — module hub (expand in future updates)
- **+** — quick actions placeholder (coming soon modal)
- **Chat** — team chat (DMs, groups, send messages, @mentions, create group)
- **Settings** — profile & sign out

## Setup

```bash
cd mobile
npm install
```

Optional local API override:

```bash
# mobile/.env
EXPO_PUBLIC_API_URL=http://10.0.2.2:5000
```

For Android emulator, `10.0.2.2` maps to host `localhost:5000`. For physical device, use your PC LAN IP.

Production default: `https://api.loopcstrategies.com`

### Native `android/` and `ios/` in Git

The **`android/`** tree is tracked in this repository. **`ios/`** is not generated on Windows: Expo skips the iOS native project when you run `expo prebuild` from Windows. To add or refresh **`ios/`** for commits, run on **macOS or Linux** from `mobile/`:

```bash
npx expo prebuild --platform ios
```

Then commit the resulting `ios/` folder. CI and teammates on Mac can keep `ios/` in sync the same way after dependency or config changes.

If you use a **local** `mobile/android` checkout and native config or dependencies change after `git pull`, refresh from `mobile/` when needed:

```bash
cd mobile
npm install
npx expo prebuild --clean --platform android
```

Then open the project in Android Studio or run `npx expo run:android`. Omit `--clean` for a lighter sync if you intentionally keep local Gradle tweaks (not recommended long-term).

### Optional: Sentry

Set `EXPO_PUBLIC_SENTRY_DSN` in EAS environment variables (and optionally `EXPO_PUBLIC_SENTRY_ENVIRONMENT`, `EXPO_PUBLIC_SENTRY_RELEASE`, `EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE`). Init runs from `src/lib/sentryInit.ts` when the app loads. See repo `docs/OBSERVABILITY-SENTRY.md`. Native changes may require a new EAS build after upgrading `@sentry/react-native`.

**EAS Android release builds:** the `@sentry/react-native` config plugin runs `sentry-cli` during Gradle. Without a Sentry org/project and auth, that step fails (e.g. “organization ID or slug is required”). `eas.json` sets `SENTRY_DISABLE_AUTO_UPLOAD` and `SENTRY_DISABLE_NATIVE_DEBUG_UPLOAD` to `true` on all build profiles so EAS succeeds without Sentry server credentials. To **re-enable** source map and native debug uploads: remove those two keys from the profile `env` blocks (or override them in the EAS dashboard), add EAS secrets `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, and `SENTRY_PROJECT` (or pass `organization` / `project` in the Expo plugin config per [Sentry Expo setup](https://docs.sentry.io/platforms/react-native/manual-setup/expo/)).

## Checks

```bash
npm run typecheck
npm test
```

`npm audit` may report **moderate** issues in transitive Expo tooling (`uuid` chain); **`npm audit --omit=dev --audit-level=high`** is used in CI for production gates. Prefer Dependabot Expo bumps over `npm audit fix --force`.

## Run

From repo root:

```bash
npm run dev:mobile
```

Or from `mobile/`:

```bash
npm start
```

Scan the QR code with Expo Go, or press `a` for Android emulator.

**Important:** `npm run dev:mobile` (Expo Go / dev server) is **not** the same as an installed APK. Dev loads JavaScript from your PC live; an APK bundles code at build time. Git push updates Vercel/Railway only — not the mobile app.

| Workflow | When to use |
|----------|-------------|
| `npm run dev:mobile` | Daily development: Metro + Expo Go or emulator (`a` / `i` in terminal) |
| **`npm run mobile:build:android:local:bundle`** | **Play Store AAB** from local Gradle (no EAS). See **[../docs/MOBILE-ANDROID-LOCAL-BUILD.md](../docs/MOBILE-ANDROID-LOCAL-BUILD.md)**. |
| **`npm run mobile:build:android:local:apk`** | **Release APK** for sideload / internal testing (no EAS). |
| `npx expo run:android` (from `mobile/`) | Install a **development** binary on device/emulator (not Expo Go); uses bundled native project. |
| `npm run mobile:build:android:preview` | Optional: EAS cloud preview APK (needs `eas login` / CI token). |
| `npm run mobile:update:preview` | OTA JS update to installs that use EAS Update **preview** channel (requires EAS-configured client). |

After an **EAS** preview build with `expo-updates`, `npm run mobile:update:preview` can ship JS-only changes without rebuilding the APK. **Local AAB/APK** builds do not use EAS unless you also configure OTA separately.

## iOS: device vs Simulator (EAS)

| Install target | Command | Notes |
|----------------|---------|--------|
| **Physical iPhone** | `npm run build:preview:ios` | Profile `preview` (`ios.simulator: false`). Install from Expo **Builds** when finished; Apple may require registered **UDIDs** for ad hoc. Same **preview** OTA channel as Android preview. |
| **iOS Simulator (Mac)** | `npm run build:preview:ios-simulator` | Profile `preview-simulator` (`ios.simulator: true`). Download the artifact from Expo; extract and install with `eas build:run` or `xcrun simctl install` per [Expo iOS Simulator](https://docs.expo.dev/build-reference/simulators/). |
| **Local dev** | `npm start`, then press `i` | Uses your machine’s Metro bundle and `.env`; not the same binary as EAS. |

## Auth

Mobile login sends `X-Client: mobile` and expects `{ token, user }` from `POST /api/auth/login` with `company: mg`.

Deploy the backend auth update before testing against production.

## Live metal tickers (tab header)

- Gold, Silver, and Platinum use the same **`/api/erp-accounting/metal-rates/live`** endpoint as the MG web dashboard (MT4-backed when the bridge feed is fresh).
- The tab bar header refreshes every **15 seconds** while the app is foregrounded; **pull to refresh** on Home also updates spot prices.
- **Manual QA:** Log in as MG, open the web dashboard in parallel, and confirm the three headline numbers match (allow a few seconds for poll timing).

## Build — Android without EAS (recommended default)

See **[../docs/MOBILE-ANDROID-LOCAL-BUILD.md](../docs/MOBILE-ANDROID-LOCAL-BUILD.md)** for JDK/SDK setup, `prebuild`, and signing notes.

From repo root:

```bash
npm run mobile:build:android:local:bundle   # AAB for Play Store
npm run mobile:build:android:local:apk      # APK for sideload
```

If **Windows** fails with **path longer than 260 characters**, use `mobile/scripts/Enable-WindowsLongPaths.ps1` (Admin) and reboot, or build the AAB in GitHub Actions: workflow **Mobile Android bundle (local Gradle)** (`.github/workflows/mobile-android-bundle.yml`, **Run workflow**).

## Build (optional — EAS cloud)

See **[STORE_RELEASE.md](./STORE_RELEASE.md)** for Expo-hosted builds and submit.

Quick start after `npx eas login` and `npx eas init`:

```bash
# Internal test APK (Android, cloud)
npm run mobile:build:android:preview

# Production store builds (cloud)
npm run mobile:build:android
npm run mobile:build:ios
```

Configure `mobile/eas.json` submit section before `npm run submit:android` / `submit:ios`.
