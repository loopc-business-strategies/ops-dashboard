# Backfill: JV / Bank JV ledger rows (base → foreign currency)

Older journal and bank journal voucher lines were sometimes stored as **base currency + `exchangeRate: 1`** with **`amount` already in base**, while the UI and validation used a foreign currency (e.g. UZS). The live API now stores **`amount` in FC** and **`exchangeRate`** from Master → Currencies so that **`amount × exchangeRate`** equals the base posting.

## Recommended procedure (COA inference)

1. **Chart of accounts**: Set **`currency`** on each relevant account (e.g. local bank `101002` → `UZS`). The backfill infers FC from COA leg tallies (single FC, or **strict majority** across debit/credit legs in the same `referenceId` batch).

2. **Currencies**: Ensure an **active** row for that code with **`exchangeRate > 0`** (foreign → base, same convention as the rest of ERP).

3. **Preview all tenants** (no DB writes):

   ```bash
   cd backend
   npm run backfill:jv-ledger-fc:dry -- --tenant=all
   ```

   To see which COA rows block inference (set `currency` on those accounts, then re-run):

   ```bash
   npm run backfill:jv-ledger-fc:dry -- --tenant=mg --verbose
   ```

4. **Apply one tenant** (writes; requires destructive guard — token, reason, production flag if applicable):

   ```bash
   npm run backfill:jv-ledger-fc:apply -- --tenant=mg --reason="JV ledger FC backfill after COA review" --confirm="$DESTRUCTIVE_ADMIN_CONFIRM_TOKEN"
   ```

5. Repeat `--tenant=cg` / `loopc` as needed.

## If COA is still wrong (last resort)

Force a currency for every candidate row (use only after dry-run review):

```bash
node scripts/backfill-jv-ledger-base-to-fc.js --tenant=mg --dry-run --mode=force --currency=UZS
```

## Related script

`scripts/backfill-ledger-exchange-rates.js` fixes rows that already have a **non-base** `currency` but **`exchangeRate` 1 or invalid** — different case than base-stored amounts.
