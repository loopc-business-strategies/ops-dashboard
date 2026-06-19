# Mobile universal links (MG Ops)

HTTPS links on **mg.loopcstrategies.com** can open the MG mobile app when configured.

## Web URLs handled

| URL | Mobile destination |
|-----|-------------------|
| `https://mg.loopcstrategies.com/dashboard?tab=erp-enquiry&account=CODE` | ERP tab + account summary |
| `mgops://dashboard?tab=erp-enquiry&account=CODE` | Same (custom scheme) |

Parsing: `mobile/src/navigation/dashboardDeepLink.ts`  
Routing: `mobile/src/navigation/useDeepLinkNavigation.ts`

## Server files (Vercel)

Served from `frontend/public/.well-known/`:

- **apple-app-site-association** — replace `TEAMID` with your Apple Developer Team ID before iOS App Links verify.
- **assetlinks.json** — replace `REPLACE_WITH_RELEASE_SHA256_FINGERPRINT` with the SHA-256 of your **release** signing cert (`keytool -list -v -keystore …` or Play Console → App signing).

## App config

`mobile/app.config.ts`:

- iOS: `associatedDomains: ['applinks:mg.loopcstrategies.com']`
- Android: `intentFilters` with `https` + `mg.loopcstrategies.com` + `/dashboard`

After changing native config, run `npx expo prebuild` (or EAS build) so AndroidManifest / entitlements update.

## Verify

1. Deploy web so `https://mg.loopcstrategies.com/.well-known/apple-app-site-association` returns JSON.
2. Install release build on device.
3. Open `https://mg.loopcstrategies.com/dashboard?tab=erp-enquiry&account=1000` in Safari/Chrome — should offer to open MG Ops.
