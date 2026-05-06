require('dotenv').config();
const dns = require('dns');
dns.setServers((process.env.ATLAS_DNS_SERVERS || '8.8.8.8,1.1.1.1').split(',').map(s => s.trim()));
const mongoose = require('mongoose');

async function checkTenant(name, uri) {
  try {
    const conn = await mongoose.createConnection(uri, { serverSelectionTimeoutMS: 8000 }).asPromise();
    const db = conn.getClient().db();

    const mappings = await db.collection('accountmappings').countDocuments();
    const mappingDocs = await db.collection('accountmappings').find({}, { projection: { mappingType: 1, accountCode: 1, accountName: 1, _id: 0 } }).limit(20).toArray();
    const currencies = await db.collection('currencies').find({}, { projection: { code: 1, exchangeRate: 1, baseCurrency: 1, _id: 0 } }).toArray();
    const rootAccounts = await db.collection('chartofaccounts').find({ parentId: null }, { projection: { accountCode: 1, accountName: 1, accountType: 1, _id: 0 } }).limit(20).toArray();
    const fxAccounts = await db.collection('chartofaccounts').find(
      { accountCode: { $in: ['4190', '5190'] } },
      { projection: { accountCode: 1, accountName: 1, _id: 0 } }
    ).toArray();
    const txByStatus = await db.collection('transactions').aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]).toArray();
    const txByType = await db.collection('transactions').aggregate([
      { $group: { _id: '$type', count: { $sum: 1 } } }
    ]).toArray();
    const users = await db.collection('users').find({}, { projection: { name: 1, role: 1, department: 1, isActive: 1, _id: 0 } }).toArray();
    const openTx = await db.collection('transactions').find(
      { status: { $in: ['draft', 'submitted'] } },
      { projection: { type: 1, status: 1, amount: 1, description: 1, _id: 1 } }
    ).limit(20).toArray();
    const ledgerBalance = await db.collection('ledgers').aggregate([
      { $group: { _id: null, totalDebit: { $sum: '$debitAmount' }, totalCredit: { $sum: '$creditAmount' }, count: { $sum: 1 } } }
    ]).toArray();
    const recentLedgers = await db.collection('ledgers').find({}, { projection: { description: 1, amount: 1, referenceType: 1, _id: 0 } }).sort({ createdAt: -1 }).limit(5).toArray();

    await conn.close();
    console.log(JSON.stringify({
      tenant: name,
      users,
      currencies,
      mappings,
      mappingDocs,
      fxAccounts,
      rootAccountCount: rootAccounts.length,
      txByStatus,
      txByType,
      openTx,
      ledgerBalance,
      recentLedgers,
    }, null, 2));
  } catch (e) {
    console.log(JSON.stringify({ tenant: name, error: e.message }));
  }
}

(async () => {
  await checkTenant('mg', process.env.MONGO_URI_MG);
  await checkTenant('cg', process.env.MONGO_URI_CG);
  await checkTenant('loopc', process.env.MONGO_URI_LOOPC);
})();
