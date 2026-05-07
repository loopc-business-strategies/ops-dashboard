require('dotenv').config();
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const mongoose = require('mongoose');

const TARGET_FC = [1818000.8, 1752289.11];

async function checkTenant(name, uri) {
  const conn = await mongoose.createConnection(uri, { serverSelectionTimeoutMS: 10000 }).asPromise();
  const db = conn.getClient().db();

  const txs = await db.collection('transactions').find(
    {
      'voucherMeta.lineItems.curr': 'UZS',
      $or: [
        { 'voucherMeta.lineItems.amountFc': { $in: TARGET_FC } },
        { 'voucherMeta.lineItems.amtFc': { $in: TARGET_FC } },
      ],
    },
    {
      projection: {
        _id: 1,
        type: 1,
        amount: 1,
        currency: 1,
        exchangeRate: 1,
        status: 1,
        customerId: 1,
        vendorId: 1,
        voucherMeta: 1,
        createdAt: 1,
      },
    }
  ).toArray();

  console.log(`\n=== ${name} transactions: ${txs.length} ===`);

  for (const t of txs) {
    const lineItems = (t.voucherMeta?.lineItems || []).map((li) => ({
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
      lineItems,
      referenceExchangeRate: t.voucherMeta?.referenceExchangeRate,
    }, null, 2));

    const ledgers = await db.collection('ledgers').find(
      { referenceId: t._id, isDeleted: { $ne: true } },
      {
        projection: {
          _id: 1,
          date: 1,
          debitAccountId: 1,
          creditAccountId: 1,
          amount: 1,
          currency: 1,
          exchangeRate: 1,
          description: 1,
          referenceType: 1,
          createdAt: 1,
        },
      }
    ).toArray();

    const coaIds = [...new Set(
      ledgers
        .flatMap((l) => [l.debitAccountId, l.creditAccountId])
        .filter(Boolean)
        .map((x) => String(x))
    )];

    const coa = await db.collection('chartofaccounts').find(
      { _id: { $in: coaIds.map((id) => new mongoose.Types.ObjectId(id)) } },
      { projection: { _id: 1, accountCode: 1, accountName: 1 } }
    ).toArray();

    const byId = Object.fromEntries(coa.map((c) => [String(c._id), `${c.accountCode} ${c.accountName}`]));

    console.log(`  ledgers: ${ledgers.length}`);
    for (const l of ledgers) {
      console.log(
        `   - ${String(l._id)} DR ${byId[String(l.debitAccountId)] || String(l.debitAccountId)} CR ${byId[String(l.creditAccountId)] || String(l.creditAccountId)} amount ${l.amount} curr ${l.currency} rate ${l.exchangeRate} refType ${l.referenceType}`
      );
    }

    const journals = ledgers.filter((l) => l.referenceType === 'journal');
    console.log(`  journal rows: ${journals.length}`);
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
