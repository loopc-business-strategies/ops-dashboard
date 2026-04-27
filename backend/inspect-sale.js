
require("dotenv").config();
const mongoose = require("mongoose");
const Transaction = require("./models/Transaction");
const Ledger = require("./models/Ledger");
const ChartOfAccount = require("./models/ChartOfAccount");

async function run() {
  try {
    const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI;
    if (!mongoUri) {
       throw new Error("MONGO_URI not found in environment");
    }
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB.");

    const tx = await Transaction.findOne({ type: "sale", status: "posted" })
      .sort({ updatedAt: -1 })
      .lean();

    if (!tx) {
      console.log("No posted sale transaction found.");
      process.exit(0);
    }

    console.log("\n--- Latest Sale Transaction ---");
    console.log(`ID: ${tx._id}`);
    console.log(`Amount: ${tx.amount}`);
    console.log(`CustomerID: ${tx.customerId}`);
    console.log(`VendorID: ${tx.vendorId}`);
    console.log(`DebitAccountID: ${tx.debitAccountId}`);
    console.log(`CreditAccountID: ${tx.creditAccountId}`);
    console.log(`JournalEntryID: ${tx.journalEntryId}`);
    console.log(`Voucher No: ${tx.voucherMeta ? tx.voucherMeta.vocNo : "N/A"}`);
    console.log(`Fixing Type: ${tx.voucherMeta ? tx.voucherMeta.fixingType : "N/A"}`);

    const ledgerEntries = await Ledger.find({ referenceId: tx._id, isDeleted: { $ne: true } })
      .sort({ createdAt: 1 })
      .lean();

    console.log("\n--- Related Ledger Entries ---");
    for (const row of ledgerEntries) {
      const debitAccDoc = await ChartOfAccount.findById(row.debitAccountId).lean();
      const creditAccDoc = await ChartOfAccount.findById(row.creditAccountId).lean();
      
      const debitAccStr = debitAccDoc ? `${debitAccDoc.accountCode} (${debitAccDoc.accountName})` : "N/A";
      const creditAccStr = creditAccDoc ? `${creditAccDoc.accountCode} (${creditAccDoc.accountName})` : "N/A";
      
      console.log(`ID: ${row._id}`);
      console.log(`  RefType: ${row.referenceType}`);
      console.log(`  DebitAcc: ${debitAccStr}`);
      console.log(`  CreditAcc: ${creditAccStr}`);
      console.log(`  Amount: ${row.amount}`);
      console.log(`  isDeleted: ${row.isDeleted}`);
    }

    const codesToCheck = ["4100", "1301"];
    console.log("\n--- Account Balances (Calculated from Ledger) ---");
    for (const code of codesToCheck) {
      const acc = await ChartOfAccount.findOne({ accountCode: code });
      if (!acc) {
        console.log(`Account ${code} not found.`);
        continue;
      }

      const debitRows = await Ledger.find({ debitAccountId: acc._id, isDeleted: { $ne: true } }).lean();
      const creditRows = await Ledger.find({ creditAccountId: acc._id, isDeleted: { $ne: true } }).lean();

      const totalDebit = debitRows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);
      const totalCredit = creditRows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0);

      console.log(`Account: ${code} (${acc.accountName})`);
      console.log(`  Total Debit: ${totalDebit}`);
      console.log(`  Total Credit: ${totalCredit}`);
      console.log(`  Net: ${totalDebit - totalCredit}`);
    }

    await mongoose.connection.close();
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

run();

