# Ops Dashboard

Multi-tenant operations and ERP platform for mg, cg, and loopc companies.

## Deployment Docs
- Main deployment checklist: `DEPLOYMENT-CHECKLIST.md`
- Release/version policy: `RELEASE-VERSIONING-POLICY.md`

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
