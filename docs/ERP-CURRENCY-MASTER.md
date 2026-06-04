# ERP Currency Master

## Stored rate

Each currency document stores **`exchangeRate` as the USD value of 1 unit of that currency** (foreign → USD). Ledger base equivalents use **`amount * exchangeRate`** for non-base currencies.

## Default currencies (sync / bootstrap only)

`ensureDefaultCurrencyMaster` (and the “Sync USD/EUR/AED/UZS” flow) only ensures **USD** (base), **EUR**, **AED**, and **UZS**. Those presets live in [`backend/services/erpAccounting/currencyBootstrapService.js`](../backend/services/erpAccounting/currencyBootstrapService.js).

Optional currencies are **not** part of that list unless you deliberately extend `DEFAULT_CURRENCY_MASTER` (which would make them auto-provisioned on sync).

## Adding an optional currency (example: INR)

Add per tenant in the app: **ERP → Currency Master → + Add Currency**. Requires permission to manage accounts (`POST /erp-accounting/currencies`).

Use the **“1 USD = (units of this currency)”** field when you think in quote form (e.g. type **85.6** for INR). The app stores **`1 ÷` that value** as `exchangeRate` so the table shows **0.011682** and **1 USD = 85.6** correctly. You can still type **Exchange rate** directly if you prefer.

**Example — Indian Rupee like Currency Master (1 USD = 85.6 INR, Exchange Rate column 0.011682)**

| Field | Value |
|--------|--------|
| Code | `INR` |
| Name | `Indian Rupee` |
| Symbol | `₹` (or `INR`) |
| Exchange rate | Use **`1 / 85.6`** in a calculator and paste the full value (USD per 1 INR), **or** rely on the app to store full precision from a formula. Do **not** type only the six-digit rounded literal **`0.011682`** by itself — that rounds away precision and the **“1 USD =”** column will show ~**85.60** instead of **85.6**. |

Leave **base** unchecked so USD remains the base currency.

After saving, confirm **Exchange Rate** shows **`0.011682`** (six decimals) and **“1 USD =”** shows **`85.6`** (or your approved spot).

## Automated upsert (operators)

If you prefer the database path (e.g. bulk or CI), use [`backend/scripts/destructive/provision-inr-currency.js`](../backend/scripts/destructive/provision-inr-currency.js). It is **not** part of default bootstrap; it only upserts `INR` when you run it.

Dry run (no writes):

```bash
cd backend
node scripts/destructive/provision-inr-currency.js --tenant=loopc
```

Apply (requires the same `--apply`, `--reason`, `--confirm`, and token env vars as other destructive scripts; use production override only when appropriate):

```bash
node scripts/destructive/provision-inr-currency.js --tenant=loopc --inr-per-usd=85.6 --apply --reason="OPS-123 add INR to LoopC" --confirm="$DESTRUCTIVE_ADMIN_CONFIRM_TOKEN"
```

Override the spot quote with `--inr-per-usd=<number>` (meaning **1 USD = that many INR**).
