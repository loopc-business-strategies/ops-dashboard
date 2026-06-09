# Testing (local & CI)

## Quick checks (repo root)

Use **Node 24** locally when mirroring CI (see **`.nvmrc`** at the repo root and `docs/WINDOWS-DEV.md`).

```powershell
npm run lint
```

Runs workspace guardrails plus **strict ESLint** on production `frontend/src/components/tabs/erp/**/*.{js,jsx}` and `frontend/src/api/**/*.js` (`--max-warnings=0`).

To lint the **entire** `frontend/src` tree (same flat config; may report many warnings outside the ERP tab):

```powershell
npm run lint:eslint:repo
```

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

Or from `frontend/`:

```powershell
cd frontend
npx playwright install chromium
npm run test:e2e
```

CI installs Chromium with `npx playwright install --with-deps chromium` then runs the same script. Smoke tests live under `frontend/e2e/` and start a **preview** server (`build` + `vite preview`) via `playwright.config.js`.

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
