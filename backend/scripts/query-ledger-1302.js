const mongoose = require('mongoose');
require('dotenv').config();

async function run() {
  try {
    if (!process.env.MONGO_URI_CG) throw new Error('Missing MONGO_URI_CG');
    await mongoose.connect(process.env.MONGO_URI_CG);
    
    const ChartOfAccount = require('./models/ChartOfAccount');
    const Ledger = require('./models/Ledger');
    const Transaction = require('./models/Transaction');

    const coa = await ChartOfAccount.findOne({ accountCode: '1302' });
    if (!coa) {
      console.log('Account 1302 not found');
      return;
    }
    console.log(`Found ChartOfAccount: ${coa.accountName} (${coa.accountCode}) ID: ${coa._id}`);

    const ledgerRows = await Ledger.find({
      $or: [{ debitAccountId: coa._id }, { creditAccountId: coa._id }],
      isDeleted: { $ne: true }
    }).sort({ date: -1 });

    console.log(`Found ${ledgerRows.length} active ledger rows`);
    console.log('date | refType | amount | refId | vocNo | type | fixingType');
    console.log('------------------------------------------------------------');

    for (const row of ledgerRows) {
      let vocNo = 'N/A', type = 'N/A', fixingType = 'N/A';
      if (row.referenceId) {
        const tx = await Transaction.findById(row.referenceId);
        if (tx) {
          vocNo = tx.voucherMeta?.vocNo || 'N/A';
          type = tx.type || 'N/A';
          fixingType = tx.voucherMeta?.fixingType || 'N/A';
        }
      }
      console.log(`${row.date.toISOString().split('T')[0]} | ${row.referenceType.padEnd(9)} | ${row.amount.toString().padStart(10)} | ${row.referenceId} | ${vocNo.toString().padStart(5)} | ${type.padEnd(8)} | ${fixingType}`);
    }

  } catch (err) {
    console.error(err);
  } finally {
    await mongoose.disconnect();
  }
}

run();