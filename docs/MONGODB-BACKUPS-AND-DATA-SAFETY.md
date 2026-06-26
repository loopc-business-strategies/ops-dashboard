# MongoDB backups and task data safety

Operator checklist for **Atlas backups**, **restore drills**, and **upload persistence** on Railway.

**Last reviewed:** 2026-06-26

## RTO / RPO targets

| Metric | Target | Notes |
|--------|--------|-------|
| **RPO** (max data loss) | **≤ 24 hours** | Atlas continuous backup or daily snapshots; enable PITR if tier allows |
| **RTO** (time to restore service) | **≤ 4 hours** | Restore snapshot to replacement cluster + update `MONGO_URI_*` + redeploy API |

Document actual restore times in your ops log after each quarterly drill.

## Why backups matter

- **Hardware or human mistakes** (bad script, accidental `dropDatabase`) are only recoverable with a backup or point-in-time restore.
- Task automation in this repo **does not delete** task documents: it may set `archivedAt`, `isDeleted` (soft delete), or append comments. Those rows usually remain in Mongo until you explicitly clean them or restore from backup.

## Phased rollout (connect now, Atlas subscription later)

| Phase | When | What runs | GitHub |
|-------|------|-----------|--------|
| **1 — Deferred** (now) | Before Atlas M10+ | Upload storage + Mongo connectivity via `/api/ready` | `ATLAS_BACKUP_PHASE=deferred` (default) |
| **2 — Interim dumps** (optional) | When S3 secrets ready | Weekly `mongodump` → S3/R2 | `MONGO_BACKUP_ENABLED=true` |
| **3 — Strict** | After Atlas Cloud Backup on all projects | Atlas API schedule + snapshot checks | `ATLAS_BACKUP_PHASE=strict` |

### GitHub Actions variables

| Variable | Value now | After Atlas M10+ |
|----------|-----------|------------------|
| `ATLAS_BACKUP_PHASE` | `deferred` | `strict` |
| `MONGO_BACKUP_ENABLED` | `false` (or unset) | `true` when S3 secrets set |

Workflows: [mongo-backup-drill.yml](../.github/workflows/mongo-backup-drill.yml) (quarterly), [mongo-backup-mongodump.yml](../.github/workflows/mongo-backup-mongodump.yml) (weekly, gated).

### GitHub secrets (optional)

**Phase 1 strict / API checks (later):** `ATLAS_PUBLIC_KEY`, `ATLAS_PRIVATE_KEY`, `ATLAS_GROUP_ID_MG`, `ATLAS_GROUP_ID_CG`, `ATLAS_GROUP_ID_LOOPC`

**Phase 2 mongodump:** `MONGO_URI_MG`, `MONGO_URI_CG`, `MONGO_URI_LOOPC`, `BACKUP_S3_ENDPOINT`, `BACKUP_S3_BUCKET`, `BACKUP_S3_ACCESS_KEY`, `BACKUP_S3_SECRET_KEY`

Local:

```bash
npm run drill:atlas-backup-plan                    # phase=deferred by default
ATLAS_BACKUP_PHASE=strict npm run drill:atlas-backup-plan -- --strict-backup
npm run backup:mongodump:dry-run                     # check env before enabling Phase 2
```

## MongoDB Atlas (production tenants)

Clusters: one per tenant (`MONGO_URI_MG`, `MONGO_URI_CG`, `MONGO_URI_LOOPC`).

1. Atlas project → **Backup** (or **Cloud Backup**).
2. Enable **continuous cloud backup** (or snapshot schedule) for **each** cluster.
3. Confirm **retention** (minimum **7 days**; adjust for compliance).
4. Optionally enable **Point-in-Time Recovery** if your tier supports it.
5. Document **who can trigger a restore** (see runbook below).

### If you see "Introducing Backups" (backups not enabled)

That landing page means **Cloud Backup is off** for `Cluster0` in that project. Production data is **not** covered by Atlas snapshots until you upgrade.

1. Project **MG** (then **CG**, **LoopC**) → **DATABASE** → **Backup**
2. Click **Upgrade cluster for continuous backups** (recommended) or **Upgrade cluster for daily backups**
3. Atlas will prompt you to change **Cluster0** tier — Cloud Backup requires **M10+** (not M0/M2/M5 free/shared tiers)
4. After upgrade, the Backup page should show **Snapshots**, **Backup Policy**, and recent snapshot dates
5. Set retention to at least **7 days** under **Backup Policy**

Repeat for all three projects. Then run:

```bash
npm run drill:atlas-backup-plan -- --strict-backup
```

(or set `ATLAS_UI_BACKUP_CONFIRMED=mg,cg,loopc` in `backend/.env` after confirming each project)


Automated CI only checks **connectivity** (`npm run verify:mongo-backup-drill`). A full restore still requires the Atlas dashboard once per quarter:

1. Pick the **oldest tenant** cluster (e.g. MG) and choose a snapshot from the last 7 days.
2. **Restore to a new cluster** (name e.g. `mg-restore-drill-YYYY-MM`) — never overwrite production.
3. Create a read-only DB user for the drill cluster.
4. Connect with `mongosh` or Compass; confirm at least one known document in `users`, `transactions`, or `ledgers`.
5. **Delete the drill cluster** when finished.
6. Record the drill:
   ```bash
   npm run verify:backup-checklist -- --record "Atlas MG snapshot restored to non-prod cluster; RTO estimate 2h"
   ```

## Automated drills (GitHub Actions)

| Workflow | Schedule | What it checks |
|----------|----------|----------------|
| [mongo-backup-drill.yml](../.github/workflows/mongo-backup-drill.yml) | 1st of Jan/Apr/Jul/Oct 09:00 UTC | `verify:upload-storage` + `drill:atlas-backup-plan` (deferred or strict) |
| [mongo-backup-mongodump.yml](../.github/workflows/mongo-backup-mongodump.yml) | Weekly Sun 03:00 UTC | `mongodump` to S3 when `MONGO_BACKUP_ENABLED=true` |

Manual run: **Actions → Mongo Backup Drill → Run workflow**.

Local:

```bash
npm run drill:atlas-backup-plan          # full plan: direct Mongo + Atlas API/UI + optional restore
npm run verify:atlas-backup-drill   # direct Mongo + Atlas backup/snapshot API (needs ATLAS_* keys)
npm run verify:mongo-backup-drill    # tenant connectivity (direct Mongo or /api/ready fallback)
npm run verify:upload-storage        # prod + staging UPLOAD_STORAGE_ROOT + volume
npm run verify:data-safety           # both checks
npm run verify:backup-checklist      # print checklist + record drill date
```

## Railway upload volume (persistent files)

Uploaded files (vouchers, bank slips, chat attachments) are stored on disk. Without a **persistent volume**, they are **lost on redeploy**.

### Required configuration (production + staging)

| Setting | Value |
|---------|--------|
| Railway volume | `ops-dashboard-volume` mounted at `/app/uploads` |
| `UPLOAD_STORAGE_ROOT` | `/app/uploads` |
| `CHAT_UPLOAD_DIR` | `/app/uploads/chat` (optional explicit) |

`railway.json` `startCommand` creates subdirectories and defaults `UPLOAD_STORAGE_ROOT` from `RAILWAY_VOLUME_MOUNT_PATH` when unset.

Verify after any Railway service change:

```bash
npm run verify:upload-storage
```

`/api/ready` reports `uploadStorageRootSet`, `uploadStorageWritable`, and `uploadVolumeAligned` under `checks`.

## Restore verification checklist (operators)

Complete once per quarter (or after any cluster migration):

- [ ] **Atlas / provider dashboard:** Continuous backup or snapshot schedule is **enabled** for every tenant cluster.
- [ ] **Retention** documented (minimum 7 days).
- [ ] **Connectivity drill:** `npm run verify:mongo-backup-drill` passes (or GitHub **Mongo Backup Drill** workflow green).
- [ ] **Restore drill:** Restore a snapshot to a **non-production** cluster; confirm at least one known document per tenant.
- [ ] **Upload volume:** `npm run verify:upload-storage` passes for production and staging.
- [ ] **Runbook:** Restore approver named; RTO/RPO recorded in ops log.
- [ ] **Destructive scripts:** Confirm [`backend/scripts/destructive/_destructive-guard.js`](../backend/scripts/destructive/_destructive-guard.js) gates before any `--apply` in production.

## Restore runbook (who / how)

| Step | Owner | Action |
|------|-------|--------|
| 1 | On-call / DBA | Confirm incident scope (one tenant vs all) |
| 2 | DBA | Atlas → restore snapshot or PITR to **new** cluster |
| 3 | Ops | Update `MONGO_URI_<TENANT>` on Railway production service |
| 4 | Ops | Redeploy API; run `npm run smoke:tenants` |
| 5 | Finance lead | Spot-check ERP ledger / recent vouchers |

## Task-specific automation (env)

- **`TASK_RULES_JOB`**: defaults to **off** until `TASK_RULES_JOB=true`. Disabling the job does not remove existing data.
- See [`ENV-VARS-QUICK-REFERENCE.md`](../ENV-VARS-QUICK-REFERENCE.md) and [`backend/.env.example`](../backend/.env.example).

## In-app recovery

- **Archived** items: **Show archived** on Operations **Projects** → **Unarchive**.
- **Soft-deleted** tasks: still in DB with `isDeleted: true`; recovery requires DB access or a future admin tool.

## Related docs

- [`DEPLOYMENT-CHECKLIST.md`](../DEPLOYMENT-CHECKLIST.md)
- [`docs/DEPLOY.md`](DEPLOY.md)
- [`docs/OBSERVABILITY-AND-DEPLOYS.md`](OBSERVABILITY-AND-DEPLOYS.md)
- [`docs/ops-log/README.md`](ops-log/README.md) — local drill log (gitignored)
