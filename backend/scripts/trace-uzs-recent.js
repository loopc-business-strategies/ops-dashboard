require('dotenv').config();
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const mongoose = require('mongoose');

async function checkTenant(name, uri) {
  const conn = await mongoose.createConnection(uri, { serverSelectionTimeoutMS: 10000 }).asPromise();
  const db = conn.getClient().db();

  const txs = await db.collection('transactions').find(
    {
      type: { $in: ['receipt', 'payment'] },
      'voucherMeta.lineItems.curr': 'UZS',
    },
    {
      projection: {
        _id: 1,
        type: 1,
        amount: 1,
        currency: 1,
        exchangeRate: 1,
        status: 1,
        createdAt: 1,
        customerId: 1,
        vendorId: 1,
        voucherMeta: 1,
      },
    }
  ).sort({ createdAt: -1 }).limit(30).toArray();

  console.log(`\n=== ${name} UZS receipt/payment tx: ${txs.length} ===`);
  for (const t of txs) {
    const lines = (t.voucherMeta?.lineItems || []).map((li) => ({
      curr: li.curr,
      amountFc: li.amountFc,
      amtFc: li.amtFc,
      rate: li.rate,
      amountLc: li.amountLc,
      amtLc: li.amtLc,
    }));

    console.log(JSON.stringify({
      id: String(t._id),
      type: t.type,
      amount: t.amount,
      currency: t.currency,
      exchangeRate: t.exchangeRate,
      status: t.status,
      createdAt: t.createdAt,
      vocNo: t.voucherMeta?.vocNo,
      vocType: t.voucherMeta?.vocType,
      currCode: t.voucherMeta?.currCode,
      currRate: t.voucherMeta?.currRate,
      referenceExchangeRate: t.voucherMeta?.referenceExchangeRate,
      partyCode: t.voucherMeta?.partyCode,
      lineItems: lines,
    }, null, 2));
  }

  await conn.close();
}

(async () => {
  await checkTenant('MG', process.env.MONGO_URI_MG);
  await checkTenant('CG', process.env.MONGO_URI_CG);
  await checkTenant('LoopC', process.env.MONGO_URI_LOOPC);
})().catch((e) => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
