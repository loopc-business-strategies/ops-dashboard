# Fixed vs Unfixed Transaction Implementation

## Overview
Implemented separate posting logic for metal sale/purchase transactions to distinguish between:
- **UNFIXED (Stock Only)**: Updates physical inventory only, NO value posting
- **FIXED (Value Only)**: Posts financial value only, NO stock changes

## Changes Made

### Backend (`backend/routes/erp-accounting.js`)

#### 1. Modified `applyVoucherInventoryImpact()` (line 260)
- Added check for `tx.voucherMeta?.fixingType` and `tx.metalFixStatus`
- If FIXED: Skip inventory impact entirely (return early)
- If UNFIXED: Process stock movements only (no COGS ledger entry)
- Stock movement reason now includes "(FIXED)" or "(UNFIXED)" label

#### 2. Modified `applyTransactionWorkflowAction()` 'post' action (line 532)
- Added fixingType detection logic
- If UNFIXED: Skip ledger entry creation, only apply inventory impact
- If FIXED: Create ledger entry, skip inventory impact
- Non-sale/purchase transactions work as before

### Frontend (`frontend/src/components/tabs/VoucherTab.jsx`)

#### 1. Transaction List Display (line 1841)
- Added "Fixing" column to transaction table (only for sale/purchase)
- Shows "Fixed" (green badge) or "Unfixed" (red badge)
- Column positioned after Party Name, before Currency

#### 2. Form Display (line 2207)
- Fixing Type selector already present (Fixed/UnFixed dropdown)
- Displays for metal sale/purchase vouchers only

## How It Works

### UNFIXED Transaction Flow
```
Sale: 100 units @ 10 USD each
↓
[POST]
├─ Stock Movement: -100 units recorded
├─ NO Ledger entry created
└─ NO Revenue (4000) posting
```

**Account Impact:**
- Inventory: -100 units
- AR: NO change
- Revenue: NO change

### FIXED Transaction Flow
```
Sale: 100 units @ 10 USD each = 1,000 USD value
↓
[POST]
├─ NO Stock Movement
├─ Ledger: Dr 1100 (AR) Cr 4000 (Revenue) for 1,000
└─ NO Inventory quantity change
```

**Account Impact:**
- Inventory: NO change
- AR: +1,000
- Revenue: +1,000

## Testing

### Manual Testing via UI

1. **Create UNFIXED Sale:**
   - Go to Metal Sale tab
   - Enter party, items, amount
   - Set Fixing Type = **UnFixed**
   - Submit → Approve → Post
   - Check: Stock decreases, NO revenue posted

2. **Create FIXED Sale:**
   - Go to Metal Sale tab
   - Enter party, items, amount
   - Set Fixing Type = **Fixed**
   - Submit → Approve → Post
   - Check: Revenue posted, stock unchanged

3. **View in Account Summary:**
   - Note: Unfixed sales only show stock impact
   - Note: Fixed sales show revenue in account balance

### Database Verification

```javascript
// Check UNFIXED transaction
db.stockmovements.findOne({ reason: /UNFIXED.*vocNo/ })
  // Should exist

db.ledgers.findOne({ referenceId: txId, referenceType: "sale" })
  // Should NOT exist

// Check FIXED transaction
db.stockmovements.findOne({ reason: /FIXED.*vocNo/ })
  // Should NOT exist

db.ledgers.findOne({ referenceId: txId, referenceType: "sale" })
  // Should exist
```

## Account Mapping

### UNFIXED Transactions
- **Sale**: Stock decreases, NO ledger entry
- **Purchase**: Stock increases, NO ledger entry

### FIXED Transactions
- **Sale**: Dr 1100 (AR) Cr 4000 (Revenue)
- **Purchase**: Dr 1210 (Metal Inv) Cr 2000 (AP)

## Edge Cases Handled

1. **Default behavior**: If fixingType not specified, defaults to "FIXED" (value posting)
2. **Non-sale/purchase**: Ignores fixingType, posts normally
3. **Payment/Receipt**: Not affected by fixingType
4. **Expense transactions**: Not affected by fixingType

## Frontend Display

### Transaction List
Shows Fixing status as badge:
- 🟢 Green "Fixed" - value only
- 🔴 Red "Unfixed" - stock only

### Form
Dropdown selector in header details:
- Fixed (posts value)
- UnFixed (posts stock only)

## Next Steps (if needed)

1. Add Account Summary breakdown by fixing type
   - Show total fixed balance separate from unfixed
   - Display metal balance (unfixed only) vs revenue balance (fixed only)

2. Add reporting filters
   - Filter transactions by fixing type in reports
   - Show impact analysis by fixing type

3. Add audit trail
   - Track fixing type changes in transaction history
   - Log why each type was chosen

## Compatibility

- ✅ Existing FIXED transactions continue to work
- ✅ New UNFIXED transactions work as designed
- ✅ No breaking changes to other transaction types
- ✅ Backward compatible with prior database data
