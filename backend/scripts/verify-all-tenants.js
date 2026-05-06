require('dotenv').config();
const dns = require('dns');
dns.setServers(['8.8.8.8','1.1.1.1']);
const mongoose = require('mongoose');

async function verifyTenant(name, uri) {
  const conn = await mongoose.createConnection(uri, { serverSelectionTimeoutMS: 8000 }).asPromise();
  const db = conn.getClient().db();

  const mappings = await db.collection('accountmappings').find({}, { projection: { mappingType: 1, _id: 0 } }).toArray();
  const types = new Set(mappings.map(m => m.mappingType));

  const directTypes = ['sale', 'purchase', 'receipt', 'payment', 'expense', 'payroll'];
  const fxVatTypes  = ['exchange_gain', 'exchange_loss', 'vat_input', 'vat_output', 'vat_settlement'];

  const missingDirect = directTypes.filter(t => !types.has(t));
  const missingFxVat  = fxVatTypes.filter(t => !types.has(t));

  const markOoo = await db.collection('chartofaccounts')
    .find({ accountCode: { $in: ['1300', '1302'] } }, { projection: { accountCode: 1, accountName: 1, _id: 0 } })
    .toArray();

  await conn.close();

  console.log(`\n${name}:`);
  console.log(`  Total mappings    : ${mappings.length}`);
  console.log(`  Missing direct    : ${missingDirect.length ? missingDirect.join(', ') : 'none ✅'}`);
  console.log(`  Missing FX/VAT    : ${missingFxVat.length ? missingFxVat.join(', ') : 'none ✅'}`);
  if (markOoo.length) {
    console.log(`  ⚠️  COA codes 1300/1302: ${JSON.stringify(markOoo)}`);
  } else {
    console.log(`  COA 1300/1302     : clean ✅`);
  }
}

(async () => {
  await verifyTenant('MG',    process.env.MONGO_URI_MG);
  await verifyTenant('CG',    process.env.MONGO_URI_CG);
  await verifyTenant('LoopC', process.env.MONGO_URI_LOOPC);
  console.log('\nAll checks done.');
})().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
