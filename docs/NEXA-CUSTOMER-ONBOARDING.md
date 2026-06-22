# Nexa customer onboarding — subdomain portal

Checklist for provisioning a new B2B customer on Nexa (web portal + mobile app). Each company gets an isolated MongoDB database and a subdomain portal.

## What the customer receives

| Item | Example |
|------|---------|
| Web portal | `https://acme.loopcstrategies.com` |
| Mobile app | **Nexa** (App Store / Play Store) |
| Company code (mobile login) | `acme` |
| First admin | Username + password you create in setup |

Company code routes API traffic to the correct database. It is **not** a secret — authentication is still username + password + JWT scoped to that tenant.

---

## 1. MongoDB

1. Create a dedicated database (or cluster) for the customer in MongoDB Atlas.
2. On **Railway** (API service), add an environment variable:
   - `MONGO_URI_ACME` = connection string for the new database  
   (Replace `ACME` with the uppercase company code.)

3. Redeploy the API so the new URI is available.

---

## 2. Tenant registry

Register the tenant so web, mobile, and API agree on the company code.

**Option A — Git catalog (default deploys)**

Edit `shared/tenant-catalog.json`:

```json
"acme": {
  "key": "acme",
  "displayName": "Acme",
  "tagline": "Acme Operations",
  "portalHost": "acme.loopcstrategies.com",
  "envVar": "MONGO_URI_ACME"
}
```

**Option B — Railway overlay (no code deploy for registry only)**

Set `TENANT_REGISTRY_JSON` on Railway with the same shape:

```json
{
  "tenants": {
    "acme": {
      "key": "acme",
      "displayName": "Acme",
      "portalHost": "acme.loopcstrategies.com",
      "envVar": "MONGO_URI_ACME"
    }
  }
}
```

Also add branding in `frontend/src/config/tenantBranding.js` and `mobile/src/config/tenantBranding.ts` (colors, logo, enabled tabs/modules).

---

## 3. DNS and Vercel (web portal)

1. **DNS:** CNAME `acme.loopcstrategies.com` → Vercel (or your frontend host).
2. **Vercel:** Add domain alias `acme.loopcstrategies.com` to the frontend project.
3. **Logo:** Add `frontend/public/logos/acme-logo.svg` (referenced in tenant branding).

The same frontend build serves all tenants; hostname → tenant is resolved automatically.

---

## 4. API CORS

Append the new portal origin to Railway `CLIENT_URLS` (comma-separated):

```
https://acme.loopcstrategies.com
```

Redeploy API after changing `CLIENT_URLS`.

---

## 5. First Super Admin

When the tenant database has **zero users**, open:

```
https://acme.loopcstrategies.com/setup
```

Create the first Super Admin with company code `acme`.

Alternatively, from a machine that can reach the API:

```bash
curl -X POST https://api.loopcstrategies.com/api/auth/setup \
  -H "Content-Type: application/json" \
  -H "x-tenant: acme" \
  -H "x-company: acme" \
  -d '{"name":"admin","password":"YOUR_SECURE_PASSWORD","company":"acme"}'
```

After the first user exists, `/setup` is permanently disabled for that tenant.

---

## 6. ERP bootstrap

Run ERP seed / chart-of-accounts scripts against the new tenant database (same scripts used for MG/CG), with tenant context set to `acme`. See existing scripts under `backend/scripts/`.

Verify in the portal: ERP → Accounts, Currencies, Settings load without errors.

---

## 7. Mobile (Nexa app)

1. Customer installs **Nexa** from the store.
2. Login screen:
   - **Company code:** `acme`
   - **Username / password:** as provisioned above

No separate APK per customer — one app, company code selects the tenant.

---

## 8. Smoke test

- [ ] Web login at `https://acme.loopcstrategies.com`
- [ ] Overview and enabled module tabs visible per branding
- [ ] Mobile login with company code `acme`
- [ ] ERP reports return data (not empty DB errors)
- [ ] Chat and notifications work (tenant headers present)

LoopC super admins can view the registered tenant list under **Admin → Tenants** on `loopc.loopcstrategies.com`.

---

## Enterprise: custom domain (Phase 3)

For customers who need `erp.customer.com` instead of a subdomain:

1. Customer adds DNS CNAME `erp.customer.com` → Vercel.
2. Add domain in Vercel dashboard (SSL via Let’s Encrypt).
3. Map host → tenant in registry:

```json
"customDomains": {
  "erp.customer.com": "acme"
}
```

Or per-tenant:

```json
"acme": {
  "customDomains": ["erp.customer.com"]
}
```

4. Add `https://erp.customer.com` to `CLIENT_URLS`.
5. Charge enterprise tier — custom domain is an add-on, not required for standard SaaS.

Example mapping already in catalog for testing: `erp.enterprise-demo.com` → `mg`.

---

## Quick reference

| Step | Where |
|------|--------|
| Database URI | Railway `MONGO_URI_<CODE>` |
| Tenant registry | `shared/tenant-catalog.json` or `TENANT_REGISTRY_JSON` |
| Branding / modules | `frontend/src/config/tenantBranding.js`, `mobile/src/config/tenantBranding.ts` |
| Web DNS + alias | DNS + Vercel |
| CORS | Railway `CLIENT_URLS` |
| First user | `/setup` or `POST /api/auth/setup` |
| ERP data | `backend/scripts/` seeds |
| Customer handoff | Portal URL + company code + credentials |
