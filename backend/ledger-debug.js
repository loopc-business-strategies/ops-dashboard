// ledger-debug.js
require('dotenv').config();
const mongoose = require('mongoose');

async function main() {
  await mongoose.connect(process.env.MONGODB_URI || process.env.MONGO_URI);
  const Ledger = mongoose.models.Ledger || require('./models/Ledger');
  const Transaction = mongoose.models.Transaction || require('./models/Transaction');

  // Check ALL ledger entries regardless of isActive
  const all = await Ledger.find({}).lean();
  console.log(`ALL ledger entries (including inactive): ${all.length}`);
  
  const active = all.filter(e => e.isActive !== false);
  const inactive = all.filter(e => e.isActive === false);
  console.log(`  Active (isActive != false): ${active.length}`);
  console.log(`  Inactive (isActive === false): ${inactive.length}`);

  // Check sample entries
  if (all.length > 0) {
    console.log('\nSample entries:');
    all.slice(0, 10).forEach(e => {
      console.log(`  _id:${e._id} | acct:${e.accountCode} | Dr:${e.debit||0} Cr:${e.credit||0} | isActive:${e.isActive} | txId:${e.transactionId}`);
    });
  }

  // Get all transactions
  const txs = await Transaction.find({}).lean();
  console.log(`\nAll transactions: ${txs.length}`);
  for (const tx of txs) {
    const rows = await Ledger.find({ transactionId: tx._id }).lean();
    console.log(`  TX [${tx.voucherType}#${tx.voucherNo}] status:${tx.status} amt:${tx.grandTotal||tx.amount} | ledger rows (all): ${rows.length}`);
    for (const r of rows) {
      console.log(`    ${r.accountCode} | Dr:${r.debit||0} Cr:${r.credit||0} | isActive:${r.isActive}`);
    }
  }

  await mongoose.disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
