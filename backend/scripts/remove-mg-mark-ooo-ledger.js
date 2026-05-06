require('dotenv').config();
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const mongoose = require('mongoose');

(async () => {
  const conn = await mongoose.createConnection(process.env.MONGO_URI_MG, { serverSelectionTimeoutMS: 8000 }).asPromise();
  const db = conn.getClient().db();

  // Use the known ObjectIds of the deleted accounts
  const markId = new mongoose.Types.ObjectId('69eedfd757a5ebca7a1528ac');
  const oooId  = new mongoose.Types.ObjectId('69ef03fac1702f4e42515334');
  const ids = [markId, oooId];

  // Show a sample before deleting
  const samples = await db.collection('ledgers').find({
    $or: [{ debitAccountId: { $in: ids } }, { creditAccountId: { $in: ids } }]
  }, { projection: { date: 1, amount: 1, referenceType: 1, referenceId: 1, debitAccountId: 1, creditAccountId: 1 } }).limit(5).toArray();
  console.log('Sample ledger entries to be removed:');
  samples.forEach(s => console.log(' ', JSON.stringify(s)));

  const total = await db.collection('ledgers').countDocuments({
    $or: [{ debitAccountId: { $in: ids } }, { creditAccountId: { $in: ids } }]
  });
  console.log(`\nTotal ledger entries referencing mark/ooo: ${total}`);

  // Delete all ledger entries referencing these accounts
  const result = await db.collection('ledgers').deleteMany({
    $or: [{ debitAccountId: { $in: ids } }, { creditAccountId: { $in: ids } }]
  });
  console.log(`Deleted ${result.deletedCount} ledger entries ✅`);

  // Also check and clean stockmovements, transactions, or any other collections
  for (const col of ['transactions', 'stockmovements', 'financeinvoices', 'financeexpenses']) {
    try {
      const count = await db.collection(col).countDocuments({
        $or: [{ debitAccountId: { $in: ids } }, { creditAccountId: { $in: ids } }, { accountId: { $in: ids } }]
      });
      if (count > 0) {
        const r = await db.collection(col).deleteMany({
          $or: [{ debitAccountId: { $in: ids } }, { creditAccountId: { $in: ids } }, { accountId: { $in: ids } }]
        });
        console.log(`Deleted ${r.deletedCount} entries from ${col} ✅`);
      } else {
        console.log(`${col}: no references found ✅`);
      }
    } catch {
      // collection may not exist
    }
  }

  await conn.close();
  console.log('\nCleanup complete.');
})().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
