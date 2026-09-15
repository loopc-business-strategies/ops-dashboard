# Ops Dashboard — Hardening Gap Checklist

Living checklist from the Production Hardening Master Plan audit.
Update status as phases complete. **Additive migrations only. No AI. Preserve existing data.**

## Safety gates verified (Phase 1)

| Control | Location | Status |
|---------|----------|--------|
| Backup required for migrate apply | `backend/utils/migrationSafety.js` (`MIGRATION_I_HAVE_BACKUP`) | Verified |
| Confirm token required | `MIGRATION_CONFIRM_TOKEN` | Verified |
| Production-like URI refused | `assertMigrationApplyAllowed` + known Atlas denylist | Verified |
| Staging-only script assert | `assertStagingOnlyScript` via migration apply | Verified |
| Destructive script guards | `backend/scripts/destructive/_destructive-guard.js` + CI `check:destructive-guards` | Verified |
| Backup docs / drills | `docs/MONGODB-BACKUPS-AND-DATA-SAFETY.md`, GH workflows `mongo-backup-*` | Verified |
| Dry-run default | `backend/migrations/README.md` | Verified |

**Manual ops before any staging apply:** Atlas backup → set `MIGRATION_I_HAVE_BACKUP=true` + `MIGRATION_CONFIRM_TOKEN` → `npm run migrate:staging:apply -- --confirm=<token>`. Never apply migrations against production URIs (blocked in code).

---

## Track A

| Feature | Current | Gap | Proposed | Files / APIs / Models | Mig | Perm | Audit | Test | Status |
|---------|---------|-----|----------|----------------------|-----|------|-------|------|--------|
| Hardening checklist | Missing | Doc | This file | `docs/HARDENING-GAP-CHECKLIST.md` | N | N | N | N | Done |
| Voucher Submit | Auto-posts (`postImmediately`) | Submit should stay `submitted` | Remove FE flag; lock PUT after submit | `VoucherTab.jsx`, `transactionRoutes.js`, `transactionWorkflowService.js` | N | Y | Y | Y | Done |
| Stock remainder lots | Partial select binds whole lot | Remainder genealogy | Split remainder lot on select | `stockService.js`, `ProductionStockLot` | Additive | PCC | Y | Y | Done |
| Batch split/merge | Missing | Genealogy ops | Split/merge APIs + UI | `batchService.js`, `ProductionBatch` | Additive | PCC mgr | Y | Y | Done |
| Maintenance WO | Date fields only | PM/breakdown WOs | `ProductionMaintenanceWorkOrder` | PCC models/routes/OpsPanels | Additive | PCC | Y | Y | Done |

## Track B

| Feature | Current | Gap | Proposed | Status |
|---------|---------|-----|----------|--------|
| Verb ACL + approval/SoD | Domain matrices only | Reusable policy | Additive verbs + `approvalPolicy` service | Done |
| Finance AR/AP → ERP | Seed/local | Dual books confusion | Wire outstanding APIs | Done |
| Procurement P2P | Partial | Receiving/QC handoff | PO `/receive` without dup stock | Done |
| Customer 360 | Missing | CRM≠ERP | Read join view + link field | Done |
| HR / Training / Compliance | Partial | Expiry/calendar/floor link | Additive + notifications endpoints | Done |
| Ops / Transport | Seed-heavy | Durable or DEMO label | `OpsShipment` + DEMO badge | Done |
| Overview / Search / Exceptions | Toast/static | Real APIs | Command center + search + exceptions | Done |
| Barcode / hardware gateway | Stubs / MT4 only | Interfaces | Scan resolve + edge contract | Done |
| Final harden + §69 report | — | — | Tests + report | Done |

## Explicit non-goals

- AI features
- Replacing PCC or ERP GL
- DROP/TRUNCATE/destructive production resets
- Physical hardware purchase/integration
