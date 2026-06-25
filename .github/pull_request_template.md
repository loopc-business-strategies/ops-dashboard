## Summary

<!-- What changed and why -->

## ERP PR checklist

If this PR touches ERP, vouchers, margins, metal rates, ledger, customers, or vendors, confirm:

- [ ] Financial work uses `/api/erp-accounting` only (see [docs/ERP-API-PR-CHECKLIST.md](docs/ERP-API-PR-CHECKLIST.md))
- [ ] `npm run check:risk-guardrails` passes
- [ ] `npm run sync:erp-access` run if `shared/erp-access-matrix.json` changed

## Test plan

- [ ] `npm run check:ci-parity` (or relevant subset)
- [ ] Manual steps (tenant, tab, expected result):
