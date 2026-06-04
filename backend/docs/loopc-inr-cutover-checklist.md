# LoopC INR base cutover — verification checklist

Run only after backup and finance approval. Cutover script: [`revalue-loopc-inr-base-cutover.js`](../scripts/destructive/revalue-loopc-inr-base-cutover.js).

## Pre-flight

- [ ] `MONGO_URI_LOOPC` points to the correct database; backup taken.
- [ ] Agreed **INR per 1 USD** cutover rate documented (matches `--inr-per-usd`).
- [ ] Dry-run executed and JSON preview reviewed (`--tenant=loopc --inr-per-usd=...` without `--apply`).

## Apply

- [ ] `DESTRUCTIVE_ADMIN_CONFIRM_TOKEN` (or `CLEANUP_CONFIRM_TOKEN`) set in environment.
- [ ] Production: `ALLOW_PRODUCTION_DESTRUCTIVE_SCRIPT=true` only during the window.
- [ ] Apply command includes `--reason="..."` (≥10 chars) and `--confirm=...` matching the token.

## Post-cutover (ERP as LoopC tenant)

- [ ] **Currencies**: exactly one base — INR, `exchangeRate` 1; USD row shows **INR per 1 USD** (≈ cutover rate); other FC rates look sensible.
- [ ] **Ledger enquiry / trial balance**: totals scaled vs pre-cutover expectation (× INR/USD rate on old USD-base rows).
- [ ] **INR receipt** (document currency = INR): saves and posts; main ledger row amount matches FC where rate is 1.
- [ ] **USD (or other FC) receipt/payment**: reference rate + line rate; posted amounts in INR; FX gain/loss journal only when rules say so.
- [ ] **Metal rates** (manual PUT): new rows use `priceCurrency` from tenant base (INR after cutover).

## Known limitations

- Script **does not** rewrite `transactions` / `voucherMeta` historical fields (`amountLC`, old `exchangeRate` on stored vouchers). Reports that read raw voucher JSON may not match printed history until a separate data cleanup, if ever required.
