# Venus Bullions (`vb`) tenant

Portal: `https://vb.loopcstrategies.com`  
Company code (mobile): `vb`  
API env: `MONGO_URI_VB`

## Operator DNS (required)

Vercel domain alias is added. GoDaddy still hosts DNS — add:

```
Type: A
Name: vb
Value: 76.76.21.21
```

Then verify: `npx vercel domains verify vb.loopcstrategies.com --scope beulah-4360s-projects`

## Railway

- Production `MONGO_URI_VB` → Railway MongoDB service (`mongodb.railway.internal`)
- Staging `MONGO_URI_VB` → Railway `MongoDB-a2LI`
- `CLIENT_URLS` includes `https://vb.loopcstrategies.com`

## ERP bootstrap

After API deploy with catalog entry:

```bash
railway ssh -s ops-dashboard -e production -- node backend/scripts/bootstrap-new-tenant-erp.js --tenant=vb --source=mg
```

First admin: `https://vb.loopcstrategies.com/setup` (company code `vb`).
