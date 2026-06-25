# Legacy `/api/erp` deprecation plan

**Status:** Active — no removal date yet. **New financial features must use `/api/erp-accounting` only.**

See [ERP-API-GUIDE.md](./ERP-API-GUIDE.md) for the split between APIs.

## Current split

| API | Keep for | Migrate away from |
|-----|----------|-------------------|
| `/api/erp-accounting` | GL, ledger, vouchers, metal trading, accounting inventory, customers/vendors with ledger links | — |
| `/api/erp` | Production work orders, ops procurement docs, legacy ops inventory | Financial party master data duplicated here |

## Overlap risk (highest priority)

| Domain | Legacy `/api/erp` | Target `/api/erp-accounting` | Rule |
|--------|-------------------|------------------------------|------|
| Vendors / suppliers | `Supplier` model, procurement | `Vendor` + ledger account | **Do not create new suppliers on `/api/erp` for accounting** |
| Inventory | Ops stock movements | Accounting stock types + GL | Use accounting inventory for valuation |
| Customers | Legacy CRM links | `Customer` + ledger | Accounting customer is source of truth for AR |

## Timeline (proposed)

| Phase | When | Action |
|-------|------|--------|
| **Now** | Immediate | Freeze new financial endpoints on `/api/erp`; PR checklist enforced |
| **Phase 1** | Next 2 quarters | Audit `frontend/src/api/erp.js` callers; document each route still needed |
| **Phase 2** | After audit | Read-only shim on legacy vendor/supplier writes with redirect message to accounting API |
| **Phase 3** | TBD | Remove unused `/api/erp` routes; keep production/procurement subset only |

## Frontend modules still on legacy `/api/erp`

- `ProductionTab`, `OperationsTab`, **Procurement Plus** — intentional until ops migration
- Do **not** add ERP financial tabs here

## Verification

- Grep before merge: `grep -r "'/api/erp" frontend/src` — new financial paths should be zero
- `npm run sync:erp-access` after matrix changes

## Related

- [ERP-API-PR-CHECKLIST.md](./ERP-API-PR-CHECKLIST.md)
- [CRITICAL-FIXES-CHECKLIST.md](./CRITICAL-FIXES-CHECKLIST.md) item #5
