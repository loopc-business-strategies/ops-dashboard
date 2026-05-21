# ERP tab refactor roadmap (P1)

`frontend/src/components/tabs/ERPTab.jsx` and `frontend/src/components/tabs/VoucherTab.jsx` are large surface areas. The goal is **routable or lazy-loaded submodules** and **shared `erp/` helpers** without changing user-visible behaviour.

## Done (incremental)

- `frontend/src/components/tabs/erp/metalMarginPolicy.js` — account enquiry creditor/vendor spot MTM suppression (kept in sync with `backend/services/erpAccounting/metalMarginPolicy.js`).
- Tab shells under `frontend/src/components/tabs/erp/tabs/` (e.g. `ERPReportsTab`, `ERPInventoryTab`).

## Next slices (suggested order)

1. **Account enquiry block** — extract the modal + statement merge hooks from `ERPTab.jsx` into `erp/accountEnquiry/` (props: API client, theme tokens, callbacks).
2. **Voucher list vs editor** — split `VoucherTab.jsx` into `voucher/VoucherListPanel.jsx` and `voucher/VoucherEditorPanel.jsx` with shared types in `erp/voucherUtils.js`.
3. **Dashboard widgets** — already partially in `erp/ERPDashboardWidgets.jsx`; move remaining widget data prep out of `ERPTab.jsx`.

## Acceptance checks (any PR that moves code)

- Account enquiry: creditor/vendor liability still suppresses misleading spot MTM; pure-weight statement still dedupes merged legs.
- Supplier and customer margin API responses unchanged for the same inputs (see `backend/tests/metalMarginPolicy.test.js`).
- No new unconditional `fetch` loops; lazy tabs still load on demand.
