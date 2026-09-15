# Production Control Center — Hardening Implementation Report

**Date:** 2026-09-15  
**Scope:** Harden existing PCC in place (no rebuild, no destructive DB ops)

---

## 1. Files changed

### Backend
- `backend/services/productionControl/constants.js` — batch/pass transition maps, `OPEN_PASS_STATUSES`, `ALERT_ACKNOWLEDGED`, `PASS_REJECTED`
- `backend/services/productionControl/errors.js` — **new** shared `ProductionError`
- `backend/services/productionControl/statusTransitions.js` — **new** transition + department match helpers
- `backend/services/productionControl/batchService.js` — transitions; duplicate-issue guard; vault idempotency (existing path strengthened)
- `backend/services/productionControl/passService.js` — reservation, source dept, receive variance/HOLD, cancel rollback (kept)
- `backend/services/productionControl/processService.js` — SOP reason, impossible weights, QC reasons/lineage, `expectedVersion` alias
- `backend/services/productionControl/machineAlertService.js` — acknowledge alert
- `backend/services/productionControl/liveFloorService.js` — custody snapshot; `getMyTasks`
- `backend/routes/productionControl.js` — demo mutation guard, acknowledge route, my-tasks, variance/SOP/rework fields
- `backend/models/ProductionPass.js` — variance fields + `batchId+status` index
- `backend/models/QcInspection.js` — `reworkOf` / `previousInspectionId`
- `backend/models/ProcessRun.js` — `sopReason`
- `backend/models/ProductionAlert.js` — acknowledge fields
- `backend/migrations/007-production-hardening-indexes.js` — **new** additive `syncIndexes`
- `backend/tests/production-control-hardening.test.js` — **new** metal-integrity tests

### Frontend
- `frontend/src/components/production-control/shared.jsx` — nav regroup; permission helpers; CSV utils
- `frontend/src/components/production-control/Panels.jsx` — handover receive UX; My Tasks; SOP; custody; alerts ack
- `frontend/src/components/production-control/FloorManagerPanels.jsx` — Exceptions First; Reports KPI/table/CSV
- `frontend/src/components/production-control/DepartmentPanel.jsx` — melting detail fields
- `frontend/src/components/production-control/demo/demoApi.js` — my-tasks + acknowledge
- `frontend/src/api/productionControl.js` — new API methods
- `frontend/src/pages/ProductionControlCenter.jsx` — my-tasks section; productionRole

---

## 2. Backend changes
- Centralized **batch/pass status transitions** enforced on mutate paths
- **Vault issue:** only `CREATED`/`AWAITING_ISSUE`; rejects if already issued; honors `issueIdempotencyKey`
- **Pass reservation:** `available = currentWeight − Σ(open pass weights)`
- **fromDepartment** verified against batch custody (rejection audited outside txn)
- **Receive variance** vs issued weight; reason required over tolerance; optional auto-HOLD; issued weight preserved
- Process: SOP NO→reason; impossible output rejected; QC FAIL/REWORK require reason; rework lineage fields
- Weight adjust accepts `expectedVersion` **or** `expectedBatchVersion`
- Alert **OPEN → ACKNOWLEDGED → RESOLVED**
- Demo header `X-PCC-Demo: 1` blocks mutations
- `GET /my-tasks` operator queue

---

## 3. Frontend changes
- Nav groups: COMMAND / PRODUCTION / MATERIAL / QUALITY / FACTORY / MANAGEMENT / ADMIN (section **ids preserved**)
- Handover screen with issued/received/variance + confirm receive
- My Tasks; Floor Manager Exceptions First; Reports as KPI cards + tables + CSV (no raw JSON primary UI)
- SOP YES/NO; melting extra fields; batch custody panel; issue-from-vault (existing) retained

---

## 4. Database / schema changes
**Additive optional fields only:**
- Pass: `varianceAbs`, `variancePct`, `varianceReason`
- ProcessRun: `sopReason`
- QcInspection: `reworkOf`, `previousInspectionId`
- Alert: `acknowledgedBy*`, `acknowledgedAt`
- Batch: `QC_FAILED` already in enum; `issueIdempotencyKey` retained

**No** drops, truncates, ID rewrites, or data deletes.

---

## 5. New indexes
Migration `007-production-hardening-indexes.js` — `syncIndexes` for Pass (`batchId+status`), QC (`reworkOf`), Batch, Alert, ProcessRun. Idempotent; never drops indexes.

---

## 6. Security changes
- Backend permission matrix unchanged; FE mirrors for UX only
- Demo mutation guard on all non-GET PCC routes
- Invalid pass source department audited (`PASS_REJECTED`)
- Tenant isolation unchanged (per-tenant DB + auth context)

---

## 7. Concurrency fixes
- Vault issue + pass create/issue/receive remain transactional
- Pass weight reservation re-checked at issue
- Version alias fixed for weight adjust
- Cancel in-transit restores batch to WAITING (preserved/confirmed)

---

## 8. Production workflow changes
- Explicit transition map; invalid transitions → clear 400
- HOLD only via hold/auto-variance/QC HOLD; release via release flow

---

## 9. QC changes
- FAIL/REWORK require reason
- Optional `reworkOf` / `previousInspectionId` lineage
- Prior QC records never deleted

---

## 10. Stock / metal custody
- Batch detail returns explicit `custody` + reserved/available transferable weight
- Movements/passes/audit still source of history

---

## 11. Performance
- Soft socket refresh preserved
- Composite pass index for reservation queries
- Reports avoid dumping only JSON

---

## 12. Tests added/updated
- **New:** `production-control-hardening.test.js` (overlapping passes, source dept, receive variance, impossible weights, SOP, QC lineage, transitions, demo block, alert ack, my-tasks, expectedVersion alias)
- Existing suites retained

---

## 13. Tests passed
```
Test Suites: 3 passed
Tests:       26 passed
```
(`production-control.test.js` + `production-control-permissions.test.js` + `production-control-hardening.test.js`)

---

## 14. Remaining risks
- Alert evaluation still can run as side effect on live-floor reads (pre-existing)
- Numbering still last-doc scan under concurrency (pre-existing)
- Socket auth still uses browser session cookie pattern (pre-existing)
- Tenant isolation not dual-DB asserted in hardening file (architecture is per-tenant connection; harness is single-tenant)
- `/production` route still login-only at App level (module gate is sidebar); rely on API 403

---

## 15. Intentionally NOT implemented
- **Batch split/merge** (not in current workflow — future enhancement)
- Full PM/maintenance work-order module (status + maintenance date fields only)
- PDF/Excel export beyond CSV
- Rewriting Live Floor / demo stack
- Destructive migrations or data backfills

---

## 16. Destructive data confirmation
**No destructive database operation was performed.**  
No collections dropped, no documents mass-deleted, no ID/tenant rewrites, no seed overwrite of live production data. Migration `007` only runs additive `syncIndexes`.
