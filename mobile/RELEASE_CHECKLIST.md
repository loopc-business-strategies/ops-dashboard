# Nexa mobile — release checklist

Use this before every **App Store / Play Store** submission or **TestFlight** drop. Automated gates run in CI; manual steps are yours.

## Automated gates (CI)

| Check | Where |
|-------|--------|
| Typecheck + unit tests | CI job **Mobile TypeScript** |
| Release identity (`com.loopc.nexa`, scheme `nexaops`, version sync) | `npm run check:release` in mobile |
| Production API + web smoke | **Post-Deploy Tenant Smoke** on `main` |
| Mobile JWT API smoke (login, chat, ERP, socket) | **Post-Deploy Tenant Smoke** → `smoke:mobile:api` |

Local:

```bash
cd mobile && npm run check:release
npm run smoke:mobile:api   # needs MOBILE_SMOKE_LOGIN_NAME / MOBILE_SMOKE_LOGIN_PASSWORD
```

## Pre-release (both platforms)

- [ ] Bump `mobile/package.json` **version** and `APP_VERSION` in `app.config.ts` (must match).
- [ ] Bump Android `versionCode` in `android/app/build.gradle` when shipping to Play (monotonic integer).
- [ ] Run `npm run check:release` and `npm test` in `mobile/`.
- [ ] Confirm `EXPO_PUBLIC_API_URL` / production API is `https://api.loopcstrategies.com` for release builds.
- [ ] Review [store/STORE_METADATA.md](./store/STORE_METADATA.md) — listing text, privacy URL, screenshots.

## iOS — GitHub macOS (no EAS)

Workflow: [`.github/workflows/mobile-ios-testflight.yml`](../../.github/workflows/mobile-ios-testflight.yml)  
Guide: [docs/MOBILE-IOS-GITHUB-BUILD.md](../../docs/MOBILE-IOS-GITHUB-BUILD.md)

- [ ] App Store Connect app exists — bundle ID `com.loopc.nexa`, name **Nexa**
- [ ] GitHub secrets: `APPLE_TEAM_ID`, `BUILD_CERTIFICATE_BASE64`, `P12_PASSWORD`, `BUILD_PROVISION_PROFILE_BASE64`, `KEYCHAIN_PASSWORD`, App Store Connect API key trio
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
