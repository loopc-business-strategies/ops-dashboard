# Observability: Sentry (optional)

Errors in **production** should be visible in one place. This repo supports **optional** [Sentry](https://sentry.io) on the **backend** and **web frontend** when DSN env vars are set. **Mobile (Expo)** can use the same DSN pattern after adding the native SDK (see below).

## Environment variables

| Platform | Variable | Notes |
|----------|-----------|--------|
| **Railway (backend)** | `SENTRY_DSN` | Server-side errors; unset = Sentry disabled |
| **Railway** | `SENTRY_ENVIRONMENT` | Optional; defaults to `NODE_ENV` (e.g. `production`, `staging`) |
| **Railway** | `SENTRY_RELEASE` | Optional; release label in Sentry (falls back to `RAILWAY_GIT_COMMIT_SHA` / `GITHUB_SHA` / `COMMIT_SHA` when unset) |
| **Railway** | `SENTRY_TRACES_SAMPLE_RATE` | Optional; `0`–`1` performance trace sampling; default `0` (errors only) |
| **Vercel (frontend)** | `VITE_SENTRY_DSN` | Client errors; unset = disabled |
| **Vercel** | `VITE_SENTRY_ENVIRONMENT` | Optional; defaults to `import.meta.env.MODE` |
| **Vercel** | `VITE_SENTRY_RELEASE` | Optional; overrides release; otherwise `VITE_VERCEL_GIT_COMMIT_SHA` is used when set by Vercel |
| **Vercel** | `VITE_SENTRY_TRACES_SAMPLE_RATE` | Optional; `0`–`1`; default `0` |
| **EAS (Expo)** | `EXPO_PUBLIC_SENTRY_DSN` | Set in Expo for the build profile; requires `@sentry/react-native` (see Mobile) |
| **EAS (Expo)** | `EXPO_PUBLIC_SENTRY_RELEASE` | Optional; e.g. EAS build ID or git SHA for release tracking |
| **EAS (Expo)** | `EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE` | Optional; `0`–`1`; default `0` |
| **EAS (Expo)** | `EXPO_PUBLIC_SENTRY_ENVIRONMENT` | Optional; defaults to `development` in dev builds and `production` otherwise |

Never commit DSNs into the repo. Create separate Sentry **projects** (or environments) for staging vs production.

## Backend

Initialized in [backend/app.js](../backend/app.js) when `SENTRY_DSN` is set. Unhandled errors in the Express error handler are reported via `Sentry.captureException`.

## Frontend (Vite)

Initialized at startup in [frontend/src/main.jsx](../frontend/src/main.jsx) when `VITE_SENTRY_DSN` is set. Unhandled errors and promise rejections are captured by the SDK.

## Mobile (Expo / React Native)

The app includes **`@sentry/react-native`**. [mobile/src/lib/sentryInit.ts](../mobile/src/lib/sentryInit.ts) defines `initMobileSentry()`, which is called from [mobile/app/_layout.tsx](../mobile/app/_layout.tsx) when `EXPO_PUBLIC_SENTRY_DSN` is set.

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
- [FRONTEND-LINT-SCOPE.md](./FRONTEND-LINT-SCOPE.md) — which frontend paths ESLint enforces in CI
- [SENTRY-RELEASE-SETUP.md](./SENTRY-RELEASE-SETUP.md) — release and trace sampling on Railway, Vercel, and EAS
