require('./_destructive-guard')({ scriptName: __filename })
require("dotenv").config();
const mongoose = require("mongoose");

async function fixExistingVouchers() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
    
    const Transaction = require("./models/Transaction");
    const Ledger = require("./models/Ledger");
    const StockMovement = require("./models/StockMovement");
    const User = require("./models/User");
    
    const adminUser = await User.findOne({ role: "super_admin" });
    if (!adminUser) throw new Error("No admin user found");
    
    console.log("\n=== Fix Existing Voucher Entries ===\n");
    
    // Get sales that need fixing
    const sales = await Transaction.find({
      type: "sale",
      status: "posted"
    }).sort({ createdAt: 1 }).lean();
    
    console.log(`Processing ${sales.length} sales...\n`);
    
    for (const sale of sales) {
      const voucherNo = sale.voucherMeta?.vocNo || sale._id;
      const fixingType = sale.voucherMeta?.fixingType || sale.metalFixStatus || "not set";
      const isUnfixed = ['unfixed', 'non-fixing', 'nonfixing', 'non_fixing'].includes(String(fixingType).toLowerCase());
      
      console.log(`Processing: ${voucherNo} (${fixingType})`);
      
      // Get current entries
      const ledgerCount = await Ledger.countDocuments({
        referenceId: sale._id,
        referenceType: "sale",
        isDeleted: { $ne: true }
      });
      
      const stockCount = await StockMovement.countDocuments({
        reason: { $regex: voucherNo, $options: "i" }
      });
      
      if (isUnfixed) {
        // UNFIXED should have: NO ledger, YES stock
        if (ledgerCount > 0) {
          console.log(`  ⚠️  Removing ${ledgerCount} ledger entries (Unfixed should not have ledger)`);
          await Ledger.updateMany(
            { referenceId: sale._id, referenceType: "sale", isDeleted: { $ne: true } },
            { $set: { isDeleted: true, deletedAt: new Date(), updatedBy: adminUser._id } }
          );
        }
        if (stockCount === 0) {
          console.log(`  ⚠️  Missing stock movements! Cannot recreate without reposting.`);
        } else {
          console.log(`  ✅ Correct: ${stockCount} stock movements, 0 ledger entries`);
        }
      } else {
        // FIXED should have: YES ledger, NO stock
        if (stockCount > 0) {
          console.log(`  ⚠️  Removing ${stockCount} stock movements (Fixed should not have stock changes)`);
          // Note: We can't actually remove stock movements as they affect inventory
          // We'd need to reverse the inventory changes, which is complex
          console.log(`     (Note: Stock movements affect inventory, manual review recommended)`);
        }
        if (ledgerCount === 0) {
          console.log(`  ⚠️  Missing ledger entry! Cannot recreate without reposting.`);
        } else {
          console.log(`  ✅ Correct: ${ledgerCount} ledger entries`);
        }
      }
    }
    
    console.log("\n=== Summary ===");
    console.log("Ledger entries have been cleaned for Unfixed transactions.");
    console.log("Stock movements cannot be auto-cleaned (affect inventory).");
    console.log("\nBest approach: Delete these vouchers and recreate them with the new logic.\n");
    
  } catch (e) {
    console.error("Error:", e.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

fixExistingVouchers();
