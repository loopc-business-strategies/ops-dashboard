# MG Floor

MG-only factory production mobile/tablet app for Modern Gold Jewelry Manufacturing.

**Does not modify Nexa** (`mobile/`). This is a separate Expo app.

## Architecture

```
MG Floor (Android phone/tablet)
    → MG Backend Bearer JWT (company=mg)
        → /api/mg-floor/*
        → Production Control Center domain
        → MONGO_URI_MG
```

## Absolute rules

- Tenant permanently locked to `mg` (no company selector)
- No Mongo credentials in the app
- Manual entry only: operators type Qty / Purity / Time and send each batch for Floor Manager approval (no scales, camera capture or XRF)
- Operators submit under their admin-assigned floor department
- Nexa (`mobile/`) must remain untouched

See [docs/MG-FLOOR.md](../docs/MG-FLOOR.md) for the approval flow.

## Development

```bash
cd mg-floor
npm install
set EXPO_PUBLIC_API_URL=http://localhost:5000
npm start
# or connected device/emulator:
npm run android
```

## Local Android builds (no EAS)

See **[docs/MG-FLOOR-ANDROID-LOCAL-BUILD.md](../docs/MG-FLOOR-ANDROID-LOCAL-BUILD.md)**.

```bash
# first time
set EXPO_PUBLIC_API_URL=https://api.loopcstrategies.com
npm run mg-floor:prebuild:android

# factory sideload APK
npm run mg-floor:build:android:local:apk
# Windows long paths:
#   scripts\build-mg-floor-apk-subst-q.cmd

# Play Store AAB later
npm run mg-floor:build:android:local:bundle
```

APK: `mg-floor/android/app/build/outputs/apk/release/app-release.apk`

## Environments

| Profile | API |
|---------|-----|
| development / preview | staging Railway URL (eas.json) |
| production | https://api.loopcstrategies.com |

Production builds must not point at localhost/staging.

## Backend surface

- `GET /api/mg-floor/me`
- `POST|GET /api/mg-floor/batch-entries`, `POST /api/mg-floor/batch-entries/:id/approve|reject`
- `GET /api/mg-floor/jobs|history|stats/summary`
- `POST /api/mg-floor/sync`
- `POST /api/mg-floor/corrections/weight`

All routes enforce JWT auth + `requireMgTenant`.
