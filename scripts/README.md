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
| `check-access-policy-parity.mjs` | safe, audit-only | Verifies shared ERP access policy copies stay aligned. |
| `dev-orchestrator.js` | safe | Starts local frontend/backend with free ports and injected API base. |
| `production-smoke.js` | live-data, audit-only, tenant-specific | Checks Vercel tenant login pages, Railway health, and auth routing. |
| `smoke-tenants.js` | live-data, audit-only, tenant-specific | Legacy tenant smoke check used by GitHub Actions. |
| `sync-erp-access-policy.js` | safe | Generates backend/frontend access-policy JSON from `shared/erp-access-matrix.json`. |
