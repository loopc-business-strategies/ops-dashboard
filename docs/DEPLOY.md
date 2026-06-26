# Deploy and release

Single reference for **how this repo ships**. First-time Vercel/Railway/Mongo setup is in [DEPLOYMENT-CHECKLIST.md](../DEPLOYMENT-CHECKLIST.md).

## Production architecture

| Layer | Host | Trigger |
|-------|------|---------|
| Web SPA | Vercel (`mg` / `cg` / `loopc` / `app` on `loopcstrategies.com`) | Push to **`main`** |
| API | Railway (`https://api.loopcstrategies.com`) | Push to **`main`** |
| Staging API | Railway staging (`https://ops-dashboard-staging-e6c6.up.railway.app`) | Push to **`staging`** |
| Staging web | Vercel preview (`staging` branch) | Push to **`staging`** |
| Mobile | Manual GitHub Actions (no auto-deploy on git push) | `workflow_dispatch` |

Config files: root [`vercel.json`](../vercel.json), [`railway.json`](../railway.json). Vercel **Root Directory** must be **empty** (repo root), not `frontend`.

## Day-to-day production deploy

```text
1. Merge or push to main
2. GitHub Actions → CI runs (lint, tests, builds)
3. Vercel + Railway deploy from main (automatic via Git integration)
4. Post-Deploy Tenant Smoke runs after CI succeeds on main
```

You do **not** need local `vercel` or `railway` CLI for normal releases.

### Before you push

```bash
npm run check:ci-parity          # or CI-equivalent: lint + backend fast + mobile typecheck
npm run test:backend
npm run test:frontend
```

Optional gate (same as `deploy:railway` script):

```bash
npm run deploy:railway           # tests only — does not push or trigger hosts
```

### After deploy

- **Actions → Post-Deploy Tenant Smoke** — tenant portals, API health, optional authenticated ERP + mobile JWT smoke.
- Manual: `npm run smoke:tenants` and `npm run smoke:prod` (see [SMOKE-SECRETS-CHECKLIST.md](./SMOKE-SECRETS-CHECKLIST.md)).

Production URLs:

```text
https://mg.loopcstrategies.com
https://cg.loopcstrategies.com
https://loopc.loopcstrategies.com
https://api.loopcstrategies.com/api/health
https://api.loopcstrategies.com/api/ready
```

## Staging deploy

Push to **`staging`** (kept in sync with `main` when releasing):

| Workflow | Purpose |
|----------|---------|
| [staging-smoke.yml](../.github/workflows/staging-smoke.yml) | API + Vercel preview + auth ERP |
| [staging-e2e.yml](../.github/workflows/staging-e2e.yml) | Playwright login against staging preview |

Details: [STAGING-ENVIRONMENT.md](./STAGING-ENVIRONMENT.md).

## GitHub Actions map

| Workflow | When | Purpose |
|----------|------|---------|
| **CI** | Every push / PR | Lint, ERP policy parity, backend/frontend/mobile tests, frontend build, Playwright (local preview) |
| **Post-Deploy Tenant Smoke** | After CI on `main` | Production smoke + optional auth ERP + mobile API smoke |
| **Staging Smoke** | Push `staging` | Staging Railway + Vercel preview + mobile JWT API smoke |
| **Staging E2E** | Push `staging` | Authenticated Playwright on staging preview |
| **Mongo Backup Drill** | Quarterly (1 Jan/Apr/Jul/Oct) + manual | Upload volume + Mongo connectivity (`ATLAS_BACKUP_PHASE=deferred` default) — [MONGODB-BACKUPS-AND-DATA-SAFETY.md](./MONGODB-BACKUPS-AND-DATA-SAFETY.md) |
| **Mongo Backup Mongodump** | Weekly Sun + manual | Optional `mongodump` → S3 when `MONGO_BACKUP_ENABLED=true` |
| **Provision smoke credentials** | Manual | Create `ops-smoke-probe` + GitHub secrets |
| **Provision staging smoke credentials** | Manual | Staging smoke users + secrets |
| **Mobile iOS (GitHub macOS)** | Manual | TestFlight IPA — [MOBILE-IOS-GITHUB-BUILD.md](./MOBILE-IOS-GITHUB-BUILD.md) |
| **Mobile Android bundle** | Manual | Release AAB — [MOBILE-ANDROID-LOCAL-BUILD.md](./MOBILE-ANDROID-LOCAL-BUILD.md) |

Smoke secrets and variables: [SMOKE-SECRETS-CHECKLIST.md](./SMOKE-SECRETS-CHECKLIST.md).

## Environment variables

- **Copy-paste names and values:** [ENV-VARS-QUICK-REFERENCE.md](../ENV-VARS-QUICK-REFERENCE.md)
- **Version bumps:** [RELEASE-VERSIONING-POLICY.md](../RELEASE-VERSIONING-POLICY.md)

### Production: Redis (`REDIS_URL`)

Set **`REDIS_URL`** on Railway production (and staging if you run multiple API instances or want parity with prod). Without it, the API uses in-process memory for report caches, rate limits, notification digest dedupe, and realtime SSE fan-out — fine for a single instance, but unsafe when Railway scales horizontally or restarts split traffic across pods.

After deploy, `/api/ready` reports `checks.redisConfigured` — post-deploy smoke does not fail when Redis is unset, but you should treat `redisConfigured: false` in production as a deployment gap.

1. Railway → project → **Add Redis** (or attach an existing Redis service).
2. Copy the **private** Redis URL into the API service variables as `REDIS_URL` (see [ENV-VARS-QUICK-REFERENCE.md](../ENV-VARS-QUICK-REFERENCE.md)).
3. Redeploy the API; confirm `/api/ready` and post-deploy smoke pass.
4. Optional: verify Redis-backed paths in logs (cache/rate-limit init) after deploy.

Do not set stale `BACKEND_BUILD_COMMIT` on Railway; build metadata comes from [`backend/build-meta.json`](../backend/build-meta.json) at deploy time.

## Vercel preview safety

- Production tenant hostnames proxy `/api/*` to Railway.
- `*.vercel.app` previews return `api-preview-disabled.json` for `/api/*` so previews cannot hit production API by accident.
- Staging preview uses **Preview** env `VITE_API_URL` → staging Railway (see [STAGING-ENVIRONMENT.md](./STAGING-ENVIRONMENT.md)).

## Mobile releases

Not tied to `main` push. Use [mobile/RELEASE_CHECKLIST.md](../mobile/RELEASE_CHECKLIST.md).

## Observability and incidents

- Health: `/api/health` (liveness), `/api/ready` (Mongo + tenants + integrations).
- Logs: Railway log stream (API), Vercel deployment logs (web).
- Optional Sentry: [OBSERVABILITY-SENTRY.md](./OBSERVABILITY-SENTRY.md).
- Outage triage: [INCIDENT-RUNBOOK.md](./INCIDENT-RUNBOOK.md).
- Deploy notes (logs, ERP stability): [OBSERVABILITY-AND-DEPLOYS.md](./OBSERVABILITY-AND-DEPLOYS.md).

## Rollback

| Component | Action |
|-----------|--------|
| Frontend | Vercel → Deployments → promote previous deployment, or `git revert` + push `main` |
| Backend | Railway → redeploy previous image, or `git revert` + push `main` |
| Data | Do not delete without audit — see `npm run cleanup:safe` and [MONGODB-BACKUPS-AND-DATA-SAFETY.md](./MONGODB-BACKUPS-AND-DATA-SAFETY.md) |

## Related docs (by task)

| Task | Doc |
|------|-----|
| First-time production setup (DNS, Mongo, CORS) | [DEPLOYMENT-CHECKLIST.md](../DEPLOYMENT-CHECKLIST.md) |
| Local dev / Windows | [WINDOWS-DEV.md](./WINDOWS-DEV.md), [TESTING.md](./TESTING.md) |
| Customer onboarding | [NEXA-CUSTOMER-ONBOARDING.md](./NEXA-CUSTOMER-ONBOARDING.md) |
| Historical snapshots only (archived — not for deploy/ops) | [archive/README.md](./archive/README.md) |
| Critical fixes tracker (P0–P3) | [CRITICAL-FIXES-CHECKLIST.md](./CRITICAL-FIXES-CHECKLIST.md) |
