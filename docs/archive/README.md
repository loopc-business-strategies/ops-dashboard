# Do not use for current ops

Markdown files in this folder are **historical snapshots** only — phase reports, one-off fix notes, completion banners, and cleanup guides from past work. They may describe features, commands, or timelines that no longer match the codebase.

Search tools and AI assistants can surface these files alongside current docs. **Do not follow them for deploy, incident response, or day-to-day development.** Each archived `.md` file starts with an **ARCHIVED** banner linking back to canonical docs.

## Current sources of truth

| Doc | Use |
|-----|-----|
| [README.md](../../README.md) | How to run and test the app |
| [docs/DEPLOY.md](../DEPLOY.md) | Deploys, CI, smoke, rollback |
| [docs/TESTING.md](../TESTING.md) | Local and CI test commands |
| [docs/ERP-API-GUIDE.md](../ERP-API-GUIDE.md) | ERP API surface |
| [DEPLOYMENT-CHECKLIST.md](../../DEPLOYMENT-CHECKLIST.md) | First-time production setup only |
| [docs/OBSERVABILITY-AND-DEPLOYS.md](../OBSERVABILITY-AND-DEPLOYS.md) | Health and logs |
| [ENV-VARS-QUICK-REFERENCE.md](../../ENV-VARS-QUICK-REFERENCE.md) | Configuration |

When updating behaviour, change code and the docs above — not archived files.

Re-stamp banners after adding new archive files: `node scripts/stamp-archive-banners.mjs`

---

## Index by category

### ERP phase reports and analysis

| File | Note |
|------|------|
| `PROJECT-ANALYSIS.md` | Legacy full-project analysis (April 2026) |
| `ERP-ANALYSIS-AND-RECOMMENDATIONS.md` | Legacy ERP recommendations |
| `ERP-ALL-FEATURES-COMPLETE.md` | Historical completion claim |
| `ERP-PHASE1-COMPLETION-REPORT.md` | Historical phase report |

### One-off fixes and verification

| File | Note |
|------|------|
| `BANK-JV-FIXES-APPLIED.md` | Bank journal voucher fix notes |
| `EXCHANGE-FIX-SUMMARY.md` | Exchange cleanup summary |
| `EXCHANGE-CLEANUP-GUIDE.md` | Exchange cleanup guide |
| `FINAL-MG-VERIFICATION.md` | MG verification snapshot |
| `FIXED-UNFIXED-IMPLEMENTATION.md` | Fixing register implementation notes |
| `MULTI-LINE-VOUCHER-FIX-SUMMARY.md` | Multi-line voucher fix |
| `MULTI-LINE-VOUCHER-FX-FIX.md` | Voucher FX fix |
| `VOUCHER-VERIFICATION-REPORT.md` | Voucher verification report |

### Cleanup and data guides

| File | Note |
|------|------|
| `CLEAN-NOW-GUIDE.md` | One-off cleanup guide |
| `CLEANUP-MANUAL-GUIDE.md` | Manual cleanup guide |
| `MG-CLEANUP-COMPLETE.md` | MG cleanup completion |
| `MONGODB-CLEANUP-QUERY.md` | Mongo cleanup queries |

### Deploy and infrastructure snapshots

| File | Note |
|------|------|
| `DEPLOYMENT-STATUS-20260511.md` | Deployment status snapshot |
| `DEPLOYMENT-SUMMARY.md` | Deployment summary |
| `PRODUCTION-HARDENING-SUMMARY.md` | Hardening summary |
| `REALTIME-CURSOR-ROLLOUT.md` | Realtime rollout notes |
| `force-redeploy.md` | Browser cache / redeploy notes |
| `IMPROVEMENTS-PERFORMANCE-AND-SCALABILITY.md` | Performance notes |

### Non-documentation artifacts

| Path | Note |
|------|------|
| `backend-routes/erp-accounting.js.bak` | Code backup only — not documentation; do not restore without review |
