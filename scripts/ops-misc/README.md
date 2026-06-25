# Ad-hoc ops scripts

**Security:** Do not put real production passwords in source. HTTPS scripts load optional `backend/.env` and repo-root `.env.local` when `dotenv` is available, and read **`OPS_MISC_*`** variables below. Authenticated scripts exit with instructions if login env is missing.

These Node scripts were consolidated from the **repository root** so the top level stays focused on the workspace (`package.json`, `frontend/`, `backend/`, etc.).

They are **not** part of the production app unless documented elsewhere. **Destructive cleanup scripts** (`deep-*.js`, `authenticated-cleanup-mg.js`, `deep-mongo-cleanup-mg.js`) now require the same guard as `backend/scripts/destructive/`:

- `--tenant=mg` (default)
- `--apply` to mutate
- `--reason="..."` (10+ chars) and `--confirm=<token>` for apply in production-like envs

Default is **dry-run** (counts only).

## Environment (HTTPS helpers)

| Variable | Purpose |
|----------|---------|
| `OPS_MISC_API_BASE` | API origin (e.g. `https://api.example.com`). Falls back to `SMOKE_API_BASE`, then `https://api.loopcstrategies.com`. |
| `OPS_MISC_TENANT_ID` | Value for `X-Tenant-ID` (default `mg`). |
| `OPS_MISC_LOGIN_NAME` or `OPS_MISC_LOGIN_USERNAME` | Login identifier for `/api/auth/login`. |
| `OPS_MISC_LOGIN_PASSWORD` | **Required** for scripts that authenticate. |
| `OPS_MISC_LOGIN_USE_USERNAME_FIELD` | If `1` or `true`, send `{ username, password }` instead of `{ name, password }`. |
| `OPS_MISC_PROBE_*` | Used only by `verify-deployment.js` for non-destructive auth endpoint probes (`OPS_MISC_PROBE_COMPANY`, `OPS_MISC_PROBE_NAME`, `OPS_MISC_PROBE_PASSWORD`; defaults are non-credential placeholders). |

Shared helpers live in [`_opsMiscEnv.js`](_opsMiscEnv.js).

## Running

From the repo root:

```bash
node scripts/ops-misc/verify-deployment.js
```

Set `DOMAIN` or other env vars as described in each script’s header comments.

## Contents (overview)

| Script | Purpose (high level) |
|--------|----------------------|
| `verify-deployment.js` | Probe mg/cg/loopc subdomains and API health |
| `check-login.js` | Quick login probe against configured API |
| `check-mg-coa.js`, `check-mg-entries-direct.js` | MG chart-of-accounts / entries checks |
| `deep-cleanup-mg.js`, `deep-cleanup-mg-fixed.js`, `deep-mongo-cleanup-mg.js`, `authenticated-cleanup-mg.js` | Destructive or authenticated cleanup utilities — **read before use** |
| `final-verify.js`, `verify-mg-cleanup.js` | Verification helpers after cleanup |
| `inspect-sale-mapping.js` | Sale mapping inspection |
| `test-queries.js` | Ad-hoc query experiments |

For maintained backend maintenance scripts, see `backend/scripts/README.md`.
