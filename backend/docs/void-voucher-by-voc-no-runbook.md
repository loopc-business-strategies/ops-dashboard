# Void a posted voucher by document number (e.g. LoopC `Rec/2026/0001`)

Posted vouchers are **not hard-deleted**. Use **Void** so ledgers are reversed and the transaction is soft-deleted with an audit trail.

## 1. Void from the app (recommended)

1. Sign in to **LoopC** as **Finance** or **Super Admin**.
2. ERP → **Vouchers** → **Receipt** (or the correct type).
3. Find **Rec/2026/0001** (or your `vocNo`).
4. Click **Void**.
5. Enter a **reason** with **at least 8 characters**.
6. Enter the **confirmation token** when prompted (same value as server env **`DESTRUCTIVE_ADMIN_CONFIRM_TOKEN`** or **`CLEANUP_CONFIRM_TOKEN`**).
7. Reload the list; the voucher should no longer appear among active vouchers.

### Production: if Void returns 403

- Backend requires **`ENABLE_DESTRUCTIVE_ADMIN_API=true`** in production for destructive routes (see `backend/middleware/destructiveAction.js`). Enable only during an approved maintenance window, void, then disable again if policy requires.

## 2. Void via API (fallback)

### Scripted void (same as UI route)

From `backend/` (or repo root with `node backend/scripts/...`). Loads `backend/.env`.

**Environment**

| Variable | Purpose |
|----------|---------|
| `VOID_API_BASE_URL` / `API_URL` / `SMOKE_API_BASE_URL` / `API_BASE_URL` | API origin (no trailing slash) |
| `VOID_TENANT` / `SMOKE_LOGIN_COMPANY` / `DEFAULT_TENANT` | `x-tenant` / `x-company` (e.g. `loopc`) |
| `VOID_API_JWT` or `ERP_API_JWT` or `JWT` | `Authorization: Bearer …` (Finance/Super Admin) |
| *or* `SMOKE_LOGIN_PASSWORD` (+ optional `SMOKE_LOGIN_NAME`) | Cookie session via `/api/auth/login` (no JWT) |
| `VOID_CONFIRM_TOKEN` or `DESTRUCTIVE_ADMIN_CONFIRM_TOKEN` or `CLEANUP_CONFIRM_TOKEN` | Must match server; sent as `confirmToken` in JSON body |
| `VOID_REASON` | Optional; default is long enough for the destructive guard |

**Commands**

Dry-run (resolve `--voc-no` via list API, print target URL; no POST):

```bash
node scripts/void-transaction-via-api.js --voc-no=Rec/2026/0001 --type=receipt
```

Execute void:

```bash
node scripts/void-transaction-via-api.js --voc-no=Rec/2026/0001 --type=receipt --apply
```

Or by id:

```bash
node scripts/void-transaction-via-api.js --id=YOUR_MONGO_OBJECT_ID --apply
```

`npm run void:transaction:api -- --voc-no=Rec/2026/0001 --apply` from `backend/` is equivalent.

### Manual curl

Resolve the MongoDB `_id` of the transaction (see script below), then:

```bash
curl -sS -X POST "https://YOUR_API/api/erp-accounting/transactions/TRANSACTION_ID_HERE/void" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT" \
  -H "X-Tenant: loopc" \
  -d "{\"reason\":\"Remove receipt Rec/2026/0001 per finance approval\",\"confirmToken\":\"YOUR_DESTRUCTIVE_ADMIN_CONFIRM_TOKEN\"}"
```

Adjust host/headers to match how your deployment passes tenant and auth (e.g. `X-Company`, cookie session, etc.).

## 3. Find `TRANSACTION_ID` from `vocNo`

From repo root:

```bash
node backend/scripts/find-transaction-id-by-voc-no.js --tenant=loopc --voc-no=Rec/2026/0001 --type=receipt
```

Or from `backend/`:

```bash
node scripts/find-transaction-id-by-voc-no.js --tenant=loopc --voc-no=Rec/2026/0001 --type=receipt
```

Uses `MONGO_URI_LOOPC` from `.env`. Prints `_id` and a sample `curl` line with placeholders.
