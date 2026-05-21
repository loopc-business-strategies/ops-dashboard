# Backend Scripts Registry

This directory contains operational scripts for tenant audits, ERP/accounting maintenance, smoke checks, and live-data repair. Treat every script as production-adjacent unless you have pointed it at an explicit test database.

## Safety Rules

- Prefer read-only scripts first: `audit-*`, `check-*`, `inspect-*`, `verify-*`, `trace-*`, `export-*`, `list-*`, and `search-*`.
- For anything marked `dry-run/apply or writes data`, inspect the script for flags such as `--apply`, `DRY_RUN`, or `APPLY` before running.
- For anything marked `writes data`, assume it can mutate or delete tenant data immediately.
- Never run cleanup/reset/remove/purge scripts against live tenant URIs without a backup and a written target tenant.
- Capture terminal output for any data-changing run and paste the summary into the related maintenance note.

## Registry

Destructive or live-mutating scripts matching `cleanup-*`, `clear-*`, `delete-*`, `find-and-remove-*`, `hard-delete-*`, `purge-*`, `remove-*`, `reset-*`, plus other known data repair/reset scripts, are quarantined under `destructive/`. Each one loads
`destructive/_destructive-guard.js` before its legacy logic runs. The guard
requires:

- `--tenant=mg`, `--tenant=cg`, `--tenant=loopc`, or `--tenant=all`
- `--apply`
- `--reason="approved maintenance reason"` with enough detail to audit later
- `--confirm=<token>` matching `CLEANUP_CONFIRM_TOKEN` or `DESTRUCTIVE_ADMIN_CONFIRM_TOKEN`
- `ALLOW_PRODUCTION_DESTRUCTIVE_SCRIPT=true` when `NODE_ENV`, Railway, Vercel,
  or `--production` indicates production

The guard only blocks accidental execution. It does not make legacy scripts
safe or transactional; inspect each script and take a backup before applying.

## Safe Command Patterns

Use these as the default maintenance flow:

1. Run read-only audits first:
   `node scripts/audit-mg-accounting-integrity.js`
2. Run API smoke checks before and after maintenance:
   `node scripts/smoke-tenants.js`
3. Run quarantined destructive scripts only with an explicit tenant, reason, and confirmation token:
   `CLEANUP_CONFIRM_TOKEN=... node scripts/destructive/example.js --tenant=mg --apply --reason="ticket OPS-123 approved cleanup" --confirm=...`
4. For production, also require the production override after a backup:
   `ALLOW_PRODUCTION_DESTRUCTIVE_SCRIPT=true NODE_ENV=production CLEANUP_CONFIRM_TOKEN=... node scripts/destructive/example.js --tenant=mg --apply --reason="ticket OPS-123 approved cleanup after backup" --confirm=...`

### `void-metal-voucher-by-voc-no.js`

Voids a single **purchase** or **sale** metal voucher by `voucherMeta.vocNo` (same effect as the app’s Void: soft-delete ledgers, reverse linked stock movements, soft-delete the transaction). Default is dry-run.

```bash
node scripts/void-metal-voucher-by-voc-no.js --tenant=mg --voc-no=Pur/2026/0001
node scripts/void-metal-voucher-by-voc-no.js --tenant=mg --apply --voc-no=Pur/2026/0001 \
  --reason="Void duplicate purchase per OPS-123" --confirm="$DESTRUCTIVE_ADMIN_CONFIRM_TOKEN"
```

Requires `DESTRUCTIVE_ADMIN_CONFIRM_TOKEN` or `CLEANUP_CONFIRM_TOKEN` in the environment for `--apply`. If more than one transaction matches the voc-no, the script exits without changes.

Do not add new live-data repair scripts to the root of this folder. Put mutating scripts under `destructive/` and require `./_destructive-guard` as the first executable line after imports.

The table below predates the workspace registry and uses a few descriptive labels. Read them as:

- `read-only` = `safe`, `audit-only`
- `writes data` = `destructive`, usually `tenant-specific`
- `dry-run/apply or writes data` = `destructive` when apply mode is enabled; otherwise `audit-only`
- `exercises API / may write test data` = `live-data`, `tenant-specific`
- `review before running` = not yet classified; treat as `live-data`, `tenant-specific` until inspected

| Script | Safety class | Notes |
|---|---|---|
| `destructive/add-user-nan-all-tenants.js` | writes data | See script source before use. |
| `analyze-all-tenants.js` | read-only | See script source before use. |
| `analyze-pay0003-live.js` | read-only | See script source before use. |
| `audit-cg-accounting-integrity.js` | read-only | See script source before use. |
| `audit-loopc-accounting-integrity.js` | read-only | See script source before use. |
| `audit-mg-accounting-integrity.js` | read-only | See script source before use. |
| `audit-mg-exchange-cleanup.js` | read-only | Counts active/deleted MG exchange entries. Does not modify data. |
| `audit-mg-voucher-ledger-details-live-api.js` | read-only | See script source before use. |
| `audit-ooo-remnants.js` | read-only | See script source before use. |
| `backfill-fx-journals-all-tenants.js` | dry-run/apply or writes data | See script source before use. |
| `backfill-fx-journals-missing.js` | dry-run/apply or writes data | See script source before use. |
| `backfill-ledger-exchange-rates.js` | dry-run/apply or writes data | See script source before use. |
| `backfill-jv-ledger-base-to-fc.js` | dry-run/apply or writes data | Uses `services/jvLedgerFxBackfill.js` (same as `POST …/ledger/repair-jv-fx/*`). COA + narration inference. See `docs/erp-backfill-jv-ledger-fx.md`. |
| `backfill-mapping-departments.js` | dry-run/apply or writes data | See script source before use. |
| `backfill-missing-metal-ledger.js` | dry-run/apply or writes data | See script source before use. |
| `backfill-transaction-type-all-tenants.js` | dry-run/apply or writes data | See script source before use. |
| `destructive/bootstrap-mappings-all-tenants.js` | dry-run/apply or writes data | See script source before use. |
| `bootstrap-statutory-accounts-all-tenants.js` | dry-run/apply or writes data | See script source before use. |
| `check-all-collections.js` | read-only | See script source before use. |
| `check-api-accounts.js` | read-only | See script source before use. |
| `check-cg-collections.js` | read-only | See script source before use. |
| `check-cg-remnants.js` | read-only | See script source before use. |
| `check-cg-state.js` | read-only | See script source before use. |
| `check-existence.js` | read-only | See script source before use. |
| `check-fixing-types.js` | read-only | See script source before use. |
| `check-joshua-ledgers.js` | read-only | See script source before use. |
| `check-loopc-remnants.js` | read-only | See script source before use. |
| `check-mg-after-copy.js` | read-only | See script source before use. |
| `check-mg-copy.js` | read-only | See script source before use. |
| `check-mg-remnants.js` | read-only | See script source before use. |
| `check-mg-restore-targets.js` | read-only | See script source before use. |
| `check-pw.js` | read-only | See script source before use. |
| `check-voucher-5-fixed.js` | read-only | See script source before use. |
| `check-voucher-5.js` | read-only | See script source before use. |
| `destructive/cleanup-cg-test-overrides.js` | writes data | See script source before use. |
| `destructive/cleanup-cash-1000-direct.js` | writes data | Legacy direct MG cleanup script quarantined. Requires destructive guard before it can soft-delete ledger rows. |
| `destructive/cleanup-loopc-orphan-test-parties.js` | writes data | See script source before use. |
| `destructive/cleanup-mg-orphan-test-parties.js` | writes data | See script source before use. |
| `destructive/cleanup-mg-test-overrides.js` | writes data | See script source before use. |
| `destructive/clear-mg-journal-vouchers.js` | writes data | See script source before use. |
| `destructive/clear-mg-legacy-vouchers-live-api.js` | writes data | See script source before use. |
| `destructive/clear-mg-legacy-vouchers.js` | writes data | See script source before use. |
| `comprehensive-ooo-mark-search.js` | review before running | See script source before use. |
| `compute-nets-v2.js` | read-only | See script source before use. |
| `compute-nets-v3.js` | read-only | See script source before use. |
| `compute-nets-v4.js` | read-only | See script source before use. |
| `compute-nets.js` | read-only | See script source before use. |
| `copy-chart-of-accounts.js` | writes data | See script source before use. |
| `copy-ops-to-cg.js` | writes data | See script source before use. |
| `copy-ops-to-mg.js` | writes data | See script source before use. |
| `debug-nets.js` | read-only | See script source before use. |
| `deep-analysis.js` | read-only | See script source before use. |
| `deep-search-joshua.js` | read-only | See script source before use. |
| `destructive/delete-via-live-api.js` | writes data | See script source before use. |
| `destructive/danger-reset-mg-transactions.js` | writes data | Dry-run by default. Requires `MONGO_URI_MG`, `ALLOW_MG_DESTRUCTIVE_RESET=true`, `--apply`, and a confirmation token before deleting MG transactions/ledgers. Does not touch users or chart of accounts. |
| `destructive/danger-reset-mg-transactions-ledgers.js` | writes data | Legacy root cleanup script quarantined. Requires destructive guard before it can delete MG transactions/ledgers. Does not touch chart of accounts. |
| `export-cg-account-balances.js` | read-only | See script source before use. |
| `export-loopc-account-balances.js` | read-only | See script source before use. |
| `export-mg-account-balances.js` | read-only | See script source before use. |
| `find-all-joshua-accounts.js` | read-only | See script source before use. |
| `destructive/find-and-remove-2301.js` | read-only | See script source before use. |
| `destructive/find-and-remove-ooo-mark-cg.js` | read-only | See script source before use. |
| `find-creditor-accounts.js` | read-only | See script source before use. |
| `find-orphan-ledgers.js` | read-only | See script source before use. |
| `find_missing_ledger.js` | read-only | See script source before use. |
| `destructive/fix-exchange-gain-mapping.js` | writes data | See script source before use. |
| `fix-inventory-ledger.js` | writes data | See script source before use. |
| `destructive/fix-mg-voucher-nonzero-balance-live-api.js` | writes data | See script source before use. |
| `fix-voucher-5-accounts.js` | writes data | See script source before use. |
| `destructive/fix-voucher-entries.js` | writes data | See script source before use. |
| `destructive/hard-delete-via-live-api.js` | writes data | See script source before use. |
| `inspect-ledger-ids.js` | read-only | See script source before use. |
| `inspect-legacy-for-test-accounts.js` | read-only | See script source before use. |
| `inspect-sale-mapping.js` | read-only | See script source before use. |
| `inspect-sale.js` | read-only | See script source before use. |
| `inspect-test-accounts-all-tenants.js` | read-only | See script source before use. |
| `ledger-debug.js` | read-only | See script source before use. |
| `list-all-ap-accounts.js` | read-only | See script source before use. |
| `list-users.js` | read-only | See script source before use. |
| `destructive/live-jv-dual-test.js` | exercises API / may write test data | See script source before use. |
| `merge-cg-hepi-account.js` | writes data | See script source before use. |
| `destructive/prune-customer-accounts.js` | writes data | See script source before use. |
| `destructive/purge-cg-vouchers-and-journals.js` | writes data | See script source before use. |
| `query-ledger-1302.js` | read-only | See script source before use. |
| `reclass-fx-journal-bank-to-cash-all-tenants.js` | writes data | See script source before use. |
| `destructive/remove-2301-from-atlas.js` | writes data | See script source before use. |
| `destructive/remove-account-2301.js` | writes data | See script source before use. |
| `destructive/remove-joshua-customer.js` | writes data | See script source before use. |
| `destructive/remove-joshua-vendor-and-account.js` | writes data | See script source before use. |
| `destructive/remove-mark-from-all.js` | writes data | See script source before use. |
| `destructive/remove-mark-ooo-chart-cg.js` | writes data | See script source before use. |
| `destructive/remove-mg-mark-ooo-ledger.js` | writes data | See script source before use. |
| `destructive/remove-mg-mark-ooo.js` | writes data | See script source before use. |
| `destructive/remove-ooo-from-cg.js` | writes data | See script source before use. |
| `destructive/remove-ooo-mark-vendors-cg.js` | writes data | See script source before use. |
| `destructive/renumber-mg-payment-receipt-docno-live-api.js` | writes data | See script source before use. |
| `destructive/repair-cg-voucher-postings.js` | dry-run/apply or writes data | See script source before use. |
| `repair-inventory-accounts.js` | dry-run/apply or writes data | See script source before use. |
| `destructive/reset-cg-admin.js` | writes data | See script source before use. |
| `destructive/reset-erp-master-fresh.js` | writes data | See script source before use. |
| `destructive/reset-erp-start.js` | writes data | See script source before use. |
| `destructive/reset-mg-admin.js` | writes data | See script source before use. |
| `destructive/reset-nan-all-tenants.js` | writes data | See script source before use. |
| `destructive/reset-pw.js` | writes data | See script source before use. |
| `destructive/restore-cg-test-accounts.js` | writes data | See script source before use. |
| `destructive/restore-mg-payment-receipt-legacy-live-api.js` | writes data | See script source before use. |
| `revalue-fx-journals-all-tenants.js` | review before running | See script source before use. |
| `search-all-joshua.js` | read-only | See script source before use. |
| `search-ooo-mark-all-collections-cg.js` | read-only | See script source before use. |
| `search-test-accounts-cg.js` | read-only | See script source before use. |
| `seed-currency-master-all-tenants.js` | writes data | See script source before use. |
| `destructive/seed-erp-accounting.js` | writes data | See script source before use. |
| `set-fx-mapping-to-cash-all-tenants.js` | dry-run/apply or writes data | See script source before use. |
| `setup-cg-requested-parties-and-bank.js` | review before running | See script source before use. |
| `smoke-erp-api.js` | exercises API / may write test data | See script source before use. |
| `smoke-tenants.js` | exercises API / may write test data | See script source before use. |
| `task-query-voc6.js` | read-only | See script source before use. |
| `task-script.js` | exercises API / may write test data | See script source before use. |
| `test-api-fixed-unfixed.js` | writes data | See script source before use. |
| `test-fixing-unfixing.js` | writes data | See script source before use. |
| `trace-cg-voucher-refs.js` | read-only | See script source before use. |
| `trace-fx-revaluation.js` | read-only | See script source before use. |
| `trace-ledger-14544.js` | read-only | See script source before use. |
| `trace-uzs-diff.js` | read-only | See script source before use. |
| `trace-uzs-recent.js` | read-only | See script source before use. |
| `trial-balance-check.js` | read-only | See script source before use. |
| `trial2.js` | read-only | See script source before use. |
| `update-uzs-rate.js` | dry-run/apply or writes data | See script source before use. |
| `verify-account-removal.js` | read-only | See script source before use. |
| `verify-all-tenants.js` | read-only | See script source before use. |
| `verify-api-account-removal.js` | read-only | See script source before use. |
| `verify-cg-tt-routing.js` | read-only | See script source before use. |
| `verify-customer-margin-and-accounts.js` | read-only | See script source before use. |
| `verify-fixing-logic.js` | read-only | See script source before use. |
| `verify-fx-journal-audit.js` | read-only | See script source before use. |
| `verify-fx-mapping-cash-all-tenants.js` | read-only | See script source before use. |
| `verify-mg-vouchers-balances-live-api.js` | read-only | See script source before use. |
| `verify-voucher-5-fixed-v2.js` | read-only | See script source before use. |
| `verify-voucher-5-fixed.js` | read-only | See script source before use. |

