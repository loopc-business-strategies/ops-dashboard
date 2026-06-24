# Observability

Deploy flow and CI are documented in **[DEPLOY.md](./DEPLOY.md)**. This page covers **runtime visibility** after a deploy.

## Health endpoints

| Route | Use |
|-------|-----|
| `GET /api/health` | Liveness — process up |
| `GET /api/ready` | Readiness — JWT secret, Mongo per tenant, push integration flags |

Railway should use `/api/health` or `/api/ready` for health checks. Startup logs **warnings** (not exit) when env is partial so health can still respond during misconfiguration.

## Logs

- **API:** Morgan access logs in development; in production use **Railway** log stream (paths, status, latency).
- **Web:** **Vercel** deployment and function logs.
- After shipping, confirm Vercel and Railway build logs show the **same commit SHA** as `main`.

## ERP stability

Metal / margin policy lives in `backend/services/erpAccounting/metalMarginPolicy.js` with tests in `backend/tests/metalMarginPolicy.test.js`. Change policy there when adjusting supplier AP, creditor enquiry, or dashboard margin behaviour.

## Optional error tracking

[Sentry setup](./OBSERVABILITY-SENTRY.md) — backend, web, Expo. Not required for deploy; enable when you want release-tagged errors.

## Related

- [INCIDENT-RUNBOOK.md](./INCIDENT-RUNBOOK.md) — outage triage
- [MONGODB-BACKUPS-AND-DATA-SAFETY.md](./MONGODB-BACKUPS-AND-DATA-SAFETY.md) — backups
- [ENV-VARS-QUICK-REFERENCE.md](../ENV-VARS-QUICK-REFERENCE.md) — configuration
