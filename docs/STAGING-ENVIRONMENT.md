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
- **CI:** [`.github/workflows/staging-smoke.yml`](../.github/workflows/staging-smoke.yml) runs `npm run smoke:staging` on `push` to `staging` or manual dispatch.

## 6. GitHub Actions staging smoke

Configure these under **Settings → Secrets and variables → Actions** before enabling the workflow:

### Repository variables

| Variable | Purpose |
|----------|---------|
| `STAGING_SMOKE_API_BASE` | Staging API origin. Defaults to current Railway staging URL: `https://ops-dashboard-staging-e6c6.up.railway.app` |
| `STAGING_SMOKE_BASE_DOMAIN` | Staging tenant domain suffix, e.g. `staging.loopcstrategies.com` |
| `STAGING_SMOKE_VERCEL_HOSTS` | Optional comma-separated explicit frontend hosts when staging tenants are not simple subdomains |
| `STAGING_SMOKE_RAILWAY_READINESS_URL` | Optional explicit readiness URL; defaults to `${STAGING_SMOKE_API_BASE}/api/ready` |
| `STAGING_SMOKE_WAIT_SECONDS` | Optional deploy propagation delay; default `60` |
| `STAGING_SMOKE_REQUIRE_AUTH` | Default `false`; set `true` after staging smoke users exist |
| `STAGING_SMOKE_SKIP_FRONTEND` | Default `true`; set `false` after adding `STAGING_SMOKE_VERCEL_HOSTS` |

### Vercel preview Deployment Protection (401 on `*.vercel.app`)

Staging frontend smoke hits the Vercel **preview** URL (`STAGING_SMOKE_VERCEL_HOSTS`). If Vercel Authentication / Deployment Protection is enabled for Preview deployments, `/login` returns **401** until you either:

**Option A — Protection Bypass for Automation (recommended for CI)**

1. Vercel → **ops-dashboard** project → **Settings** → **Deployment Protection**
2. Under **Protection Bypass for Automation**, click **Create** (label e.g. `GitHub staging smoke`)
3. Copy the generated secret
4. GitHub → repo **Settings** → **Secrets and variables** → **Actions** → **New repository secret**
5. Name: `STAGING_SMOKE_VERCEL_BYPASS`, value: the secret from step 3
6. Keep `STAGING_SMOKE_SKIP_FRONTEND=false` — smoke sends `x-vercel-protection-bypass` automatically

Local reproduction:

```powershell
$env:SMOKE_API_BASE = "https://ops-dashboard-staging-e6c6.up.railway.app"
$env:SMOKE_VERCEL_HOSTS = "ops-dashboard-git-staging-beulah-4360s-projects.vercel.app"
$env:SMOKE_SKIP_FRONTEND = "false"
$env:SMOKE_REQUIRE_AUTH = "false"
$env:SMOKE_VERCEL_PROTECTION_BYPASS = "<vercel-bypass-secret>"
npm run smoke:staging
```

**Option B — Disable preview protection (public staging preview)**

1. Same **Deployment Protection** page
2. Under **Vercel Authentication**, set Preview deployments to **None** (or add the preview host under **Deployment Protection Exceptions**)
3. No bypass secret required; anyone with the preview URL can open the app

### Repository secrets

Use staging-only users/tokens. Do not reuse production smoke users if write tests are later added.

| Secret | Purpose |
|--------|---------|
| `STAGING_SMOKE_AUTH_NAME` / `STAGING_SMOKE_AUTH_PASSWORD` | Shared staging login for authenticated ERP probe |
| `STAGING_SMOKE_AUTH_NAME_MG` / `STAGING_SMOKE_AUTH_PASSWORD_MG` | Per-tenant MG override |
| `STAGING_SMOKE_AUTH_NAME_CG` / `STAGING_SMOKE_AUTH_PASSWORD_CG` | Per-tenant CG override |
| `STAGING_SMOKE_AUTH_NAME_LOOPC` / `STAGING_SMOKE_AUTH_PASSWORD_LOOPC` | Per-tenant LoopC override |
| `STAGING_SMOKE_AUTH_TOKEN` | Bearer token alternative |
| `STAGING_SMOKE_SESSION_COOKIE` | Session cookie alternative |
| `STAGING_SMOKE_VERCEL_BYPASS` | Vercel Protection Bypass for Automation secret when `STAGING_SMOKE_SKIP_FRONTEND=false` |

Local reproduction:

```powershell
$env:SMOKE_API_BASE = "https://api-staging.loopcstrategies.com"
$env:SMOKE_BASE_DOMAIN = "staging.loopcstrategies.com"
$env:SMOKE_AUTH_NAME_MG = "<staging-mg-user>"
$env:SMOKE_AUTH_PASSWORD_MG = "<staging-mg-password>"
npm run smoke:staging
```

API-only check before the staging frontend exists:

```powershell
$env:SMOKE_API_BASE = "https://api-staging.loopcstrategies.com"
$env:SMOKE_SKIP_FRONTEND = "true"
$env:SMOKE_REQUIRE_AUTH = "false"
npm run smoke:staging
```

`npm run smoke:staging` refuses to run against production `loopcstrategies.com` targets unless `STAGING_SMOKE_ALLOW_PRODUCTION_TARGETS=true` is set intentionally.

## 7. Smoke checklist after provisioning staging

- [x] `/api/health` and `/api/ready` on staging URL  
- [ ] Login from staging web → session + CSRF happy path  
- [ ] Mobile preview build or dev client → login + one API call  
- [x] `npm run smoke:staging` with staging credentials

## 8. Authenticated E2E (Playwright on staging preview)

Workflow: [`.github/workflows/staging-e2e.yml`](../.github/workflows/staging-e2e.yml) runs on `push` to `staging` (or manual dispatch).

Uses existing staging secrets (`STAGING_SMOKE_AUTH_*`, `STAGING_SMOKE_VERCEL_BYPASS`) and variables (`STAGING_SMOKE_VERCEL_HOSTS`).

Local run against the Vercel preview:

```powershell
$env:PLAYWRIGHT_BASE_URL = "https://ops-dashboard-git-staging-beulah-4360s-projects.vercel.app"
$env:PLAYWRIGHT_VERCEL_BYPASS = "<from STAGING_SMOKE_VERCEL_BYPASS secret>"
$env:E2E_AUTH_NAME = "ops-staging-smoke-probe"
$env:E2E_AUTH_PASSWORD = "<from STAGING_SMOKE_AUTH_PASSWORD secret>"
$env:E2E_AUTH_COMPANY = "loopc"
npm run test:e2e:staging
```

CI still runs mocked/local Playwright via [`.github/workflows/ci.yml`](../.github/workflows/ci.yml) `frontend-e2e` on every push.

## See also

- [INCIDENT-RUNBOOK.md](./INCIDENT-RUNBOOK.md)
- [DEPLOYMENT-CHECKLIST.md](../DEPLOYMENT-CHECKLIST.md)
