# Staging environment (Railway + Vercel parity)

Goal: a **second** full stack that mirrors production **URLs and secrets shape** so you catch CORS, CSRF, cookies, EAS `EXPO_PUBLIC_*`, and DB migrations before merging to `main`.

## 1. Recommended layout

| Piece | Production | Staging |
|--------|-------------|---------|
| Git branch | `main` | `staging` (or deploy previews from PRs only) |
| Railway service | e.g. `ops-dashboard-api` | New service: `ops-dashboard-api-staging` from same repo, **Root Directory** = `backend` |
| Vercel project | Production project | Same project **Preview** env, or a dedicated `ops-dashboard-web-staging` |
| MongoDB | Prod clusters | **Separate** Atlas DBs or databases (never point staging at prod data for write tests) |
| EAS | `production` channel / profile | `preview` profile already maps to non-prod API if `EXPO_PUBLIC_API_URL` points at staging |

## 2. Railway (staging backend)

1. **New service** → GitHub repo → branch `staging` (or `main` with manual deploys only from staging branch).
2. **Variables:** Copy from production and adjust:

   - `NODE_ENV=production` (still use production mode for realistic CSRF/cookie behavior) or `NODE_ENV=staging` if your code branches on it (today most paths only check `production` vs not).
   - `JWT_SECRET` — **different** random value from prod (invalidates tokens between envs).
   - `MONGO_URI_MG` / `_CG` / `_LOOPC` — **staging** URIs.
   - `CLIENT_URL` / `CLIENT_URLS` — include **only** staging frontend origins (e.g. `https://staging.yourdomain.com`, `https://*.vercel.app` for preview if you allow it).
   - `SERVER_BASE_URL` — public **staging** API URL (for links and uploads).
   - Optional: `SENTRY_DSN` / `SENTRY_ENVIRONMENT=staging` — separate Sentry project or environment (see [OBSERVABILITY-SENTRY.md](./OBSERVABILITY-SENTRY.md)).

3. **Custom domain** (optional): `api-staging.yourdomain.com` → staging service.

## 3. Vercel (staging frontend)

1. **Environment variables** → **Preview** (or a dedicated “Staging” environment):

   - `VITE_API_BASE_URL` / `VITE_API_URL` → **staging** Railway URL (must match `CLIENT_URLS` on that Railway service).
   - Same **tenant subdomain** strategy as prod if you use hostname-based tenant resolution locally.

2. Deploy **Preview** from `staging` branch or open a PR into `staging` so every PR gets a preview URL; add that URL pattern to Railway `CLIENT_URLS`.

## 4. EAS (mobile against staging)

1. In Expo: **Environment variables** for the **preview** (or a `staging` EAS environment) set:

   - `EXPO_PUBLIC_API_URL=https://<staging-api-host>/api` (or your convention).

2. Run `eas build` / `eas update` against that environment so QA devices hit staging only.

3. Do **not** reuse production `EXPO_PUBLIC_API_URL` on internal QA builds if you want isolation.

## 5. Secrets pattern (parity without leakage)

- **Naming:** Prefix staging secrets in your password manager (`STAGING_RAILWAY_JWT`, etc.).
- **Rotation:** Rotate staging JWT and DB passwords on a looser schedule than prod; still never commit `.env`.
- **CI:** GitHub Actions can target staging smoke (`SMOKE_API_BASE` pointing at staging) on a schedule or on `push` to `staging`.

## 6. Smoke checklist after provisioning staging

- [ ] `/api/health` and `/api/ready` on staging URL  
- [ ] Login from staging web → session + CSRF happy path  
- [ ] Mobile preview build or dev client → login + one API call  
- [ ] Post-deploy smoke script (optional) with staging credentials

## See also

- [INCIDENT-RUNBOOK.md](./INCIDENT-RUNBOOK.md)
- [DEPLOYMENT-CHECKLIST.md](../DEPLOYMENT-CHECKLIST.md)
