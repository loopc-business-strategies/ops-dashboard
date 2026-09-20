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

7 scales → device-gateway/ → /api/mg-floor/scales/ingest
```

## Absolute rules

- Tenant permanently locked to `mg` (no company selector)
- No Mongo credentials in the app
- Operators cannot type weight — capture from stable scale reading
- Nexa (`mobile/`) must remain untouched

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

## Device gateway

See [device-gateway/README.md](../device-gateway/README.md).

## Backend surface

- `GET /api/mg-floor/me`
- `POST /api/mg-floor/metal/in|out`
- `POST /api/mg-floor/transfers`
- `GET /api/mg-floor/jobs|history|scales`
- `POST /api/mg-floor/sync`
- `POST /api/mg-floor/corrections/weight`

All routes enforce JWT auth + `requireMgTenant`.

## Hardware still required on site

Verify Ming Heng MH-708 baud/parity/stop bits/pinout before setting RS232 config in `device-gateway/config/default.json`.
