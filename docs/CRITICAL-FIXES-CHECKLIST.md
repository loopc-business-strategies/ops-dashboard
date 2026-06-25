# Critical fixes checklist

Ordered production-safety and maintainability work.

**Last reviewed:** 2026-06-25 · **HEAD:** see `git log -1`

---

## P0 — Production safety

| # | Item | Status |
|---|------|--------|
| 1 | **Live metal fan-out all tenants** | **Done** — code, HTTP test, prod `verify:live-metal-movement:all` 3/3 |
| 2 | **Redis multi-instance** | **Done** — prod `redisConfigured: true`, readiness warnings shipped |
| 3 | **Mongo backup verification** | **Done (code)** — `npm run verify:backup-checklist`; record drills with `--record` |

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
| 11 | **Sentry production** | **Railway done** — set `VITE_SENTRY_DSN` on Vercel per [ENV-VARS-QUICK-REFERENCE.md](../ENV-VARS-QUICK-REFERENCE.md) |
| 12 | **Margin widget parity** | **Done** — web + mobile tests |
| 13 | **Mobile ERP scope** | **Done** — [MOBILE-ERP-SCOPE.md](./MOBILE-ERP-SCOPE.md) |
| 14 | **Dependabot majors** | **Done (process)** — [DEPENDABOT-MAJOR-REVIEW.md](./DEPENDABOT-MAJOR-REVIEW.md) quarterly |

---

## Verify commands

```bash
npm run verify:critical-health
npm run verify:live-metal-movement:all
npm run verify:backup-checklist
npm run smoke:tenants
```

---

## Related docs

- [DEPLOY.md](./DEPLOY.md)
- [ERP-DUAL-API-AUDIT.md](./ERP-DUAL-API-AUDIT.md)
- [MOBILE-ERP-SCOPE.md](./MOBILE-ERP-SCOPE.md)
- [MONGODB-BACKUPS-AND-DATA-SAFETY.md](./MONGODB-BACKUPS-AND-DATA-SAFETY.md)
