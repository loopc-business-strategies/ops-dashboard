# Multi-tenant ERP alignment (MG / CG / LoopC)

Voucher ledger **formulas** are shared in code; cross-tenant differences usually come from **per-database** master data. Use these scripts from `backend/` with `.env` URIs set (`MONGO_URI_MG`, `MONGO_URI_CG`, `MONGO_URI_LOOPC`).

## LoopC INR base cutover (ledger + currency master)

- Script: [`revalue-loopc-inr-base-cutover.js`](../scripts/destructive/revalue-loopc-inr-base-cutover.js) (LoopC only; dry-run by default).
- Checklist: [`loopc-inr-cutover-checklist.md`](loopc-inr-cutover-checklist.md).
- If INR is base but **USD** still shows rate `1`, run [`fix-usd-exchange-when-inr-base.js`](../scripts/fix-usd-exchange-when-inr-base.js) (`--tenant=loopc --inr-per-usd=...`, then `--apply`).

## 1. Currency `exchangeRate` alignment

Copies `exchangeRate` from a source tenant to targets for **matching currency codes** only. Does **not** change `baseCurrency` flags.

```bash
cd backend
node scripts/sync-currency-rates-from-source-tenant.js
node scripts/sync-currency-rates-from-source-tenant.js --source=mg --targets=cg,loopc
node scripts/sync-currency-rates-from-source-tenant.js --apply
```

- Default: dry run.
- If **base currency code** differs between source and target, rate diffs are **suppressed** and `--apply` skips that target until bases match (rates are not comparable).

## 2. Legacy receipt/payment `transaction.amount` (FC vs LC)

Detects vouchers where `amount` tracks **sum of line LC** instead of **sum of line FC** while document currency is not base (old double-FX pattern).

```bash
node scripts/audit-legacy-voucher-transaction-amount-fc.js
node scripts/audit-legacy-voucher-transaction-amount-fc.js --tenant=cg --limit=3000
```

**Remediation:** void/repost after correcting data, or manual adjusting journals. Heuristic may miss edge cases.

## 3. Chart and mappings vs reference tenant

Lists chart **account codes** present on reference but missing on another tenant, and `accountmappings` rows whose debit/credit **codes** differ (by `mappingType`).

```bash
node scripts/compare-tenant-chart-to-reference.js
node scripts/compare-tenant-chart-to-reference.js --reference=mg --others=cg,loopc
```

Use chart bootstrap / ERP UI to add missing accounts; see also `scripts/set-fx-mapping-to-cash-all-tenants.js` for FX cash/gain/loss wiring.
