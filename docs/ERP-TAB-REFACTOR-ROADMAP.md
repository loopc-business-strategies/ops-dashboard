# ERP tab refactor roadmap (P1)

`frontend/src/components/tabs/ERPTab.jsx` and `frontend/src/components/tabs/VoucherTab.jsx` are large surface areas. The goal is **routable or lazy-loaded submodules** and **shared `erp/` helpers** without changing user-visible behaviour.

## Wired in ERPTab (done)

- `frontend/src/components/tabs/erp/metalMarginPolicy.js` — account enquiry creditor/vendor spot MTM suppression (kept in sync with `backend/services/erpAccounting/metalMarginPolicy.js`).
- Tab shells under `frontend/src/components/tabs/erp/tabs/` (e.g. `ERPReportsTab`, `ERPInventoryTab`).
- **Account enquiry** — `AccountEnquiryModal.jsx`, `useAccountEnquiryStatement.js`, `useAccountEnquiryModalDrag.js`, `useEnquiryDeepLinkEffects.js` imported and used in ERPTab (inline statement math, drag handlers, modal JSX, and deep-link effects removed).
- **Dashboard widgets** — `useErpDashWidgets.js` (layout persistence via `useErpDashUiState`), `useErpDashUiState.js` (arrange/customize UI), `useErpDashWidgetData.js` (report + chat fetch; tab-visit effects live in the hook).
- **Voucher list** — `frontend/src/components/tabs/voucher/VoucherListPanel.jsx`.
- **Voucher editor** — `frontend/src/components/tabs/voucher/VoucherEditorPanel.jsx`.
- **Voucher print** — `useVoucherPrintModel.js`, `VoucherPrintPanel.jsx`.
- **Voucher domain helpers** — `frontend/src/components/tabs/erp/voucherUtils.js` (doc numbering, FX, inventory decode, `sortVouchersByDocNo`, `nextVocNo`, `displayVoucherDocNo`, `computeVoucherGrandTotal`, `numberToWords`); re-exported from `voucher/voucherTabShared.js`.
- **Fixing register** — `useFixingRegisterStockTypeOptions.js`, `fixingRegisterDataLoader.js`, `useFixingRegisterPanelDrag.js` (panel offset/drag state internal to hook), `useFixingRegisterState.js` (filter/results/load handler); ERPTab imports `fixingRegFmt*` from `fixingRegisterUtils.js`.
- **Journal voucher** — `useJournalVoucher.js` wired in ERPTab (LoopC header-currency parity in `validateJvLines`); `useJvModalDragResize.js` for modal chrome.
- **Transaction composer** — `useTransactionComposer.js` (form state, validation, create/update).

`ERPTab.jsx` is ~4550 lines after enquiry + dashboard wire-up (down from ~6460 on main).

## Presentational splits (done)

- `TransactionComposerForm.jsx` — JSX from `ERPTransactionsTab.jsx` (logic in `useTransactionComposer`).
- `JournalVoucherModal.jsx` — JSX from `ERPLedgerTab.jsx` (logic in `useJournalVoucher`).

## Deferred / repo-wide (addressed)

- Sentry `@sentry/node` / `@sentry/react` upgraded to ^10.
- Backend ESLint: zero warnings on the production backend glob (`lint:eslint:backend` with `--max-warnings=0`).
- `lint:eslint:repo` ratcheted to zero warnings on `frontend/src`.

## Acceptance checks (any PR that moves code)

- Account enquiry: creditor/vendor liability still suppresses misleading spot MTM; pure-weight statement still dedupes merged legs.
- Supplier and customer margin API responses unchanged for the same inputs (see `backend/tests/metalMarginPolicy.test.js`).
- No new unconditional `fetch` loops; lazy tabs still load on demand.
- Voucher create/view/print layouts unchanged for metal and non-metal types.
