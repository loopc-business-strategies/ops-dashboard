# ERP tab refactor roadmap (P1)

`frontend/src/components/tabs/ERPTab.jsx` and `frontend/src/components/tabs/VoucherTab.jsx` are large surface areas. The goal is **routable or lazy-loaded submodules** and **shared `erp/` helpers** without changing user-visible behaviour.

## Operations tab (refactor)

- Seed data + design tokens + shared UI chrome extracted from `OperationsTab.jsx` into `frontend/src/components/tabs/operations/` (`operationsSeedData.js`, `operationsTabTokens.js`, `operationsTabUI.jsx`).
- **Ops projects mapping** — `operations/opsProjectsMapping.js` (API ↔ UI task row transforms, payloads, stale detection).
- **ERP tenant resolution** — `erp/resolveErpUserTenant.js` shared by `ERPTab.jsx`, `VoucherTab.jsx`, and voucher hooks.

## Wired in ERPTab (done)

- `frontend/src/components/tabs/erp/metalMarginPolicy.js` — account enquiry creditor/vendor spot MTM suppression (kept in sync with `backend/services/erpAccounting/metalMarginPolicy.js`).
- Tab shells under `frontend/src/components/tabs/erp/tabs/` (e.g. `ERPReportsTab`, `ERPInventoryTab`).
- **Account enquiry** — `AccountEnquiryModal.jsx`, `useAccountEnquiryStatement.js`, `useAccountEnquiryModalDrag.js`, `useEnquiryDeepLinkEffects.js` imported and used in ERPTab (inline statement math, drag handlers, modal JSX, and deep-link effects removed).
- **Dashboard widgets** — `useErpDashWidgets.js` (layout persistence via `useErpDashUiState`), `useErpDashUiState.js` (arrange/customize UI), `useErpDashWidgetData.js` (report + chat fetch; tab-visit effects live in the hook).
- **Voucher list** — `frontend/src/components/tabs/voucher/VoucherListPanel.jsx`.
- **Voucher editor** — `frontend/src/components/tabs/voucher/VoucherEditorPanel.jsx`.
- **Voucher print** — `useVoucherPrintModel.js`, `VoucherPrintPanel.jsx`.
- **Voucher notification open** — `useVoucherPendingOpen.js` wired in `VoucherTab.jsx` (pending bell → open voucher effect).
- **Voucher domain helpers** — `frontend/src/components/tabs/erp/voucherUtils.js` (doc numbering, FX, inventory decode, `sortVouchersByDocNo`, `nextVocNo`, `displayVoucherDocNo`, `computeVoucherGrandTotal`, `numberToWords`); re-exported from `voucher/voucherTabShared.js`.
- **Fixing register** — `useFixingRegisterStockTypeOptions.js`, `fixingRegisterDataLoader.js`, `useFixingRegisterPanelDrag.js` (panel offset/drag state internal to hook), `useFixingRegisterState.js` (filter/results/load handler); ERPTab imports `fixingRegFmt*` from `fixingRegisterUtils.js`.
- **Journal voucher** — `useJournalVoucher.js` wired in ERPTab (LoopC header-currency parity in `validateJvLines`); `useJvModalDragResize.js` for modal chrome.
- **Transaction composer** — `useTransactionComposer.js` (form state, validation, create/update).

## Finance tab (done)

- **Finance modals** — `frontend/src/components/tabs/finance/FinanceModals.jsx` + `financeTabTokens.js` extracted from `FinanceTab.jsx`.

`ERPTab.jsx` is ~3180 lines after branding + transactions wire-up (down from ~6460 on main).

## S5 wire-up (done)

- **`useErpLedger`** — wired in `ERPTab.jsx` (conditional reference-data loads; replaces inline `loadLedger`).
- **`useErpVendors`** — wired (`fetchAllVendorsAggregated` shared with transaction reference bootstrap).
- **`useErpInventory`** — wired (`loadInventory`, `loadStockLedger`).
- **`useErpLedgerActions`** — ledger edit / reverse / reconcile / save handlers extracted from `ERPTab.jsx`.
- **`useErpVendorActions`** — vendor CRUD, workflow, and document handlers extracted; defaults in `vendorFormDefaults.js`.
- **`useErpAccounts`** — wired with tenant-scoped summary cache (`readSummaryAccountsCache` / `writeSummaryAccountsCache`).
- **`useErpInventoryActions`** — stock mapping + catalog CRUD, modal drag, auto stock-code sync; helpers in `inventoryFormDefaults.js`.
- **`useErpBranding`** — report branding load/save, logo upload, profile selection, preview logo effect.
- **`useErpTransactions`** — wired with lazy `loadTransactionReferenceData` bootstrap (preserves composer behaviour).

## Mobile store signing (ops — not code)

12 GitHub secrets still missing per `mobile/RELEASE_CHECKLIST.md`. Run `npm run check:mobile-release-secrets` after provisioning certs/keystores. See `npm run setup:mobile-github-secrets -- --print-instructions`.

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
