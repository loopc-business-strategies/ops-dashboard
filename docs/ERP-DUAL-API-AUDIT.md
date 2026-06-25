# ERP dual API — Phase 1 audit

**Date:** 2026-06-25 · **Status:** Complete (inventory frozen)

Companion: [ERP-DUAL-API-DEPRECATION.md](./ERP-DUAL-API-DEPRECATION.md)

---

## Frontend imports of legacy `/api/erp`

| File | Purpose | Keep? |
|------|---------|-------|
| `frontend/src/api/erp.js` | Legacy client module | Yes — definition |
| `frontend/src/components/tabs/OperationsTab.jsx` | Ops inventory, procurement UI | Yes — intentional |
| `frontend/src/components/tabs/ProductionTab.jsx` | Work orders | Yes — intentional |
| `frontend/src/api/erpUnified.js` | Routes procurement to legacy or accounting | Yes — bridge |
| `frontend/src/components/tabs/ProcurementPlusTab.jsx` | Uses `erpUnified` only | Yes |

**CI guard:** `npm run check:erp-legacy-imports` — blocks any new `api/erp` imports outside the allowlist above.

All financial tabs (`ERPTab`, `VoucherTab`, `FinanceTab`, `DirectDealsTab`) use **`erp-accounting` only**.

---

## Backend `/api/erp` write routes (legacy)

| Domain | Routes | Overlap with accounting |
|--------|--------|-------------------------|
| Ops inventory | `POST/PUT/DELETE /inventory` | Accounting has valuation inventory — **do not duplicate** |
| Suppliers | `POST/PUT/DELETE /procurement/suppliers` | **High risk** — use `Vendor` on `/api/erp-accounting` for AR/AP |
| Purchase orders | `POST/PUT/DELETE /procurement/purchase-orders` | Ops procurement only |
| Work orders | `POST/PUT/DELETE /production/work-orders` | Production only |
| Finance records | `POST/PUT/DELETE /finance/records` | Legacy ops finance — not GL |
| Procurement docs | `POST/DELETE /procurement/documents` | File uploads |
| Expiry alerts | `PUT /alerts/expiry/:id/resolve` | Ops alerts |

**Rule:** No new `POST/PUT/DELETE` on `/api/erp` for ledger, vouchers, customers, vendors, or metal trading.

---

## Phase 2 (next)

1. Add read-only warning header on legacy supplier writes pointing to accounting `Vendor` API.
2. Grep CI for new `/api/erp` routes in `backend/routes/erp.js` on PR (optional).
3. Migrate `OperationsTab` supplier create flows to accounting vendors where parties need ledger links.

---

## Verification

```bash
npm run check:erp-legacy-imports
npm run sync:erp-access
```
