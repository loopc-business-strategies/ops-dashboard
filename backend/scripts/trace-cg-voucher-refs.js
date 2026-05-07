require('dotenv').config();
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const mongoose = require('mongoose');

const REF_IDS = [
  '69fa2ccb8aca104c2c3abddc', // payment
  '69fa29678aca104c2c3abbbc', // receipt
  '69fa26c68aca104c2c3abad4', // sale
  '69fa25728aca104c2c3aba47', // purchase
];

(async () => {
  const conn = await mongoose.createConnection(process.env.MONGO_URI_CG, { serverSelectionTimeoutMS: 10000 }).asPromise();
  const db = conn.getClient().db();

  for (const id of REF_IDS) {
    const oid = new mongoose.Types.ObjectId(id);
    const tx = await db.collection('transactions').findOne({ _id: oid });
    const erpTx = await db.collection('financerecords').findOne({ _id: oid });
    const purchaseOrders = await db.collection('purchaseorders').findOne({ _id: oid });

    console.log('\n=== REF', id, '===');
    console.log('transactions exists:', !!tx);
    if (tx) {
      console.log(JSON.stringify({
        _id: String(tx._id),
        type: tx.type,
        amount: tx.amount,
        currency: tx.currency,
        exchangeRate: tx.exchangeRate,
        status: tx.status,
        voucherMeta: tx.voucherMeta,
        description: tx.description,
      }, null, 2));
    }

    console.log('financerecords exists:', !!erpTx);
    if (erpTx) {
      console.log(JSON.stringify(erpTx, null, 2));
    }

    console.log('purchaseorders exists:', !!purchaseOrders);
    if (purchaseOrders) {
      console.log(JSON.stringify(purchaseOrders, null, 2));
    }

    const relatedJournals = await db.collection('ledgers').find({ referenceId: oid, referenceType: 'journal', isDeleted: { $ne: true } }).toArray();
    console.log('journal count for ref:', relatedJournals.length);
  }

  const fxLedgers = await db.collection('ledgers').find({
    $or: [
      { description: /exchange/i },
      { referenceType: 'journal' },
    ],
    isDeleted: { $ne: true },
  }).sort({ createdAt: -1 }).limit(30).toArray();

  console.log('\n=== Recent journal/exchange ledgers in CG ===');
  for (const l of fxLedgers) {
    console.log(JSON.stringify({
      _id: String(l._id),
      referenceType: l.referenceType,
      referenceId: String(l.referenceId || ''),
      amount: l.amount,
      description: l.description,
      debitAccountId: String(l.debitAccountId || ''),
      creditAccountId: String(l.creditAccountId || ''),
      createdAt: l.createdAt,
    }, null, 2));
  }

  await conn.close();
})().catch((e) => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
