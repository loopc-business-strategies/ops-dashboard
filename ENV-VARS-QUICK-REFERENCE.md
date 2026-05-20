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

The MG/CG/LoopC ERP dashboard **spot metals** widget calls `GET /api/erp-accounting/reports/market-prices` (and optional **SSE** `GET /api/erp-accounting/reports/market-prices/stream`), which use [metals.dev](https://metals.dev) by default.

**Enable live prices on Railway (about two minutes):**

1. Open [metals.dev](https://metals.dev) → sign up or log in → **Dashboard** → copy your **API key**.
2. Railway → your **backend** service → **Variables** → **New Variable** → name `METALS_DEV_API_KEY` → paste the key → **Deploy** (or wait for auto-redeploy).
3. Confirm logs: on production boot you should **not** see the warning `ERP live spot metals: set METALS_DEV_API_KEY...`. Open the ERP dashboard spot widget — status should show **Live push (SSE)** or **Live (poll)** with `feedStatus: live`.

Local development: add the same line to `backend/.env` (see `backend/.env.example`).

```
METALS_DEV_API_KEY=<your metals.dev API key>
```

Optional tuning:

```
METALS_MARKET_URL=https://api.metals.dev/v1/latest
METALS_SPOT_CACHE_MS=2200
METALS_SPOT_FALLBACK_CACHE_MS=20000
METALS_SPOT_SSE_POLL_MS=900
```

If you host a compatible JSON endpoint, set `METALS_MARKET_URL` to that URL; the backend will not require `METALS_DEV_API_KEY` when the default metals.dev host is not used.

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

