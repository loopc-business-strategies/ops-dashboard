# Ad-hoc ops scripts

These Node scripts were consolidated from the **repository root** so the top level stays focused on the workspace (`package.json`, `frontend/`, `backend/`, etc.).

They are **not** part of the production app, CI guardrails, or `npm run` workflows unless documented elsewhere. Review each file before running: many hit live APIs or contain tenant-specific assumptions.

## Running

From the repo root:

```bash
node scripts/ops-misc/verify-deployment.js
```

Set `DOMAIN` or other env vars as described in each script’s header comments.

## Contents (overview)

| Script | Purpose (high level) |
|--------|----------------------|
| `verify-deployment.js` | Probe mg/cg/loopc subdomains and API health |
| `check-login.js` | Quick login probe against configured API |
| `check-mg-coa.js`, `check-mg-entries-direct.js` | MG chart-of-accounts / entries checks |
| `deep-cleanup-mg.js`, `deep-cleanup-mg-fixed.js`, `deep-mongo-cleanup-mg.js`, `authenticated-cleanup-mg.js` | Destructive or authenticated cleanup utilities — **read before use** |
| `final-verify.js`, `verify-mg-cleanup.js` | Verification helpers after cleanup |
| `inspect-sale-mapping.js` | Sale mapping inspection |
| `test-queries.js` | Ad-hoc query experiments |

For maintained backend maintenance scripts, see `backend/scripts/README.md`.
