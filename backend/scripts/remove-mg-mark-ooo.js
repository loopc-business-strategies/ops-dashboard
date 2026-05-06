require('dotenv').config();
const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);
const mongoose = require('mongoose');

(async () => {
  const conn = await mongoose.createConnection(process.env.MONGO_URI_MG, { serverSelectionTimeoutMS: 8000 }).asPromise();
  const db = conn.getClient().db();

  // Find the accounts
  const accounts = await db.collection('chartofaccounts').find({ accountCode: { $in: ['1300', '1302'] } }).toArray();
  console.log('Accounts found:', accounts.map(a => ({ id: a._id, code: a.accountCode, name: a.accountName })));

  if (!accounts.length) {
    console.log('No accounts with code 1300 or 1302 found — nothing to do.');
    await conn.close();
    return;
  }

  const ids = accounts.map(a => a._id);

  // Check ledger refs
  const ledgerRefs = await db.collection('ledgers').countDocuments({
    $or: [{ debitAccountId: { $in: ids } }, { creditAccountId: { $in: ids } }]
  });
  console.log('Ledger references:', ledgerRefs);

  // Check account mapping refs
  const mappingRefs = await db.collection('accountmappings').find({
    $or: [{ debitAccountId: { $in: ids } }, { creditAccountId: { $in: ids } }]
  }).toArray();
  console.log('Mapping references:', mappingRefs.length);

  // Remove from mappings if referenced
  if (mappingRefs.length) {
    const mappingIds = mappingRefs.map(m => m._id);
    const del = await db.collection('accountmappings').deleteMany({ _id: { $in: mappingIds } });
    console.log(`Deleted ${del.deletedCount} account mapping(s) referencing mark/ooo`);
  }

  // Delete the COA accounts
  const result = await db.collection('chartofaccounts').deleteMany({ _id: { $in: ids } });
  console.log(`Deleted ${result.deletedCount} COA account(s): mark (1300) and/or ooo (1302)`);

  if (ledgerRefs > 0) {
    console.log(`WARNING: ${ledgerRefs} ledger entries still reference these accounts — historical data remains but the accounts are now removed from COA.`);
  } else {
    console.log('No ledger entries referenced these accounts — clean removal ✅');
  }

  await conn.close();
})().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
