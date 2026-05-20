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

### Rate Limiting (Optional, use defaults if not specified)

```
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=400
AUTH_RATE_LIMIT_WINDOW_MS=900000
AUTH_RATE_LIMIT_MAX=25
REQUEST_BODY_LIMIT=100kb
```

### CORS & Allowed Origins

**Set this AFTER you have your Vercel domains configured:**

```
CLIENT_URL=https://mg.yourdomain.com,https://cg.yourdomain.com,https://loopc.yourdomain.com,https://app.yourdomain.com,http://mg.localhost:5173,http://cg.localhost:5173,http://loopc.localhost:5173
```

---

## Vercel Frontend — Environment Variables

**Location:** Vercel Dashboard → Your Project → Settings → Environment Variables

### Required Variables

```
VITE_API_URL=https://api.yourdomain.com
```

**Note:** Set this AFTER Railway custom domain is live.

### Build & Output (Usually auto-detected, verify settings)

- **Framework Preset:** Vite
- **Build Command:** `npm run build`
- **Output Directory:** `dist`

---

### Live spot metals (ERP dashboard)

The MG/CG/LoopC ERP dashboard **spot metals** widget calls `GET /api/erp-accounting/reports/market-prices` (and optional **SSE** `GET /api/erp-accounting/reports/market-prices/stream`). If **`METALS_SPOT_MOCK_REALTIME=true`** (see below), the backend uses a **synthetic tick feed** first (for UI / latency testing). Otherwise it tries: **metals.dev** (default) → **FRED** (if `FRED_API_KEY` is set) → **Alpha Vantage** (if `ALPHA_VANTAGE_API_KEY` or `METALS_ALPHA_VANTAGE_API_KEY` is set) → **inventory / saved metal rates** fallback.

**Enable live prices on Railway (about two minutes):**

1. Open [metals.dev](https://metals.dev) → sign up or log in → **Dashboard** → copy your **API key**.
2. Railway → your **backend** service → **Variables** → **New Variable** → name `METALS_DEV_API_KEY` → paste the key → **Deploy** (or wait for auto-redeploy).
3. Confirm logs: on production boot you should **not** see the warning `ERP live spot metals: set METALS_DEV_API_KEY...`. Open the ERP dashboard spot widget — status should show **Live push (SSE)** or **Live (poll)** with `feedStatus: live`.

Local development: add the same line to `backend/.env` (see `backend/.env.example`). The backend sends **only** the `api_key` query parameter (no `Authorization: Bearer` header), which matches the [official examples](https://www.metals.dev/docs) and avoids HTTP 400 from metals.dev.

```
METALS_DEV_API_KEY=<your metals.dev API key>
```

Optional tuning:

```
METALS_MARKET_URL=https://api.metals.dev/v1/latest
METALS_SPOT_CACHE_MS=1500
METALS_SPOT_FALLBACK_CACHE_MS=20000
METALS_SPOT_SSE_POLL_MS=1000
```

Shorter `METALS_SPOT_CACHE_MS` / `METALS_SPOT_SSE_POLL_MS` refresh the UI more often but **increase calls** to metals.dev (mind the **free plan monthly request cap**).

If the ERP widget shows **Fallback** / **inventory**, open the orange error line: it now includes metals.dev’s **`error_message`** (for example invalid key, quota, or billing). Common fixes: paste `METALS_DEV_API_KEY` **without** wrapping quotes, **no** spaces or line breaks; confirm the key on [metals.dev/dashboard](https://metals.dev/dashboard); check **monthly request limits** on the free plan.

If you host a compatible JSON endpoint, set `METALS_MARKET_URL` to that URL; the backend will not require `METALS_DEV_API_KEY` when the default metals.dev host is not used.

**Alternate free feeds (quota / no metals.dev key):**

1. **FRED (St. Louis Fed)** — [Get an API key](https://fred.stlouisfed.org/docs/api/api_key.html). With only `FRED_API_KEY`, the backend uses **gold** by default (`GOLDPMGBD228NLBM`, London PM USD per troy oz). Set optional series IDs for other metals after you pick them on [fred.stlouisfed.org](https://fred.stlouisfed.org/):

```
FRED_API_KEY=<your FRED key>
# FRED_METALS_SERIES_GOLD=GOLDPMGBD228NLBM   # default if omitted
# FRED_METALS_SERIES_SILVER=
# FRED_METALS_SERIES_PLATINUM=
# FRED_METALS_SERIES_PALLADIUM=
```

2. **Alpha Vantage** — [Free API key](https://www.alphavantage.co/support/#api-key). Uses `GOLD_SILVER_SPOT` for gold/silver and `CURRENCY_EXCHANGE_RATE` for XPT/USD and XPD/USD (availability depends on Alpha’s data). The free tier is **25 requests/day**; use a **large** `METALS_SPOT_CACHE_MS` (for example `3600000`) and a slower `METALS_SPOT_SSE_POLL_MS` so you do not burn the daily cap on dashboard refreshes.

```
ALPHA_VANTAGE_API_KEY=<key>
# or: METALS_ALPHA_VANTAGE_API_KEY=<key>
```

**Synthetic real-time mock (free — for SSE / UI testing only):**

When enabled, the server **does not call** metals.dev, FRED, or Alpha; prices are a **small random walk** in USD/troy oz so the widget can show **live ticks** as fast as `METALS_SPOT_SSE_POLL_MS`. **Off in production** unless you also set `METALS_SPOT_MOCK_REALTIME_ALLOW_PRODUCTION=true` (discouraged).

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

