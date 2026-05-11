const mongoose = require('mongoose');
const mongoUri = 'mongodb+srv://mg_db:loopc-mg@cluster0.m5yqfs7.mongodb.net/ops-dashboard?appName=Cluster0&retryWrites=true&w=majority';

async function run() {
  try {
    const conn = await mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });
    
    const LedgerSchema = new mongoose.Schema({}, { strict: false, collection: 'ledgers' });
    const TransactionSchema = new mongoose.Schema({}, { strict: false, collection: 'transactions' });
    
    const Ledger = mongoose.model('Ledger', LedgerSchema);
    const Transaction = mongoose.model('Transaction', TransactionSchema);

    const ledgerCount = await Ledger.countDocuments();
    const refTypeCounts = await Ledger.aggregate([{ $group: { _id: '$referenceType', count: { $sum: 1 } } }]);
    
    const bankJvCount = await Ledger.countDocuments({ referenceType: 'bank_jv' });
    const bankReconciledCounts = await Ledger.aggregate([
      { $match: { referenceType: 'bank_jv' } },
      { $group: { _id: '$bankReconciled', count: { $sum: 1 } } }
    ]);

    const totals = await Ledger.aggregate([
      { $group: { _id: null, totalDebit: { $sum: '$debit' }, totalCredit: { $sum: '$credit' } } }
    ]);

    const lastEntries = await Ledger.find().sort({ date: -1 }).limit(20);

    const transCount = await Transaction.countDocuments();
    const transTypeCounts = await Transaction.aggregate([{ $group: { _id: '$type', count: { $sum: 1 } } }]);
    const transStatusCounts = await Transaction.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]);

    const missingJournalEntries = await Transaction.countDocuments({ status: 'posted', journalEntryId: { $exists: false } });

    console.log(JSON.stringify({
      ledgerCount,
      refTypeCounts,
      bankJvCount,
      bankReconciledCounts,
      totals: totals[0],
      lastEntries: lastEntries.map(e => ({
        date: e.date,
        debitAccountCode: e.debitAccountCode || e.debitAccountId,
        creditAccountCode: e.creditAccountCode || e.creditAccountId,
        amount: e.amount || (e.debit > 0 ? e.debit : e.credit),
        referenceType: e.referenceType,
        reference: e.reference
      })),
      transCount,
      transTypeCounts,
      transStatusCounts,
      missingJournalEntries,
      trialBalanceMismatch: Math.abs((totals[0]?.totalDebit || 0) - (totals[0]?.totalCredit || 0)) > 0.01
    }, null, 2));

    await mongoose.disconnect();
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
