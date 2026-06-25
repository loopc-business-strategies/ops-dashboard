# Ops Dashboard

Multi-tenant operations and ERP platform for mg, cg, and loopc companies.

## Deployment Docs

| Doc | Use |
|-----|-----|
| **[docs/DEPLOY.md](docs/DEPLOY.md)** | **Canonical** — production/staging deploy, CI, smoke, rollback |
| [DEPLOYMENT-CHECKLIST.md](DEPLOYMENT-CHECKLIST.md) | First-time Vercel/Railway/Mongo/DNS setup |
| [docs/STAGING-ENVIRONMENT.md](docs/STAGING-ENVIRONMENT.md) | Staging Railway + Vercel preview |
| [docs/SMOKE-SECRETS-CHECKLIST.md](docs/SMOKE-SECRETS-CHECKLIST.md) | GitHub smoke secrets and variables |
| [docs/INCIDENT-RUNBOOK.md](docs/INCIDENT-RUNBOOK.md) | Outage triage |
| [docs/OBSERVABILITY-SENTRY.md](docs/OBSERVABILITY-SENTRY.md) | Optional Sentry |
| [docs/OBSERVABILITY-AND-DEPLOYS.md](docs/OBSERVABILITY-AND-DEPLOYS.md) | Health, logs, ERP stability notes |
| [docs/ERP-API-GUIDE.md](docs/ERP-API-GUIDE.md) | ERP API surface |
| [docs/CRITICAL-FIXES-CHECKLIST.md](docs/CRITICAL-FIXES-CHECKLIST.md) | P0–P3 critical fixes tracker |
| [docs/ERP-API-PR-CHECKLIST.md](docs/ERP-API-PR-CHECKLIST.md) | ERP pull request checklist |
| [RELEASE-VERSIONING-POLICY.md](RELEASE-VERSIONING-POLICY.md) | Version bumps |
| [docs/TESTING.md](docs/TESTING.md) | Local and CI test commands |
| [docs/MONGODB-BACKUPS-AND-DATA-SAFETY.md](docs/MONGODB-BACKUPS-AND-DATA-SAFETY.md) | Backups |
| [docs/MOBILE-NO-EAS.md](docs/MOBILE-NO-EAS.md) | Mobile dev without EAS |
| [docs/archive/README.md](docs/archive/README.md) | Historical snapshots only (archived) — do not use for deploy or ops |

**Windows-only development:** see `docs/WINDOWS-DEV.md` (Jest, Mongo memory server / VC++ redist, Node version). **CI uses Node 24** (`.github/workflows/ci.yml`). At the repo root, **`.nvmrc`** pins **24** for `nvm use`, `fnm use`, or Volta so local runs match CI when debugging “passes in CI, fails locally.”

**Ad-hoc ops / cleanup scripts** (historically at the repo root) live under **`scripts/ops-misc/`** — see `scripts/ops-misc/README.md`. Example: `node scripts/ops-misc/verify-deployment.js`. Root **`ops_dashboard*.html`** scratch exports are listed in **`.gitignore`** and should not be committed.

**Linting:** `npm run lint` runs repository guardrails **and** strict ESLint on production slices (`erp/**`, `FinanceTab`, `OperationsTab`, `ERPTab`, `VoucherTab`, etc.) with **`--max-warnings=0`**. **`npm run lint:eslint:repo`** applies the same zero-warning policy to **all** of **`frontend/src`** (same as CI). For lint plus mobile typecheck plus backend fast tests locally, use **`npm run check:ci-parity`** (see **`docs/TESTING.md`**).

**CI backend tests:** the **Backend Fast Tests** job runs `test:fast` and **`test:erp-accounting`**. **Backend full Jest** runs **`npm test`** on all suites (same as local `cd backend && npm test`). **Backend Integration** runs tenant routing, tenant isolation, and ERP transactions in parallel. Root **`npm run test:backend`** still adds guardrails + sync before the full suite.

**Frontend tests:** **`npm run test:frontend`** (used by **`deploy:railway`**) runs **`npm test`** (jsdom Vitest) **and** **`npm run test:unit`** (Node Vitest), matching CI’s frontend job.

**Normal releases:** Push to **`main`** — Vercel and Railway deploy via Git integration; **Post-Deploy Tenant Smoke** runs after CI. See **[docs/DEPLOY.md](docs/DEPLOY.md)** for the full workflow, staging, mobile releases, and rollback.

Configure smoke **secrets** once: **[docs/SMOKE-SECRETS-CHECKLIST.md](docs/SMOKE-SECRETS-CHECKLIST.md)**.

Optional metal market feeds (`METALS_DEV_API_KEY`, etc.) and MT4 live prices: [ENV-VARS-QUICK-REFERENCE.md](ENV-VARS-QUICK-REFERENCE.md), [docs/MT4_METAL_PRICE_BRIDGE.md](docs/MT4_METAL_PRICE_BRIDGE.md).
