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

Each MG user has an admin-assigned **floor department** (`User.floorDepartment`: melting, casting, rolling, bangle_division, stamping, polishing, quality_control, packing). Set it in **Admin → Users → Create / Edit → Floor department (MG Floor)** (MG tenant only).

- Operators always submit under their own floor department; the tablet shows it in the left column. No department assigned → 403 `FLOOR_DEPARTMENT_REQUIRED`; sending a different department → 403 `DEPARTMENT_MISMATCH`.
- Floor / Production Managers (`approvePass`) may submit for the department chosen on the tablet, falling back to their own.

## Floor Manager approval (Metal In / Out batches)

Record only: approving or rejecting posts nothing to inventory, stock, ERP, ledger, COGS, accounting or vouchers.

- **Tablet:** the logged-in operator types a batch and taps **CONFIRM BATCH N** (Metal In needs `receivePass`, Metal Out needs `createPass`). Empty rows are skipped; a row without a time gets the current time. The batch is stored as a `FloorBatchEntry` (`PENDING`) for the operator's floor department and local day.
- Status under each batch: **WAITING FOR F.M** and **APPROVED** lock the boxes; **REJECTED** shows the reason and unlocks them so the operator can fix and confirm again; **SAVED OFFLINE** means it is in the outbox (`batch_entry`, idempotent by `entryId`) and is sent on reconnect. Approval itself is never done offline.
- The tablet reloads today's entries for its department on login/restart and refreshes every 30 s.
- One live entry per day + department + In/Out + batch: a second CONFIRM while one is pending or approved returns 409 `BATCH_ENTRY_EXISTS`.
- Only `PENDING → APPROVED` or `PENDING → REJECTED`; an approved batch is immutable (409 `BATCH_ENTRY_DECIDED`).
- **Web:** Operations → **FM** tab (MG only). It is shown only when the backend reports `canDecide` (`approvePass`: floor_manager / production_manager, which includes super_admin and management). Pending / Approved / Rejected lists with counts, refreshed every 30 s; **Approve**, or **Reject** with a reason (3–500 characters) that the operator sees on the tablet. Nobody can approve or reject their own batch.
- API (`mgProtect`): `POST /api/mg-floor/batch-entries`, `GET /api/mg-floor/batch-entries` (status / direction / department / entryDate / from / to), `POST /api/mg-floor/batch-entries/:id/approve`, `POST /api/mg-floor/batch-entries/:id/reject`.
- Audit: `mg_floor_batch_entry_submitted`, `mg_floor_batch_entry_approved`, `mg_floor_batch_entry_rejected`, each with entryId, batch, direction, department, operator, status and (for decisions) decided by / at and reject reason.

## Data safety

- Additive models only: `FloorDevice`, `FloorSyncOperation`, `FloorBatchEntry`
- No database drops/resets
- Weight corrections use existing `WeightAdjustment` (original + new + reason)
