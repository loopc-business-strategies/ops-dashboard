# MG Ops Mobile

Read-only MG companion app (iOS / Android) for the ops-dashboard platform.

## Tabs

- **Home** — live metals + all 9 ERP dashboard cards (margins, fixing, bank, cash flow, expenses, volume, AP/AR, chat preview, alerts)
- **ERP** — module hub (expand in future updates)
- **+** — quick actions placeholder (coming soon modal)
- **Chat** — read team messages
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
| `npm run dev:mobile` | Daily development on phone via Expo Go |
| `npm run mobile:build:android:preview` | New APK when native deps change or first install |
| `npm run mobile:update:preview` | Push JS/UI changes to an already-installed preview APK (no rebuild) |

After the first preview build with `expo-updates`, run `npm run mobile:update:preview` to ship Home/dashboard changes without rebuilding the APK.

## Auth

Mobile login sends `X-Client: mobile` and expects `{ token, user }` from `POST /api/auth/login` with `company: mg`.

Deploy the backend auth update before testing against production.

## Build (EAS — App Store / Play Store)

See **[STORE_RELEASE.md](./STORE_RELEASE.md)** for full steps.

Quick start after `npx eas login` and `npx eas init`:

```bash
# Internal test APK (Android)
npm run mobile:build:android:preview

# Production store builds
npm run mobile:build:android
npm run mobile:build:ios
```

Configure `mobile/eas.json` submit section before `npm run submit:android` / `submit:ios`.
