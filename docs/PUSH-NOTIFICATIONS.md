# Push notifications (Nexa MG)

Two channels reach users outside the open app:

## 1. Mobile (Expo / iOS + Android)

1. **App:** After login, the Nexa MG mobile app registers an Expo push token and `POST`s it to `/api/auth/me/push-token` (see `mobile/src/services/expoPushRegistration.ts`).
2. **Server:** When an event calls `RealtimeServer.sendUserNotification(..., tenantKey)` with a real tenant (`mg`, `cg`, or `loopc`), the backend sends Socket.IO **and** (if configured) Expo push via `expo-server-sdk`.
3. **Railway / backend env:** Set **`EXPO_ACCESS_TOKEN`** (Expo account → Access tokens). Without it, mobile OS notifications are skipped; in-app Socket notifications still work. The variable name must be exactly **`EXPO_ACCESS_TOKEN`** (not the token’s friendly label from Expo). After deploy, verify with **`GET /api/ready`** — response includes **`checks.integrations.expoPushAccessTokenSet: true`** (boolean only; never exposes the token).
4. **Android release APK (local Gradle):** You also need **Firebase `google-services.json`** and **FCM credentials on the Expo project**. See **[`docs/MOBILE-ANDROID-PUSH-FCM.md`](./MOBILE-ANDROID-PUSH-FCM.md)** — without this, background push on sideloaded APKs will not work even when the API is configured.

## 2. Web / PC (Web Push)

1. **Browser:** After login to the Vite dashboard, the app registers `/sw.js` and subscribes with **`VITE_WEB_PUSH_PUBLIC_KEY`** (same value as backend `WEB_PUSH_PUBLIC_KEY`).
2. **Server:** Set **`WEB_PUSH_PUBLIC_KEY`**, **`WEB_PUSH_PRIVATE_KEY`**, and optionally **`WEB_PUSH_SUBJECT`** (e.g. `mailto:support@example.com`). Generate keys locally:

   ```bash
   npx web-push generate-vapid-keys
   ```

3. **Vercel (frontend):** Add `VITE_WEB_PUSH_PUBLIC_KEY` to the frontend environment (public key only), **or** rely on runtime `GET /api/push/web-config` (same public key as Railway).
4. **Railway (API):** Add the **same** public key plus the **private** key to the backend service.

Web Push requires **HTTPS** (or `localhost` for dev). Users must allow notifications in the browser prompt.

## 3. Android 13+

The mobile app manifest includes **`POST_NOTIFICATIONS`** so the OS can grant notification permission for release builds.

## Related files

- Backend send: [backend/services/expoPushNotifications.js](backend/services/expoPushNotifications.js), [backend/services/webPushNotifications.js](backend/services/webPushNotifications.js), [backend/realtime/RealtimeServer.js](backend/realtime/RealtimeServer.js)
- Auth routes: [backend/routes/auth.js](backend/routes/auth.js)
- Frontend SW: [frontend/public/sw.js](frontend/public/sw.js), [frontend/src/utils/webPushRegister.js](frontend/src/utils/webPushRegister.js)
