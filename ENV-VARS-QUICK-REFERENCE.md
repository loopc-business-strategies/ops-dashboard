# Quick Reference: Environment Variables

Copy these exact variable names and values into your platforms.

---

## Railway Backend — Environment Variables

**Location:** Railway Dashboard → Your Backend Service → Variables

### Required Variables

```
NODE_ENV=production
PORT=5000
DEFAULT_TENANT=loopc
JWT_SECRET=<GENERATE-A-RANDOM-STRING-32-CHARS-MIN>
SERVER_BASE_URL=https://api.loopcstrategies.com
```

`SERVER_BASE_URL` — absolute base for ERP attachment download URLs (no trailing slash). Warned in production if missing.

### Shared coordination (recommended for multi-instance Railway)

```
REDIS_URL=<railway-redis-private-url>
```

When set, report caches, report rate limits, notification digest dedupe, and realtime SSE fan-out use Redis instead of process-local memory. Without `REDIS_URL`, the backend falls back to local in-process coordination for single-instance deployments.

### CORS (frontend origins)

```
CLIENT_URLS=https://mg.loopcstrategies.com,https://cg.loopcstrategies.com,https://loopc.loopcstrategies.com,https://app.loopcstrategies.com,https://loopcstrategies.com
CLIENT_URL=https://mg.loopcstrategies.com,https://cg.loopcstrategies.com,https://loopc.loopcstrategies.com,https://loopcstrategies.com
```

Include **`https://app.loopcstrategies.com`** if that host is used ([vercel.json](vercel.json) API proxy). Both `CLIENT_URL` and `CLIENT_URLS` are merged in [backend/app.js](backend/app.js).

### Push notifications (mobile + web)

```
EXPO_ACCESS_TOKEN=<expo-access-token-for-nexa>
WEB_PUSH_PUBLIC_KEY=<vapid-public-key>
WEB_PUSH_PRIVATE_KEY=<vapid-private-key>
WEB_PUSH_SUBJECT=mailto:support@yourdomain.com
```

Verify on deploy: `GET /api/ready` → `integrations.expoPushAccessTokenSet` and `webPushVapidKeysSet`.

See [docs/RAILWAY_EXPO_PUSH.md](docs/RAILWAY_EXPO_PUSH.md) and [docs/PUSH-NOTIFICATIONS.md](docs/PUSH-NOTIFICATIONS.md).

**OpenAI:** paste `OPENAI_API_KEY` without trailing newlines (or run `node scripts/trim-railway-openai-key.mjs`).

### Persistent uploads (Railway volume)

Attach a **persistent volume** to the backend service (for example mount path `/app/uploads`), then set:

```
UPLOAD_STORAGE_ROOT=/app/uploads
```

The deploy `startCommand` creates `transactions`, `bank-slips`, `vendor-documents`, `crm-contacts`, and `task-attachments` under this root. Optional overrides per type: `TRANSACTION_UPLOAD_DIR`, `BANK_SLIP_UPLOAD_DIR`, `VENDOR_DOCUMENT_UPLOAD_DIR`, `CRM_CONTACT_UPLOAD_DIR` (see `backend/services/erpAccounting/uploadMiddleware.js`).

### Operations projects (optional jobs & webhooks)

```
# Reminder sweep (clears reminderAt, DM assignee + stored also-notify list); default on
# TASK_REMINDER_JOB=false

# Stale comment job (append system comment); default off — set true to enable
# TASK_STALE_COMMENT_JOB=true
# TASK_STALE_COMMENT_INTERVAL_MS=86400000
# TASK_STALE_MS=604800000         # ms; match UI: VITE_OPS_PROJECTS_STALE_DAYS × 86400000 (or legacy VITE_TASK_STALE_DAYS; default 7 days)
# TASK_STALE_COMMENT_TEXT=

# Outbound webhooks — URLs alone do nothing until explicitly enabled
# TASK_WEBHOOK_ENABLED=true
# TASK_WEBHOOK_URLS=https://example.com/hook
# TASK_WEBHOOK_SECRET=            # optional HMAC → X-Task-Signature; each POST includes unique webhookDeliveryId for consumer dedupe

# Task rules job (auto-archive done tasks after delay; due-soon DM + webhook within N hours of due) — default off; opt in:
# TASK_RULES_JOB=true
# TASK_RULES_INTERVAL_MS=600000
# TASK_RULE_AUTO_ARCHIVE_MS=604800000   # default 7d after status → done/cancelled
# TASK_DUE_PROXIMITY_HOURS=48
```

**⚠️ Generate secure JWT_SECRET:**
```bash
# On your local machine, run:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Then copy the output and paste as JWT_SECRET value.

### MongoDB Connection URIs

Get these from MongoDB Atlas → Your Cluster → Connect → Drivers → Connection String

```
MONGO_URI_MG=<YOUR-MG-CLUSTER-CONNECTION-STRING>
MONGO_URI_CG=<YOUR-CG-CLUSTER-CONNECTION-STRING>
MONGO_URI_LOOPC=<YOUR-LOOPC-CLUSTER-CONNECTION-STRING>
```

**Example format (customize with your values):**
```
MONGO_URI_MG=mongodb+srv://admin:YourPassword123@ops-dashboard-mg.a1b2c3d.mongodb.net/ops-dashboard?retryWrites=true&w=majority
MONGO_URI_CG=mongodb+srv://admin:YourPassword123@ops-dashboard-cg.a1b2c3d.mongodb.net/ops-dashboard?retryWrites=true&w=majority
MONGO_URI_LOOPC=mongodb+srv://admin:YourPassword123@ops-dashboard-loopc.a1b2c3d.mongodb.net/ops-dashboard?retryWrites=true&w=majority
```

### Optional: Sentry (error reporting)

See `docs/OBSERVABILITY-SENTRY.md` and **`docs/SENTRY-RELEASE-SETUP.md`** (release labels and trace sampling on each host).

```
SENTRY_DSN=https://<key>@<org>.ingest.sentry.io/<project>
SENTRY_ENVIRONMENT=production
# Optional — release grouping in Sentry (commit SHA is auto-detected when unset)
SENTRY_RELEASE=<git-sha-or-label>
# Optional — 0 to 1; default 0 (performance tracing off)
SENTRY_TRACES_SAMPLE_RATE=0
```

### Rate Limiting (Optional, use defaults if not specified)

```
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=1200
AUTH_RATE_LIMIT_WINDOW_MS=900000
AUTH_RATE_LIMIT_MAX=25
REQUEST_BODY_LIMIT=100kb
```

### CORS & Allowed Origins

**Set this AFTER you have your Vercel domains configured:**

Use **`CLIENT_URLS`** (preferred) for every browser origin that calls the API, comma-separated, **no trailing slashes**. Include tenant subdomains **and** the apex marketing URL if the SPA is ever loaded from it (otherwise browsers send `Origin: https://yourdomain.com` and the API rejects the request with `CORS: origin not allowed` — see `backend/app.js`).

```
CLIENT_URLS=https://mg.yourdomain.com,https://cg.yourdomain.com,https://loopc.yourdomain.com,https://app.yourdomain.com,https://yourdomain.com,http://mg.localhost:5173,http://cg.localhost:5173,http://loopc.localhost:5173
```

Legacy **`CLIENT_URL`** (optional): same list; the server merges both into one allowlist.

```
CLIENT_URL=https://mg.yourdomain.com,https://cg.yourdomain.com,https://loopc.yourdomain.com,https://app.yourdomain.com,https://yourdomain.com,http://mg.localhost:5173,http://cg.localhost:5173,http://loopc.localhost:5173
```

---

## Vercel Frontend — Environment Variables

**Location:** Vercel Dashboard → Your Project → Settings → Environment Variables

### API base URL (multi-portal sessions)

**Recommended for MG / CG / LoopC on separate subdomains:** leave `VITE_API_URL` and `VITE_API_BASE_URL` **unset** on Vercel. The app defaults to same-origin `/api`, and [`vercel.json`](vercel.json) rewrites `/api/*` to Railway. Each portal subdomain (`mg.`, `cg.`, `loopc.`) keeps its own session cookies.

If you set an absolute API URL (e.g. `https://api.loopcstrategies.com`), the backend uses **per-tenant cookies** (`sessionToken_mg`, `sessionToken_cg`, …) so multiple portals can stay signed in in the same browser. Without that backend support, the last login overwrites the shared `sessionToken` cookie.

```
# Optional — only if you need a dedicated API origin instead of /api rewrite:
# VITE_API_URL=https://api.yourdomain.com
```

**Note:** Set a dedicated API URL only AFTER Railway custom domain is live.

### Optional: Operations projects (stale badge)

Keep the **inactivity window** in sync with the backend stale-comment job: backend uses `TASK_STALE_MS` (milliseconds); the UI uses whole days via **`VITE_OPS_PROJECTS_STALE_DAYS`** (preferred) or legacy `VITE_TASK_STALE_DAYS` (default **7**). Example for 14 days: set `VITE_OPS_PROJECTS_STALE_DAYS=14` and `TASK_STALE_MS=1209600000` (14 × 86400000).

```
# VITE_OPS_PROJECTS_STALE_DAYS=7
# VITE_TASK_STALE_DAYS=7
```

### Optional: Sentry (browser errors)

```
VITE_SENTRY_DSN=https://<key>@<org>.ingest.sentry.io/<project>
VITE_SENTRY_ENVIRONMENT=production
# Optional — Vercel sets VITE_VERCEL_GIT_COMMIT_SHA on deploy; override with:
# VITE_SENTRY_RELEASE=<label>
# VITE_SENTRY_TRACES_SAMPLE_RATE=0
```

### Build & Output (Usually auto-detected, verify settings)

- **Framework Preset:** Vite
- **Build Command:** `npm run build`
- **Output Directory:** `dist`

### Expo / EAS — Mobile (optional)

See [docs/OBSERVABILITY-SENTRY.md](docs/OBSERVABILITY-SENTRY.md). Set in **Expo** → your app → **Environment variables** (per profile: preview / production):

```
EXPO_PUBLIC_API_URL=https://api.yourdomain.com
EXPO_PUBLIC_SENTRY_DSN=https://<key>@<org>.ingest.sentry.io/<project>
EXPO_PUBLIC_SENTRY_ENVIRONMENT=production
# EXPO_PUBLIC_SENTRY_RELEASE=<git-sha-or-eas-build-id>
# EXPO_PUBLIC_SENTRY_TRACES_SAMPLE_RATE=0
```

---

### Optional: MT4 live metal top bar

The **MG ERP top bar** can show live Gold, Silver, and Platinum prices from your connected MT4 terminal. Run the local Expert Advisor in `tools/mt4-price-bridge` and set the same bridge token in MT4 and the backend.

```
METAL_RATES_BRIDGE_TOKEN=<long random secret shared with MT4 EA>
```

The bridge posts to:

```
POST /api/erp-accounting/metal-rates/bridge
```

Prices from MT4 are normally USD per troy ounce; the backend stores them as **USD/G** for ERP use.

### Optional: server-side metal market prices (API / reports)

Backend routes such as `GET /api/erp-accounting/reports/market-prices` (and optional SSE) may still use external feeds for **reports, margins, and saved metal rates**.

If you call the default **metals.dev** host, set **`METALS_DEV_API_KEY`** (or **`METALS_API_KEY`**) in Railway / `backend/.env`. Otherwise the service falls back to **FRED** (`FRED_API_KEY`), **Alpha Vantage** (`ALPHA_VANTAGE_API_KEY` or `METALS_ALPHA_VANTAGE_API_KEY`), then **inventory / saved metal rates**.

If you previously set **`METALS_DEV_API_KEY`** only for the old ERP dashboard spot widget, you can **delete that variable** in Railway; keep it only if you still rely on metals.dev-backed **server** routes (reports, etc.).

```
METALS_DEV_API_KEY=<optional — only if you use metals.dev-backed market routes>
```

Optional tuning (cache intervals, custom `METALS_MARKET_URL`, etc.) is unchanged — see previous internal docs or `backend/routes/erp-accounting/reportRoutes.js`.

**Synthetic real-time mock (dev / load testing only):**

When enabled, the server **does not call** metals.dev, FRED, or Alpha; prices are a **small random walk** in USD/troy oz. **Off in production** unless you also set `METALS_SPOT_MOCK_REALTIME_ALLOW_PRODUCTION=true` (discouraged).

```
METALS_SPOT_MOCK_REALTIME=true
METALS_SPOT_SSE_POLL_MS=500
# METALS_SPOT_MOCK_REALTIME_ALLOW_PRODUCTION=true
```

### Maintenance: repair misposted purchase (AP + inventory)

If an older posted purchase credited the wrong payable (e.g. generic AP) while the voucher **party** was a vendor sub-account (e.g. **2305**), or stock was booked on a **stock-type** row instead of a **product**, run from `backend/`:

```bash
# Preview (no writes)
node scripts/repair-misposted-purchase-voucher.js --tenant=mg --voc-no=Pur/2026/0001

# Apply (requires destructive guard — see script header)
node scripts/repair-misposted-purchase-voucher.js --tenant=mg --apply --reason="Repair misposted purchase" --confirm="$DESTRUCTIVE_ADMIN_CONFIRM_TOKEN" --voc-no=Pur/2026/0001
```

Optional: `REPAIR_SYNC_VENDOR_LEDGER=false` to skip updating `Vendor.ledgerAccountId`.

---

## MongoDB Atlas — Network Access

**Location:** MongoDB Atlas → Your Organization → Network Access

### For Development:
```
Allow from: 0.0.0.0/0 (Allow all)
```

### For Production (more secure):
Get Railway's outbound IP and add:
```
Allow from: <RAILWAY-OUTBOUND-IP>/32
```

---

## GitHub Actions — Post-deploy smoke (`post-deploy-tenant-smoke.yml`)

**Location:** GitHub repo → **Settings** → **Secrets and variables** → **Actions**

### Repository variables (defaults for `smoke:tenants` / `smoke:prod`)

Names match the workflow `env` block and `scripts/production-smoke.js`:

| Variable | Purpose |
|----------|---------|
| `SMOKE_BASE_DOMAIN` | Host suffix for `mg` / `cg` / `loopc` portal checks |
| `SMOKE_API_BASE` | API origin (no trailing slash), e.g. `https://api.yourdomain.com` |
| `SMOKE_WAIT_SECONDS` | Seconds to sleep before smoke (deploy propagation) |
| `SMOKE_REQUIRE_AUTH` | Default `true`. Set `false` to skip authenticated ERP probe when credentials are absent |

### Repository secrets (optional ERP probe + notifications)

| Secret | Purpose |
|--------|---------|
| `SMOKE_AUTH_TOKEN` | Bearer token for read-only ERP route (no login) |
| `SMOKE_SESSION_COOKIE` | Session cookie header value for the probe |
| `SMOKE_AUTH_NAME` / `SMOKE_AUTH_PASSWORD` | Shared login for password-based probe |
| `SMOKE_AUTH_NAME_MG` / `SMOKE_AUTH_PASSWORD_MG` | Per-tenant overrides (`_CG`, `_LOOPC` same pattern) |
| `SMOKE_SLACK_WEBHOOK_URL` | Notify on smoke failure |
| `SMOKE_TEAMS_WEBHOOK_URL` | Notify on smoke failure |

---

## GitHub Actions — Staging smoke (`staging-smoke.yml`)

Use these only after provisioning separate staging Railway/Vercel/Mongo resources. `npm run smoke:staging` refuses to target production `loopcstrategies.com` hosts by default.

### Repository variables

| Variable | Purpose |
|----------|---------|
| `STAGING_SMOKE_API_BASE` | Staging API origin; defaults to `https://ops-dashboard-staging-e6c6.up.railway.app` |
| `STAGING_SMOKE_BASE_DOMAIN` | Staging tenant host suffix |
| `STAGING_SMOKE_VERCEL_HOSTS` | Optional explicit staging frontend hosts, comma-separated |
| `STAGING_SMOKE_RAILWAY_READINESS_URL` | Optional explicit readiness URL |
| `STAGING_SMOKE_WAIT_SECONDS` | Optional deploy propagation delay |
| `STAGING_SMOKE_REQUIRE_AUTH` | Default `false`; set `true` after staging smoke users exist |
| `STAGING_SMOKE_SKIP_FRONTEND` | Default `true`; set `false` after adding staging frontend hosts |

### Repository secrets

| Secret | Purpose |
|--------|---------|
| `STAGING_SMOKE_AUTH_NAME` / `STAGING_SMOKE_AUTH_PASSWORD` | Shared staging login |
| `STAGING_SMOKE_AUTH_NAME_MG` / `STAGING_SMOKE_AUTH_PASSWORD_MG` | Per-tenant MG staging login |
| `STAGING_SMOKE_AUTH_NAME_CG` / `STAGING_SMOKE_AUTH_PASSWORD_CG` | Per-tenant CG staging login |
| `STAGING_SMOKE_AUTH_NAME_LOOPC` / `STAGING_SMOKE_AUTH_PASSWORD_LOOPC` | Per-tenant LoopC staging login |
| `STAGING_SMOKE_AUTH_TOKEN` | Bearer token alternative |
| `STAGING_SMOKE_SESSION_COOKIE` | Session cookie alternative |

---

## DNS Records to Create

**Location:** Your Domain Registrar (GoDaddy, Namecheap, Cloudflare, etc.)

Create these CNAME records (exact names depend on your registrar interface):

```
Name              Type    Value (CNAME Target)
---               ----    ---
mg                CNAME   cname.vercel-dns.com (from Vercel)
cg                CNAME   cname.vercel-dns.com (from Vercel)
loopc             CNAME   cname.vercel-dns.com (from Vercel)
app               CNAME   cname.vercel-dns.com (from Vercel)
api               CNAME   cname-alias.railway.app (from Railway)
```

**Wait 5-15 minutes after creating DNS records for propagation.**

---

## Verify Propagation

Run these commands to verify DNS is live:

```bash
# Check MG subdomain
nslookup mg.yourdomain.com

# Check CG subdomain
nslookup cg.yourdomain.com

# Check LoopC subdomain
nslookup loopc.yourdomain.com

# Check API subdomain
nslookup api.yourdomain.com

# Test API health
curl https://api.yourdomain.com/api/health
```

Expected output from health check:
```json
{"success":true,"message":"Server is running!","time":"2026-05-03T...Z"}
```

---

## Checklist: Before Going Live

- [ ] All MongoDB clusters created and accessible
- [ ] Railway backend deployed with all env vars set
- [ ] Vercel frontend deployed with all env vars set
- [ ] Custom domains added to both platforms
- [ ] DNS records created and propagated (verify with nslookup)
- [ ] SSL certificates issued (wait 10 min, then visit each domain)
- [ ] Health check passes: `curl https://api.yourdomain.com/api/health`
- [ ] Can access login pages:
  - [ ] `https://mg.yourdomain.com`
  - [ ] `https://cg.yourdomain.com`
  - [ ] `https://loopc.yourdomain.com`
- [ ] Setup super_admin for each company (use setup endpoint)
- [ ] Test login flow for each company
- [ ] Verify data isolation (create record in one company, verify invisible in others)
- [ ] Test cross-tenant rejection (try using MG token on cg.yourdomain.com)

---

## Quick Links

- Railway: https://railway.app/dashboard
- Vercel: https://vercel.com/dashboard
- MongoDB Atlas: https://cloud.mongodb.com
- Your Domain Registrar: (set bookmark)
