# Performance report — Account Summary / ERP speed (2026-09-15)

## 1. Main bottlenecks found

- Account enquiry loaded up to **500** statement rows before showing summary (`ACCOUNT_ENQUIRY_STATEMENT_LIMIT`).
- Enquiry blocked on `Ledger.countDocuments` before returning rows.
- Statement path used `.populate()` for debit/credit CoA on every row.
- Frontend had no AbortController on enquiry/date-range changes.
- Summary account catalog requested `limit: 5000` (backend capped at 500).
- `socket.io-client` was a static import on the authenticated dashboard path.
- ERP dashboard tab + enquiry modals were eager in the ERP chunk.
- Overview keep-alive continued 120s polling while hidden.
- Enquiry/summary caches were process-local only (reports already used Redis).

## 2. Files changed (high level)

**Backend:** `accountsRoutes.js`, `Transaction.js` (index), `reportRoutes.js` (lean), `serverTiming.js`, `erpReadCaches` usage via `getShared`/`setShared`.

**Frontend:** enquiry controller/modal/API/cache, `realtimeSocket.js`, `ERPTab.jsx`, `ERPTabPanels.jsx`, `Dashboard.jsx`, `OverviewTab.jsx`, `useErpAccounts.js`, `useErpDashWidgetData.js`, perf helpers/tests.

## 3. API / database optimizations

- `includeStatement=0` summary-first enquiry path (balances/metals/positions without statement hydrate).
- Default statement page size **40**; cursor `beforeDate`/`beforeId` + `runningBalanceSeed` for load-more.
- `countDocuments` only when `includeCount=1` (default deferred / pending).
- Batch CoA map instead of ledger populate.
- Additive index: `{ voucherMeta.partyAccountId, isDeleted, status, type }` on Transaction.
- `/accounts?q=` server search (scoped, limited).
- `/reports/ledger` uses `.lean()` + `.select()`.
- Enquiry + summary account caches use Redis-backed `getShared`/`setShared` (same family as reports).
- `Server-Timing` / `X-Enquiry-Row-Count` / `X-Enquiry-Cache` on enquiry.

## 4. Frontend optimizations

- Two-phase enquiry load (summary → statement page).
- Load-more statement button; virtualized table retained.
- AbortController on enquiry account/date changes.
- Cache keys include phase + limit.
- Dynamic `socket.io-client` import.
- Lazy `ERPDashboardTab`, `ERPTabModals`, `ErpEditRecordModal`.
- Pause Overview intervals when keep-alive tab is hidden.
- Summary accounts fetch limit 500 (matches backend).
- Dashboard report soft cache TTL 90s.
- Optional `localStorage.ops.debugEnquiryPerf=1` marks for DevTools.

## 5. Caching improvements

- Client sessionStorage enquiry cache keyed by tenant/code/dates/limit/phase.
- Server enquiry/summary caches shared across replicas when Redis is configured; local Map fallback remains.
- **No** Redis materialization of accounting balances.

## 6. Bundle / loading improvements

- Socket.io deferred off sync critical path.
- ERP dashboard/modals code-split.
- Export libs were already dynamic (unchanged).

## 7. Before vs after (measurement method)

Instrumenting only (no production timing dump of tenant data):

| Path | Before (design) | After (expected) |
|------|-----------------|------------------|
| Account Summary first paint | Wait for ≤500-row enquiry | Summary returns without statement rows |
| Statement initial | 500 rows | 40 rows + load-more |
| Enquiry count | Always `countDocuments` | Deferred unless `includeCount=1` |
| Rapid date changes | Stacked full refetches | Aborted stale requests |

Enable `ops.debugEnquiryPerf` and Chrome Network **Server-Timing** on `/accounts/enquiry` for local before/after numbers.

## 8. Data safety confirmation

- No collections truncated, no documents deleted/modified by migration scripts in this change set.
- Additive Transaction index only (via schema; sync through existing migration `004` when run).
- Accounting formulas (opening, net, signed amounts, RB walk) unchanged; pagination continues the same walk with seed.
- Permissions, auth, exports, realtime behavior preserved (socket connect is async, same events).

## 9. Intentionally NOT implemented

- Precomputed/materialized Account Summary balances on post.
- Brotli compression (gzip already on).
- Raising Mongo pool size.
- Unloading ERP keep-alive after idle (state-loss risk).
- Collapsing metal-rate transports to a single channel (failover risk).

## 10. Remaining infra bottlenecks

- Atlas tier / index build time for new Transaction index in production.
- Multi-replica cache stampede without Redis (local caches diverge until TTL).
- Very large AR/AP rollup accounts (1100/2000) still expand related ledgers for balance aggregates.
- Full export paths may still request higher `statementLimit` (capped 500).
