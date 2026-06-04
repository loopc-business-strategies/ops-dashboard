# Observability: Sentry (optional)

Errors in **production** should be visible in one place. This repo supports **optional** [Sentry](https://sentry.io) on the **backend** and **web frontend** when DSN env vars are set. **Mobile (Expo)** can use the same DSN pattern after adding the native SDK (see below).

## Environment variables

| Platform | Variable | Notes |
|----------|-----------|--------|
| **Railway (backend)** | `SENTRY_DSN` | Server-side errors; unset = Sentry disabled |
| **Railway** | `SENTRY_ENVIRONMENT` | Optional; defaults to `NODE_ENV` (e.g. `production`, `staging`) |
| **Vercel (frontend)** | `VITE_SENTRY_DSN` | Client errors; unset = disabled |
| **Vercel** | `VITE_SENTRY_ENVIRONMENT` | Optional; defaults to `import.meta.env.MODE` |
| **EAS (Expo)** | `EXPO_PUBLIC_SENTRY_DSN` | Set in Expo dashboard for the profile you use; requires `@sentry/react-native` in the app (see Mobile) |

Never commit DSNs into the repo. Create separate Sentry **projects** (or environments) for staging vs production.

## Backend

Initialized in [backend/app.js](../backend/app.js) when `SENTRY_DSN` is set. Unhandled errors in the Express error handler are reported via `Sentry.captureException`.

## Frontend (Vite)

Initialized at startup in [frontend/src/main.jsx](../frontend/src/main.jsx) when `VITE_SENTRY_DSN` is set. Unhandled errors and promise rejections are captured by the SDK.

## Mobile (Expo / React Native)

The app includes **`@sentry/react-native`** and a small init in [mobile/app/_layout.tsx](../mobile/app/_layout.tsx) when `EXPO_PUBLIC_SENTRY_DSN` is set.

1. Create a **React Native** project in Sentry; copy the DSN.
2. In [Expo](https://expo.dev) → your project → **Environment variables**, add `EXPO_PUBLIC_SENTRY_DSN` for **preview** / **production** as needed.
3. After changing native Sentry config, run a **new EAS build** (not only OTA) if the Sentry wizard adds native code; OTA is enough for JS-only tweaks.

If you remove the DSN, Sentry stays inert (no network calls).

## Alternatives

- **Datadog / Logtail / Axiom** — ship structured logs from `backend/middleware/logger.js` to a log drain.
- **Uptime** — ping `/api/health` every minute from a global monitor (Better Stack, UptimeRobot).

## Related

- [INCIDENT-RUNBOOK.md](./INCIDENT-RUNBOOK.md)
- [ENV-VARS-QUICK-REFERENCE.md](../ENV-VARS-QUICK-REFERENCE.md) — add Sentry lines there in your fork if you want a single checklist
