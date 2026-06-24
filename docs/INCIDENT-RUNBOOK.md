# Incident runbook (one page)

Use this when **the app is down**, **auth/chat/API fails**, or **deploys look wrong**.

## 1. Confirm what is running

| Check | URL / place | What “good” looks like |
|--------|-------------|-------------------------|
| API liveness | `GET https://<your-api-host>/api/health` | JSON `success: true`, `commit` / `build.commit` matches the Git SHA you expect from GitHub `main` |
| API readiness | `GET https://<your-api-host>/api/ready` | `200` when DB and dependencies are ready; `503` if Mongo or another dependency is down |
| Frontend | Open each tenant portal (mg / cg / loopc) | Login page or dashboard loads; no blank white screen |
| Mobile (EAS) | [expo.dev](https://expo.dev) → project → **Builds** / **Updates** | Latest build green; preview channel shows recent commit |

**Railway:** Service → **Deployments** → logs for the active deployment.  
**Vercel:** Project → **Deployments** → build log and **Functions** / edge errors if applicable.

## 2. Fast triage order

1. **Is the backend up?** `/api/health` — if no response, Railway/crash/DNS.
2. **Does health commit match Git?** If not, wrong deploy or stale `BACKEND_BUILD_OVERRIDE_*` (see [README](../README.md)).
3. **CORS / cookies / CSRF?** Browser console: failed requests to API, `CSRF validation failed`, `CORS` — check `CLIENT_URL` / `CLIENT_URLS` on Railway match the exact Vercel preview or production origin.
4. **Tenant / DB?** `/api/ready` 503 — Mongo URI env vars (`MONGO_URI_*`), IP allowlist on Atlas, `DNS_SERVERS` if SRV resolution fails (see [backend/server.js](../backend/server.js)).
5. **Mobile only?** Confirm `EXPO_PUBLIC_API_URL` in EAS env matches Railway API; force-quit app after OTA; iOS needs valid credentials/build for device installs.

## 3. Rollback

- **Railway:** Redeploy previous **successful** deployment from the service history.
- **Vercel:** Promote or redeploy a prior **Ready** deployment.
- **Git:** Revert the bad commit on `main` and push (triggers both platforms if connected).

## 4. After recovery

- Note **time**, **symptom**, **commit SHA**, **fix** in your team channel or ticket.
- If you use **Sentry** (optional): open the issue, link the release/commit. See [OBSERVABILITY-SENTRY.md](./OBSERVABILITY-SENTRY.md).

## 5. Related docs

- [DEPLOYMENT-CHECKLIST.md](../DEPLOYMENT-CHECKLIST.md) — full provisioning
- [docs/DEPLOY.md](./DEPLOY.md) — deploy flow, CI, smoke
- [docs/OBSERVABILITY-AND-DEPLOYS.md](./OBSERVABILITY-AND-DEPLOYS.md) — health, logs
- [docs/STAGING-ENVIRONMENT.md](./STAGING-ENVIRONMENT.md) — staging parity (catch issues before prod)
- [ENV-VARS-QUICK-REFERENCE.md](../ENV-VARS-QUICK-REFERENCE.md) — variable names
