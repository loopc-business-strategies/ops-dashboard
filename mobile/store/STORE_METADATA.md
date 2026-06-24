# Store listing metadata (Nexa)

Copy fields into **App Store Connect** and **Google Play Console**. Keep URLs and support contact current.

## Identity

| Field | Value |
|-------|--------|
| App name (user-visible) | Nexa |
| iOS bundle ID | `com.loopc.nexa` |
| Android package | `com.loopc.nexa` |
| Primary category | Business |
| Content rating | Complete platform questionnaires (business app, no user-generated public content in store sense) |

## Short description (Play, ~80 chars)

Nexa — multi-tenant ops dashboard for metal trading, ERP, and team chat.

## Description (template)

Nexa is the mobile companion for LoopC NexaOps. Authorized users sign in with company code, username, and password to access tenant-specific operations data on the go.

**Features**

- Multi-tenant login (MG, CG, LoopC and related entities)
- ERP dashboard and financial reports
- Transaction visibility
- Team chat and notifications
- Live metal spot rates on Home

**Requirements**

- Active NexaOps account issued by your organization
- Internet connection to the Nexa API

Support: contact your NexaOps administrator or LoopC Business Strategies.

## URLs

| Purpose | Suggested |
|---------|-----------|
| Marketing / privacy policy | `https://loopcstrategies.com` (or your published privacy URL) |
| Support | Same as your ops support channel |
| API (embedded in app) | `https://api.loopcstrategies.com` |

## App Store Connect specifics

- **Export compliance:** `ITSAppUsesNonExemptEncryption: false` (HTTPS only) — set in `app.config.ts`
- **Screenshots:** iPhone 6.7" and 6.5" required; iPad if `supportsTablet` stays enabled
- **TestFlight notes:** "Internal QA — MG/CG/LoopC login, ERP read, chat"

## Google Play specifics

- **Data safety:** declare account credentials, business data, chat; no sale of personal data
- **App signing:** Play App Signing with upload key (see `android/keystore.properties.example`)
- **Foreground service / notifications:** declare if using FCM background delivery

## Versioning

When submitting a new store build:

1. Update `mobile/package.json` `version` and `APP_VERSION` in `app.config.ts`
2. Increment `versionCode` in `android/app/build.gradle`
3. Run `npm run check:release` in `mobile/`
