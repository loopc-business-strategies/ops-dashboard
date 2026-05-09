const mongoose = require('mongoose');
require('dotenv').config();
async function run() {
  if (!process.env.MONGO_URI_CG) throw new Error('Missing MONGO_URI_CG');
  await mongoose.connect(process.env.MONGO_URI_CG);
  const transactions = await mongoose.connection.db.collection('transactions').find({
    type: { $in: ['sale', 'purchase'] },
    status: 'posted',
    isDeleted: { $ne: true }
  }).toArray();
  for (const tx of transactions) {
    const ledger = await mongoose.connection.db.collection('ledgerentries').findOne({
      referenceId: tx._id,
      referenceType: { $in: ['sale', 'purchase'] }
    });
    if (!ledger) {
      console.log('ID:' + tx._id + ', VocNo:' + (tx.voucherMeta ? tx.voucherMeta.vocNo : 'N/A') + ', Type:' + tx.type + ', FixingType:' + (tx.voucherMeta ? tx.voucherMeta.fixingType : 'N/A') + ', Party:' + (tx.voucherMeta ? tx.voucherMeta.partyCode : 'N/A') + ', Debit:' + tx.debitAccountId + ', Credit:' + tx.creditAccountId + ', JE:' + tx.journalEntryId);
    }
  }
  await mongoose.disconnect();
}
run().catch(console.error);
