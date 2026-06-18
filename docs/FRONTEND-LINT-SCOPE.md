# Frontend ESLint scope in CI

GitHub Actions runs ESLint with **zero warnings** on:

- `frontend/src/components/tabs/erp/**/*.js`
- `frontend/src/api/**/*.js`

Command: root `npm run lint:eslint:ci` (see [package.json](../package.json)).

Additional zero-warning slices run in the root `npm run lint` pipeline: hooks order, finance/ops tabs, extended tabs, ERP shell tabs (`ERPTab.jsx`, `VoucherTab.jsx`), and the **full** `frontend/src` tree via `lint:eslint:repo`.

## Why

The ERP tab area and the **shared API client layer** are high-churn and security-sensitive. CI enforces a strict bar there first; the repo-wide ratchet (`lint:eslint:repo`) now enforces zero warnings on all of `frontend/src`.

## Local checks

- **ERP + API slice (subset of CI):** `npm run lint:eslint:ci`
- **Full frontend tree (same as CI repo ratchet):** `npm run lint:eslint:repo`
- **Full lint pipeline (guardrails + all ESLint slices):** `npm run lint`

When you touch dashboard tabs outside the ERP tree, `npm run lint` already covers them via `lint:eslint:repo`.
