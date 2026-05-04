const mongoose = require("mongoose");
require("dotenv").config();

const Transaction = require("./models/Transaction");
const Ledger = require("./models/Ledger");
const ChartOfAccount = require("./models/ChartOfAccount");
const Customer = require("./models/Customer");

async function run() {
  try {
    const mongoUri = process.env.MONGO_URI || `mongodb+srv://${process.env.DB_USER}:${encodeURIComponent(process.env.DB_PASS)}@${process.env.DB_CLUSTER}/${process.env.DB_NAME || "ops-dashboard"}?${process.env.DB_PARAMS || "retryWrites=true&w=majority"}`;
    await mongoose.connect(mongoUri);

    // 1) Latest posted receipt transaction
    const latestReceipt = await Transaction.findOne({ type: "receipt", status: "posted" })
      .sort({ updatedAt: -1 })
      .lean();

    if (!latestReceipt) {
      console.log("No posted receipt found.");
      process.exit(0);
    }

    console.log("--- Latest Posted Receipt ---");
    console.log(`ID: ${latestReceipt._id}`);
    console.log(`Amount: ${latestReceipt.amount}`);
    console.log(`CustomerID: ${latestReceipt.customerId}`);
    console.log(`Debit AccountID: ${latestReceipt.debitAccountId}`);
    console.log(`Credit AccountID: ${latestReceipt.creditAccountId}`);
    console.log(`JournalEntryID: ${latestReceipt.journalEntryId}`);
    console.log(`VocNo: ${latestReceipt.vocNo}`);

    // 2) Ledger rows for that tx id
    const ledgerRows = await Ledger.find({ referenceId: latestReceipt._id, isDeleted: { $ne: true } }).lean();
    console.log("\n--- Ledger Rows ---");
    for (const row of ledgerRows) {
      const debitAcc = await ChartOfAccount.findById(row.debitAccountId).lean();
      const creditAcc = await ChartOfAccount.findById(row.creditAccountId).lean();
      console.log(`RowID: ${row._id}`);
      console.log(`ReferenceType: ${row.referenceType}`);
      console.log(`Debit Account: ${debitAcc ? debitAcc.accountCode + " / " + debitAcc.accountName : "N/A"}`);
      console.log(`Credit Account: ${creditAcc ? creditAcc.accountCode + " / " + creditAcc.accountName : "N/A"}`);
      console.log(`Amount: ${row.amount}`);
    }

    // 3) Customer details
    const customer = await Customer.findById(latestReceipt.customerId).lean();
    console.log("\n--- Customer Details ---");
    if (customer) {
      const ledgerAcc = await ChartOfAccount.findById(customer.ledgerAccountId).lean();
      console.log(`Name: ${customer.name}`);
      console.log(`Ledger Account: ${ledgerAcc ? ledgerAcc.accountCode + " - " + ledgerAcc.accountName : "N/A"}`);
    } else {
      console.log("Customer not found.");
    }

    // 4) Compute current ledger totals
    const accountsToCheck = ["1301", "1100"];
    console.log("\n--- Ledger Totals (non-deleted) ---");
    for (const code of accountsToCheck) {
      const acc = await ChartOfAccount.findOne({ accountCode: code }).lean();
      if (acc) {
        const debits = await Ledger.aggregate([
          { $match: { debitAccountId: acc._id, isDeleted: { $ne: true } } },
          { $group: { _id: null, total: { $sum: "$amount" } } }
        ]);
        const credits = await Ledger.aggregate([
          { $match: { creditAccountId: acc._id, isDeleted: { $ne: true } } },
          { $group: { _id: null, total: { $sum: "$amount" } } }
        ]);
        const totalDebit = debits[0]?.total || 0;
        const totalCredit = credits[0]?.total || 0;
        console.log(`Account ${code} (${acc.accountName}): Debit=${totalDebit}, Credit=${totalCredit}, Net=${totalDebit - totalCredit}`);
      } else {
        console.log(`Account ${code} not found.`);
      }
    }

    // 5) Latest posted sale + receipt totals for that customer
    if (latestReceipt.customerId) {
        const sales = await Transaction.aggregate([
            { $match: { customerId: latestReceipt.customerId, type: "sale", status: "posted" } },
            { $group: { _id: null, total: { $sum: "$amount" } } }
        ]);
        const receipts = await Transaction.aggregate([
            { $match: { customerId: latestReceipt.customerId, type: "receipt", status: "posted" } },
            { $group: { _id: null, total: { $sum: "$amount" } } }
        ]);
        const totalSales = sales[0]?.total || 0;
        const totalReceipts = receipts[0]?.total || 0;
        console.log("\n--- Customer Outstanding (Posted Only) ---");
        console.log(`Total Sales: ${totalSales}`);
        console.log(`Total Receipts: ${totalReceipts}`);
        console.log(`Expected Outstanding: ${totalSales - totalReceipts}`);
    }

  } catch (err) {
    console.error(err);
  } finally {
    mongoose.disconnect();
  }
}

run();
