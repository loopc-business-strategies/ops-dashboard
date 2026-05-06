require('dotenv').config();
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const mongoose = require('mongoose');

const ALLOWED_TYPES = new Set(['sale', 'purchase', 'receipt', 'payment', 'expense', 'payroll']);

function normalizeType(value) {
  const type = String(value || '').trim().toLowerCase();
  return ALLOWED_TYPES.has(type) ? type : '';
}

async function fixTenant(name, uri) {
  const conn = await mongoose.createConnection(uri, { serverSelectionTimeoutMS: 8000 }).asPromise();
  const db = conn.getClient().db();

  const txCol = db.collection('transactions');
  const docs = await txCol.find({}, { projection: { _id: 1, type: 1, transactionType: 1, voucherMeta: 1 } }).toArray();

  let repaired = 0;
  let unresolved = 0;

  for (const tx of docs) {
    const current = normalizeType(tx.type);
    if (current) continue;

    const fromLegacyField = normalizeType(tx.transactionType);
    const fromVoucherMeta = normalizeType(tx.voucherMeta?.type || tx.voucherMeta?.transactionType);
    const resolved = fromLegacyField || fromVoucherMeta;

    if (!resolved) {
      unresolved += 1;
      continue;
    }

    await txCol.updateOne(
      { _id: tx._id },
      {
        $set: { type: resolved },
        $unset: { transactionType: '' },
      }
    );
    repaired += 1;
  }

  await conn.close();

  console.log(`\n${name}`);
  console.log(`  Total transactions: ${docs.length}`);
  console.log(`  Repaired type: ${repaired}`);
  console.log(`  Unresolved: ${unresolved}`);
}

(async () => {
  await fixTenant('MG', process.env.MONGO_URI_MG);
  await fixTenant('CG', process.env.MONGO_URI_CG);
  await fixTenant('LoopC', process.env.MONGO_URI_LOOPC);
  console.log('\nDone.');
})().catch((e) => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
