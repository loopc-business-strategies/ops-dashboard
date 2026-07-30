# ERP dual API — audit

**Last reviewed:** 2026-07-30 · **Status:** Phases 1–3 complete

Companion: [ERP-DUAL-API-DEPRECATION.md](./ERP-DUAL-API-DEPRECATION.md)

---

## Frontend imports of legacy `/api/erp`

| File | Purpose | Keep? |
|------|---------|-------|
| `frontend/src/api/erp.js` | Legacy client module | Yes — definition |
| `frontend/src/api/erpUnified.js` | Bridge (allowlisted) | Yes |
| `frontend/src/components/tabs/OperationsTab.jsx` | Ops inventory / procurement UI | Yes — intentional |
| `frontend/src/components/tabs/ProductionTab.jsx` | Work orders | Yes — intentional |
| `frontend/src/components/tabs/ProcurementPlusTab.jsx` | Ops procurement via `erpUnified` | Yes — reads only for suppliers |

**CI guard:** `npm run check:erp-legacy-imports` — blocks new `api/erp` imports outside the allowlist.

All financial tabs (`ERPTab`, `VoucherTab`, `FinanceTab`, `DirectDealsTab`) use **`erp-accounting` only**.

---

## Backend `/api/erp` write status

| Domain | Status |
|--------|--------|
| Ops inventory | Kept for ops stock movements |
| Suppliers writes | **410 Gone** — use `/api/erp-accounting/vendors` |
| Purchase orders | Ops procurement only |
| Work orders | Production only |
| Finance records | **410 Gone** |
| Procurement docs / expiry alerts | Ops only |
| Legacy response header | `X-Legacy-Erp-Api: true` on remaining routes |

**Rule:** No new `POST/PUT/DELETE` on `/api/erp` for ledger, vouchers, customers, vendors, or metal trading.

---

## Phases

| Phase | Status |
|-------|--------|
| **1** — Inventory + CI import guard | **Done** |
| **2** — Supplier writes 410; accounting vendors for parties | **Done** |
| **3** — Finance records 410; legacy header | **Done** |

**Frontend follow-up (2026-07-30):** Procurement Plus no longer offers “Add supplier”; UI points to ERP Vendors.

---

## Verification

```bash
npm run check:erp-legacy-imports
```
