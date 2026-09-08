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

## Railway / Mongo

- Production + staging `MONGO_URI_VB` → Atlas DB `ops-dashboard-vb` on the **MG** cluster (`cluster0.m5yqfs7.mongodb.net`), same `mg_db` user (dedicated DB name; migrate to a dedicated Atlas project later if desired)
- `CLIENT_URLS` includes `https://vb.loopcstrategies.com`

## ERP bootstrap (done)

```bash
# CoA from mg + currencies + default mappings
node backend/scripts/bootstrap-new-tenant-erp.js --tenant=vb --source=mg
```

First Super Admin was created in DB (`vbadmin`). Prefer rotating password after first login. Portal `/setup` stays disabled in production unless `ENABLE_SETUP` + `SETUP_TOKEN` are intentionally enabled.