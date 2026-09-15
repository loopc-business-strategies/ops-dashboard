# Staging smoke runbook — PR #62 hardening

Use after [PR #62](https://github.com/loopc-business-strategies/ops-dashboard/pull/62) is on the environment under test (Vercel preview from the PR branch, or staging/`main` after merge). Staging layout: [STAGING-ENVIRONMENT.md](./STAGING-ENVIRONMENT.md). Secrets: [SMOKE-SECRETS-CHECKLIST.md](./SMOKE-SECRETS-CHECKLIST.md).

**Do not** point these checks at production write paths. **Do not** run `migrate:apply` on production without Atlas backup + tokens.

---

## 0. Preflight

- [ ] App URL is staging or PR preview (not production hostname).
- [ ] API URL matches that env (`VITE_API_*` → staging Railway).
- [ ] `VITE_ENABLE_SEED_DATA` is **off** on staging/prod builds.
- [ ] Operations shows **DEMO MODE** only when seed is intentionally on; otherwise live paths.
- [ ] Signed in as finance user + a Super Admin (for lock vs unlock checks).

---

## 1. Voucher — Create → Draft → Submit (no auto-post)

- [ ] Create a voucher; **Save Draft** → status stays draft; no GL movement.
- [ ] **Submit** → status becomes `submitted` (or equivalent); **no** ledger post / no auto-approve.
- [ ] As non–Super Admin finance user, **edit/PUT** after submit → `VOUCHER_SUBMITTED_LOCKED` (or UI blocks edit).
- [ ] Super Admin can still unlock/override per existing policy (if applicable).

---

## 2. ERP — Approve → Post still works

- [ ] Open ERP Transactions for the submitted voucher.
- [ ] **Approve** then **Post** succeeds and posts to the single GL.
- [ ] Confirm AR/AP outstanding reflects posted amounts where expected.

---

## 3. Production Control Center (PCC)

- [ ] **Stock:** partial select from a lot creates a **remainder** lot; genealogy / parent link present.
- [ ] **Split:** split weights sum to source; both children visible.
- [ ] **Merge:** merge preserves genealogy; resulting weight/status sensible.
- [ ] **Maintenance:** create WO → complete (or schedule); overdue path raises/shows alert if due date past.
- [ ] Demo session: mutations still blocked / DEMO messaging when demo mode is on.

---

## 4. Overview — command center UI

- [ ] **Global Search** opens and returns permission-filtered hits for a known customer/batch/employee.
- [ ] **Owner Exceptions** opens and lists exceptions (or empty state without error).

---

## 5. Authenticated API smoke

Use a valid staging JWT (browser session cookie/token or `Authorization` header).

- [ ] `GET /api/search?q=…` → 200, shaped results.
- [ ] `GET /api/exceptions` → 200.
- [ ] `GET /api/hardware/contract` → 200, contract/docs shape (no fake device required).
- [ ] Optional: `GET /api/customer-360?…`, `POST /api/scan/resolve` with a known barcode if data exists.

---

## 6. Data safety (staging DB only)

- [ ] Atlas backup (or snapshot) of the **staging** cluster before any migrate apply.
- [ ] Migration **dry-run / validate-only** succeeds.
- [ ] `migrate:apply` only with backup confirmation + `MIGRATION_CONFIRM_TOKEN` on **staging** — never blind production apply from this checklist.

---

## Pass / fail

| Area | Pass criteria |
|------|----------------|
| Voucher | Submit ≠ post; lock after submit for finance |
| ERP | Approve → post still works |
| PCC | Remainder / split / merge / maintenance WO |
| Overview | Search + exceptions usable |
| APIs | search / exceptions / hardware contract 200 |
| Env | Seed off; no prod writes |

**Related:** [HARDENING-IMPLEMENTATION-REPORT.md](./HARDENING-IMPLEMENTATION-REPORT.md), [HARDENING-GAP-CHECKLIST.md](./HARDENING-GAP-CHECKLIST.md), [HARDWARE-EDGE-GATEWAY.md](./HARDWARE-EDGE-GATEWAY.md).
