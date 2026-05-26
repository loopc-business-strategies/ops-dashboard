# Quick Exchange Entries Manual Cleanup (MongoDB Atlas UI)

## Problem
- MG Tenant has 2 bad exchange entries posted to **Cash account 1000**:
  - Exchange Gain: 5,954.65 USD (debit side)
  - Exchange Loss: 85.95 USD (credit side)
- Total impact on Cash 1000: 5,868.70 Dr (should be 0)
- **Action**: Delete these entries from MongoDB

## Solution: Delete via MongoDB Atlas UI

### Step 1: Open MongoDB Atlas
1. Go to: https://cloud.mongodb.com/
2. Login → Your cluster "cluster0" → Collections tab

### Step 2: Find Ledger Collection
1. Click **"ledgers"** collection
2. Or search for `ledgers`

### Step 3: Filter for Bad Entries
In the query filter box, paste:
```json
{
  "referenceType": "journal",
  "isDeleted": { "$ne": true },
  "description": { "$regex": "Exchange (gain|loss) adjustment", "$options": "i" },
  "$or": [
    { "debitAccountId": { "$regex": "1000" } },
    { "creditAccountId": { "$regex": "1000" } }
  ]
}
```

### Step 4: Review Results
You should see 2 entries:
```
1. "Exchange gain adjustment for transaction ..."
   - Amount: 5954.65
   - Date: 2026-05-05

2. "Exchange loss adjustment for transaction ..."
   - Amount: 85.95
   - Date: 2026-05-09
```

### Step 5: Delete via Update
For each entry shown:
1. Click the entry row
2. Click "..." → "Edit"
3. Update these fields:
   ```json
   "isDeleted": true,
   "deletedAt": { "$date": "2026-05-12T00:00:00Z" }
   ```
4. Click "Update"
5. Repeat for both entries

**OR** Delete both at once:
1. Click "Delete" button on the query results
2. Confirm deletion

---

## Verify Cleanup

### Option A: Check via Dashboard
1. Open https://mg.loopcstrategies.com (MG tenant)
2. Go to: Accounting → Accounts Enquiry
3. Search Account: **1000** (Cash on Hand)
4. Click "Load Summary"
5. **Expected**: Balance shows 0 or opening balance only (not 5,868.70)

### Option B: Check Ledger Directly
```json
// MongoDB Atlas Query
db.ledgers.find({
  "accountCode": "1000",
  "isDeleted": { "$ne": true }
})
// Should return NO exchange entries
```

---

## After Cleanup

✅ **Cash account 1000 is now clean!**

New exchange entries will automatically post to:
- **Accounts Payable (2000)** for payment transactions
- **Accounts Receivable (1100)** for receipt transactions
- **P&L accounts**: Exchange Gain (4190) / Exchange Loss (5190)

Cash will only show actual bank transactions.

---

## Need Help?

If filter doesn't work:
1. **Remove the $or condition** and search only:
   ```json
   { "description": { "$regex": "Exchange" } }
   ```
2. Review results manually for entries with amount ~5954.65 or ~85.95
3. Delete each one

Or contact: Check backend logs via `railway logs --service ops-dashboard`

---
