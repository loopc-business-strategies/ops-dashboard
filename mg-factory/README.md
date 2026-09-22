# MG Factory

Modern Gold factory kiosk app — department unlock first, then employee Face ID / password.

**Orientation:** tablets lock to landscape at runtime; phones stay free (portrait OK).

**Does not modify** `mg-floor/` or Nexa (`mobile/`).

## Flow

1. Department login (`melting` + department password)
2. Employee login (password or device Face ID / fingerprint)
3. Metal In / Metal Out / Call Floor Manager

## Development

```bash
cd mg-factory
npm install
set EXPO_PUBLIC_API_URL=http://localhost:5000
npm start
```

Root: `npm run dev:mg-factory`

## Local Android APK (no EAS)

```bash
# first time — generate native project
set EXPO_PUBLIC_API_URL=https://api.loopcstrategies.com
npm run mg-factory:prebuild:android

# factory sideload APK (recommended on OneDrive/Desktop clones)
scripts\build-mg-factory-apk-subst-q.cmd
```

That helper syncs **app source only** into `C:\mgf` (outside OneDrive), keeps a local `node_modules` + `android/` there, and runs Gradle with short paths. Copying OneDrive `node_modules`/build caches into `C:\mgf` reintroduces CMake/Ninja “build.ninja still dirty”. The APK is copied back into the repo tree.

APK: `mg-factory/android/app/build/outputs/apk/release/app-release.apk`

Without `android/keystore.properties`, the release build uses **debug signing** (internal QA / sideload only).

## Backend

`/api/mg-factory/*` — JWT + MG tenant. Seed department passwords:

```bash
cd backend
node scripts/seed-mg-factory-departments.js
```
