# MG Floor

Factory-floor production system for **Modern Gold (MG)** only.

## Packages

| Path | Role |
|------|------|
| `mg-floor/` | Expo React Native app (phone + tablet) |
| `backend/routes/mgFloor.js` | MG-locked API facade over Production Control |
| `mobile/` | **Nexa — do not modify for MG Floor** |

Local Android APK/AAB (no EAS): [MG-FLOOR-ANDROID-LOCAL-BUILD.md](./MG-FLOOR-ANDROID-LOCAL-BUILD.md).

## Tenant security

MG Floor APIs reject any authenticated session whose JWT `company` / `req.tenant` is not `mg`.

Cross-tenant tests: `backend/tests/mg-floor-security.test.js`

## Manual entry only

MG Floor is 100% manual entry. There are no weighing scales, camera / OCR capture, XRF analyzers, device gateways or scale-based Metal IN / OUT / Transfer screens. The only flow is:

Operator types Qty / Purity / Time → **CONFIRM BATCH** → `PENDING` → Operations → **FM** tab → **Approve** or **Reject** (with reason).

The removed endpoints (`/api/mg-floor/scales*`, `/scale-camera-captures*`, `/xrf*`, `/gateways*`, `/gateway/*`, `/metal/in`, `/metal/out`, `/transfers`, `/passes/open`) answer **410** `MG_FLOOR_FEATURE_REMOVED` for every method. `POST /api/hardware/ingest` no longer accepts `weighing_scale`. Offline items of the removed types (`metal_in`, `metal_out`, `transfer`, `xrf_test`, `weight_capture`) left on an old tablet get a per-operation `FAILED / FEATURE_REMOVED` sync result; current builds drop them from the outbox on start.

Existing collections from the old flows (`scales`, `hardwareevents`, `floorweightcaptures`, XRF, gateways) are left untouched in the database.

## Floor department

Each MG user has an admin-assigned **floor department** (`User.floorDepartment`). The keys are the Operations → Production workbook departments (`backend/constants/productionDepartments.js`): vault_room, melting, rolling, bangle_area, stamping, pendent_section, welding_area, assembly, qc, finished_goods. Set it in **Admin → Users → Create / Edit → Floor department (MG Floor)** (MG tenant only).

- Keys from the first MG Floor list are mapped when read: bangle_division → bangle_area, quality_control → qc, packing → finished_goods. Retired casting / polishing count as unassigned until an admin picks a new department (and cannot be saved any more). A tablet that had a retired department selected asks for the department again.

- Operators always submit under their own floor department; the tablet shows it in the left column. No department assigned → 403 `FLOOR_DEPARTMENT_REQUIRED`; sending a different department → 403 `DEPARTMENT_MISMATCH`.
- Floor / Production Managers (`approvePass`) may submit for the department chosen on the tablet, falling back to their own.

## Floor Manager approval (Metal In / Out batches)

Approving fills the Operations → Production workbook (below); approving or rejecting posts nothing to inventory, stock, ERP, ledger, COGS, accounting or vouchers.

- **Tablet:** the logged-in operator types a batch and taps **CONFIRM BATCH N** (Metal In needs `receivePass`, Metal Out needs `createPass`). Empty rows are skipped; a row without a time gets the current time. The batch is stored as a `FloorBatchEntry` (`PENDING`) for the operator's floor department and local day.
- Status under each batch: **WAITING FOR F.M** and **APPROVED** lock the boxes; **REJECTED** shows the reason and unlocks them so the operator can fix and confirm again; **SAVED OFFLINE** means it is in the outbox (`batch_entry`, idempotent by `entryId`) and is sent on reconnect. Approval itself is never done offline.
- The tablet reloads today's entries for its department on login/restart and refreshes every 30 s.
- One live entry per day + department + In/Out + batch: a second CONFIRM while one is pending or approved returns 409 `BATCH_ENTRY_EXISTS`.
- Only `PENDING → APPROVED` or `PENDING → REJECTED`; an approved batch is immutable (409 `BATCH_ENTRY_DECIDED`).
- **Web:** Operations → **FM** tab (MG only). It is shown only when the backend reports `canDecide` (`approvePass`: floor_manager / production_manager, which includes super_admin and management). Pending / Approved / Rejected lists with counts, refreshed every 30 s; **Approve**, or **Reject** with a reason (3–500 characters) that the operator sees on the tablet. Nobody can approve or reject their own batch.
- API (`mgProtect`): `POST /api/mg-floor/batch-entries`, `GET /api/mg-floor/batch-entries` (status / direction / department / entryDate / from / to), `POST /api/mg-floor/batch-entries/:id/approve`, `POST /api/mg-floor/batch-entries/:id/reject`.
- Audit: `mg_floor_batch_entry_submitted`, `mg_floor_batch_entry_approved`, `mg_floor_batch_entry_rejected`, each with entryId, batch, direction, department, operator, status and (for decisions) decided by / at and reject reason.

## Operations → Production workbook link

Each approved batch writes one workbook row (`OperationsProductionEntry`, `source: 'mg_floor'`) per day + department + batch label (`floorBatchKey`), in `backend/services/mgFloor/workbookLink.js`:

- **Metal IN** approval: Metal IN = sum of line quantities; Fine Gold = Σ qty × purity / 100 over lines with a purity (purity above 100 is read as per-mille); Purity % = Fine Gold / Metal IN × 100 (blended, so alloy lowers it); Batch Start = earliest line time; Employee = operator.
- **Metal OUT** approval: Metal OUT = sum of quantities; Batch Over = latest line time. Metal Loss = Metal IN − Metal OUT once both are approved.
- Department Manager = whoever approved last. Line times (`HH:MM`) use the tablet's `tzOffsetMinutes` (sent by builds from this change on), otherwise `MG_FLOOR_TIMEZONE` (default `Asia/Dubai`).
- In the web workbook these rows show an **MG Floor** badge; only Rating, Breakdown and Requests can be edited and they cannot be deleted (API: 409 `MG_FLOOR_ROW_LOCKED`). Manual rows keep full editing; their Fine Gold is computed from Metal IN × Purity %.
- **Sync MG Floor batches** (Operations → Production, shown to FM approvers) calls `POST /api/mg-floor/batch-entries/sync-workbook` (`approvePass`) to add batches approved before the link, or retry a failed workbook write. It is idempotent and audited (`mg_floor_workbook_synced`); batches from retired departments are skipped and counted.
- MG's Production Dashboard still uses the live-floor production APIs; only LoopC's dashboard is built from the workbook.

## Data safety

- Additive models only: `FloorDevice`, `FloorSyncOperation`, `FloorBatchEntry`
- No database drops/resets
- Weight corrections use existing `WeightAdjustment` (original + new + reason)
