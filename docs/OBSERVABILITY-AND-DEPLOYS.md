# Observability and deploys

This repo is split into a **Node/Express API** (`backend/`) and a **React frontend** (`frontend/`). Production typically uses **Railway** for the API and **Vercel** for the static SPA, both triggered from the same Git repository.

## Deploy flow (recommended)

1. Merge or push to **`main`** on GitHub.
2. **Vercel** rebuilds the frontend from the connected project (root or `frontend/` per project settings).
3. **Railway** redeploys the backend service from source (or use `railway redeploy --from-source` from the CLI if you manage deploys manually).

The commit SHA shown in each provider’s build log should match the revision you intend to ship. After margin or metal-balance fixes, confirm both services picked up the same SHA.

## Logs and health

- **API:** Express uses **morgan** for HTTP access logs in development; in production, rely on Railway (or your host) log streams for request paths, status codes, and latency.
- **Health:** The API exposes **`/api/health`** for load balancers and Railway health checks (see `backend/server.js` startup validation).
- **Env validation:** Missing `JWT_SECRET` or tenant Mongo URIs log **warnings** at startup rather than exiting, so `/api/health` can still respond during partial misconfiguration.

## ERP-specific stability

- **Metal / margin policy** is centralized in `backend/services/erpAccounting/metalMarginPolicy.js` with Jest coverage in `backend/tests/metalMarginPolicy.test.js`. When changing supplier AP, creditor enquiry, or dashboard margin behaviour, update that module and extend the tests.

## Vercel project link

If `vercel link` fails with “Could not retrieve Project Settings”, the GitHub integration is still authoritative: ensure the Git repo is connected in the Vercel dashboard and deploy from **`main`**. Local `.vercel` is optional for previews; production deploys do not require a working local link.

## Related docs

- `DEPLOYMENT.md` — broader deployment checklist.
- `ENV-VARS-QUICK-REFERENCE.md` — environment variables for API and metals feeds.
