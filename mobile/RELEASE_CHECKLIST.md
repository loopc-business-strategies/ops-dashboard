# Nexa mobile — release checklist

Use this before every **App Store / Play Store** submission or **TestFlight** drop. Automated gates run in CI; manual steps are yours.

## Automated gates (CI)

| Check | Where |
|-------|--------|
| Typecheck + unit tests | CI job **Mobile TypeScript** |
| Release identity (`com.loopc.nexa`, scheme `nexaops`, version sync) | `npm run check:release` in mobile |
| Production API + web smoke | **Post-Deploy Tenant Smoke** on `main` |
| Mobile JWT API smoke (login, chat, ERP, socket) | **Post-Deploy Tenant Smoke** → `smoke:mobile:api` |
| Mobile JWT API smoke on staging | **Staging Smoke** on `staging` → `smoke:mobile:staging` |

Local:

```bash
cd mobile && npm run check:release
npm run smoke:mobile:api   # needs MOBILE_SMOKE_LOGIN_NAME / MOBILE_SMOKE_LOGIN_PASSWORD
npm run smoke:mobile:staging   # staging API — STAGING_SMOKE_AUTH_* or MOBILE_SMOKE_*
npm run check:mobile-release-secrets   # gh: which iOS/Android store secrets exist
npm run setup:mobile-github-secrets -- --print-instructions   # where to add secrets + gh push helper
npm run verify:mg-jv-live:smoke   # prod API JV route probe (no MG password)
npm run verify:mg-jv-live   # full MG JV audit (needs MG_ADMIN_PASSWORD)
```

## Pre-release (both platforms)

- [ ] Bump `mobile/package.json` **version** and `APP_VERSION` in `app.config.ts` (must match).
- [ ] Bump Android `versionCode` in `android/app/build.gradle` when shipping to Play (monotonic integer).
- [ ] Run `npm run check:release` and `npm test` in `mobile/`.
- [ ] Confirm `EXPO_PUBLIC_API_URL` / production API is `https://api.loopcstrategies.com` for release builds.
- [ ] Review [store/STORE_METADATA.md](./store/STORE_METADATA.md) — listing text, privacy URL, screenshots.

## GitHub store secrets audit (2026-06-25)

Run from repo root: `npm run check:mobile-release-secrets` (requires `gh auth login`).

| Secret | Status |
|--------|--------|
| `APPLE_TEAM_ID` | missing |
| `BUILD_CERTIFICATE_BASE64` | missing |
| `P12_PASSWORD` | missing |
| `BUILD_PROVISION_PROFILE_BASE64` | missing |
| `KEYCHAIN_PASSWORD` | missing |
| `APP_STORE_CONNECT_API_KEY_ID` | missing |
| `APP_STORE_CONNECT_ISSUER_ID` | missing |
| `APP_STORE_CONNECT_API_KEY` | missing |
| `ANDROID_KEYSTORE_BASE64` | missing |
| `ANDROID_KEYSTORE_PASSWORD` | missing |
| `ANDROID_KEY_ALIAS` | missing |

iOS signing is **not** ready for **Mobile iOS (GitHub macOS)** until the five iOS signing secrets are added per [docs/MOBILE-IOS-GITHUB-BUILD.md](../../docs/MOBILE-IOS-GITHUB-BUILD.md). Android CI still uses debug signing until the three Android keystore secrets are set.

## iOS — GitHub macOS (no EAS)

Workflow: [`.github/workflows/mobile-ios-testflight.yml`](../../.github/workflows/mobile-ios-testflight.yml)  
Guide: [docs/MOBILE-IOS-GITHUB-BUILD.md](../../docs/MOBILE-IOS-GITHUB-BUILD.md)

- [ ] App Store Connect app exists — bundle ID `com.loopc.nexa`, name **Nexa**
- [ ] GitHub secrets: `APPLE_TEAM_ID`, `BUILD_CERTIFICATE_BASE64`, `P12_PASSWORD`, `BUILD_PROVISION_PROFILE_BASE64`, `KEYCHAIN_PASSWORD`, App Store Connect API key trio  
  Run `npm run check:mobile-release-secrets` from repo root to see which are missing.
- [ ] Provisioning profile name **`Nexa App Store`** (matches `scripts/ios-export-options.plist`)
- [ ] Actions → **Mobile iOS (GitHub macOS)** → Run workflow (~20–40 min)
- [ ] TestFlight: internal testers, then MG / CG / LoopC login on device

## Android — local or GitHub Linux

Workflow: [`.github/workflows/mobile-android-bundle.yml`](../../.github/workflows/mobile-android-bundle.yml)  
Guide: [docs/MOBILE-ANDROID-LOCAL-BUILD.md](../../docs/MOBILE-ANDROID-LOCAL-BUILD.md)

- [ ] **Play upload:** `mobile/android/keystore.properties` + upload keystore (or GitHub secrets for CI signing — see workflow)
- [ ] Build AAB: `npm run mobile:build:android:local:bundle` or run **Mobile Android bundle** workflow
- [ ] Play Console: package `com.loopc.nexa`, upload AAB to internal track first
- [ ] FCM / push: [docs/MOBILE-ANDROID-PUSH-FCM.md](../../docs/MOBILE-ANDROID-PUSH-FCM.md) if notifications are in scope

## Post-release smoke (device)

- [ ] Install from TestFlight or Play internal track
- [ ] Login **MG**, **CG**, **LoopC** (logout between tenants)
- [ ] Home metal rates load; one ERP report opens
- [ ] Chat list loads; optional push on real device

## Related

- [STORE_RELEASE.md](./STORE_RELEASE.md) — optional EAS cloud path  
- [docs/MOBILE-NO-EAS.md](../../docs/MOBILE-NO-EAS.md) — default dev/release without EAS billing
