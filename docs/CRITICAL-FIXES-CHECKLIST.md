# Critical fixes checklist

Ordered production-safety and maintainability work. Update status as items complete.

**Last reviewed:** 2026-06-24 · **HEAD:** see `git log -1`

---

## P0 — Production safety (do first)

| # | Item | Owner | Done when | Status |
|---|------|-------|-----------|--------|
| 1 | **Live metal fan-out on all tenants** | Ops + backend | Railway on `37f2ed5+`; logs show `fanout: ['cg','loopc','mg']`; `npm run verify:live-metal-movement:all` passes; mg/cg/loopc top bars show ▲/▼ movement | Code + HTTP integration test — verify prod |
| 2 | **Redis for multi-instance API** | Ops | `REDIS_URL` set on Railway prod (and staging if >1 replica); `/api/ready` `warnings` empty when set; see [DEPLOY.md](./DEPLOY.md#production-redis-redis_url) | Startup/readiness warnings shipped — set on Railway |
| 3 | **Mongo backup verification** | Ops | Atlas backups enabled; `npm run verify:backup-checklist`; restore drill in [MONGODB-BACKUPS-AND-DATA-SAFETY.md](./MONGODB-BACKUPS-AND-DATA-SAFETY.md) | Runbook script added — periodic drill |

### Verify commands (P0)

```bash
# After deploy — requires smoke credentials in backend/.env or env
npm run verify:live-metal-movement:all

# Local guardrails (no credentials)
npm run verify:critical-health

# Quarterly backup drill reminder
npm run verify:backup-checklist
```

---

## P1 — Data integrity & ERP boundaries

| # | Item | Owner | Done when | Status |
|---|------|-------|-----------|--------|
| 4 | **ERP API discipline** | All devs | Every ERP PR answers [ERP-API-PR-CHECKLIST.md](./ERP-API-PR-CHECKLIST.md); financial work only on `/api/erp-accounting` | Ongoing |
| 5 | **Dual ERP deprecation plan** | Tech lead | [ERP-DUAL-API-DEPRECATION.md](./ERP-DUAL-API-DEPRECATION.md); no new financial features on `/api/erp` | Documented |
| 6 | **Destructive script audit** | Ops | All `backend/scripts/destructive/*.js` use `_destructive-guard.js`; [destructive/README.md](../backend/scripts/destructive/README.md) | Guards pass in CI |

---

## P2 — Maintainability before large ERP features

| # | Item | Owner | Done when | Status |
|---|------|-------|-----------|--------|
| 7 | **ERPTab.jsx headroom** | Frontend | File stays **under 6,000 lines** before major ERP features; `DEFAULT_METAL_RATES` in `erpTabConstants.js`; see [ERP-REFACTOR-BACKLOG.md](./ERP-REFACTOR-BACKLOG.md) | ~4,280 lines; incremental extraction |
| 8 | **erp-accountingContext.js** | Backend | New routes only in `backend/routes/erp-accounting/*`; context stays under 2,400 lines | ~665 lines today |
| 9 | **E2E money paths** | QA / dev | JV save E2E green in CI; staging auth E2E green when secrets set | JV E2E exists |

---

## P3 — Observability & parity

| # | Item | Owner | Done when | Status |
|---|------|-------|-----------|--------|
| 10 | **Sentry in production** | Ops | `SENTRY_DSN` on Railway + Vercel; `/api/ready` reports `sentryConfigured`; release = git SHA | Readiness check shipped — set DSN |
| 11 | **Margin widget parity** | Frontend + mobile | Dashboard widgets use `suppressMetalSpotMtm` from API rows; tests cover supplier + liability customer (web + mobile) | Done |
| 12 | **Dependabot majors** | Dev | Quarterly review Express / Mongoose / Expo SDK | Scheduled |

---

## Recently completed

| Commit | Fix |
|--------|-----|
| `37f2ed5` | MT4 bridge fan-out → mg, cg, loopc |
| `d83a6f1` | Admin Settings `useLanguage` crash |
| `de0da4e` | Web idle session logout |
| `bebf054` / `0641e43` | Mobile + web Account Summary live MTM |
| `d8cb569` | docs/archive banners |

---

## Related docs

- [DEPLOY.md](./DEPLOY.md) — deploy, Redis, rollback
- [ERP-API-GUIDE.md](./ERP-API-GUIDE.md) — which API to use
- [ERP-DUAL-API-DEPRECATION.md](./ERP-DUAL-API-DEPRECATION.md) — legacy `/api/erp` plan
- [ERP-REFACTOR-BACKLOG.md](./ERP-REFACTOR-BACKLOG.md) — line budgets
- [MT4_METAL_PRICE_BRIDGE.md](./MT4_METAL_PRICE_BRIDGE.md) — live prices ops
- [INCIDENT-RUNBOOK.md](./INCIDENT-RUNBOOK.md) — outage triage
