# Android push (FCM) for Nexa mobile

Local **release APK/AAB** builds need **Firebase Cloud Messaging (FCM)** wired into the native Android project. Without it, the app may still obtain an Expo push token, but **OS notifications will not arrive** when the app is in the background.

Web push and in-app Socket notifications are unaffected.

## Prerequisites (already done on production API)

| Item | Where |
|------|--------|
| `EXPO_ACCESS_TOKEN` | Railway → `ops-dashboard` service (verify: `GET /api/ready` → `expoPushAccessTokenSet: true`) |
| EAS project ID | `mobile/app.config.ts` → `extra.eas.projectId` (`f049f1a3-d499-416b-97af-e082bca658fa`) |
| Android package | `com.loopc.nexa` (see `mobile/app.config.ts`) |

## Step 1 — Firebase project

1. Open [Firebase Console](https://console.firebase.google.com/).
2. Create or select a project (display name **Nexa**; Firebase project ID may remain `mg-ops-push`).
3. **Project settings** → edit **Project name** / Android app **nickname** to **Nexa** if the console still shows “Nexa MG”.
4. **Add app** → **Android** (skip if already registered).
5. **Android package name:** `com.loopc.nexa` (must match `app.config.ts`). If you still have an older Firebase app for `com.loopc.mg.ops`, add a second Android app for `com.loopc.nexa` or migrate FCM credentials to the new package.
6. Download **`google-services.json`**.
7. Place it at:

   ```
   mobile/android/app/google-services.json
   ```

   Template (do not commit real keys): [`mobile/android/app/google-services.json.example`](../mobile/android/app/google-services.json.example).  
   Verify locally: `npm run check:fcm`.

## Step 2 — Upload FCM credentials to Expo

Expo’s push service delivers to Android via FCM credentials stored on your Expo account.

1. Sign in at [expo.dev](https://expo.dev) → project **nexa-mg** (display name **Nexa**; slug unchanged; project ID above). Optionally rename the project display name under Expo project settings.
2. Open **Project settings** → **Credentials** → **Android** → **Push Notifications**.
3. Upload **FCM V1 service account key** (Firebase → Project settings → Service accounts → Generate new private key JSON), **or** follow Expo’s wizard for **FCM legacy** if prompted.
4. The Expo account must match the one used for `EXPO_ACCESS_TOKEN` on Railway.

CLI alternative (interactive):

```bash
cd mobile
npx eas login
npx eas credentials
```

Choose **Android** → **Push Notifications** → upload FCM key.

## Step 3 — Rebuild and install the APK

Gradle applies Google Services automatically when `google-services.json` exists.

From repo root:

```bash
# Windows long paths
scripts\build-mobile-apk-subst-q.cmd

# Or short path
npm run mobile:build:android:local:apk
```

Install the new APK on the device (uninstall old build if package signature changed).

## Step 4 — Test on device

1. Open **Nexa** → log in → **Allow notifications**.
2. **Settings** tab → **Register for push** (should say “Push registered with server.”).
3. Background the app (home button).
4. Trigger an event (chat message, voucher approval, etc.).
5. Expect an OS notification.

If registration fails, check Railway logs for `[expo-push]` and confirm the user document has `expoPushTokens` in MongoDB.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| “Register for push” fails | Log in again; check API reachability; confirm `POST /api/auth/me/push-token` returns 200. |
| Register OK, no background alert | Missing `google-services.json` and/or Expo FCM credentials; rebuild APK after adding both. |
| `DeviceNotRegistered` in Railway logs | Open app once after install; tap **Register for push**; stale tokens are pruned automatically. |
| Foreground only works | Expected without FCM + token registration; Socket handles foreground. |
| Expo Go | Use a **release APK** or EAS build — Expo Go uses a different push experience. |

## Related

- [`docs/PUSH-NOTIFICATIONS.md`](./PUSH-NOTIFICATIONS.md) — overview (mobile + web)
- [`docs/RAILWAY_EXPO_PUSH.md`](./RAILWAY_EXPO_PUSH.md) — `EXPO_ACCESS_TOKEN` on Railway
- [`docs/MOBILE-ANDROID-LOCAL-BUILD.md`](./MOBILE-ANDROID-LOCAL-BUILD.md) — local Gradle builds
