# Venus Bullions (`vb`) tenant

Portal: `https://vb.loopcstrategies.com`  
Company code (mobile): `vb`  
API env: `MONGO_URI_VB`

## Operator DNS (required for portal host)

Vercel domain alias is added. GoDaddy still hosts DNS — add:

```
Type: A
Name: vb
Value: 76.76.21.21
```

Then verify: `npx vercel domains verify vb.loopcstrategies.com --scope beulah-4360s-projects`

Until DNS is live, API tenant `vb` still works via `x-tenant: vb` / mobile company code `vb`.

## Railway / Mongo (dedicated Atlas)

- Atlas project: **Venus Bullion**
- Cluster host: `cluster0.fiotefu.mongodb.net`
- DB user: `business_db_user`
- Production DB: `ops-dashboard`
- Staging DB: `ops-dashboard-staging`
- `CLIENT_URLS` includes `https://vb.loopcstrategies.com`

**Network Access:** Venus Bullion project must allow Railway egress (same as MG — typically `0.0.0.0/0`). Without this, `/api/ready` fails for tenant `vb` and deploys healthcheck.

Migrate tooling: [`scripts/apply-vb-atlas-separation.mjs`](../scripts/apply-vb-atlas-separation.mjs) (URI in gitignored `scripts/_tmp-vb-atlas-uri.txt`).

## ERP bootstrap

CoA/currencies/mappings and first admin (`vbadmin`) were seeded and copied to the dedicated cluster.

Portal `/setup` stays disabled in production unless `ENABLE_SETUP` + `SETUP_TOKEN` are intentionally enabled.
