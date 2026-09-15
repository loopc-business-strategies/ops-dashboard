# Track A Interim Report — Production Hardening

**Date:** 2026-09-16  
**Scope:** Phases 1 → 5 → 3 (safety, voucher Submit-only, PCC gap-fill)

## Completed

1. **Phase 1** — [`docs/HARDENING-GAP-CHECKLIST.md`](HARDENING-GAP-CHECKLIST.md); verified migration backup tokens, production URI denylist, destructive script guards.
2. **Phase 5** — Voucher UI no longer sends `postImmediately`. Submit leaves status `submitted` with audit/notify. PUT locked after submit/approve for non–Super Admin (`VOUCHER_SUBMITTED_LOCKED`). Approve/post APIs preserved.
3. **Phase 3A** — Partial stock select creates remainder lot (`parentLotId` / `childLotIds`) inside the same transaction.
4. **Phase 3B** — Batch split/merge APIs + UI split form; statuses `SPLIT`/`MERGED`; genealogy fields additive.
5. **Phase 3C** — `ProductionMaintenanceWorkOrder` CRUD + complete + overdue evaluation; Maintenance panel rewritten; raise-alert UI on Alerts panel.

## Tests run (Track A)

- `production-control.test.js` — partial stock, split/merge, maintenance
- `erp-accounting-transactions.test.js` — submit without postImmediately + edit lock

## Data safety

- No DROP/TRUNCATE; additive schema fields only; demo mutations still blocked via `X-PCC-Demo`.

## Next

Track B phases 2, 4, 6–12 per master plan.
