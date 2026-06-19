# Nexa MG Mobile — App Store & Play Store

Default **no-EAS** workflow (local Metro, local Gradle, no `eas update` billing): **[../docs/MOBILE-NO-EAS.md](../docs/MOBILE-NO-EAS.md)**.

## Android without EAS (recommended first)

For **local Gradle AAB/APK** (no Expo cloud build billing), use **[../docs/MOBILE-ANDROID-LOCAL-BUILD.md](../docs/MOBILE-ANDROID-LOCAL-BUILD.md)** and from repo root:

```bash
npm run mobile:build:android:local:bundle
npm run mobile:build:android:local:apk
```

Configure **release signing** in `mobile/android/app/build.gradle` before uploading to Play (see that doc).

---

## Optional — EAS cloud path

The sections below describe [Expo Application Services (EAS)](https://expo.dev/eas) if you prefer cloud builds or `eas submit` / `eas update`.

## Prerequisites

1. **Expo account** — https://expo.dev/signup (free tier works for builds)
2. **Apple Developer Program** — $99/year (iOS App Store + TestFlight)
3. **Google Play Console** — $25 one-time (Android)
4. **Backend deployed** — mobile login needs `X-Client: mobile` token on Railway

## One-time setup

From repo root:

```bash
cd mobile
npm install
npx eas login
npx eas init
```

`eas init` links this app to an Expo project and writes `projectId` into `app.config.ts` (or set `EXPO_PUBLIC_EAS_PROJECT_ID`).

## Recommended build order

### Step 1 — Internal preview (test before stores)

**Android APK** (install directly on phones):

```bash
npm run mobile:build:android:preview
```

**iOS internal** (TestFlight after first production-style build):

```bash
npm run mobile:build:ios:preview
```

Download the build from the URL EAS prints, or from https://expo.dev/accounts/YOUR_ACCOUNT/projects/mg-ops-mobile/builds

### Step 2 — Store production builds

**Google Play (AAB):**

```bash
npm run mobile:build:android
```

**Apple App Store (IPA):**

```bash
npm run mobile:build:ios
```

EAS manages signing credentials on first run (follow prompts, or use `eas credentials`).

### Step 3 — Submit to stores

1. Create app listings:
   - **Google Play:** app name `Nexa MG`, package `com.loopc.mg.ops`
   - **App Store Connect:** bundle ID `com.loopc.mg.ops`

2. Update `mobile/eas.json` → `submit.production.ios` with your Apple ID, ASC app ID, and team ID.

3. Submit:

```bash
cd mobile
npm run submit:android
npm run submit:ios
```

Or upload the AAB/IPA manually from the EAS build page.

## CI / non-interactive builds

Set GitHub/Expo secrets:

- `EXPO_TOKEN` — from https://expo.dev/accounts/[account]/settings/access-tokens

Then:

```bash
cd mobile
EXPO_TOKEN=your_token npm run build:production:android
```

## Profiles (eas.json)

| Profile | Use |
|---------|-----|
| `development` | Dev client with Expo dev tools |
| `preview` | Internal APK / test installs |
| `production` | Play Store AAB + App Store IPA (`autoIncrement` version) |

## App identity

| | Value |
|--|--------|
| Name | Nexa MG |
| Android package | `com.loopc.mg.ops` |
| iOS bundle ID | `com.loopc.mg.ops` |
| API | `https://api.loopcstrategies.com` |
| Tenant | `mg` |

## Troubleshooting

- **Login fails on device:** Ensure Railway has latest auth.js with mobile `token` response.
- **iOS build requires Mac:** EAS builds in the cloud — no Mac needed on your PC.
- **First iOS submit:** Complete App Store Connect privacy questionnaire and export compliance (app uses standard HTTPS only — `ITSAppUsesNonExemptEncryption: false` is set).
