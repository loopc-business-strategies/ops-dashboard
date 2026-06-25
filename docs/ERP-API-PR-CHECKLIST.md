# ERP pull request checklist

Use for **any PR** that touches ERP, vouchers, margins, metal rates, customers, vendors, ledger, or inventory.

## API surface

- [ ] Financial / metal / GL / vouchers → **`/api/erp-accounting`** only ([ERP-API-GUIDE.md](./ERP-API-GUIDE.md))
- [ ] Legacy ops (procurement work orders, ops inventory) → **`/api/erp`** only if not yet migrated
- [ ] No duplicate vendor/customer records across both APIs without explicit sync

## Backend

- [ ] New handlers in `backend/routes/erp-accounting/*`, not growing `erp-accountingContext.js` with endpoint logic
- [ ] Business logic in `backend/services/erpAccounting/`, thin route wrappers
- [ ] Access policy updated in `shared/erp-access-matrix.json` if permissions change → run `npm run sync:erp-access`
- [ ] Joi/schema validation for new write endpoints

## Frontend

- [ ] API calls via `frontend/src/api/erp-accounting/`
- [ ] No large additions to `ERPTab.jsx` — extract hooks/helpers under `frontend/src/components/tabs/erp/`
- [ ] Margin live recalc uses `metalMarginPolicy.js` / `mapErpLiveMarginRow.js` rules (supplier suppress, liability customer suppress)

## Mobile

- [ ] Parity with web for same API fields (`suppressMetalSpotMtm`, live MTM helpers)
- [ ] Paths under `mobile/src/api/` match accounting routes, not legacy `/api/erp` for financial data

## Tests

- [ ] Backend: unit or integration test for non-trivial posting / policy change
- [ ] Frontend: `*.test.js` for pure helpers; contract tests if API shape changes
- [ ] `npm run check:risk-guardrails` passes (ERPTab & context line budgets)

## Deploy / ops

- [ ] No destructive scripts run against prod without `_destructive-guard` and explicit tenant
- [ ] Metal bridge changes: confirm fan-out tenants (`METAL_RATES_BRIDGE_FANOUT_TENANTS`)
