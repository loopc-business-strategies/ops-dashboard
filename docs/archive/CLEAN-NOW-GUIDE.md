> **ARCHIVED — do not use for current operations.**  
> This is a historical snapshot and may not match the codebase.  
> Canonical docs: [docs/DEPLOY.md](../DEPLOY.md) · [README.md](../../README.md)

# 🎯 Complete Cleanup Guide - MongoDB Atlas UI (5 minutes)

## Problem
- MongoDB Atlas doesn't allow your local machine to connect
- Need to IP whitelist OR use MongoDB UI directly

## ✅ Solution: MongoDB Atlas Web UI (Easiest, No IP needed)

### Step 1: Open MongoDB Atlas
https://cloud.mongodb.com/

### Step 2: Select Your Cluster  
- Click on your cluster "cluster0" or your project
- Click **"Collections"** tab

### Step 3: Navigate to Ledgers
- On left sidebar, find: `loopc_mg` → `ledgers`
- Click to open the ledgers collection

### Step 4: Search for Bad Entries
In the **Filter** box at top, paste:

```json
{
  "referenceType": "journal",
  "isDeleted": {"$ne": true},
  "description": {"$regex": "Exchange"}
}
```

Click "Apply" or press Enter

### Step 5: Review Results
You should see exactly **2 entries**:

| Date | Amount | Description |
|------|--------|-------------|
| 5/5/2026 | 5,954.65 | Exchange gain adjustment |
| 5/9/2026 | 85.95 | Exchange loss adjustment |

### Step 6: Delete Entries (Method A - Via Update)

Click the **">"** icon or dropdown next to each entry, then:
1. Click **"Edit"**
2. Find field: `"isDeleted"`
3. Change from: `false` → `true`
4. Find field: `"deletedAt"`  
5. Add new value: `{"$date": "2026-05-12T00:00:00Z"}`
6. Click **"Update"**
7. Repeat for second entry

**OR** Delete Both At Once (Method B):

1. With filter applied, click **"Delete"** button at top
2. Select **"Delete all matching documents"**
3. Confirm deletion

### Step 7: Verify Deletion

Clear the filter and search for the entries again:
```json
{
  "referenceType": "journal",
  "description": {"$regex": "Exchange"}
}
```

Should return: **0 results** ✅

### Step 8: Refresh Dashboard

1. Go to: https://mg.loopcstrategies.com/dashboard
2. Hard refresh: **Ctrl+Shift+R** (or Cmd+Shift+R on Mac)
3. Go to: Accounting → Accounts Enquiry
4. Account: **1000**
5. Click **"Load Summary"**
6. Verify:
   - **Balance: 0** (not 5,868.70) ✅
   - **Statement: 0 entries** (not 2) ✅

---

## Screenshots/Video

### In MongoDB Atlas Collections:
```
loopc_mg → ledgers

Filter: {"referenceType": "journal", "description": {"$regex": "Exchange"}}

Result:
  [1] ✓ Exchange gain adjustment for transaction ...
      Amount: 5,954.65
      isDeleted: false  ← CHANGE TO: true
      
  [2] ✓ Exchange loss adjustment for transaction ...
      Amount: 85.95
      isDeleted: false  ← CHANGE TO: true
```

### After Update:
```
Results: 0 items
(No more bad entries found)
```

### Dashboard After Refresh:
```
Account 1000: Cash on Hand
Balance: 0 Dr  ← Previously 5,868.70
Statement: 0 entries  ← Previously 2 entries
```

---

## Alternative: Add Your IP to Whitelist (If Preferred)

If you want to use the cleanup script instead:

1. Find your public IP: https://whatismyipaddress.com/
2. MongoDB Atlas → Network Access → Add IP Address
3. Paste your IP + click "Confirm"
4. Wait 5 minutes for changes to propagate
5. Run: `node backend/scripts/cleanup-smart.js`

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Can't find "Collections" tab | Click cluster name → Collections (should be next to "Overview") |
| Filter not working | Try without `{"$ne": true}` first: `{"referenceType": "journal"}` |
| Can't find ledgers collection | Search box on left side, type "ledgers" |
| Delete button grayed out | Make sure you have Admin role in MongoDB Atlas |
| Changes not showing in dashboard | Hard refresh browser: Ctrl+Shift+R |

---

## Quick Summary

✅ **Via MongoDB UI** (Recommended - 5 min):
- Open Collections → ledgers collection
- Find 2 exchange entries
- Update `isDeleted: true` on both
- Refresh dashboard → Done!

✅ **Via Local Script** (Advanced - 15 min):
- Add your IP to MongoDB Atlas whitelist
- Wait 5 min
- Run cleanup script
- Verify dashboard

---

**Start with MongoDB UI method above - it's the fastest!** 🚀
