# Venus Bullions (`vb`) tenant

Portal: `https://venusbullions.loopcstrategies.com`  
Company code (mobile): `vb`  
API env: `MONGO_URI_VB`

## Operator DNS (GoDaddy)

Vercel project `ops-dashboard` has `venusbullions.loopcstrategies.com` attached. GoDaddy DNS:

```
Type: CNAME
Name: venusbullions
Value: bce13f01831e157c.vercel-dns-017.com
```

(Same CNAME target as `cg` / `loopc` / `mg`.)

Do **not** keep a `vb` subdomain unless you re-add it on purpose.

## Railway / Mongo (dedicated Atlas)

- Atlas project: **Venus Bullion**
- Cluster host: `cluster0.fiotefu.mongodb.net`
- DB user: `business_db_user`
- Production DB: `ops-dashboard`
- Staging DB: `ops-dashboard-staging`
- `CLIENT_URLS` includes `https://venusbullions.loopcstrategies.com`

**Network Access:** Venus Bullion project must allow Railway egress (typically `0.0.0.0/0`).

## ERP bootstrap

CoA/currencies/mappings and first admin (`vbadmin`) are on the dedicated cluster.
