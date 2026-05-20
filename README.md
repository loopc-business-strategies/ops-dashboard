# Ops Dashboard

Multi-tenant operations and ERP platform for mg, cg, and loopc companies.

## Deployment Docs
- Main deployment checklist: `DEPLOYMENT-CHECKLIST.md`
- Release/version policy: `RELEASE-VERSIONING-POLICY.md`

**Normal releases:** With the repo connected to **Vercel** and **Railway**, pushing to **`main`** is enough—both platforms pick up the commit automatically. You do not need local `npx vercel` or `railway` for day-to-day deploys. Use those CLIs only for manual redeploys or when setting up CI with `VERCEL_TOKEN` / a fresh `railway login`; headless environments (e.g. some agent sandboxes) often lack OAuth, which is why CLI deploy can fail there even when GitHub integrations succeed.
- Live ERP spot metals (Railway): `METALS_DEV_API_KEY`, or `FRED_API_KEY` / `ALPHA_VANTAGE_API_KEY` as fallbacks; optional **`METALS_SPOT_MOCK_REALTIME=true`** for synthetic SSE ticks in dev — see `ENV-VARS-QUICK-REFERENCE.md`

## GitHub Actions Setup (One-Shot)
This repo includes the post-deploy tenant smoke workflow:
- `.github/workflows/post-deploy-tenant-smoke.yml`

Configure these in GitHub once:
1. Repo `Settings` -> `Secrets and variables` -> `Actions`
2. Add **Variables** and **Secrets** below

### Required Variables
Add under `Repository variables`:

| Name | Example Value | Purpose |
|---|---|---|
| `SMOKE_BASE_DOMAIN` | `loopcstrategies.com` | Base domain used to test mg/cg/loopc portals |
| `SMOKE_API_BASE` | `https://api.loopcstrategies.com` | API base for `/api/health` and auth route checks |
| `SMOKE_WAIT_SECONDS` | `180` | Delay before smoke run to allow Vercel/Railway propagation |

### Optional Secrets (Failure Notifications)
Add under `Repository secrets`:

| Name | Example Value | Purpose |
|---|---|---|
| `SMOKE_SLACK_WEBHOOK_URL` | `https://hooks.slack.com/services/...` | Post smoke failures to Slack |
| `SMOKE_TEAMS_WEBHOOK_URL` | `https://outlook.office.com/webhook/...` | Post smoke failures to Microsoft Teams |

### Optional Secrets (Authenticated ERP Smoke)
Add these if you want smoke checks to verify a real logged-in ERP route:

| Name | Example Value | Purpose |
|---|---|---|
| `SMOKE_AUTH_NAME` | `smoke-user` | Shared smoke login username for all tenants |
| `SMOKE_AUTH_PASSWORD` | `***` | Shared smoke login password for all tenants |
| `SMOKE_AUTH_NAME_MG` | `mg-smoke-user` | Optional MG-specific smoke username |
| `SMOKE_AUTH_PASSWORD_MG` | `***` | Optional MG-specific smoke password |
| `SMOKE_AUTH_NAME_CG` | `cg-smoke-user` | Optional CG-specific smoke username |
| `SMOKE_AUTH_PASSWORD_CG` | `***` | Optional CG-specific smoke password |
| `SMOKE_AUTH_NAME_LOOPC` | `loopc-smoke-user` | Optional LoopC-specific smoke username |
| `SMOKE_AUTH_PASSWORD_LOOPC` | `***` | Optional LoopC-specific smoke password |
| `SMOKE_REQUIRE_AUTH` | `true` | Fail smoke if authenticated ERP credentials are missing |

In CI, authenticated ERP smoke is required by default because GitHub sets `CI=true`. For local/manual runs without credentials, the authenticated ERP probe is skipped unless `SMOKE_REQUIRE_AUTH=true`. Existing `SMOKE_AUTH_TOKEN` or `SMOKE_SESSION_COOKIE` values are still supported.

### Backend Build Metadata
Railway writes `backend/build-meta.json` during build so `/api/health` reports the source commit that produced the running backend.

Do not set `BACKEND_BUILD_COMMIT` or `BACKEND_BUILD_SHA` in Railway. Those legacy variable names can become stale. If a manual override is ever needed, use:

```text
BACKEND_BUILD_OVERRIDE_COMMIT=<sha>
BACKEND_BUILD_OVERRIDE_SHA=<sha>
```

### Copy-Paste Values (Production)
Use these defaults directly if you run current production domains:

```text
SMOKE_BASE_DOMAIN=loopcstrategies.com
SMOKE_API_BASE=https://api.loopcstrategies.com
SMOKE_WAIT_SECONDS=180
```

### Trigger Behavior
- Automatic: after `CI` workflow completes successfully on `main`
- Manual: `Actions` -> `Post-Deploy Tenant Smoke` -> `Run workflow`

### Vercel API Safety (Preview vs Production)
- Production hostnames (`mg`, `cg`, `loopc`, `app` under `loopcstrategies.com`) rewrite `/api/*` to production Railway API.
- `*.vercel.app` preview deployments do not proxy to production API; they return `api-preview-disabled.json` by design to prevent accidental production writes.
- If you need live preview API testing, configure a separate non-production backend and update rewrite policy accordingly.

### What the Smoke Check Verifies
- `https://mg.<domain>/login` returns valid app shell
- `https://cg.<domain>/login` returns valid app shell
- `https://loopc.<domain>/login` returns valid app shell
- `${SMOKE_API_BASE}/api/health` success for each tenant header pair
- `${SMOKE_API_BASE}/api/auth/login` tenant routing sanity check for `mg`, `cg`, `loopc`

### Troubleshooting
- If smoke fails right after deploy, rerun workflow with higher wait value (for example `300`).
- If all portals fail, check DNS and Vercel domain bindings.
- If health checks fail only, check Railway service status and env vars.
