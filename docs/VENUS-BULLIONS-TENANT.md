# Venus Bullions (`vb`) tenant

Primary portal: `https://venusbullions.loopcstrategies.com`  
Alias portal: `https://vb.loopcstrategies.com`  
Company code (mobile): `vb`  
API env: `MONGO_URI_VB`

## Operator DNS (GoDaddy) — required for browser portal

Vercel project `ops-dashboard` has both domains attached. GoDaddy still hosts DNS (`ns19/ns20.domaincontrol.com`) — add:

```
Type: A
Name: venusbullions
Value: 76.76.21.21

Type: A
Name: vb
Value: 76.76.21.21
```

Then:

```bash
npx vercel domains verify venusbullions.loopcstrategies.com --scope beulah-4360s-projects
npx vercel domains verify vb.loopcstrategies.com --scope beulah-4360s-projects
```

Until DNS is live, API tenant `vb` still works via `x-tenant: vb` / mobile company code `vb`.

## Railway / Mongo (dedicated Atlas)

- Atlas project: **Venus Bullion**
- Cluster host: `cluster0.fiotefu.mongodb.net`
- DB user: `business_db_user`
- Production DB: `ops-dashboard`
- Staging DB: `ops-dashboard-staging`
- `CLIENT_URLS` includes both portal URLs above

**Network Access:** Venus Bullion project must allow Railway egress (typically `0.0.0.0/0`).

## ERP bootstrap

CoA/currencies/mappings and first admin (`vbadmin`) are on the dedicated cluster.
