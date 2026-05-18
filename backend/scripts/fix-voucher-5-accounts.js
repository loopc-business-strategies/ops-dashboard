require('./destructive/_destructive-guard')({ scriptName: __filename })
require("dotenv").config();
const mongoose = require("mongoose");

async function fixVoucher5Accounts() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
    
    const Transaction = require("./models/Transaction");
    const ChartOfAccount = require("./models/ChartOfAccount");
    
    console.log("\n=== Fixing Voucher 5 Accounts ===\n");
    
    // Find Voucher 5
    const voc5 = await Transaction.findOne({
      "voucherMeta.vocNo": "5"
    });
    
    if (!voc5) {
      console.log("❌ Voucher 5 not found");
      await mongoose.disconnect();
      process.exit(0);
    }
    
    console.log(`Current state: debitAccountId=${voc5.debitAccountId}, creditAccountId=${voc5.creditAccountId}`);
    
    // For UNFIXED sale, we need:
    // Dr: Customer ledger account (AR like 1301)
    // Cr: Sales Revenue (4000)
    // But we don't create the ledger entry, just reference the accounts
    
    // Get or create AR account
    const arAccount = await ChartOfAccount.findOne({ accountCode: "1100" });
    const revenueAccount = await ChartOfAccount.findOne({ accountCode: "4000" });
    
    if (!arAccount) {
      console.log("❌ AR Account (1100) not found");
      await mongoose.disconnect();
      process.exit(0);
    }
    
    if (!revenueAccount) {
      console.log("❌ Revenue Account (4000) not found");
      await mongoose.disconnect();
      process.exit(0);
    }
    
    console.log(`Found AR Account: ${arAccount.accountCode} - ${arAccount.accountName}`);
    console.log(`Found Revenue Account: ${revenueAccount.accountCode} - ${revenueAccount.accountName}`);
    
    // Update transaction with accounts
    voc5.debitAccountId = arAccount._id;
    voc5.creditAccountId = revenueAccount._id;
    await voc5.save();
    
    console.log(`\n✅ Updated Voucher 5:`);
    console.log(`   Debit: ${arAccount.accountCode} (${arAccount.accountName})`);
    console.log(`   Credit: ${revenueAccount.accountCode} (${revenueAccount.accountName})`);
    console.log(`\n✅ Voucher 5 will now appear in Account Summary for Account ${arAccount.accountCode}`);
    
  } catch (e) {
    console.error("Error:", e.message);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

fixVoucher5Accounts();
require('./destructive/_destructive-guard')({ scriptName: __filename })
