> **ARCHIVED — do not use for current operations.**  
> This is a historical snapshot and may not match the codebase.  
> Canonical docs: [docs/DEPLOY.md](../DEPLOY.md) · [README.md](../../README.md)

# Multi-Line Voucher Exchange Gain Fix

## Problem
When adding a **second line item** to a voucher, the system was calculating exchange gain/loss based on **all aggregated line items' foreign amounts** instead of just the **primary (first) line item**. This caused incorrect FX adjustments.

**Example:**
- Line 1: 100 AED (USD equivalent: 27.26 USD at rate 3.674)
- Line 2: 50 AED (USD equivalent: 13.63 USD at rate 3.674)
- **Old behavior**: Aggregated 150 AED as the foreign amount → incorrect FX calculation
- **New behavior**: Uses only 100 AED (Line 1) for FX calculation → correct

## Solution

### 1. Fixed Backend FX Calculation Logic
**File:** `backend/services/erpAccounting/fxRevaluationService.js`

**Changed function:** `resolveVoucherFxMetrics`

**What changed:**
- Now uses **only the primary (first) line item** with currency information for FX calculations
- Previously aggregated ALL line items' foreign amounts together
- This prevents multi-line vouchers from incorrectly triggering exchange gain/loss

**Code change:**
```javascript
// BEFORE: Summed all line items
lines.forEach((line) => {
  totalForeignAmount += foreignAmount
  totalBaseAmount += baseAmount
})

// AFTER: Use only primary line
const primaryLine = resolvePrimaryVoucherFxLine(voucherMeta)
const foreignAmount = resolveVoucherFxLineForeignAmount(primaryLine)
```

### 2. Created Voucher Verification Script
**File:** `backend/scripts/fix-multi-line-voucher-fx-mg.js`

**Purpose:** Identifies and fixes existing vouchers in mg tenant

**What it does:**
1. Finds all posted payment/receipt vouchers with multiple line items
2. Checks if they have exchange gain/loss journals
3. Identifies if those FX journals were calculated based on aggregated amounts
4. If found, removes the incorrect FX journals
5. Provides a summary report

**Run the script:**
```bash
cd backend && node scripts/fix-multi-line-voucher-fx-mg.js
```

**Expected output:**
```
✅ Connected to mg database
📋 Scanning mg for multi-line vouchers with FX issues...

======================================================================
📊 SUMMARY FOR TENANT: mg
======================================================================

Total multi-line vouchers checked: [number]
  - With correct FX journals: [number]
  - With removed FX journals: [number]
  - With no FX journals: [number]
  - With no reference rate: [number]

✅ Fixed [number] vouchers by removing incorrect FX journals
```

## How to Verify the Fix

### Test in mg Vouchers Tab:

1. **Create a new Payment/Receipt voucher**
2. **Add Line Item 1:**
   - Currency: AED
   - Amount (FC): 100
   - Rate: 3.674
3. **Add Line Item 2:**
   - Currency: AED (same or different)
   - Amount (FC): 50
   - Rate: 3.674
4. **Set a reference rate** (different from settlement rate) to trigger FX calculation
5. **Post the voucher**

**Expected behavior (after fix):**
- Exchange gain/loss calculated based on **Line 1 amount only** (100 AED)
- Line 2 is a separate line item and should NOT affect FX calculation
- If only Line 1 has a currency mismatch with reference rate → FX journal created
- If Line 1 matches reference rate → No FX journal (correct!)

### Check Existing Vouchers:

Run the verification script to automatically find and fix any impacted vouchers:

```bash
cd backend && node scripts/fix-multi-line-voucher-fx-mg.js
```

## Impact

### What gets fixed:
- ✅ Multi-line vouchers will now calculate FX gain/loss correctly
- ✅ New vouchers with multiple line items will not trigger spurious FX entries
- ✅ Existing vouchers with incorrect FX journals can be cleaned up

### What stays the same:
- ✅ Single-line vouchers unaffected (they already worked correctly)
- ✅ All other voucher types (purchase, sale) unaffected
- ✅ Existing posted vouchers remain as-is (script removes only incorrect entries)

## Deployment Checklist

- [x] Fix FX metrics calculation in `fxRevaluationService.js`
- [x] Create cleanup script `fix-multi-line-voucher-fx-mg.js`
- [ ] Run script to check mg tenant vouchers
- [ ] Review any removed FX journals in logs
- [ ] Test new multi-line voucher creation in mg
- [ ] Document any manual corrections needed
- [ ] Repeat for cg and loopc tenants if needed

## Files Modified

1. `backend/services/erpAccounting/fxRevaluationService.js` - Core FX calculation fix
2. `backend/scripts/fix-multi-line-voucher-fx-mg.js` - New verification/cleanup script

## Questions?

Check the test file for exchange gain/loss behavior:
- `backend/tests/erp-accounting-transactions.test.js` - Lines ~900 for FX tests
