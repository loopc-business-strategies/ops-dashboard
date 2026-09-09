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

**Do not** copy Chart of Accounts from MG (`bootstrap-new-tenant-erp.js --source=mg`). That seeded MG party accounts (e.g. Modern Capital) into VB.

Clean ERP reset + starter CoA (preserves `vbadmin`, wipes CoA/parties/txs/ledgers on VB only):

```bash
# Dry-run
npm run reset:vb-erp-masters -- --from-railway

# Apply
I_UNDERSTAND=RESET-VB-ERP-MASTERS npm run reset:vb-erp-masters -- --from-railway --apply --reason="Remove MG CoA contamination from VB"
```

Operators then add Venus-specific banks and party accounts in the portal.
