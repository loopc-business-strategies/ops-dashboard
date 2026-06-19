# Testing (local & CI)

## Quick checks (repo root)

Use **Node 24** locally when mirroring CI (see **`.nvmrc`** at the repo root and `docs/WINDOWS-DEV.md`).

```powershell
npm run lint
```

Runs workspace guardrails plus **strict ESLint** on production `frontend/src/components/tabs/erp/**/*.{js,jsx}` and `frontend/src/api/**/*.js` (`--max-warnings=0`), **`npm run lint:eslint:hooks-order`**, **`npm run lint:eslint:finance-ops`** (Finance + Operations tabs), **`npm run lint:eslint:extended-tabs`** (additional dashboard files listed in `package.json`; zero warnings), and **`npm run lint:eslint:erp-shell-tabs`** (**`ERPTab.jsx`** + **`VoucherTab.jsx`**; zero warnings).

To lint the **entire** `frontend/src` tree (zero warnings, same as CI):

```powershell
npm run lint:eslint:repo
```

## CI parity shortcut (root)

**`npm run lint`** does **not** run backend Jest, frontend Vitest, or mobile typecheck—those are separate GitHub Actions jobs.

**`npm run check:ci-parity`** runs the root lint pipeline plus **mobile typecheck** and **backend fast Jest only** (`backend/tests/permissions.test.js` via `test:fast`). It is **not** a substitute for full CI.

```powershell
npm run check:ci-parity
```

For lint + mobile typecheck + **all** backend and frontend tests locally:

```powershell
npm run check:ci-parity:full
```

Requires **`npm ci`** at the repo root, in **`backend/`**, **`frontend/`**, and **`mobile/`** first (see individual package READMEs). On **Windows**, use **Node 24** and see **`docs/WINDOWS-DEV.md`** for MongoDB Memory Server / **`MONGO_TEST_URI`** when backend tests fail. For **local Android release builds** without EAS, see **`docs/MOBILE-ANDROID-LOCAL-BUILD.md`**.

## Full pre-release (matches `deploy:railway` spirit)

From the **repository root** (after `npm ci` in `backend/`, `frontend/`, and root if you use root ESLint):

```powershell
npm run sync:erp-access
npm run test:backend
npm run test:frontend
```

- **`test:backend`**: guardrails + **all** backend Jest suites (`cd backend && npm test`).
- **`test:frontend`**: guardrails + frontend **`npm test`** (jsdom Vitest) + **`npm run test:unit`** (Node Vitest for `*.node.test.js`).

## Backend only

```powershell
cd backend
npm ci
npm run test:fast
npm run test:erp-accounting
npm run test:integration
npm test
```

On **Windows**, MongoDB Memory Server may require the **VC++ x64 redist** or **`MONGO_TEST_URI`** — see `docs/WINDOWS-DEV.md`.

## Frontend only

```powershell
cd frontend
npm ci
npm run test:unit
npm test
npm run build
```

`test:unit` is intentionally **fast** (no jsdom). Prefer adding **`*.node.test.js`** for pure helpers.

### Frontend E2E (Playwright)

From the **repository root** (after `npm ci` in `frontend/`):

```powershell
npm run test:e2e
```

Includes **`e2e/dashboard-navigation.spec.js`** (dashboard deep links, Account Summary URL params) and SPA shell smoke. Live API login test runs only when `E2E_AUTH_NAME` / `E2E_AUTH_PASSWORD` are set.

Or from `frontend/`:

```powershell
cd frontend
npx playwright install chromium
npm run test:e2e
```

CI installs Chromium with `npx playwright install --with-deps chromium` then runs the same script. Tests live under `frontend/e2e/` and start a **preview** server (`build` + `vite preview`) via `playwright.config.js`.

**Login auth smoke** (`frontend/e2e/login-auth.spec.js`):

- **Mocked login** (always runs in CI): stubs `/api/auth/login` and `/api/auth/me`, submits the login form, asserts navigation to `/dashboard`.
- **Live login** (optional): set `E2E_AUTH_NAME`, `E2E_AUTH_PASSWORD`, and optionally `E2E_AUTH_COMPANY` for a real API probe (skipped when unset).

## HTTP load smoke (optional)

With the **backend** listening (for example `npm run dev:backend` from the repo root), in another shell from the **repository root**:

```powershell
npm run load:smoke
```

Environment overrides:

- **`LOAD_SMOKE_URL`** — default `http://127.0.0.1:5000/api/health`
- **`LOAD_SMOKE_REQUESTS`** — default `30`
- **`LOAD_SMOKE_CONCURRENCY`** — default `5`

## GitHub Actions (`.github/workflows/ci.yml`)

The workflow also accepts **`workflow_dispatch`** for manual runs.

| Area | What runs |
|------|-------------|
| Hygiene | Tracked paths, destructive guards, risk guardrails, Vercel rewrites, ERP access parity, ERP tab ESLint |
| Backend fast | `test:fast` + `test:erp-accounting` |
| **Backend full Jest** | **`npm test`** in `backend/` (all suites, same as local full run) — **only** on `workflow_dispatch`, **push** to **`main`**, or **pull requests targeting `main`** (saves runner minutes on feature branches) |
| Backend integration | Tenant routing, tenant isolation, ERP transactions (matrix) |
| Frontend | `npm test` + `npm run test:unit` |
| Frontend build | `npm run build` + bundle budget |
| Frontend E2E | Playwright smoke (`npm run test:e2e` in `frontend/`) |

The **full Jest** job closes the gap where a suite might pass in split jobs but fail when the whole tree runs together (ordering, shared state, timing). To run it locally on any branch, use `cd backend && npm test`.
