# Permanent fix: JV / Bank JV ledger rows (base → foreign currency)

Older **journal** and **bank_jv** lines were sometimes stored as **base currency + `exchangeRate: 1`** with **`amount` already in base** (e.g. USD), while vouchers were entered in **soms (UZS)**. The product convention is:

**base equivalent = `amount` × `exchangeRate`**

with **`amount` in the line currency** and **`exchangeRate`** from **Master → Currencies** (foreign → base).

The backfill **does not change** that base equivalent; it only rewrites **`amount`**, **`currency`**, and **`exchangeRate`** so stored data matches the API and reports.

## What the backfill uses (COA + narration)

1. **Chart of accounts** — For each `referenceId` batch (or each orphan row), it tallies **`currency`** on every debit and credit leg (non-base only). It uses a **single** FC code or a **strict majority** among legs.

2. **Narration fallback** — If COA does not resolve (e.g. accounts still default to USD), the batch description + notes are scanned for **soms / mil soms / UZS**-style wording (same idea as the ledger UI). If matched, the batch is treated as **UZS** (only when still on base + rate 1).

3. **Currencies** — An **active** row for that code with **`exchangeRate > 0`**.

## Option A — From the ERP UI (per tenant, MG etc.)

1. Log in as a user with the **Finance** role.

2. Open **ERP → Journal Voucher** (Normal JV or Bank JV as needed).

3. Click **Preview JV FX repair** — shows how many postings **would** be updated (no writes). Optional: open the browser **console** for `skip samples` when some batches are skipped.

4. Click **Apply JV FX repair** — enter a **reason** (≥ 8 characters) and the server’s **`DESTRUCTIVE_ADMIN_CONFIRM_TOKEN`**.

5. **Production:** set **`ENABLE_DESTRUCTIVE_ADMIN_API=true`** for the maintenance window (see `middleware/destructiveAction.js`). Afterward, set it back to `false` if you normally keep destructive APIs off.

6. Reload the ledger; amounts should be stored as **UZS + rate** (or other inferred FC), not only UI-inferred.

## Option B — HTTP API (curl, Postman)

- **Preview (no token, Finance session cookie):**  
  `POST /api/erp-accounting/ledger/repair-jv-fx/preview`  
  Body JSON: `{ "mode": "coa" }` (optional `"mode": "force", "forceCurrency": "UZS"`).

- **Apply (destructive token + reason in body):**  
  `POST /api/erp-accounting/ledger/repair-jv-fx/apply`  
  Body: `{ "mode": "coa", "confirmToken": "<DESTRUCTIVE_ADMIN_CONFIRM_TOKEN>", "reason": "JV ledger UZS backfill per OPS-…" }`  
  Same production flag as above.

## Option C — CLI script (all tenants / automation)

Shared logic lives in **`services/jvLedgerFxBackfill.js`** (used by the API and the script).

```bash
cd backend
npm run backfill:jv-ledger-fc:dry -- --tenant=all
npm run backfill:jv-ledger-fc:apply -- --tenant=mg --reason="JV ledger FC backfill after COA review" --confirm="$DESTRUCTIVE_ADMIN_CONFIRM_TOKEN"
```

Force every candidate row to one FC (only after review):

```bash
node scripts/backfill-jv-ledger-base-to-fc.js --tenant=mg --dry-run --mode=force --currency=UZS
```

## Related

`scripts/backfill-ledger-exchange-rates.js` fixes rows that already have a **non-base** `currency` but **`exchangeRate` 1 or invalid** — a different case.
