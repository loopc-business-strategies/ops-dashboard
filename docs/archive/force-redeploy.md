> **ARCHIVED — do not use for current operations.**  
> This is a historical snapshot and may not match the codebase.  
> Canonical docs: [docs/DEPLOY.md](../DEPLOY.md) · [README.md](../../README.md)

# Force Complete Browser Cache Clear

The database is CLEAN (0 entries confirmed via API), but your browser is showing CACHED data.

## Immediate Actions:

### 1. Clear Chrome Cache (If using Chrome):
- Press: `Ctrl + Shift + Delete`
- Select: "All time"
- Check: ✓ Cookies and other site data
- Check: ✓ Cached images and files
- Click: "Clear data"
- Then press: `Ctrl + F5` (hard refresh)

### 2. Or Clear All Sites Cache:
- Go to: `chrome://settings/siteData`
- Search: "api.loopcstrategies.com"
- Delete
- Then go to: `https://mg.loopcstrategies.com/dashboard`
- Press: `Ctrl + Shift + R` (bypass all caches)

### 3. Or Use Private/Incognito Window:
- Open new Incognito window: `Ctrl + Shift + N`
- Go to: `https://mg.loopcstrategies.com/dashboard`
- You should see EMPTY data (proves it's cache)

### 4. Verify API is Clean:
```bash
curl -H "X-Tenant-ID: mg" https://api.loopcstrategies.com/api/erp-accounting/ledger
# Returns: {"success":true,"count":0,"limit":100,"entries":[]}

curl -H "X-Tenant-ID: mg" https://api.loopcstrategies.com/api/erp-accounting/transactions
# Returns: {"success":true,"transactions":[],"total":0,...}
```

**The backend has ZERO entries - Your browser is showing cached HTML/data**
