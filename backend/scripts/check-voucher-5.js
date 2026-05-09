require("dotenv").config();
const mongoose = require("mongoose");

async function checkVoucher5() {
  try {
    if (!process.env.MONGO_URI_LOOPC) throw new Error('Missing MONGO_URI_LOOPC');
    await mongoose.connect(process.env.MONGO_URI_LOOPC);
    
    const Transaction = require("./models/Transaction");
    const Ledger = require("./models/Ledger");
    const StockMovement = require("./models/StockMovement");
    
    console.log("\n=== Checking Voucher 5 Status ===\n");
    
    // Find Voucher 5
    const voc5 = await Transaction.findOne({
      "voucherMeta.vocNo": "5"
    }).populate("customerId", "name code");
    
    if (!voc5) {
      console.log("❌ Voucher 5 NOT FOUND in database");
      console.log("\nSearching for all recent sales...\n");
      
      const allSales = await Transaction.find({
        type: "sale"
      }).sort({ createdAt: -1 }).limit(10).select("voucherMeta.vocNo status amount type createdAt").lean();
      
      console.log("Recent sales:");
      allSales.forEach(s => {
        console.log(`  - ${s.voucherMeta?.vocNo || 'NO VOC NO'}: Status=${s.status}, Amount=$${s.amount}, Type=${s.type}`);
      });
      
      await mongoose.disconnect();
      process.exit(0);
    }
    
    console.log(`Voucher #: ${voc5.voucherMeta?.vocNo || 'NOT SET'}`);
    console.log(`Amount: $${voc5.amount}`);
    console.log(`Status: ${voc5.status}`);
    console.log(`Fixing Type: ${voc5.voucherMeta?.fixingType || voc5.metalFixStatus || 'NOT SET'}`);
    console.log(`Customer: ${voc5.customerId?.name || 'NOT SET'} (${voc5.customerId?.code || ''})`);
    console.log(`Debit Account: ${voc5.debitAccountId}`);
    console.log(`Credit Account: ${voc5.creditAccountId}`);
    console.log(`Journal Entry ID: ${voc5.journalEntryId || 'NOT SET'}`);
    
    // Check ledger entries
    console.log(`\n--- Ledger Entries ---`);
    const ledgerEntries = await Ledger.find({
      referenceId: voc5._id,
      isDeleted: { $ne: true }
    }).populate("debitAccountId", "accountCode accountName").populate("creditAccountId", "accountCode accountName").lean();
    
    console.log(`Total: ${ledgerEntries.length}`);
    ledgerEntries.forEach(le => {
      console.log(`  Type: ${le.referenceType}`);
      console.log(`  Dr: ${le.debitAccountId?.accountCode} (${le.debitAccountId?.accountName})`);
      console.log(`  Cr: ${le.creditAccountId?.accountCode} (${le.creditAccountId?.accountName})`);
      console.log(`  Amount: $${le.amount}`);
    });
    
    // Check stock movements
    console.log(`\n--- Stock Movements ---`);
    const stockMoves = await StockMovement.find({
      reason: { $regex: voc5.voucherMeta?.vocNo || '', $options: "i" }
    }).lean();
    
    console.log(`Total: ${stockMoves.length}`);
    stockMoves.forEach(sm => {
      console.log(`  ${sm.itemName}: ${sm.quantityBefore} → ${sm.quantityAfter}`);
    });
    
    // Summary
    console.log(`\n--- Analysis ---`);
    const isUnfixed = ['unfixed', 'non-fixing', 'nonfixing', 'non_fixing'].includes(String(voc5.voucherMeta?.fixingType || voc5.metalFixStatus || '').toLowerCase());
    
    console.log(`Fixing Type Analysis: ${isUnfixed ? 'UNFIXED' : 'FIXED'}`);
    
    if (voc5.status !== 'posted') {
      console.log(`❌ Status is "${voc5.status}" - NOT POSTED yet!`);
      console.log(`   Action needed: Submit → Approve → Post`);
    } else {
      console.log(`✓ Status is "posted"`);
      
      if (isUnfixed) {
        console.log(`\n✓ UNFIXED Transaction should have:`);
        console.log(`  • Stock Movements: ${stockMoves.length > 0 ? '✓ YES' : '❌ NO'}`);
        console.log(`  • Ledger Entries: ${ledgerEntries.length === 0 ? '✓ NO' : '❌ YES'}`);
      } else {
        console.log(`\n✓ FIXED Transaction should have:`);
        console.log(`  • Stock Movements: ${stockMoves.length === 0 ? '✓ NO' : '❌ YES'}`);
        console.log(`  • Ledger Entries: ${ledgerEntries.length > 0 ? '✓ YES' : '❌ NO'}`);
      }
    }
    
  } catch (e) {
    console.error("Error:", e.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

checkVoucher5();
