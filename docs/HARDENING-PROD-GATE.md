# Production gate — hardening after PR #62

Staging is complete for **mg / cg / loopc** indexes (006–008). This checklist is the **production** last gate.

## What production migrate cannot do via CI

The migration runner **refuses production Mongo targets** (`assertMigrationApplyAllowed`). That is intentional so a workflow cannot wipe or mutate live tenant DBs.

Production indexes are therefore **ops-owned**: Atlas backup → reviewed apply from a secured staging-validated procedure → short smoke. Do **not** set production URIs into `STAGING_MONGO_URI_*`.

## Before production deploy confirmation

- [ ] Staging UI smoke done ([HARDENING-STAGING-SMOKE.md](./HARDENING-STAGING-SMOKE.md))
- [ ] Staging indexes applied for mg/cg/loopc (done) and VB path reviewed (001–002 + 004–008; **003 deferred**)
- [ ] Atlas **production** backup / snapshot for each tenant cluster (or confirmed continuous cloud backup)
- [ ] `VITE_ENABLE_SEED_DATA` off on production frontend
- [ ] Railway/Vercel production deploy on `main` includes hardening commit

## Production smoke (read-heavy first)

- [ ] `/api/health` OK; build SHA matches `main`
- [ ] Login + Overview Global Search + Owner Exceptions (no 500s)
- [ ] Voucher draft → submit (no auto-post); ERP approve → post on a **test** voucher if policy allows
- [ ] PCC remainder/split/merge/maintenance only on agreed test metal — or skip live metal until scheduled window

## Production index sync (ops)

Only after Atlas backup, using **production** URIs in a **manual** secured session (not GitHub Actions staging workflow):

1. Dry-run pending migrations per tenant.
2. Apply **only** additive index migrations already proven on staging (`006`/`007`/`008`, and `004`/`005` if pending).
3. **Do not** run `003-backfill-jv-ledger-base-to-fc` on production without a dedicated JV FX review.

## VB note

Staging VB may have `003` **record-skipped** (deferred). Production VB must get the same review before any JV backfill.
