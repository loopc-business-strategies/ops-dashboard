require("dotenv").config();
const mongoose = require("mongoose");

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const Ledger = require("./models/Ledger");
  const ChartOfAccount = require("./models/ChartOfAccount");
  const Transaction = require("./models/Transaction");

  const entries = await Ledger.find({ isActive: true }).lean();
  console.log("Total active ledger entries: " + entries.length);

  const byAccount = {};
  for (const e of entries) {
    const code = e.accountCode;
    if (!byAccount[code]) byAccount[code] = { name: e.accountName, debits: 0, credits: 0 };
    byAccount[code].debits += Number(e.debit || 0);
    byAccount[code].credits += Number(e.credit || 0);
  }

  console.log("\n=== TRIAL BALANCE ===");
  let totalDr = 0, totalCr = 0;
  const sorted = Object.keys(byAccount).sort();
  for (const code of sorted) {
    const row = byAccount[code];
    const net = row.debits - row.credits;
    totalDr += row.debits;
    totalCr += row.credits;
    console.log(code + " | " + row.name.padEnd(30) + " | Dr: " + row.debits.toFixed(2).padStart(12) + " | Cr: " + row.credits.toFixed(2).padStart(12) + " | Net: " + net.toFixed(2).padStart(12));
  }
  console.log("".padEnd(80,"-"));
  console.log("TOTAL | " + "".padEnd(30) + " | Dr: " + totalDr.toFixed(2).padStart(12) + " | Cr: " + totalCr.toFixed(2).padStart(12) + " | Net: " + (totalDr-totalCr).toFixed(2).padStart(12));

  const txs = await Transaction.find({}).lean();
  console.log("\n=== ALL TRANSACTIONS (" + txs.length + ") ===");
  for (const tx of txs) {
    console.log("[" + tx.voucherType + "] voc#" + tx.voucherNo + " | status:" + tx.status + " | amt:" + (tx.grandTotal || tx.amount) + " | party:" + tx.partyCode + " | _id:" + tx._id);
  }

  const postedTxs = txs.filter(t => t.status === "posted");
  console.log("\n=== POSTED TX LEDGER CHECK ===");
  for (const tx of postedTxs) {
    const rows = await Ledger.find({ transactionId: tx._id, isActive: true }).lean();
    const drSum = rows.reduce((s,r) => s + Number(r.debit||0), 0);
    const crSum = rows.reduce((s,r) => s + Number(r.credit||0), 0);
    console.log("TX " + tx._id + " [" + tx.voucherType + "#" + tx.voucherNo + "] amt=" + (tx.grandTotal||tx.amount) + " | ledger rows=" + rows.length + " | Dr=" + drSum.toFixed(2) + " Cr=" + crSum.toFixed(2) + " | balanced=" + (Math.abs(drSum-crSum)<0.01?"YES":"NO"));
    for (const r of rows) {
      console.log("  " + r.accountCode + " " + r.accountName + " | Dr:" + (r.debit||0) + " Cr:" + (r.credit||0));
    }
  }

  await mongoose.disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
