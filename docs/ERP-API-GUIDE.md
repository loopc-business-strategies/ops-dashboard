# ERP API Guide

This platform exposes **two ERP-related APIs**. Use the correct one for each feature to avoid duplicate data and confusion.

## Accounting ERP — `/api/erp-accounting`

**Use for:** Financial accounting, metal trading, statutory books.

| Area | Examples |
|------|----------|
| Chart of accounts | Accounts tree, mappings |
| Ledger & journals | Bank JVs, multi-currency postings |
| Transactions | Draft → approve → post workflow |
| Parties | Customers, vendors (with ledger links) |
| Inventory (accounting) | Stock types tied to GL, live valuation |
| Vouchers | Metal purchase/sale/receipt/payment |
| Reports | Trial balance, P&L, balance sheet, aging |
| Direct deals & fixing register | OTC metal, fixings |

**Frontend:** `frontend/src/api/erp-accounting/`, `ERPTab.jsx`, `VoucherTab.jsx`

**Backend:** `backend/routes/erp-accounting/`, `backend/services/erpAccounting/`

This is the **primary ERP** for MG/CG/LoopC. New financial features belong here.

---

## Operations ERP — `/api/erp`

**Use for:** Department ops workflows (legacy).

| Area | Examples |
|------|----------|
| Ops inventory | Raw/WIP/finished stock (non-GL) |
| Procurement | Suppliers, purchase orders, documents |
| Production | Work orders |
| Alerts | Expiry alerts |

**Frontend:** `frontend/src/api/erp.js` — used by Production, Operations, **Procurement Plus**

**Backend:** `backend/routes/erp.js`

---

## Migration direction

1. **Financial / metal accounting** → always `/api/erp-accounting`
2. **Procurement & production ops** → `/api/erp` until migrated
3. Do **not** duplicate vendors/suppliers across both without explicit sync

## Migration direction

1. **Financial / metal accounting** → always `/api/erp-accounting`
2. **Procurement & production ops** → `/api/erp` until migrated
3. Do **not** duplicate vendors/suppliers across both without explicit sync

When adding features, prefer extending **erp-accounting** for anything that posts to the ledger or affects account enquiry.

---

## Management role (read-only)

Users with role `management` can **view** ERP modules they are granted (transactions, vouchers, account enquiry, customers, direct deals) but **cannot** create or mutate ERP data:

- Blocked: manage customers/vendors/accounts, create transactions, manage direct deals, update metal rates
- Allowed: view-only access aligned with Admin → Permissions toggles and VoucherTab read-only mode

Backend enforcement lives in `backend/services/erpAccounting/accessPolicy.js` (`blocksManagementWrite`).
