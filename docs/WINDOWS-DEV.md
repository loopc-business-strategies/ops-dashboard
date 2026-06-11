# Developing on Windows only

## If `npm run test:fast` fails in `beforeAll` (MongoMemoryServer)

Install the **Microsoft Visual C++ Redistributable (x64)** (latest supported):  
https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist?view=msvc-170  

Typical error: `Instance closed unexpectedly with code "3221225781"` — then Mongoose `buffering timed out` on every test. After installing, rerun `npm run test:fast` from `backend/`.

The same applies to **`npm test`** (full backend Jest): any suite that uses **MongoMemoryServer** will fail until the redist is installed.

### Optional: use a real MongoDB instead of the embedded binary

If you prefer not to install the redist, run MongoDB locally or in Docker and point Jest at it with **`MONGO_TEST_URI`** (any empty database name is fine; tests clean collections between cases):

```powershell
docker run -d --name mongo-jest -p 27017:27017 mongo:7
$env:MONGO_TEST_URI = "mongodb://127.0.0.1:27017/ops_dashboard_jest"
cd backend
npm run test:fast
```

`backend/tests/mongoMemoryTestServer.js` reads **`MONGO_TEST_URI`** before starting **MongoMemoryServer**.

---

## Backend Jest

**Jest 30** could fail immediately on Windows with:

`Module ... jest-circus/build/runner.js in the testRunner option was not found`

This repo pins **Jest 29** in `backend/package.json` and sets **`testRunner: 'jest-circus/runner'`** in `backend/jest.config.js` (a package subpath, not an absolute filesystem path) so `npm test` / `npm run test:fast` avoid that resolution bug on Windows.

After pulling changes, run:

```powershell
cd backend
npm ci
npm run test:fast
```

## MongoDB Memory Server (details)

Same as above: **`mongodb-memory-server`** ships a `mongod` binary that needs the MSVC runtime on Windows. Integration tests (`npm run test:integration:*`) need it too.

Then rerun `npm run test:fast` or `npm run test:integration:erp`.

## Match CI Node version

GitHub Actions uses **Node 24**. The repo root **`.nvmrc`** file pins **24** for **nvm**, **fnm**, or **Volta** (`nvm use` / `fnm use` from the checkout). On Windows, use **nvm-windows** or the official installer to run the same major version when debugging “passes in CI, fails locally” issues.

## Frontend Vitest

- Full suite: `cd frontend; npm test` (jsdom startup is slow; that is normal).
- Pure helpers (Node, fast): **`npm run test:unit`** — runs `*.node.test.js` (e.g. `statementHelpers`, `journalVoucherHelpers`) without jsdom.

## Paths and shells

- Prefer **`;`** between commands in PowerShell, not `&&` (older Windows PowerShell).
- Repository scripts assume **UTF-8**; avoid mixing encodings when editing generated JSON (e.g. ERP access matrix).

## Local gate parity with GitHub Actions

- **Node:** CI uses **Node 24** (`.github/workflows/ci.yml`). Match it locally via **`.nvmrc`**, **nvm-windows**, **fnm**, or **Volta** so ESLint and tests resolve the same as on `ubuntu-latest`.
- **Root `npm run lint`:** Covers workspace guardrails, strict ERP/API ESLint, repo-wide React hook order, **FinanceTab** / **OperationsTab**, and the **extended-tabs** slice (`package.json` → `lint:eslint:extended-tabs`). It does **not** substitute backend Jest, frontend Vitest, or mobile typecheck.
- **One-shot local check:** From the repo root, after `npm ci` in root, `backend/`, and `mobile/`, run **`npm run check:ci-parity`** (see **`docs/TESTING.md`**) for lint + `sync:erp-access` + mobile typecheck + backend **`test:fast`**.
- **Mongo / Jest:** If **`mongodb-memory-server`** fails on Windows, install the **VC++ x64 redist** or set **`MONGO_TEST_URI`** to a real MongoDB (see sections above).
