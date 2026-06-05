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
```

### Persistent uploads (Railway volume)

Attach a **persistent volume** to the backend service (for example mount path `/app/uploads`), then set:

```
UPLOAD_STORAGE_ROOT=/app/uploads
```

The deploy `startCommand` creates `transactions`, `bank-slips`, `vendor-documents`, and `crm-contacts` under this root. Optional overrides per type: `TRANSACTION_UPLOAD_DIR`, `BANK_SLIP_UPLOAD_DIR`, `VENDOR_DOCUMENT_UPLOAD_DIR`, `CRM_CONTACT_UPLOAD_DIR` (see `backend/services/erpAccounting/uploadMiddleware.js`).

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

### Required Variables

```
VITE_API_URL=https://api.yourdomain.com
```

**Note:** Set this AFTER Railway custom domain is live.

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
