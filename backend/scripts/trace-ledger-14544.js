require('dotenv').config();
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const mongoose = require('mongoose');

async function checkTenant(name, uri) {
  const conn = await mongoose.createConnection(uri, { serverSelectionTimeoutMS: 10000 }).asPromise();
  const db = conn.getClient().db();

  const ledgers = await db.collection('ledgers').find(
    { amount: { $in: [145.44, 145.44000000000003, 145.43999999999997] }, isDeleted: { $ne: true } },
    { projection: { _id:1, amount:1, currency:1, exchangeRate:1, debitAccountId:1, creditAccountId:1, referenceType:1, referenceId:1, description:1, createdAt:1 } }
  ).sort({ createdAt: -1 }).limit(50).toArray();

  console.log(`\n=== ${name} ledgers amount~145.44: ${ledgers.length} ===`);
  if (!ledgers.length) {
    await conn.close();
    return;
  }

  const coaIds = [...new Set(ledgers.flatMap((l) => [l.debitAccountId, l.creditAccountId]).filter(Boolean).map((x) => String(x)))];
  const coa = await db.collection('chartofaccounts').find(
    { _id: { $in: coaIds.map((id) => new mongoose.Types.ObjectId(id)) } },
    { projection: { _id:1, accountCode:1, accountName:1 } }
  ).toArray();
  const byId = Object.fromEntries(coa.map((c) => [String(c._id), `${c.accountCode} ${c.accountName}`]));

  for (const l of ledgers) {
    console.log(JSON.stringify({
      id: String(l._id),
      amount: l.amount,
      currency: l.currency,
      exchangeRate: l.exchangeRate,
      dr: byId[String(l.debitAccountId)] || String(l.debitAccountId),
      cr: byId[String(l.creditAccountId)] || String(l.creditAccountId),
      referenceType: l.referenceType,
      referenceId: String(l.referenceId || ''),
      createdAt: l.createdAt,
      description: l.description,
    }, null, 2));

    if (l.referenceType === 'transaction' && l.referenceId) {
      const tx = await db.collection('transactions').findOne(
        { _id: l.referenceId },
        { projection: { _id:1, type:1, amount:1, currency:1, exchangeRate:1, voucherMeta:1, createdAt:1 } }
      );
      if (tx) {
        console.log('  tx ->', JSON.stringify({
          id: String(tx._id),
          type: tx.type,
          amount: tx.amount,
          currency: tx.currency,
          exchangeRate: tx.exchangeRate,
          vocNo: tx.voucherMeta?.vocNo,
          vocType: tx.voucherMeta?.vocType,
          currCode: tx.voucherMeta?.currCode,
          currRate: tx.voucherMeta?.currRate,
          referenceExchangeRate: tx.voucherMeta?.referenceExchangeRate,
          lineItems: tx.voucherMeta?.lineItems,
          createdAt: tx.createdAt,
        }, null, 2));
      }
    }
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
