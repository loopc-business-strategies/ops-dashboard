# Multi-Company Deployment Checklist
## Vercel + Railway + MongoDB Atlas for mg, cg, loopc subdomains

---

## Prerequisites
- [ ] Your main domain registered (e.g., `yourdomain.com`)
- [ ] MongoDB Atlas account with three separate clusters created
  - [ ] Cluster 1: `ops-dashboard-mg`
  - [ ] Cluster 2: `ops-dashboard-cg`
  - [ ] Cluster 3: `ops-dashboard-loopc`
- [ ] GitHub repo connected to Vercel and Railway
- [ ] Admin access to DNS provider (registrar or Cloudflare)

---

## Step 1: Create Three MongoDB Clusters

### For each cluster (MG, CG, LoopC):
1. Log into MongoDB Atlas
2. Click **Create Deployment**
3. Choose **M0 Free** tier or appropriate tier for your scale
4. Name: `ops-dashboard-mg`, `ops-dashboard-cg`, `ops-dashboard-loopc`
5. Choose region closest to your users
6. Create cluster
7. Wait for cluster to be ready (green checkmark)
8. Click **Connect**
9. Choose **Drivers** → **Connection String** → **Node.js**
10. Copy the full connection string:
    ```
    mongodb+srv://USERNAME:PASSWORD@cluster-name.xxxxx.mongodb.net/?retryWrites=true&w=majority
    ```
11. Replace `USERNAME` and `PASSWORD` with your Atlas database user credentials
12. Save each URI for Step 3 below

---

## Step 2: Set Up Railway Backend

### 2.1 Connect GitHub Repository
1. Log into [railway.app](https://railway.app)
2. Click **+ New Project**
3. Select **Deploy from GitHub repo**
4. Authorize GitHub and select your ops-dashboard repo
5. Select the backend folder (if using monorepo) or leave default
6. Railway will auto-detect Node.js and create a service

### 2.2 Add Environment Variables

In Railway dashboard, go to **Variables** and add:

| Key | Value | Example |
|-----|-------|---------|
| `NODE_ENV` | `production` | `production` |
| `PORT` | `5000` | `5000` |
| `JWT_SECRET` | (generate secure random string) | `your-random-secret-key-here-min-32-chars` |
| `DEFAULT_TENANT` | `loopc` | `loopc` |
| `MONGO_URI_MG` | (MongoDB Atlas connection string for MG) | `mongodb+srv://user:pass@cluster-mg.xxxxx.mongodb.net/ops-dashboard?retryWrites=true&w=majority` |
| `MONGO_URI_CG` | (MongoDB Atlas connection string for CG) | `mongodb+srv://user:pass@cluster-cg.xxxxx.mongodb.net/ops-dashboard?retryWrites=true&w=majority` |
| `MONGO_URI_LOOPC` | (MongoDB Atlas connection string for LoopC) | `mongodb+srv://user:pass@cluster-loopc.xxxxx.mongodb.net/ops-dashboard?retryWrites=true&w=majority` |
| `RATE_LIMIT_WINDOW_MS` | `900000` | `900000` (15 min) |
| `RATE_LIMIT_MAX` | `400` | `400` requests per window |
| `AUTH_RATE_LIMIT_MAX` | `25` | `25` login attempts per window |
| `CORS_ORIGINS` | (set in step 2.3) | See below |
| `CLIENT_URL` | (set in step 2.3) | See below |

### 2.3 Set CORS and Frontend Origins

After you have your Vercel domain, add:

```
CLIENT_URL=https://mg.yourdomain.com,https://cg.yourdomain.com,https://loopc.yourdomain.com,https://app.yourdomain.com,http://mg.localhost:5173,http://cg.localhost:5173,http://loopc.localhost:5173
```

### 2.4 Deploy Backend

1. Railway should auto-deploy on Git push
2. Wait for deployment to complete (green checkmark)
3. Railway will generate a public URL like: `https://ops-dashboard-backend-prod-...railway.app`
4. You will add a custom domain in Step 4

### 2.5 MongoDB Network Access

1. In MongoDB Atlas, go to **Network Access**
2. Add IP address `0.0.0.0/0` (allow all) for development, or add Railway's outbound IP
3. Confirm access is granted

---

## Step 3: Set Up Vercel Frontend

### 3.1 Connect GitHub Repository
1. Log into [vercel.com](https://vercel.com)
2. Click **Add New** → **Project**
3. Select your ops-dashboard GitHub repo
4. Set **Root Directory** to `frontend` (if using monorepo)
5. Framework: Vite (auto-detected)
6. Click **Deploy**

### 3.2 Add Environment Variables

In Vercel dashboard, go to **Settings** → **Environment Variables** and add:

| Key | Value |
|-----|-------|
| `VITE_API_URL` | `https://api.yourdomain.com` |

(Do not add this yet; you will set it after Railway custom domain is created)

### 3.3 Deploy Frontend

Frontend will auto-deploy from Git. Wait for deployment to complete.

---

## Step 4: Set Up Custom Domains

### 4.1 Get Railway Backend Domain
1. In Railway dashboard, go to your backend service
2. Click **Settings** → **Domains**
3. Click **+ New Domain**
4. Enter: `api.yourdomain.com`
5. Railway will provide DNS instructions
6. Note the CNAME target (something like `cname-alias.railway.app`)

### 4.2 Get Vercel Frontend Domains
1. In Vercel dashboard, go to your project
2. Click **Settings** → **Domains**
3. Add **4 domains**:
   - `app.yourdomain.com` (optional, for production-only access)
   - `mg.yourdomain.com`
   - `cg.yourdomain.com`
   - `loopc.yourdomain.com`
4. Vercel will provide DNS instructions for each
5. Note all CNAME targets

### 4.3 Update DNS Records

In your domain registrar (GoDaddy, Namecheap, Cloudflare, etc.):

Create these CNAME records:

| Subdomain | CNAME Target | Type |
|-----------|--------------|------|
| `mg` | (Vercel CNAME for mg.yourdomain.com) | CNAME |
| `cg` | (Vercel CNAME for cg.yourdomain.com) | CNAME |
| `loopc` | (Vercel CNAME for loopc.yourdomain.com) | CNAME |
| `app` | (Vercel CNAME for app.yourdomain.com) | CNAME |
| `api` | (Railway CNAME for api.yourdomain.com) | CNAME |

**Example (if using Cloudflare):**
```
mg.yourdomain.com       CNAME   cname.vercel-dns.com
cg.yourdomain.com       CNAME   cname.vercel-dns.com
loopc.yourdomain.com    CNAME   cname.vercel-dns.com
app.yourdomain.com      CNAME   cname.vercel-dns.com
api.yourdomain.com      CNAME   cname-alias.railway.app
```

**Wait 5-15 minutes for DNS propagation.**

---

## Step 5: Finalize Configuration

### 5.1 Update Vercel Environment Variables

Once Railway custom domain is live:

1. In Vercel dashboard, update **Environment Variables**:
   ```
   VITE_API_URL=https://api.yourdomain.com
   ```
2. Redeploy frontend: Click **Deployments** → **Redeploy**

### 5.2 Update Railway CORS

Once all domains are live:

1. In Railway backend variables, update:
   ```
   CLIENT_URL=https://mg.yourdomain.com,https://cg.yourdomain.com,https://loopc.yourdomain.com,https://app.yourdomain.com,http://mg.localhost:5173,http://cg.localhost:5173,http://loopc.localhost:5173
   ```

---

## Step 6: Testing Plan

### 6.1 Verify SSL Certificates

Wait 5-10 minutes after DNS updates. Then visit each URL:

- [ ] `https://mg.yourdomain.com` → should load without SSL warning
- [ ] `https://cg.yourdomain.com` → should load without SSL warning
- [ ] `https://loopc.yourdomain.com` → should load without SSL warning
- [ ] `https://api.yourdomain.com/api/health` → should return `{"success":true,"message":"Server is running!"}`

### 6.2 MG Company Flow

1. Open `https://mg.yourdomain.com`
2. Verify:
   - [ ] Page shows **MG** branding and logo
   - [ ] Login form does NOT show company dropdown (or shows "MG" locked)
   - [ ] Page displays MG brand colors (blue gradient)
   - [ ] No company selector visible

3. Set up first MG admin (if not done):
   - [ ] Use API call or UI to create first super_admin
   - [ ] Or use setup endpoint: `POST https://api.yourdomain.com/api/auth/setup`
   ```json
   {
     "company": "mg",
     "name": "MGAdmin",
     "password": "SecurePass123!"
   }
   ```

4. Login with MG credentials:
   - [ ] Enter username and password
   - [ ] Click Sign In
   - [ ] Should land on MG dashboard
   - [ ] Verify user company in profile is `mg`

5. Verify MG data isolation:
   - [ ] Create a test record (employee, task, etc.)
   - [ ] Open browser DevTools → Storage → Cookies
   - [ ] Session token should exist
   - [ ] Make API call: `GET https://api.yourdomain.com/api/auth/me`
   - [ ] Response should show `"company": "mg"`

### 6.3 CG Company Flow

1. Open `https://cg.yourdomain.com`
2. Repeat 6.2 steps for CG:
   - [ ] CG branding visible (orange gradient)
   - [ ] Setup CG super_admin
   - [ ] Login and verify `"company": "cg"` in profile

### 6.4 LoopC Company Flow

1. Open `https://loopc.yourdomain.com`
2. Repeat 6.2 steps for LoopC:
   - [ ] LoopC branding visible (green gradient)
   - [ ] Setup LoopC super_admin
   - [ ] Login and verify `"company": "loopc"` in profile

### 6.5 Cross-Tenant Security Test

1. Log into MG at `https://mg.yourdomain.com`
2. Copy the session cookie or JWT token
3. Open DevTools → Network tab
4. Try to access CG: open `https://cg.yourdomain.com`
5. Open DevTools → Console and paste:
   ```javascript
   fetch('https://api.yourdomain.com/api/auth/me', {
     method: 'GET',
     credentials: 'include'
   }).then(r => r.json()).then(console.log)
   ```
6. Expected result:
   - [ ] Should receive error: `"Session tenant does not match this company portal"`
   - [ ] Should NOT see CG data
   - [ ] Session is rejected

7. Verify same from CG → MG:
   - [ ] Log into CG
   - [ ] Try to access MG data
   - [ ] Should be rejected with same error

### 6.6 Database Isolation Verification

1. From MG dashboard, create test data:
   - [ ] Create 1 employee or test record
   - [ ] Note the ID

2. Verify from CG dashboard:
   - [ ] View employee/record list
   - [ ] MG's record should NOT appear
   - [ ] CG list should be empty (or show only CG records)

3. Verify from LoopC dashboard:
   - [ ] View same list
   - [ ] Neither MG nor CG records should appear

### 6.7 API Direct Test

Test API cross-tenant rejection:

```bash
# Login to MG, get token
curl -X POST https://api.yourdomain.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "company": "mg",
    "name": "MGAdmin",
    "password": "SecurePass123!"
  }' \
  -c mg_cookies.txt

# Try to access from CG subdomain with MG token
curl https://api.yourdomain.com/api/auth/me \
  -H "Host: cg.yourdomain.com" \
  -b mg_cookies.txt

# Expected: 401 "Session tenant does not match this company portal"
```

---

## Step 7: Production Checklist

- [ ] All three companies can log in
- [ ] Branding is company-specific
- [ ] Data is isolated per company
- [ ] Cross-tenant access is blocked
- [ ] SSL certificates are valid
- [ ] Health check endpoint responds
- [ ] Rate limiting is active
- [ ] CORS allows only your domains
- [ ] MongoDB backups are configured
- [ ] Monitor uptime: add Railway/Vercel monitoring
- [ ] Set up error alerts (Sentry, LogRocket, or similar)
- [ ] Create admin runbook for:
  - [ ] Adding new users per company
  - [ ] Creating new companies (if needed)
  - [ ] Backup/restore procedures
  - [ ] Scaling MongoDB if needed

### 7.1 FX Realized Gain/Loss Audit (Reusable)

Use this whenever you need to verify or backfill exchange gain/loss journals for receipt/payment settlements.

1. Dry-run pair audit (no writes):

```powershell
Set-Location C:\Users\USER\Desktop\ops-dashboard\backend
node .\scripts\backfill-fx-journals-all-tenants.js --mode=pair
```

2. Strict FC delta dry-run (uses line-item FC difference):

```powershell
Set-Location C:\Users\USER\Desktop\ops-dashboard\backend
node .\scripts\backfill-fx-journals-all-tenants.js --mode=pair --strict-fc-delta
```

3. Apply strict FC delta backfill (writes journal rows):

```powershell
Set-Location C:\Users\USER\Desktop\ops-dashboard\backend
node .\scripts\backfill-fx-journals-all-tenants.js --mode=pair --strict-fc-delta --apply
```

4. Verify inserted journal account names/codes:

```powershell
Set-Location C:\Users\USER\Desktop\ops-dashboard\backend
node .\scripts\verify-fx-journal-audit.js
```

Expected verification output should include:
- Journal amount, currency, and exchangeRate
- Debit account code/name
- Credit account code/name
- Reference payment ID and counterpart receipt ID

Scripts:
- [backend/scripts/backfill-fx-journals-all-tenants.js](backend/scripts/backfill-fx-journals-all-tenants.js)
- [backend/scripts/verify-fx-journal-audit.js](backend/scripts/verify-fx-journal-audit.js)

---

## Step 8: Optional Enhancements

### Add Staging Environment (Recommended)

1. Create staging Vercel deployment:
   - [ ] `staging.yourdomain.com` (optional)
   - [ ] `staging-mg.yourdomain.com`
   - [ ] `staging-cg.yourdomain.com`
   - [ ] `staging-loopc.yourdomain.com`

2. Create staging Railway deployment with:
   - [ ] `MONGO_URI_MG_STAGING`, etc.
   - [ ] Same setup as production

3. Test new features on staging before production

### Add Monitoring

1. Enable Sentry for error tracking: `https://sentry.io`
2. Enable LogRocket for session replay (optional): `https://logrocket.com`
3. Enable Uptime monitoring (Railway or UptimeRobot)
4. Set up Slack alerts for errors

### Add Custom Branding

Update [frontend/src/config/tenantBranding.js](../frontend/src/config/tenantBranding.js):
- [ ] Add company logo image URLs
- [ ] Add company-specific welcome text
- [ ] Add support email per company
- [ ] Add company-specific terms/privacy links

---

## Troubleshooting

### Issue: DNS not resolving
**Solution:**
- Wait 15 minutes for DNS propagation
- Check DNS with: `nslookup mg.yourdomain.com`
- Verify CNAME is correct in your registrar
- Try flushing DNS: `ipconfig /flushdns` (Windows) or `sudo dscacheutil -flushcache` (Mac)

### Issue: SSL certificate not issued
**Solution:**
- DNS must be live and correct for 5+ minutes before cert is issued
- Vercel/Railway auto-issue; wait 10 minutes
- If still pending, check Email for certificate auth (unlikely with DNS validation)

### Issue: Login fails with "Session tenant does not match"
**Solution:**
- Verify you're on the correct subdomain (mg/cg/loopc)
- Clear browser cookies: `document.cookie.split(";").forEach(c => document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/"))`
- Verify `resolveTenantFromHost` logic in backend

### Issue: API returns 401 Unauthorized
**Solution:**
- Verify JWT_SECRET is set on Railway
- Verify token is not expired (check JWT exp claim)
- Verify Authorization header is formatted: `Authorization: Bearer <token>`

### Issue: CORS error in browser console
**Solution:**
- Verify CLIENT_URL on Railway includes your frontend origin
- Verify your frontend URL is in the Railway CORS allowlist
- Check if requests to `api.yourdomain.com` are being blocked

### Issue: MongoDB connection fails
**Solution:**
- Verify MongoDB Atlas network access allows Railway's IP (or 0.0.0.0/0 for dev)
- Verify connection string username/password are correct
- Verify database name in URI matches (default: `ops-dashboard`)
- Check MongoDB Atlas **Deployments** → **Databases** for connection status

---

## Success Criteria

✅ All three companies have separate URLs and branding  
✅ Each company logs in with its own users  
✅ Data is isolated per company  
✅ Cross-company access is blocked  
✅ SSL is valid on all domains  
✅ App is responsive and fast  
✅ Errors are logged and monitored  

You are ready for production.

---

## Support References

- [Vercel Documentation](https://vercel.com/docs)
- [Railway Documentation](https://docs.railway.app)
- [MongoDB Atlas Documentation](https://docs.mongodb.com/manual/)
- [Vite Documentation](https://vitejs.dev)
- [Express.js Security](https://expressjs.com/en/advanced/best-practice-security.html)

