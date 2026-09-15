# Atlas projects (ops-dashboard)

## Expected projects (one per tenant)

| Atlas project name | Tenant key | Cluster host marker |
|--------------------|------------|---------------------|
| **MG** | `mg` | `m5yqfs7.mongodb.net` |
| **CG** | `cg` | `karzgcd.mongodb.net` |
| **LoopC** | `loopc` | `fiijdd5.mongodb.net` |
| **Venus Bullion** | `vb` | `fiotefu.mongodb.net` |

App wiring: `MONGO_URI_MG` / `_CG` / `_LOOPC` / `_VB` and staging `STAGING_MONGO_URI_*`.  
Backup drills: `ATLAS_GROUP_ID_MG` / `_CG` / `_LOOPC` / `_VB` (see [MONGODB-BACKUPS-AND-DATA-SAFETY.md](./MONGODB-BACKUPS-AND-DATA-SAFETY.md)).

Do **not** put production tenant data in any other Atlas project.

## What is “Project 0”?

**Project 0** is Atlas’s **default project name** created with the organization if nobody renamed it. It is **not** an ops-dashboard tenant.

- Atlas **cannot merge** projects. Unused default projects should be **deleted**, not merged.
- This repo never references Project 0.

## Verify before delete

1. Atlas UI → open **Project 0** only.
2. **Database → Clusters** — empty, or only unused/test clusters.
3. If a cluster exists: **Browse Collections** — no live `ops-dashboard` / users / transactions you still need.
4. **Connect** hostname must **not** be required by Railway `MONGO_URI_*` (those should already point at MG/CG/LoopC/Venus hosts above).
5. **Project Settings → General → Project ID** — must **not** equal any `ATLAS_GROUP_ID_MG/CG/LOOPC/VB`.

Local / CI audit (fingerprints URIs; lists projects when Atlas API keys exist):

```bash
npm run atlas:project0:audit
```

## Safe remove (UI)

1. In **Project 0**, terminate every cluster.
2. **Organization → Projects → Project 0 → Delete Project** (type the name to confirm).
3. Leave **MG / CG / LoopC / Venus Bullion** untouched.

## Safe remove (API, optional)

Requires `ATLAS_PUBLIC_KEY` + `ATLAS_PRIVATE_KEY` in `backend/.env` (org/project access). Never point keys at production delete for tenant projects.

```bash
# Inspect
npm run atlas:project0:audit

# After UI confirm Project 0 is unused — terminate leftover clusters then delete project
npm run atlas:project0:audit -- --apply-delete --terminate-clusters
# Wait until clusters are gone, then:
npm run atlas:project0:audit -- --apply-delete
```

The script **refuses** to delete if Project 0’s id matches a configured `ATLAS_GROUP_ID_*`, or if URIs point at unknown hosts.
