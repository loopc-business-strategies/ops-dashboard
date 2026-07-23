# Critical fixes checklist

Ordered production-safety and maintainability work.

**Last reviewed:** 2026-07-23 · **HEAD:** see `git log -1`

---

## P0 — Production safety

| # | Item | Status |
|---|------|--------|
| 1 | **Live metal fan-out all tenants** | **Done** — code, HTTP test, prod `verify:live-metal-movement:all` 3/3 |
| 2 | **Redis multi-instance** | **Done** — live prod+staging `/api/ready` (commit `9adcb10`): `redisConfigured`, `redisReady`, **`redisRequired`**, **`socketIoRedisAdapter`** all true; Railway `REQUIRE_REDIS=true` + `REDIS_URL`. |
| 3 | **Mongo backup verification** | **Blocked for strict (2026-07-23)** — `ATLAS_BACKUP_PHASE` remains `deferred` (correct; do not flip). Deferred connectivity drill **green** today (mg/cg/loopc Mongo OK). **Missing everywhere** (GitHub secrets, Railway vars, local `.env`): `ATLAS_PUBLIC_KEY`, `ATLAS_PRIVATE_KEY`, `ATLAS_GROUP_ID_MG`, `ATLAS_GROUP_ID_CG`, `ATLAS_GROUP_ID_LOOPC`. **Operator next:** (1) Atlas Org → Access Manager → create API key; (2) each project MG/CG/LoopC → Settings → copy Project ID; (3) each cluster → Backup → enable M10+ Cloud Backup, retention ≥7d; (4) paste five values to agent or `gh secret set` each; (5) `ATLAS_BACKUP_PHASE=strict npm run check:atlas-strict-readiness` + `npm run drill:atlas-backup-plan -- --strict-backup`; (6) only if green: `gh variable set ATLAS_BACKUP_PHASE --body strict`. Interim: `MONGO_BACKUP_ENABLED=true` weekly mongodump. |

---

## P1 — Data integrity & ERP boundaries

| # | Item | Status |
|---|------|--------|
| 4 | **ERP API discipline** | **Ongoing** — PR checklist + `check:erp-legacy-imports` in CI |
| 5 | **Dual ERP deprecation** | **Done** — plan + [ERP-DUAL-API-AUDIT.md](./ERP-DUAL-API-AUDIT.md) Phase 1 |
| 6 | **Destructive script audit** | **Done** — 81 guarded scripts (destructive + root live + ops-misc cleanup + void API) |

---

## P2 — Maintainability

| # | Item | Status |
|---|------|--------|
| 7 | **ERPTab.jsx headroom** | **On track** — ~4,282 lines; `DEFAULT_METAL_RATES` extracted |
| 8 | **erp-accountingContext.js** | **Done** — ~665 lines; routes in `erp-accounting/*` |
| 9 | **E2E money paths** | **Partial** — JV E2E stubbed; staging live auth E2E in `staging-e2e.yml` (needs secrets) |
| 10 | **VoucherTab guardrail** | **Done** — `voucherTabConstants.js` extraction; CI budget 3,500 lines |

---

## P3 — Observability & parity

| # | Item | Status |
|---|------|--------|
| 11 | **Sentry production** | **Done** — Railway + Vercel `VITE_SENTRY_DSN`; bundle includes `ingest.sentry.io` |
| 12 | **Margin widget parity** | **Done** — web + mobile tests |
| 13 | **Mobile ERP scope** | **Done** — [MOBILE-ERP-SCOPE.md](./MOBILE-ERP-SCOPE.md) |
| 14 | **Dependabot majors** | **Done (process)** — [DEPENDABOT-MAJOR-REVIEW.md](./DEPENDABOT-MAJOR-REVIEW.md) quarterly |

---

## Verify commands

```bash
npm run verify:critical-health
npm run verify:live-metal-movement:all
npm run verify:data-safety
npm run verify:upload-storage
npm run verify:mongo-backup-drill
npm run smoke:tenants
```

---

## Related docs

- [DEPLOY.md](./DEPLOY.md)
- [ERP-DUAL-API-AUDIT.md](./ERP-DUAL-API-AUDIT.md)
- [MOBILE-ERP-SCOPE.md](./MOBILE-ERP-SCOPE.md)
- [MONGODB-BACKUPS-AND-DATA-SAFETY.md](./MONGODB-BACKUPS-AND-DATA-SAFETY.md)
