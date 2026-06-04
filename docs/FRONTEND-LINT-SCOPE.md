# Frontend ESLint scope in CI

GitHub Actions runs ESLint with **zero warnings** only on a **focused slice** of the frontend:

- Path: `frontend/src/components/tabs/erp/**/*.js`
- Command: root `npm run lint:eslint:ci` (see [package.json](../package.json))

## Why

The ERP tab area is high-churn and security-sensitive. CI enforces a strict bar there without blocking the entire legacy surface on day one.

## Local checks

- **Same as CI:** `npm run lint:eslint:ci`
- **Whole tree (may have warnings):** `npm run lint:eslint:repo`

When you touch files outside the ERP tab tree, run `lint:eslint:repo` locally before merging if you want broader consistency. Expanding the CI path is a deliberate repo-wide effort (fix warnings module-by-module, then widen the glob).
