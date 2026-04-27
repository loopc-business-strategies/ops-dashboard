const mongoose = require('mongoose');
require('dotenv').config();
async function run() {
  await mongoose.connect(process.env.MONGO_URI);
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
