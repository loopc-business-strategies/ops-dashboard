# Sentry release and performance sampling (operators)

After DSNs are set ([docs/OBSERVABILITY-SENTRY.md](./OBSERVABILITY-SENTRY.md)), configure **release** labels so Issues group by deploy, and optionally enable **low** performance trace sampling.

## Railway (backend — `ops-dashboard-api`)

In **Variables**, add or confirm:

| Variable | Example | Notes |
|----------|---------|--------|
| `SENTRY_DSN` | *(from Sentry project)* | Required for backend reporting |
| `SENTRY_ENVIRONMENT` | `production` or `staging` | Optional |
| `SENTRY_RELEASE` | `ops-dashboard@5b82dce` or raw git SHA | Optional; if unset, `RAILWAY_GIT_COMMIT_SHA`, `GITHUB_SHA`, or `COMMIT_SHA` is used when present |
| `SENTRY_TRACES_SAMPLE_RATE` | `0` | Default in code is `0` (errors only). Use `0.1` only if you want performance data |

Redeploy the service after changing variables.

## Vercel (web — `ops-dashboard-web`)

In **Settings → Environment Variables** (Production / Preview as needed):

| Variable | Example | Notes |
|----------|---------|--------|
| `VITE_SENTRY_DSN` | *(from Sentry project)* | Required for browser reporting |
| `VITE_SENTRY_ENVIRONMENT` | `production` | Optional |
| `VITE_SENTRY_RELEASE` | `ops-dashboard-web@5b82dce` | Optional; Vercel often injects `VITE_VERCEL_GIT_COMMIT_SHA` — web init uses that when `VITE_SENTRY_RELEASE` is empty |
| `VITE_SENTRY_TRACES_SAMPLE_RATE` | `0` | Optional; default `0` in app code |

Trigger a **new production deploy** after changing build-time variables (Vite bakes `VITE_*` at build).

## Expo / EAS (mobile)

In [expo.dev](https://expo.dev) → your project → **Environment variables** (per **preview** / **production** profile):

| Variable | Example | Notes |
|----------|---------|--------|
| `EXPO_PUBLIC_SENTRY_DSN` | *(from Sentry RN project)* | Required for native client reporting |
| `EXPO_PUBLIC_SENTRY_ENVIRONMENT` | `production` | Optional |
| `EXPO_PUBLIC_SENTRY_RELEASE` | `nexa@<eas-build-id>` | Optional; helps match Issues to a binary |
| `EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE` | `0` | Optional; default `0` |

Changing these for **native** builds requires a **new EAS build** (not only OTA) when values must appear in the compiled bundle.

## Verification

1. Deploy with the variables above.
2. Trigger a harmless test event or captured message from each surface.
3. In each Sentry project, confirm **Release** on the issue matches what you configured (or the auto-detected SHA).

## Related

- [OBSERVABILITY-SENTRY.md](./OBSERVABILITY-SENTRY.md)
- [ENV-VARS-QUICK-REFERENCE.md](../ENV-VARS-QUICK-REFERENCE.md)
