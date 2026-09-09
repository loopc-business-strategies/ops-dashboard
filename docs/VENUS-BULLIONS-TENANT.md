# Venus Bullions (`vb`) tenant

Portal (primary, same pattern as mg/cg/loopc): `https://vb.loopcstrategies.com`  
Brand alias: `https://venusbullions.loopcstrategies.com`  
Company code (mobile): `vb`  
API env: `MONGO_URI_VB`

## Operator DNS (GoDaddy)

Vercel project `ops-dashboard` has both hosts attached. GoDaddy DNS (same CNAME target as `mg` / `cg` / `loopc`):

```
Type: CNAME
Name: vb
Value: bce13f01831e157c.vercel-dns-017.com

Type: CNAME
Name: venusbullions
Value: bce13f01831e157c.vercel-dns-017.com
```

Primary portal host is `vb.loopcstrategies.com`. Keep `venusbullions` only as the brand alias in `customDomains`.

## Railway / Mongo (dedicated Atlas)

- Atlas project: **Venus Bullion**
- Cluster host: `cluster0.fiotefu.mongodb.net`
- DB user: `business_db_user`
- Production DB: `ops-dashboard`
- Staging DB: `ops-dashboard-staging`
- `CLIENT_URLS` includes `https://vb.loopcstrategies.com` and `https://venusbullions.loopcstrategies.com`

**Network Access:** Venus Bullion project must allow Railway egress (typically `0.0.0.0/0`).

## ERP bootstrap

CoA/currencies/mappings and first admin (`vbadmin`) are on the dedicated cluster.

**Currency master (VB only):** **USD** (base) and **AED** (foreign). Do not seed EUR/UZS for Venus Bullions.

**Starter CoA** includes statutory FX/VAT/P&L accounts (`1020`, `1190`, `2190`, `3100`, `3200`, `4190`, `5190`) plus FX/VAT mappings. Upsert without wipe:

```bash
npm run seed:vb-statutory-coa -- --from-railway
I_UNDERSTAND=SEED-VB-STATUTORY-COA npm run seed:vb-statutory-coa -- --from-railway --apply --reason="Add FX VAT P&L accounts to VB"
```

**Do not** copy Chart of Accounts from MG (`bootstrap-new-tenant-erp.js --source=mg`). That seeded MG party accounts (e.g. Modern Capital) into VB.

Clean ERP reset + starter CoA (preserves `vbadmin`, wipes CoA/parties/txs/ledgers on VB only):

```bash
# Dry-run
npm run reset:vb-erp-masters -- --from-railway

# Apply
I_UNDERSTAND=RESET-VB-ERP-MASTERS npm run reset:vb-erp-masters -- --from-railway --apply --reason="Remove MG CoA contamination from VB"
```

Operators then add Venus-specific banks and party accounts in the portal.

## Isolation rules (multi-tenant)

VB is a first-class catalog tenant (`shared/tenant-catalog.json` key `vb`). Hard rules:

| Rule | Detail |
|------|--------|
| Dedicated Mongo | Production must set **`MONGO_URI_VB`** to the Venus Bullion Atlas cluster only. Startup rejects URI collisions across tenants. |
| Auth / host | JWT `company` must match the portal host (`vb` / `venusbullions`). Cross-tenant cookies are rejected. |
| Currency master | VB = **USD + AED** only (`getCurrencyMasterForTenant('vb')`). Do not run generic multi-currency seeds against VB production. |
| Metal rates | Bridge fan-out includes `vb` by default. Exclude with `METAL_RATES_BRIDGE_FANOUT_TENANTS=mg,cg,loopc` if ticks must stay off VB. |
| Frontend caches | Catalog / summary / enquiry caches are tenant-keyed; logout clears them. |

### Required env (API / Railway)

- `MONGO_URI_VB` (and staging `STAGING_MONGO_URI_VB` for CI migrate/smoke)
- `CLIENT_URLS` includes `https://vb.loopcstrategies.com` (and brand alias if used)
- Optional: `ATLAS_GROUP_ID_VB` for backup drills; GitHub secret `MONGO_URI_VB` for mongodump workflows

### Manual smoke (read-only / no prod writes)

```bash
# Health
curl -sS https://api.loopcstrategies.com/api/health
curl -sS https://api.loopcstrategies.com/api/ready

# Portal
curl -sI https://vb.loopcstrategies.com | head -n 5

# Local unit coverage (no production DB)
cd backend && npm test -- --testPathPattern="tenant-db-isolation|tenant-routing-auth|currencyBootstrap"
cd frontend && npm test -- --run src/config/tenantBranding
```
