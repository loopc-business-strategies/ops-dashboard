# Post-deploy smoke secrets checklist

Use this after pushing to `main` when validating [`.github/workflows/post-deploy-tenant-smoke.yml`](../.github/workflows/post-deploy-tenant-smoke.yml).

## GitHub repository secrets

Configure under **Settings → Secrets and variables → Actions**:

| Secret | Purpose |
|--------|---------|
| `SMOKE_AUTH_NAME` | Shared login username for authenticated ERP probe |
| `SMOKE_AUTH_PASSWORD` | Shared login password |
| `SMOKE_AUTH_NAME_MG` / `SMOKE_AUTH_PASSWORD_MG` | Per-tenant overrides (optional) |
| `SMOKE_AUTH_NAME_CG` / `SMOKE_AUTH_PASSWORD_CG` | Per-tenant overrides (optional) |
| `SMOKE_AUTH_NAME_LOOPC` / `SMOKE_AUTH_PASSWORD_LOOPC` | Per-tenant overrides (optional) |
| `SMOKE_AUTH_TOKEN` | Bearer token alternative to password login |
| `SMOKE_SESSION_COOKIE` | Session cookie alternative |

## GitHub repository variables (optional)

| Variable | Default | Purpose |
|----------|---------|---------|
| `SMOKE_BASE_DOMAIN` | `loopcstrategies.com` | Portal host suffix |
| `SMOKE_API_BASE` | `https://api.loopcstrategies.com` | API origin |
| `SMOKE_WAIT_SECONDS` | `180` | Delay before smoke after CI |
| `SMOKE_REQUIRE_AUTH` | `true` | Set `false` to skip authenticated ERP probe |

## Verification steps

1. Open **Actions → CI** and confirm the latest `main` workflow completed successfully.
2. Open **Actions → Post-Deploy Tenant Smoke** and confirm the run triggered after CI (or run **workflow_dispatch** manually).
3. Confirm jobs **Smoke mg/cg/loopc** and production smoke steps are green.
4. If authenticated probe fails, check [`scripts/production-smoke.js`](../scripts/production-smoke.js) error text for missing credentials.

## Local reproduction

```powershell
$env:SMOKE_API_BASE = "https://api.loopcstrategies.com"
$env:SMOKE_AUTH_NAME = "<user>"
$env:SMOKE_AUTH_PASSWORD = "<password>"
npm run smoke:tenants
npm run smoke:prod
```

## Staging smoke

Use separate staging variables/secrets for [`.github/workflows/staging-smoke.yml`](../.github/workflows/staging-smoke.yml):

| Variable / secret | Purpose |
|-------------------|---------|
| `STAGING_SMOKE_API_BASE` | Required staging API origin |
| `STAGING_SMOKE_BASE_DOMAIN` / `STAGING_SMOKE_VERCEL_HOSTS` | Staging frontend hosts |
| `STAGING_SMOKE_AUTH_NAME*` / `STAGING_SMOKE_AUTH_PASSWORD*` | Staging-only smoke users |

Local staging run:

```powershell
$env:SMOKE_API_BASE = "https://api-staging.loopcstrategies.com"
$env:SMOKE_BASE_DOMAIN = "staging.loopcstrategies.com"
$env:SMOKE_AUTH_NAME_MG = "<staging-mg-user>"
$env:SMOKE_AUTH_PASSWORD_MG = "<staging-mg-password>"
npm run smoke:staging
```

The staging smoke command blocks production `loopcstrategies.com` targets by default to avoid accidentally validating staging against production.

See also [`ENV-VARS-QUICK-REFERENCE.md`](../ENV-VARS-QUICK-REFERENCE.md).
