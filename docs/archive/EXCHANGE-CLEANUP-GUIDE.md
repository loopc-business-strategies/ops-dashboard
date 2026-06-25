> **ARCHIVED — do not use for current operations.**  
> This is a historical snapshot and may not match the codebase.  
> Canonical docs: [docs/DEPLOY.md](../DEPLOY.md) · [README.md](../../README.md)

# Exchange Entry Cleanup & Testing Guide (Option B)

## Overview
Exchange gain/loss entries have been moved from **Cash (1000)** to **AR/AP (1100/2000)** per Option B.

**Existing bad entries in MG**: 
- Exchange Gain: 5,954.65 (posted to Cash 1000 - debit)
- Exchange Loss: 85.95 (posted to Cash 1000 - credit)
- **Action**: Must be deleted/removed from Cash and will be recreated correctly on next transaction

---

## Option 1: Automated Cleanup (Recommended)

### Step 1: Verify MongoDB Connectivity
```bash
cd backend
node -e "
require('dotenv').config()
const mongoose = require('mongoose')
mongoose.connect(process.env.MONGO_URI_MG, {
  serverSelectionTimeoutMS: 5000
}).then(() => {
  console.log('✓ MongoDB connected')
  process.exit(0)
}).catch(e => {
  console.error('✗ Error:', e.message)
  process.exit(1)
})
"
```

### Step 2: Run Cleanup Script
```bash
node scripts/cleanup-exchange-entries.js
```

**Expected output:**
```
Connecting to MongoDB...
✓ Connected to MongoDB
✓ Found Cash account: Cash on Hand

Found 2 exchange entries posted to cash account:
  [1] Exchange gain adjustment for transaction ...
      Amount: 5954.65 USD | Date: 2026-05-05
  [2] Exchange loss adjustment for transaction ...
      Amount: 85.95 USD | Date: 2026-05-09

✓ Soft-deleted 2 bad exchange entries

Cash account (1000) is now clean!
```

---

## Option 2: Manual MongoDB Cleanup

If automated cleanup fails, use MongoDB directly:

### Connect to MongoDB Atlas
```bash
# In MongoDB Atlas Web UI → Collections → filter by:
db.ledgers.find({
  referenceType: 'journal',
  isDeleted: { $ne: true },
  description: /Exchange (gain|loss) adjustment/i,
  $or: [
    { debitAccountId: ObjectId("1000-account-id") },
    { creditAccountId: ObjectId("1000-account-id") }
  ]
})
```

### Delete Bad Entries
```javascript
// In MongoDB Atlas → Query Console
db.ledgers.updateMany(
  {
    referenceType: 'journal',
    description: /Exchange (gain|loss) adjustment/i,
    $or: [
      { debitAccountId: ObjectId("CASH_ACCOUNT_1000_ID") },
      { creditAccountId: ObjectId("CASH_ACCOUNT_1000_ID") }
    ]
  },
  {
    $set: {
      isDeleted: true,
      deletedAt: new Date(),
      notes: 'Manually cleaned up - Option B routing'
    }
  }
)
```

---

## Option 3: Verify via Dashboard

In the frontend, check MG tenant → Accounts Enquiry → Account 1000 (Cash on Hand):
- **Before fix**: Shows 5,868.70 Dr balance from bad exchange entries
- **After cleanup**: Shows 0 (or correct opening balance only)
- **After new transactions**: Shows only actual cash movements

---

## Testing: Verify New Exchange Posting to AR/AP

### Step 1: Create Test Payment (Foreign Currency)
```bash
# Call this via frontend or API:
POST /api/erp-accounting/transactions

{
  "type": "payment",
  "amount": 1000,
  "currency": "AED",
  "exchangeRate": 3.67,
  "date": "2026-05-12",
  "description": "[TEST] FX Payment - verify AR/AP posting",
  "voucherMeta": {
    "vocNo": "TEST-FX-001",
    "referenceExchangeRate": 3.67,
    "lineItems": [{
      "currCode": "AED",
      "currRate": 3.75,
      "amountFC": 3750
    }]
  }
}
```

### Step 2: Verify Exchange Entry Posted to AR/AP
In frontend → Accounts Enquiry:
1. Check **Account 1000 (Cash)** → Should NOT have new exchange entries
2. Check **Account 2000 (Accounts Payable)** → Should have new exchange gain/loss entry
3. Check **Account 4190 (Exchange Gain)** → Should have corresponding P&L entry

### Expected Result:
**Before Option B:**
- Cash 1000 Debit: Exchange Gain 5,954.65 ❌

**After Option B:**
- Cash 1000: Only actual bank payments
- AP 2000 Debit: Exchange Gain 5,954.65 ✅
- Exchange Gain 4190 Credit: 5,954.65 ✅

---

## Cleanup Test Data

After verifying Option B works, remove test transaction:

```bash
DELETE /api/erp-accounting/transactions/{TEST_TRANSACTION_ID}
```

This will soft-delete the test transaction and all its related ledger entries.

---

## Verification Checklist

- [ ] Old bad entries (5,954.65 gain + 85.95 loss) removed from Cash 1000
- [ ] Cash 1000 balance now shows clean state (0 or opening balance only)
- [ ] Created test payment with foreign currency
- [ ] Test payment exchange entries posted to AP 2000, not Cash 1000
- [ ] Test transaction deleted (cleanup)
- [ ] New payment/receipt transactions now route FX entries to AR/AP correctly

---

## Troubleshooting

### MongoDB Connection Error
**Error**: `querySrv ECONNREFUSED`
- Check MongoDB Atlas IP whitelist includes your machine/Railway IP
- Verify MONGO_URI_MG in .env is correct
- Try Railway environment: `railway run node scripts/cleanup-exchange-entries.js`

### Script Not Found
```bash
ls -la backend/scripts/cleanup-exchange-entries.js
# Verify file exists and has proper permissions
```

### Entries Still Showing
- Refresh the dashboard
- Check if isDeleted filter is applied in the account enquiry API
- Verify soft-delete worked: check `isDeleted: true` in MongoDB

---

## Next Steps

1. **Immediate**: Run cleanup script or manual deletion
2. **Within 24h**: Test new FX transactions post to AR/AP correctly
3. **Ongoing**: All future exchange entries will use Option B routing
4. **Reporting**: P&L will now show exchange gains/losses cleanly separate from cash

---
