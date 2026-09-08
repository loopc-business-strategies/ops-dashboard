# Venus Bullions (`vb`) tenant

Primary portal: `https://venusbullions.loopcstrategies.com`  
Alias portal: `https://vb.loopcstrategies.com`  
Company code (mobile): `vb`  
API env: `MONGO_URI_VB`

## Operator DNS (GoDaddy)

Vercel domain aliases must be added for both hosts. GoDaddy still hosts DNS — add:

```
Type: A
Name: venusbullions
Value: 76.76.21.21

Type: A
Name: vb
Value: 76.76.21.21
```

Then verify:

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

Migrate tooling: [`scripts/apply-vb-atlas-separation.mjs`](../scripts/apply-vb-atlas-separation.mjs).

## ERP bootstrap

CoA/currencies/mappings and first admin (`vbadmin`) were seeded on the dedicated cluster.

Portal `/setup` stays disabled in production unless `ENABLE_SETUP` + `SETUP_TOKEN` are intentionally enabled.
