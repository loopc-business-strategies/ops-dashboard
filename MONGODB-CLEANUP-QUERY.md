# Direct MongoDB Cleanup - MongoDB Atlas UI

## Quick Instructions

1. **Open MongoDB Atlas**: https://cloud.mongodb.com/
2. **Select Your Cluster**: "cluster0"
3. **Go to Collections Tab**
4. **Find "ledgers" collection**
5. **Click Query Editor** (or click ">" to expand)
6. **Paste this query exactly**:

```javascript
{
  "referenceType": "journal",
  "isDeleted": { "$ne": true },
  "description": { "$regex": "Exchange (gain|loss) adjustment", "$options": "i" }
}
```

7. **Click "Find"** to see results
8. **Verify you see 2 entries**:
   - Exchange Gain: 5,954.65
   - Exchange Loss: 85.95

9. **Then paste this Update query**:

```javascript
db.ledgers.updateMany(
  {
    "referenceType": "journal",
    "isDeleted": { "$ne": true },
    "description": { "$regex": "Exchange (gain|loss) adjustment", "$options": "i" },
    "$or": [
      { "debitAccountId": { "$regex": "1000" } },
      { "creditAccountId": { "$regex": "1000" } }
    ]
  },
  {
    "$set": {
      "isDeleted": true,
      "deletedAt": new Date(),
      "notes": "Cleaned up - bad exchange entries moved to AR/AP"
    }
  }
)
```

10. **Execute** and confirm: "Successfully updated X documents"

---

## OR Use MongoDB Compass

If you have MongoDB Compass installed locally:

1. Connect to: `mongodb+srv://...` (use your MONGO_URI_MG)
2. Navigate to: `loopc_mg` → `ledgers`
3. Set filter:
```javascript
{
  referenceType: "journal",
  isDeleted: { $ne: true },
  description: /Exchange (gain|loss) adjustment/i
}
```
4. Delete all results

---

## After Cleanup

**Refresh dashboard** and check Account 1000:
- Balance should show **0** (not 5,868.70)
- Statement should show **no entries** (or 0 entries)

---

## Need it done automatically? 

Run this in your terminal from `backend/` directory:

```bash
# If you have mongo shell installed:
mongo "mongodb+srv://..." << 'EOF'
use loopc_mg
db.ledgers.updateMany(
  {
    referenceType: "journal",
    isDeleted: { $ne: true },
    description: /Exchange (gain|loss) adjustment/i,
    $or: [
      { debitAccountId: ObjectId("CASH_1000_ID") },
      { creditAccountId: ObjectId("CASH_1000_ID") }
    ]
  },
  { $set: { isDeleted: true, deletedAt: new Date() } }
)
EOF
```

Replace with your actual connection string and Cash 1000 ObjectId.
