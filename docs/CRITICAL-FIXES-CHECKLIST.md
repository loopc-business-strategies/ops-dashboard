# Critical fixes checklist

Ordered production-safety and maintainability work.

**Last reviewed:** 2026-09-04 · **HEAD:** see `git log -1`

---

## P0 — Production safety

| # | Item | Status |
|---|------|--------|
| 1 | **Live metal fan-out all tenants** | **Done** — code, HTTP test, prod `verify:live-metal-movement:all` 3/3 |
| 2 | **Redis multi-instance** | **Done** — Railway `REQUIRE_REDIS=true` + `REDIS_URL`; `/api/ready` fail-closed. **Verified 2026-09-04:** prod `/api/ready` reports `redisRequired` + `redisReady` + Socket.IO Redis adapter. **Post-deploy smoke** asserts the same (`SMOKE_REQUIRE_REDIS`, default on). |
| 3 | **Mongo backup verification** | **Interim path chosen (2026-09-16)** — stay on `ATLAS_BACKUP_PHASE=deferred` until Atlas API keys + M10+ Cloud Backup exist; **enable durable weekly mongodump** via `MONGO_BACKUP_ENABLED=true` and configure S3/R2 (`MONGO_BACKUP_S3_CONFIGURED`) so dumps are not only 7-day GH artifacts. **Do not** flip `ATLAS_BACKUP_PHASE=strict` without: `ATLAS_PUBLIC_KEY`, `ATLAS_PRIVATE_KEY`, `ATLAS_GROUP_ID_MG/CG/LOOPC` (+ VB if separate), then `npm run check:atlas-strict-readiness` + drill. Quarterly restore checklist still ops-owned: [MONGODB-BACKUPS-AND-DATA-SAFETY.md](./MONGODB-BACKUPS-AND-DATA-SAFETY.md). |

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
| 7 | **ERPTab.jsx headroom** | **Done** — thin shell (~48 lines); CI budget **120** |
| 8 | **erp-accountingContext.js** | **Done** — ~665 lines; routes in `erp-accounting/*` |
| 9 | **E2E money paths** | **Done** — CI stub JV (`journal-voucher.spec.js`); staging live auth + read-only transactions (`staging-auth` + `staging-jv`); workflow passes `PLAYWRIGHT_VERCEL_BYPASS` |
| 10 | **VoucherTab guardrail** | **Done** — open/edit + toolbar nav + save hooks extracted (plus prior line hooks); shell ~1440 lines; CI budget **2200 → 1600** |
| 10b | **OperationsTab guardrail** | **Done** — `ModalProject` → `operations/OpsProjectModal.jsx`; shell ~1715 lines; CI budget **2800 → 2000** |

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
