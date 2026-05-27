# Workspace Scripts Registry

This directory contains repo-level automation. Backend data repair and tenant maintenance scripts live in `backend/scripts/README.md`.

## Safety Classes

- `safe`: local orchestration or read-only checks.
- `audit-only`: gathers status and exits without changing data.
- `live-data`: calls production-like URLs or tenant APIs, but is intended to avoid writes.
- `destructive`: can mutate, delete, reset, or repair data.
- `tenant-specific`: behavior depends on tenant host/header/env configuration.
- `obsolete`: kept for history; avoid new use.

## Index

| Script | Classification | Notes |
|---|---|---|
| `check-forbidden-tracked-paths.mjs` | safe, audit-only | Fails if generated, uploaded, report, log, or env files are tracked by git. Requires git on PATH (fail-closed). |
| `run-production-dependency-audit.mjs` | safe, audit-only | Runs `npm audit --omit=dev --audit-level=high` for root, backend, and frontend. Use `--advisory` for full non-blocking report. |
| `setup-smoke-github-secrets.js` | requires backend/.env + gh auth | Creates `ops-smoke-probe` users in mg/cg/loopc and stores GitHub smoke secrets. `--secrets-only` / `--users-only` / `--skip-production-verify` / `--verify-only`. |
| `upload-mongo-secrets-to-github.js` | requires backend/.env + gh auth | Uploads `MONGO_URI_*` from backend/.env to GitHub secrets for the provisioning workflow. |
| `check-frontend-bundle-budget.mjs` | safe, audit-only | Checks built frontend JS/CSS chunk sizes after `frontend/dist` exists. |
| `check-access-policy-parity.mjs` | safe, audit-only | Verifies shared ERP access policy copies stay aligned. |
| `dev-orchestrator.js` | safe | Starts local frontend/backend with free ports and injected API base. |
| `production-smoke.js` | live-data, audit-only, tenant-specific | Checks Vercel tenant login pages, Railway readiness, auth routing, and authenticated ERP read (`SMOKE_REQUIRE_AUTH` defaults true). |
| `smoke-tenants.js` | live-data, audit-only, tenant-specific | Legacy tenant smoke check used by GitHub Actions. |
| `sync-erp-access-policy.js` | safe | Generates backend/frontend access-policy JSON from `shared/erp-access-matrix.json`. |
