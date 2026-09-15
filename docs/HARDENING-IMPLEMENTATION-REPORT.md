# Hardening Implementation Report (§69)

**Date:** 2026-09-16  
**Scope:** Production Hardening Master Plan — Track A + Track B

## 1. Audited

Monorepo frontend / backend / mobile; auth & tenant isolation; PCC; ERP GL; Finance; CRM; HR; Training; Compliance; Operations; notifications; backups/migrations.

## 2. Fixed

- Voucher Submit no longer auto-posts (`postImmediately` removed); edit lock after submit.
- Overview quick actions navigate to real tabs; Global Search + Owner Exceptions wired.
- Finance AR/AP reads ERP outstanding APIs (not seed).
- Operations shows **DEMO MODE** banner when seed flag is on.

## 3. Gaps filled

- Stock remainder lots; batch split/merge; maintenance work orders; raise-alert UI.
- Approval/SoD helpers; Customer 360 read API; PO goods receipt; shipments API; scan resolve; hardware gateway contract.
- Training certs expiring; compliance calendar; employee master additive fields; barcode/QR fields.

## 4. New APIs

| Path | Purpose |
|------|---------|
| `GET /api/search` | Permission-aware global search |
| `GET/POST /api/approvals/*` | Verb/SoD policy helpers |
| `GET /api/customer-360` | CRM + ERP customer join |
| `GET /api/exceptions` | Owner exception center |
| `POST /api/scan/resolve` | Barcode/QR resolve |
| `GET/POST /api/hardware/*` | Edge gateway contract + ingest |
| `GET/POST/PATCH /api/shipments` | Durable transport records |
| PCC `POST /batches/:id/split`, `POST /batches/merge` | Genealogy |
| PCC `/maintenance/*` | Maintenance WOs |
| `POST /api/erp/procurement/purchase-orders/:id/receive` | Goods receipt |
| `GET /api/training/certs/expiring` | Cert expiry |
| `GET /api/compliance/calendar` | Compliance due calendar |

## 5. Migrations

Additive Mongoose fields only (no DROP). New collections via models: `ProductionMaintenanceWorkOrder`, `OpsShipment`. Run existing index sync migration on staging after backup when deploying.

## 6. Permissions

- PCC: `splitMergeBatch`, `manageMaintenance`.
- Additive verb helper `hasModuleVerb` + Finance User mapping via `isFinanceUser`.
- SoD via `assertMakerChecker` (opt-in dual-control on stock adjust with `requireDualControl`).

## 7. Audit controls

Production audits for split/merge/remainder/maintenance; shipment create/update via `auditLog`; voucher submit audit retained.

## 8–14. Module improvements

See Track A interim + checklist. Hardware: [`docs/HARDWARE-EDGE-GATEWAY.md`](HARDWARE-EDGE-GATEWAY.md).

## 15. Tests run

- `approvalPolicy.test.js`
- `hardening-track-b.test.js`
- `production-control.test.js` (remainder, split/merge, maintenance)
- `erp-accounting-transactions` submit-lock test

## 16. Remaining issues

- Overview dept KPI cards still include demo metric constants for some roles (alerts prefer live exceptions when available).
- Finance non-AR/AP screens may still use local/seed collections.
- Customer 360 UI is API-first (consume via `/api/customer-360`); dedicated tab chrome can follow.
- Hardware ingest is accept-only (no HardwareEvent collection yet).
- Stock dual-control default off (enable via `requireDualControl` / settings).

## 17. Manual deployment steps

1. Backup Atlas (all tenants).
2. Deploy backend + frontend.
3. Staging: dry-run then apply migrations with backup tokens.
4. Smoke: voucher draft→submit; PCC partial select; split; maintenance WO; `/api/search`; `/api/exceptions`.
5. Confirm demo seed flag off in production.

## 18. Data preservation

No DROP/TRUNCATE/destructive seeds against production. Existing IDs and collections preserved. Approve/post voucher fields retained. Demo mutations blocked with `X-PCC-Demo`.

**AI:** not implemented (explicit non-goal).
