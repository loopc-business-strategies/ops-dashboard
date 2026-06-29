# Nexa Mobile

Multi-tenant companion app (iOS / Android) for the Nexa ops-dashboard platform. One app — customers log in with **company code + username + password**.

**Display name:** The app is branded **Nexa** (`mobile/appName.cjs` → `app.config.ts` → Android `strings.xml`). Push notification titles use the same name via `backend/config/mobileApp.js`. If Firebase or Expo still show “Nexa MG”, rename the **project display name** and Android **app nickname** in [Firebase Console](https://console.firebase.google.com/) and optionally on [expo.dev](https://expo.dev). **Reinstall** a new APK/AAB so the home-screen label updates on device.

### App name vs Android package (Expo Credentials)

| User-visible | Internal (users never see this) |
|--------------|-----------------------------------|
| App name **Nexa** on home screen, login, push | Package **`com.loopc.nexa`** on [expo.dev → Credentials](https://expo.dev) |

- **Use** the Expo/Play/Firebase credential identity `com.loopc.nexa` for new Android release builds.
- Existing APKs installed with the old package `com.loopc.mg.ops` are a different Android app. Uninstall the old app or install the new one side by side during migration.

**Which path should I use?** Dev + **Expo Go** for everyday coding; **local APK/AAB** when someone needs an installable build; **EAS Update (OTA)** only if you intentionally use Expo cloud. See the decision table in **[../docs/MOBILE-NO-EAS.md](../docs/MOBILE-NO-EAS.md#which-path-should-i-use)**.

## Tabs

- **Home** — ERP dashboard cards (margins, fixing, bank, expenses, volume, AP/AR). **Live Gold / Silver / Platinum** spot prices appear at the top of the Home tab (same `/metal-rates/live` API as the web MG dashboard, MT4-backed when the bridge feed is fresh). Customer and supplier margin equity/% recalculate as spot moves. Chat and notifications are in the **header** (not Home cards).
- **ERP** — **ERP Reports** (trial balance, P&L, balance sheet, day book, outstanding, forex, ledger drilldown); same `/api/erp-accounting/reports/*` APIs as web. Automated checks: `npm test` in `mobile/` (permissions + path regression tests). Backend smoke: `node backend/scripts/smoke-erp-api.js` with `SMOKE_LOGIN_COMPANY=mg` (cookie session). **Mobile JWT smoke:** `npm run smoke:mobile:api` with env credentials (Bearer + `X-Client: mobile`; includes ERP GETs + chat reads + socket + push-token API).
- **Transactions** — MG transaction list (same `/api/erp-accounting/transactions` API as web ERP Transactions tab): type chips, date/status/search filters, account filter (client-side), read-only detail view.
- **Chat** — team chat (DMs, groups, send messages, @mentions, create group). Open from the **chat icon in the tab header** (left of notifications), not the bottom bar.
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

**OS push (lock screen / background):** Backend must have **`EXPO_ACCESS_TOKEN`** (Expo); see **[../docs/PUSH-NOTIFICATIONS.md](../docs/PUSH-NOTIFICATIONS.md)**. Android 13+ uses the **`POST_NOTIFICATIONS`** permission in the tracked `android/` app manifest.

### Avoiding EAS billing and queues (recommended)

**Local Metro** (`npm start` / `npm run dev:mobile`) and **Expo Go** do **not** use EAS Build or EAS Update — Metro runs on your PC. Expo cloud charges and queues apply to **`eas build`**, **`eas update`**, and **`eas submit`** only.

- **Dev (no EAS):** `npm run dev:mobile` or `cd mobile && npm start`, then Expo Go or `a` / `i` in the terminal; or `npx expo run:android` for a local dev binary.
- **Ship Android (no EAS):** **`npm run mobile:build:android:local:bundle`** for Play AAB; for **sideload / internal APK**, pull **`main`**, run **`scripts\build-mobile-apk-subst-q.cmd`** (Windows long paths) **or** **`npm run mobile:build:android:local:apk`**, then install **`app-release.apk`** — see **[Sideload and internal APK](../docs/MOBILE-ANDROID-LOCAL-BUILD.md#sideload-and-internal-apk)** in **[../docs/MOBILE-ANDROID-LOCAL-BUILD.md](../docs/MOBILE-ANDROID-LOCAL-BUILD.md)**.
- **Do not run** `eas build`, `eas update`, or `eas submit` unless you intentionally want Expo cloud.

Full rationale and optional “strip OTA” refactor notes: **[../docs/MOBILE-NO-EAS.md](../docs/MOBILE-NO-EAS.md)**.

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

### Git: what is tracked under `mobile/`

**All source and config that should be in the repo** is already tracked when you `git add mobile/` from the repo root — Git only skips paths listed in **[`.gitignore`](.gitignore)** (root), **[`mobile/.gitignore`](.gitignore)** and **[`mobile/android/.gitignore`](android/.gitignore)**.

**Intentionally not in Git** (do not remove these ignores — they keep the repo small and safe):

| Path / pattern | Why |
|----------------|-----|
| **`mobile/node_modules/`** | Reinstall with `npm install`; huge and machine-specific |
| **`mobile/.expo/`**, **`dist/`**, **`web-build/`** | Local / web build cache |
| **`mobile/android/app/build/`**, **`mobile/android/.gradle/`**, **`mobile/android/app/.cxx/`** | Gradle / CMake outputs; regenerated every build |
| **`mobile/android/local.properties`**, **`keystore.properties`** | SDK path on your PC; signing secrets |
| **`.env*.local`** | Secrets |

To stage **every trackable file** under mobile (after you add new source):

```bash
git add mobile/
git status mobile
```

To see why a path is ignored: `git check-ignore -v mobile/<path>`.

### Optional: Sentry

Set `EXPO_PUBLIC_SENTRY_DSN` in EAS environment variables (and optionally `EXPO_PUBLIC_SENTRY_ENVIRONMENT`, `EXPO_PUBLIC_SENTRY_RELEASE`, `EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE`). Init runs from `src/lib/sentryInit.ts` when the app loads. See repo `docs/OBSERVABILITY-SENTRY.md`. Native changes may require a new EAS build after upgrading `@sentry/react-native`.

**EAS Android release builds:** the `@sentry/react-native` config plugin runs `sentry-cli` during Gradle. Without a Sentry org/project and auth, that step fails (e.g. “organization ID or slug is required”). `eas.json` sets `SENTRY_DISABLE_AUTO_UPLOAD` and `SENTRY_DISABLE_NATIVE_DEBUG_UPLOAD` to `true` on all build profiles so EAS succeeds without Sentry server credentials. To **re-enable** source map and native debug uploads: remove those two keys from the profile `env` blocks (or override them in the EAS dashboard), add EAS secrets `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, and `SENTRY_PROJECT` (or pass `organization` / `project` in the Expo plugin config per [Sentry Expo setup](https://docs.sentry.io/platforms/react-native/manual-setup/expo/)).

## Checks

**Recommended (one command — pass = exit code 0, fail = non‑zero):**

```bash
npm run check
```

Same as `npm run typecheck` then `npm run test` in sequence.

From repo root: `npm run check:mobile`

### Live API smoke (auth + chat + ERP + socket + push-token API — optional)

Hits the same **Bearer + `X-Client: mobile`** routes the app uses, plus **ERP report GETs** (same surface as `backend/scripts/smoke-erp-api.js` “mobile ERP” steps, but with **JWT** instead of cookie session), a **Socket.IO** connect to **`/notifications`** (in-app feed transport), and **POST/DELETE `/api/auth/me/push-token`** with a fake Expo-shaped token (validates the API — it does **not** prove FCM/OS notifications on a device).

**Still not covered:** delivery of an **OS push** to hardware (Expo + Google + user permission).

**Windows PowerShell example** (replace values; never commit them):

```powershell
$env:MOBILE_SMOKE_API_URL = "https://api.loopcstrategies.com"
$env:MOBILE_SMOKE_COMPANY = "mg"
$env:MOBILE_SMOKE_LOGIN_NAME = "YourUser"
$env:MOBILE_SMOKE_LOGIN_PASSWORD = "YourPassword"
npm run smoke:mobile:api
```

Optional: set **`SMOKE_MOBILE_SKIP_ERP=1`**, **`SMOKE_MOBILE_SKIP_SOCKET=1`**, or **`SMOKE_MOBILE_SKIP_PUSH=1`** to skip blocks (e.g. firewall blocks WebSocket).

Aliases: `SMOKE_LOGIN_NAME` / `SMOKE_LOGIN_PASSWORD` / `SMOKE_DEFAULT_PASSWORD` are accepted if `MOBILE_SMOKE_*` is unset.

Cookie-based ERP smoke (web session): `node backend/scripts/smoke-erp-api.js` (see `backend/scripts/SMOKE-ERP.md`).

From `mobile/`: `npm run smoke:api`

Or run separately:

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
| `npm run dev:mobile` | **Recommended daily dev (no EAS):** Metro on your machine + Expo Go or emulator (`a` / `i`). |
| **`npm run mobile:build:android:local:bundle`** | **Recommended Play AAB (no EAS):** local Gradle. See **[../docs/MOBILE-ANDROID-LOCAL-BUILD.md](../docs/MOBILE-ANDROID-LOCAL-BUILD.md)**. |
| **`npm run mobile:build:android:local:apk`** (or **`scripts\build-mobile-apk-subst-q.cmd`** on long Windows paths) | **Sideload / internal APK (no EAS):** pull **`main`**, build, install **`app-release.apk`** — [steps](../docs/MOBILE-ANDROID-LOCAL-BUILD.md#sideload-and-internal-apk). |
| `npx expo run:android` (from `mobile/`) | **No EAS:** local dev binary + Metro; use when Expo Go is not enough. |
| `npm run mobile:build:android:preview` | **Expo cloud:** preview APK — queue/billing per your Expo plan; needs `eas login`. |
| `npm run mobile:update:preview` | **Expo cloud:** EAS Update OTA to preview channel — uses EAS Update, not local dev. |

After an **EAS** preview build with `expo-updates`, `npm run mobile:update:preview` can ship JS-only changes without rebuilding the APK. For a **no-EAS** workflow, ship a **new local APK/AAB** instead; see **[../docs/MOBILE-NO-EAS.md](../docs/MOBILE-NO-EAS.md)**.

## iOS: Windows + iPhone (no Mac, no Expo credits)

**Recommended when EAS has zero credits.** GitHub Actions builds on `macos-latest`; you install via **TestFlight**.

Full setup (certificates from Windows, GitHub secrets, run workflow):

**[../docs/MOBILE-IOS-GITHUB-BUILD.md](../docs/MOBILE-IOS-GITHUB-BUILD.md)**

1. Create App Store Connect app (`com.loopc.nexa`) + distribution cert + provisioning profile + API key  
2. Add GitHub Actions secrets (see doc table)  
3. GitHub → **Actions** → **Mobile iOS (GitHub macOS)** → **Run workflow**  
4. Install **TestFlight** on iPhone → open invite → install Nexa  

## iOS: device vs Simulator (EAS — needs Expo credits)

| Install target | Command | Notes |
|----------------|---------|--------|
| **Physical iPhone** | `npm run build:preview:ios` | Profile `preview` (`ios.simulator: false`). Install from Expo **Builds** when finished; Apple may require registered **UDIDs** for ad hoc. Same **preview** OTA channel as Android preview. |
| **iOS Simulator (Mac)** | `npm run build:preview:ios-simulator` | Profile `preview-simulator` (`ios.simulator: true`). Download the artifact from Expo; extract and install with `eas build:run` or `xcrun simctl install` per [Expo iOS Simulator](https://docs.expo.dev/build-reference/simulators/). |
| **Local dev** | `npm start`, then press `i` | Uses your machine’s Metro bundle and `.env`; not the same binary as EAS. |

## Auth

Mobile login sends `X-Client: mobile` and expects `{ token, user }` from `POST /api/auth/login` with `company: mg`.

Deploy the backend auth update before testing against production.

## Live metal prices (Home tab)

- Gold, Silver, and Platinum use the same **`/api/erp-accounting/metal-rates/live`** endpoint as the web dashboard (MT4-backed when the bridge feed is fresh), with Socket.IO **`/metal-rates`** updates when connected.
- The **Home** screen shows a live spot strip above dashboard widgets; prices poll every **15 seconds** while the app is foregrounded (60s when the socket is connected). **Pull to refresh** on Home also updates spot prices.
- The **Margins** widget recalculates equity and margin % from live gold/silver gram prices (same logic as the web ERP dashboard).
- **Manual QA:** Log in as MG, open the web dashboard in parallel, and confirm the three headline numbers match (allow a few seconds for poll timing).

## Build — Android without EAS (recommended default)

See **[../docs/MOBILE-ANDROID-LOCAL-BUILD.md](../docs/MOBILE-ANDROID-LOCAL-BUILD.md)** for JDK/SDK setup, `prebuild`, and signing notes.

From repo root:

```bash
npm run mobile:build:android:local:bundle   # AAB for Play Store
npm run mobile:build:android:local:apk      # APK for sideload
```

**Sideload / internal APK:** pull **`main`**, then either run **`scripts\build-mobile-apk-subst-q.cmd`** (recommended on long Windows paths) **or** the **`npm run …:apk`** command above, then install **`mobile/android/app/build/outputs/apk/release/app-release.apk`**. Full checklist: **[Sideload and internal APK](../docs/MOBILE-ANDROID-LOCAL-BUILD.md#sideload-and-internal-apk)**.

If **Windows** fails with **path longer than 260 characters**, use `mobile/scripts/Enable-WindowsLongPaths.ps1` (Admin) and reboot, run **[`scripts/build-mobile-apk-subst-q.cmd`](../scripts/build-mobile-apk-subst-q.cmd)** (maps `Q:` and builds APK), or build the AAB in GitHub Actions: workflow **Mobile Android bundle (local Gradle)** (`.github/workflows/mobile-android-bundle.yml`, **Run workflow**).

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
