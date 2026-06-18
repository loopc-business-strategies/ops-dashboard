# MongoDB backups and task data safety

This document is a **checklist** for operators. The app does not configure backups for you; your hosting provider or DBA owns that process.

## Why backups matter

- **Hardware or human mistakes** (bad script, accidental `dropDatabase`) are only recoverable with a backup or point-in-time restore.
- Task automation in this repo **does not delete** task documents: it may set `archivedAt`, `isDeleted` (soft delete), or append comments. Those rows usually remain in Mongo until you explicitly clean them or restore from backup.

## MongoDB Atlas

1. In your Atlas project → **Backup** (or **Cloud Backup**).
2. Enable **continuous cloud backup** (or snapshot schedule) for the cluster that backs this app.
3. Confirm **retention** (e.g. 7–30 days) meets compliance needs.
4. Document **who can trigger a restore** and how (support ticket vs self-service).
5. Optionally enable **Point-in-Time Recovery** if your tier supports it.

## Railway (or other PaaS) with a managed Mongo add-on

1. Open the **MongoDB service** (or linked Atlas) in the provider dashboard.
2. Find **Backups / Snapshots** and confirm they are **enabled** and **scheduled**.
3. If Mongo runs as a **Railway volume** without managed backups, treat that as **high risk**: move to Atlas or add external backup (e.g. `mongodump` cron to object storage with encryption).

## Self-hosted MongoDB

- Use **filesystem snapshots** or **`mongodump` / `mongorestore`** on a schedule.
- Store dumps **off-server** (S3-compatible bucket, separate region).
- Test a **restore drill** at least once per quarter.

## Task-specific automation (env)

- **`TASK_RULES_JOB`**: defaults to **off** in code until you set `TASK_RULES_JOB=true`. When on, background rules may set `archivedAt` after a delay when a task is marked done/cancelled, and may send “due soon” messages. Disabling the job does not remove existing data.
- See [`ENV-VARS-QUICK-REFERENCE.md`](../ENV-VARS-QUICK-REFERENCE.md) and [`backend/.env.example`](../backend/.env.example) for all task-related variables.

## In-app recovery

- **Archived** items: use **Show archived** on Operations **Projects**, open the item, and use **Unarchive** (clears `archivedAt` via the normal task update API).
- **Soft-deleted** tasks: still in the database with `isDeleted: true`; recovery requires DB access or a future admin tool—backups remain the safety net.

## Restore verification checklist (operators)

Complete once per quarter (or after any cluster migration):

- [ ] **Atlas / provider dashboard:** Continuous backup or snapshot schedule is **enabled** for every tenant cluster (`MONGO_URI`, `MONGO_URI_MG`, `MONGO_URI_CG`, `MONGO_URI_LOOPC`).
- [ ] **Retention** documented (minimum 7 days; adjust for compliance).
- [ ] **Restore drill:** Restore a snapshot to a **non-production** cluster or namespace; confirm the app can connect and read at least one known document per tenant.
- [ ] **Runbook:** Name who can approve restore and expected RTO/RPO.
- [ ] **Destructive scripts:** Confirm [`backend/scripts/destructive/_destructive-guard.js`](../backend/scripts/destructive/_destructive-guard.js) gates are understood before any `--apply` run in production.

## Related docs

- [`DEPLOYMENT-CHECKLIST.md`](../DEPLOYMENT-CHECKLIST.md)
- [`docs/OBSERVABILITY-AND-DEPLOYS.md`](OBSERVABILITY-AND-DEPLOYS.md)
