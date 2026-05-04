// trial2.js
require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const Ledger = require('./models/Ledger');
  const ChartOfAccount = require('./models/ChartOfAccount');
  const Transaction = require('./models/Transaction');

  // Get all non-deleted ledger entries
  const all = await Ledger.find({ isDeleted: { $ne: true } })
    .populate('debitAccountId', 'accountCode accountName')
    .populate('creditAccountId', 'accountCode accountName')
    .lean();
  
  console.log(`Total non-deleted ledger entries: ${all.length}`);
  console.log('\nAll ledger entries:');
  for (const e of all) {
    const dr = e.debitAccountId?.accountCode + ' ' + e.debitAccountId?.accountName;
    const cr = e.creditAccountId?.accountCode + ' ' + e.creditAccountId?.accountName;
    console.log(`  ${e._id} | Dr: ${dr} | Cr: ${cr} | Amt: ${e.amount} | type: ${e.referenceType} | refId: ${e.referenceId}`);
  }

  // Trial balance
  const byAcct = {};
  for (const e of all) {
    if (e.debitAccountId) {
      const code = e.debitAccountId.accountCode;
      const name = e.debitAccountId.accountName;
      if (!byAcct[code]) byAcct[code] = { name, dr: 0, cr: 0 };
      byAcct[code].dr += Number(e.amount || 0);
    }
    if (e.creditAccountId) {
      const code = e.creditAccountId.accountCode;
      const name = e.creditAccountId.accountName;
      if (!byAcct[code]) byAcct[code] = { name, dr: 0, cr: 0 };
      byAcct[code].cr += Number(e.amount || 0);
    }
  }

  console.log('\n=== TRIAL BALANCE ===');
  let tDr = 0, tCr = 0;
  for (const [code, row] of Object.entries(byAcct).sort((a,b) => a[0].localeCompare(b[0]))) {
    tDr += row.dr; tCr += row.cr;
    const net = row.dr - row.cr;
    console.log(`${code} | ${(row.name||'').padEnd(30)} | Dr: ${row.dr.toFixed(2).padStart(14)} | Cr: ${row.cr.toFixed(2).padStart(14)} | Net: ${net.toFixed(2).padStart(14)}`);
  }
  console.log(`${''.padEnd(100,'-')}`);
  console.log(`TOTAL                                         | Dr: ${tDr.toFixed(2).padStart(14)} | Cr: ${tCr.toFixed(2).padStart(14)} | Net: ${(tDr-tCr).toFixed(2).padStart(14)}`);
  console.log(Math.abs(tDr - tCr) < 0.01 ? '? BALANCED' : '? NOT BALANCED');

  // Check transactions
  const txs = await Transaction.find({ isDeleted: { $ne: true } }).lean();
  console.log(`\n=== TRANSACTIONS (${txs.length}) ===`);
  for (const tx of txs) {
    const rows = await Ledger.find({ referenceId: tx._id, isDeleted: { $ne: true } }).lean();
    const byJournal = tx.journalEntryId ? await Ledger.find({ _id: tx.journalEntryId, isDeleted: { $ne: true } }).lean() : [];
    console.log(`[${tx.voucherType}#${tx.voucherNo}] status:${tx.status} | amt:${tx.grandTotal||tx.amount} | journalId:${tx.journalEntryId} | by refId:${rows.length} rows | by journalEntryId:${byJournal.length} rows`);
  }

  await mongoose.disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
