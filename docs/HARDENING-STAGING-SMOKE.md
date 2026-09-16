# Staging smoke runbook — PR #62 hardening

Use after [PR #62](https://github.com/loopc-business-strategies/ops-dashboard/pull/62) is on the environment under test (Vercel preview from the PR branch, or staging/`main` after merge). Staging layout: [STAGING-ENVIRONMENT.md](./STAGING-ENVIRONMENT.md). Secrets: [SMOKE-SECRETS-CHECKLIST.md](./SMOKE-SECRETS-CHECKLIST.md).

**Do not** point these checks at production write paths. **Do not** run `migrate:apply` on production without Atlas backup + tokens.

---

## Verification log (engineering)

| Date | Check | Result |
|------|--------|--------|
| 2026-09-16 | Staging API `/api/health` SHA | Matches `main` (`fd467bec`) |
| 2026-09-16 | Demo seed tabs (`VITE_ENABLE_SEED_DATA`) | **N/A** — flag removed; PCC demo only via `VITE_ENABLE_PRODUCTION_DEMO` |
| 2026-09-16 | Dashboard Production tab | Redirects to `/production` (PCC) |
| 2026-09-16 | **Staging Smoke** workflow | **Passed** — [run 35034340011](https://github.com/loopc-business-strategies/ops-dashboard/actions/runs/35034340011) (mg/cg/loopc/vb) |

Remaining rows below are **manual browser UI** (voucher lock, PCC metal). Automated staging smoke covers API/auth/ERP probes.

---

## 0. Preflight

- [x] App URL is staging or PR preview (not production hostname). *(ops: use staging Railway + Vercel preview)*
- [x] API URL matches that env (`VITE_API_*` → staging Railway).
- [x] Tab seed / fake business data is **off** (code purge; do not set `VITE_ENABLE_PRODUCTION_DEMO=true` on staging/prod unless intentionally demoing).
- [x] Operations / Overview use live APIs with empty states (no DEMO MODE unless PCC demo flag on).
- [ ] Signed in as finance user + a Super Admin (for lock vs unlock checks).

---

## 1. Voucher — Create → Draft → Submit (auto-post)

- [ ] Create a voucher; **Save Draft** → status stays draft; no GL movement.
- [ ] **Submit** → status becomes `posted`; ledger (and inventory for metal purchase/sale) updates.
- [ ] As non–Super Admin finance user, **edit/PUT** after submit → `VOUCHER_SUBMITTED_LOCKED` (or UI blocks edit).
- [ ] Super Admin can still unlock/override per existing policy (if applicable).
- [ ] UI shows **no Approve** step; **Post** appears only for leftover `submitted`/`approved` backlog rows.

---

## 2. ERP — Backlog Post (legacy submitted/approved only)

- [ ] Open ERP Transactions for any leftover `submitted`/`approved` voucher.
- [ ] **Post** (single click; auto-approves if submitted) succeeds and posts to the single GL.
- [ ] Confirm AR/AP outstanding reflects posted amounts where expected.

---

## 3. Production Control Center (PCC)

- [ ] **Stock:** partial select from a lot creates a **remainder** lot; genealogy / parent link present.
- [ ] **Split:** split weights sum to source; both children visible.
- [ ] **Merge:** merge preserves genealogy; resulting weight/status sensible.
- [ ] **Maintenance:** create WO → complete (or schedule); overdue path raises/shows alert if due date past.
- [ ] Demo session: mutations still blocked / DEMO messaging when demo mode is on (`VITE_ENABLE_PRODUCTION_DEMO=true` only).

---

## 4. Overview — command center UI

- [ ] **Global Search** opens and returns permission-filtered hits for a known customer/batch/employee.
- [ ] **Owner Exceptions** opens and lists exceptions (or empty state without error).

---

## 5. API smoke (no auth UI)

- [ ] `GET /api/search?q=…` → 200, shaped results (or 401 without token).
- [ ] `GET /api/exceptions` → 200 (or 401).
- [ ] `GET /api/hardware/contract` → 200, contract/docs shape (no fake device required).
- [ ] Optional: `GET /api/customer-360?…`, `POST /api/scan/resolve` with a known barcode if data exists.

---

## 6. Migration safety (staging only)

- [ ] Atlas backup (or snapshot) of the **staging** cluster before any migrate apply.
- [ ] Migration **dry-run / validate-only** succeeds.
- [ ] `migrate:apply` only with backup confirmation + `MIGRATION_CONFIRM_TOKEN` on **staging** — never blind production apply from this checklist.
