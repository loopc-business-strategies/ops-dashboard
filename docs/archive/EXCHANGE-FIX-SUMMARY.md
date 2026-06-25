> **ARCHIVED — do not use for current operations.**  
> This is a historical snapshot and may not match the codebase.  
> Canonical docs: [docs/DEPLOY.md](../DEPLOY.md) · [README.md](../../README.md)

# Exchange Entry Fix - Complete Implementation & Testing

## ✅ COMPLETED

### Code Changes (Deployed)
- ✅ [backend/routes/erp-accountingContext.js](backend/routes/erp-accountingContext.js):
  - Updated `resolveExchangeAdjustmentAccounts()` to use AR/AP accounts
  - Modified exchange posting logic to pass transaction type and offset account
  - New entries now post to AR/AP (1100/2000) and P&L (4190/5190), NOT Cash (1000)

- ✅ Commit: `d7333e3` pushed to main
- ✅ Deployed: Backend running with new logic at https://api.loopcstrategies.com

### Helper Scripts Created
- ✅ [backend/scripts/cleanup-exchange-entries.js](backend/scripts/cleanup-exchange-entries.js) - Automated cleanup
- ✅ [backend/scripts/audit-exchange-entries.js](backend/scripts/audit-exchange-entries.js) - List bad entries
- ✅ [backend/scripts/test-exchange-posting.js](backend/scripts/test-exchange-posting.js) - Test new routing

### Documentation Created
- ✅ [EXCHANGE-CLEANUP-GUIDE.md](EXCHANGE-CLEANUP-GUIDE.md) - Comprehensive cleanup guide
- ✅ [CLEANUP-MANUAL-GUIDE.md](CLEANUP-MANUAL-GUIDE.md) - MongoDB Atlas UI instructions

---

## 📋 PENDING: User Actions Required

### Step 1: Clean Up Existing Bad Entries (Choose One)

#### Option A: Automated Cleanup (Preferred)
```bash
cd backend
node scripts/cleanup-exchange-entries.js
```
✓ Requires: MongoDB connectivity from your machine

#### Option B: Manual via MongoDB Atlas UI (Easiest)
See: [CLEANUP-MANUAL-GUIDE.md](CLEANUP-MANUAL-GUIDE.md)

**Quick steps:**
1. Open: https://cloud.mongodb.com/ → Your cluster → Collections
2. Find "ledgers" collection
3. Search for entries with:
   - `description` contains "Exchange (gain|loss)"
   - `debitAccountId` or `creditAccountId` = Cash 1000 account ID
4. Delete both entries (set `isDeleted: true`)

**Bad entries to delete (MG Tenant):**
- Exchange Gain: 5,954.65 USD (2026-05-05)
- Exchange Loss: 85.95 USD (2026-05-09)

#### Option C: Direct Shell Command
If you have `mongo` shell access:
```javascript
use loopc_mg
db.ledgers.updateMany(
  {
    referenceType: "journal",
    description: /Exchange (gain|loss) adjustment/i,
    $or: [
      { debitAccountId: ObjectId("<CASH_1000_ID>") },
      { creditAccountId: ObjectId("<CASH_1000_ID>") }
    ]
  },
  {
    $set: {
      isDeleted: true,
      deletedAt: new Date(),
      notes: "Cleaned up by Option B - exchange entries now post to AR/AP"
    }
  }
)
```

---

### Step 2: Verify Cash Account is Clean

**In Dashboard (MG Tenant):**
1. Go to: Accounting → Accounts Enquiry
2. Account Number: **1000** (Cash on Hand)
3. Click "Load Summary"
4. **Verify Balance**:
   - ❌ Before: 5,868.70 Dr (from bad exchange entries)
   - ✅ After: 0 or opening balance only

**In MongoDB Atlas Query:**
```javascript
db.ledgers.find({
  accountCode: "1000",
  isDeleted: { $ne: true },
  description: /Exchange/i
})
// Should return: No results
```

---

### Step 3: Test New Exchange Routing (AR/AP posting)

**Option A: Via API (if you have auth token)**
```bash
# Create payment with foreign currency
curl -X POST https://api.loopcstrategies.com/api/erp-accounting/transactions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "type": "payment",
    "amount": 1000,
    "currency": "AED",
    "date": "2026-05-12",
    "description": "[TEST-FX] Verify AR/AP routing",
    "voucherMeta": {
      "vocNo": "TEST-FX-001",
      "referenceExchangeRate": 3.67,
      "lineItems": [{
        "currCode": "AED",
        "currRate": 3.75,
        "amountFC": 3750
      }]
    }
  }'
```

**Option B: Via Dashboard UI**
1. Create new Payment voucher in MG tenant
2. Select foreign currency (e.g., AED)
3. Enter reference rate and settlement rate
4. Save and post

**Option C: Direct MongoDB Test**
```javascript
// After creating test transaction, verify:
db.ledgers.find({
  referenceType: "journal",
  description: /Exchange (gain|loss) adjustment/i,
  _id: new ObjectId() // Latest entry
})

// Result should show:
// - debitAccountId: AR (1100) or AP (2000) — NOT Cash (1000) ✅
// - creditAccountId: Exchange Gain (4190) or Exchange Loss (5190)
```

---

### Step 4: Verify Correct Posting

**In Account Enquiry (Dashboard):**
1. Check Account 1000 (Cash) → Should NOT have new exchange entry
2. Check Account 2000 (AP) → Should have exchange entry
3. Check Account 4190 (Exchange Gain) → Should have P&L entry

**Expected Journal Entry (Option B):**
```
Debit: Accounts Payable (2000) ... 85.35 USD
Credit: Exchange Gain (4190) ... 85.35 USD
(For a gain on payment transaction)
```

---

### Step 5: Clean Up Test Entries

After verification, remove test transaction:

**Via API:**
```bash
DELETE https://api.loopcstrategies.com/api/erp-accounting/transactions/{TEST_TX_ID}
```

**Via MongoDB:**
```javascript
db.transactions.updateOne(
  { _id: ObjectId("TEST_TX_ID"), description: /TEST-FX/ },
  { $set: { isDeleted: true } }
)
```

---

## 📊 Before & After Summary

### Before (Option A - Broken)
```
Cash Account 1000:
  Opening Balance: 0
  Exchange Gain (debit): +5,954.65 ❌ WRONG ACCOUNT
  Exchange Loss (credit): -85.95 ❌ WRONG ACCOUNT
  Balance: 5,868.70 Dr (distorted by accounting adjustments)

P&L:
  Exchange Gain (4190): Not used ❌
  Exchange Loss (5190): Not used ❌

Issue: Cash balance inflated, P&L not visible
```

### After (Option B - Correct)
```
Cash Account 1000:
  Opening Balance: 0
  Only actual bank transactions (payments/receipts)
  Balance: 0 Dr (clean, accurate)

Accounts Payable (2000):
  Exchange Loss (2000): -85.95 (debit side of FX entry)
  
Exchange Gain/Loss P&L (4190/5190):
  Exchange Gain (4190): +85.95 (credit side)
  Shows FX profit/loss in P&L ✅

Result: Cash is clean, FX adjustments visible in P&L, AR/AP updated
```

---

## ⚠️ MongoDB Connectivity Issue

If cleanup scripts fail with `querySrv ECONNREFUSED`:
- This is a DNS/network issue from your local machine → MongoDB Atlas
- **Solution**: Use MongoDB Atlas UI directly (Option B)
- **Alternative**: Connect via VPN or wait for Railway environment variables to be available
- **Workaround**: Run via Railway shell (if available):
  ```bash
  railway shell
  cd backend && node scripts/cleanup-exchange-entries.js
  ```

---

## 🔍 Troubleshooting

| Issue | Cause | Solution |
|-------|-------|----------|
| Bad entries still showing | Not deleted | Verify `isDeleted: true` in MongoDB |
| New entries still post to Cash | Code not deployed | Check Railway deployment status |
| Cannot connect to MongoDB | Network/whitelist | Use MongoDB Atlas UI method |
| Test transaction not created | Auth/permission issue | Verify user has Finance role |
| Balance still shows 5,868.70 | Cache not refreshed | Hard refresh (Ctrl+Shift+R) |

---

## ✅ Completion Checklist

- [ ] Code deployed (verified: d7333e3)
- [ ] Cleanup scripts created (3 scripts)
- [ ] Existing bad entries deleted from Cash 1000
- [ ] Cash 1000 balance shows clean (0 or opening balance)
- [ ] Test payment with FX created
- [ ] Verified test entry posted to AR/AP, NOT Cash
- [ ] Verified P&L accounts show exchange entry
- [ ] Test entries deleted (cleanup)
- [ ] All future FX entries will use Option B routing ✅

---

## 📞 Next Steps

1. **Immediate** (Today): Run cleanup using MongoDB Atlas UI
2. **Verify** (1 hour): Check Cash 1000 balance in dashboard
3. **Test** (1 hour): Create FX transaction and verify AR/AP posting
4. **Validate** (Ongoing): Monitor future exchange entries in reports

---

**Status**: ✅ Implementation Complete | 📋 Awaiting User Cleanup & Testing
