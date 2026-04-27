require("dotenv").config();
const mongoose = require("mongoose");
const Transaction = require("./models/Transaction");
const Ledger = require("./models/Ledger");
const StockMovement = require("./models/StockMovement");
const InventoryItem = require("./models/InventoryItem");
const User = require("./models/User");
const ChartOfAccount = require("./models/ChartOfAccount");

async function testFixingUnfixingLogic() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
    
    const adminUser = await User.findOne({ role: "super_admin" });
    if (!adminUser) throw new Error("No admin user found");
    
    console.log("\n=== Testing Fixed vs Unfixed Transaction Posting ===\n");
    
    // Get all posted metal sales
    const metalSales = await Transaction.find({
      type: "sale",
      status: "posted",
      "voucherMeta.vocNo": { $exists: true }
    }).sort({ createdAt: -1 }).limit(5).lean();
    
    console.log(`Found ${metalSales.length} posted metal sales\n`);
    
    if (metalSales.length === 0) {
      console.log("No posted metal sales found. Please create some transactions first.");
      await mongoose.disconnect();
      return;
    }
    
    for (const sale of metalSales) {
      console.log(`\n--- Sale: ${sale.voucherMeta?.vocNo || sale._id} ---`);
      console.log(`Amount: ${sale.amount}, Status: ${sale.status}`);
      console.log(`Fixing Type: ${sale.voucherMeta?.fixingType || sale.metalFixStatus || "not set"}`);
      console.log(`Debit: ${sale.debitAccountId}, Credit: ${sale.creditAccountId}`);
      
      // Check ledger entries
      const ledgerEntries = await Ledger.find({
        $or: [
          { referenceType: "sale", referenceId: sale._id },
          { referenceType: "cogs", referenceId: sale._id }
        ],
        isDeleted: { $ne: true }
      }).populate("debitAccountId", "accountCode accountName").populate("creditAccountId", "accountCode accountName").lean();
      
      console.log(`  Ledger Entries: ${ledgerEntries.length}`);
      ledgerEntries.forEach(le => {
        const debAcc = le.debitAccountId;
        const credAcc = le.creditAccountId;
        console.log(`    - Dr ${debAcc?.accountCode} ${debAcc?.accountName} Cr ${credAcc?.accountCode} ${credAcc?.accountName} = ${le.amount}`);
      });
      
      // Check stock movements
      const stockMovements = await StockMovement.find({
        reason: { $regex: `Voucher sale.*${sale.voucherMeta?.vocNo || ""}`, $options: "i" }
      }).lean();
      
      console.log(`  Stock Movements: ${stockMovements.length}`);
      stockMovements.forEach(sm => {
        console.log(`    - ${sm.itemName}: ${sm.quantityBefore} → ${sm.quantityAfter} (${sm.change})`);
      });
    }
    
    console.log("\n=== Summary ===");
    console.log("For FIXED transactions: Should see ledger entries but NO stock movements");
    console.log("For UNFIXED transactions: Should see stock movements but NO ledger entries");
    console.log("\n");
    
  } catch (e) {
    console.error("Error:", e.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

testFixingUnfixingLogic();
