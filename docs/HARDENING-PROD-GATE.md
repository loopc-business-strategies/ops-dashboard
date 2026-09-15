# Production gate — hardening after PR #62

Staging is complete for **mg / cg / loopc** indexes (006–008). This checklist is the **production** last gate.

## What production migrate cannot do via CI

The migration runner **refuses production Mongo targets** (`assertMigrationApplyAllowed`). That is intentional so a workflow cannot wipe or mutate live tenant DBs.

Production indexes are therefore **ops-owned**: Atlas backup → reviewed apply from a secured staging-validated procedure → short smoke. Do **not** set production URIs into `STAGING_MONGO_URI_*`.

## Verification log (engineering — 2026-09-16)

| Check | Result |
|-------|--------|
| `/api/health` + `/api/ready` on prod | OK; Redis; SHA `fd467bec` |
| Tab seed / `VITE_ENABLE_SEED_DATA` | Removed; PCC demo only via `VITE_ENABLE_PRODUCTION_DEMO` (unset in prod) |
| Dashboard `production` tab | Redirects to PCC (`/production`) |
| VB migrations | See **VB index strategy** below |
| **Post-Deploy Tenant Smoke** | **Passed** — [run 35034342762](https://github.com/loopc-business-strategies/ops-dashboard/actions/runs/35034342762) |
| **Staging Smoke** | **Passed** — [run 35034340011](https://github.com/loopc-business-strategies/ops-dashboard/actions/runs/35034340011) |
| Upload volumes | Prod + staging `uploadVolumeAligned=true` |
| Weekly mongodump | **Passed** (GH artifacts) — [run 35034375429](https://github.com/loopc-business-strategies/ops-dashboard/actions/runs/35034375429); S3/R2 not configured yet |
| Mongo Backup Drill | **Passed** (deferred phase) — [run 35034377877](https://github.com/loopc-business-strategies/ops-dashboard/actions/runs/35034377877) |

Manual browser rows (voucher UI lock, PCC live metal) remain for a finance operator.

## Before production deploy confirmation

- [x] Staging indexes applied for mg/cg/loopc (done) and VB path reviewed (001–002 + 005–008; **003 deferred**; **004 record-skipped** — see below)
- [x] Tab demo seed off on production frontend (code purge; do not enable `VITE_ENABLE_PRODUCTION_DEMO` in prod)
- [x] Railway/Vercel production deploy tracks `main`
- [x] Staging automated smoke done (workflow); manual voucher/PCC UI rows still open in [HARDENING-STAGING-SMOKE.md](./HARDENING-STAGING-SMOKE.md)
- [x] Interim weekly mongodump enabled (`MONGO_BACKUP_ENABLED=true`); Atlas strict + S3/R2 still pending (see [CRITICAL-FIXES-CHECKLIST.md](./CRITICAL-FIXES-CHECKLIST.md) #3)

## Production smoke (read-heavy first)

- [x] `/api/health` OK; build SHA matches `main` (re-check after each deploy)
- [x] Authenticated tenant smoke (Post-Deploy) green for mg/cg/loopc/vb
- [ ] Login + Overview Global Search + Owner Exceptions in browser (no 500s)
- [ ] Voucher draft → submit (no auto-post); ERP approve → post on a **test** voucher if policy allows
- [ ] PCC remainder/split/merge/maintenance only on agreed test metal — or skip live metal until scheduled window

## Production index sync (ops)

Only after Atlas backup, using **production** URIs in a **manual** secured session (not GitHub Actions staging workflow):

1. Dry-run pending migrations per tenant.
2. Apply **only** additive index migrations already proven on staging (`006`/`007`/`008`, and `005` if pending).
3. **Do not** run `003-backfill-jv-ledger-base-to-fc` on production without a dedicated JV FX review.
4. **Do not** re-run full `004-sync-mongoose-indexes` on VB until the voucher partial-index definition is Atlas-compatible (see below).

## VB index strategy (decision 2026-09-16)

Staging VB:
- Applied `001`–`002`, then `005`–`008`.
- **Record-skipped** `003` (JV FX backfill — deferred on purpose; leave skipped unless finance requests FX review).
- **Record-skipped** `004` (`syncIndexes` failed on unsupported voucher partial index `$ne` / `$not` on this cluster).

**Chosen path:** keep `004` skipped. Hardening performance indexes from `006`–`008` remain the required set. Optional follow-up (not blocking): rewrite the failing voucher partial index to an Atlas-supported filter expression, then dry-run `004` on staging VB only.

Production VB must get the same review before any JV backfill (`003`) or full `004` sync.
