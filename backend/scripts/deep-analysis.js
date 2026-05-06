require('dotenv').config();
const dns = require('dns');
dns.setServers(['8.8.8.8','1.1.1.1']);
const mongoose = require('mongoose');

async function analyzeTenant(name, uri) {
  const conn = await mongoose.createConnection(uri, { serverSelectionTimeoutMS: 8000 }).asPromise();
  const db = conn.getClient().db();

  // Users
  const users = await db.collection('users').find({}, { projection: { name:1, role:1, department:1, isActive:1 }}).toArray();

  // COA
  const coaCount = await db.collection('chartofaccounts').countDocuments();
  const coaTypes = await db.collection('chartofaccounts').distinct('accountType');

  // Mappings
  const mappings = await db.collection('accountmappings').find({}, { projection: { mappingType:1, isActive:1 }}).toArray();
  const inactiveMappings = mappings.filter(m => !m.isActive);

  // Currencies
  const currencies = await db.collection('currencies').find({}, { projection: { code:1, baseCurrency:1, exchangeRate:1 }}).toArray();

  // Ledger
  const ledgerCount = await db.collection('ledgers').countDocuments();
  const ledgerDeleted = await db.collection('ledgers').countDocuments({ isDeleted: true });

  // Transactions
  const txTotal = await db.collection('transactions').countDocuments();
  const txByStatus = await db.collection('transactions').aggregate([
    { $group: { _id: '$status', count: { $sum: 1 }}}
  ]).toArray();
  const txByType = await db.collection('transactions').aggregate([
    { $group: { _id: '$type', count: { $sum: 1 }}}
  ]).toArray();

  // Orphan ledger entries (debitAccountId or creditAccountId not in COA)
  const coaIds = (await db.collection('chartofaccounts').find({}, { projection: { _id:1 }}).toArray()).map(a => a._id.toString());
  const ledgerSample = await db.collection('ledgers').find({}, { projection: { debitAccountId:1, creditAccountId:1 }}).limit(500).toArray();
  const orphans = ledgerSample.filter(l => 
    !coaIds.includes(l.debitAccountId?.toString()) || !coaIds.includes(l.creditAccountId?.toString())
  );

  // Customers
  const customers = await db.collection('customers').countDocuments();
  // Vendors
  const vendors = await db.collection('vendors').countDocuments();
  // Suppliers
  const suppliers = await db.collection('suppliers').countDocuments();
  // Employees
  const employees = await db.collection('employees').countDocuments();
  // Inventory
  const inventory = await db.collection('inventoryitems').countDocuments();

  // Direct deals
  const deals = await db.collection('directdeals').countDocuments();
  const unfixedDeals = await db.collection('directdeals').countDocuments({ metalFixStatus: 'unfixed' });

  // CRM
  const leads   = await db.collection('crmleads').countDocuments();
  const crmDeals = await db.collection('crmdeals').countDocuments();

  // Tasks
  const tasks = await db.collection('tasks').countDocuments();
  const overdueTasks = await db.collection('tasks').countDocuments({ dueDate: { $lt: new Date() }, status: { $ne: 'done' }});

  // Messages
  const messages = await db.collection('messages').countDocuments();

  // Finance (separate collections)
  const invoices = await db.collection('financeinvoices').countDocuments();
  const expenses = await db.collection('financeexpenses').countDocuments();
  const payrolls = await db.collection('financepayrolls').countDocuments();

  // Training
  const trainingSessions = await db.collection('trainingsessions').countDocuments();
  const trainingCerts = await db.collection('trainingcerts').countDocuments();

  // Compliance
  const complianceDocs = await db.collection('compliancedocs').countDocuments();

  // Report branding
  const reportBranding = await db.collection('reportbrandings').findOne();

  // COA accounts with missing accountCode (code 0 or blank or null)
  const missingCode = await db.collection('chartofaccounts').countDocuments({ $or: [{ accountCode: '' }, { accountCode: null }, { accountCode: '0' }]});

  // Duplicate accountCode check
  const dupCodes = await db.collection('chartofaccounts').aggregate([
    { $group: { _id: '$accountCode', count: { $sum: 1 }}},
    { $match: { count: { $gt: 1 }}}
  ]).toArray();

  await conn.close();

  return {
    users, coaCount, coaTypes, mappings, inactiveMappings,
    currencies, ledgerCount, ledgerDeleted, txTotal, txByStatus, txByType,
    orphans, customers, vendors, suppliers, employees, inventory,
    deals, unfixedDeals, leads, crmDeals, tasks, overdueTasks,
    messages, invoices, expenses, payrolls,
    trainingSessions, trainingCerts, complianceDocs, reportBranding,
    missingCode, dupCodes
  };
}

(async () => {
  const tenants = [
    { name: 'MG',    uri: process.env.MONGO_URI_MG },
    { name: 'CG',    uri: process.env.MONGO_URI_CG },
    { name: 'LoopC', uri: process.env.MONGO_URI_LOOPC },
  ];

  for (const t of tenants) {
    try {
      const r = await analyzeTenant(t.name, t.uri);
      console.log(`\n${'='.repeat(60)}`);
      console.log(`TENANT: ${t.name}`);
      console.log(`${'='.repeat(60)}`);

      console.log(`\n── USERS (${r.users.length}) ──`);
      r.users.forEach(u => console.log(`  ${u.name} | ${u.role} | dept:${u.department||'—'} | active:${u.isActive}`));

      console.log(`\n── CHART OF ACCOUNTS ──`);
      console.log(`  Total: ${r.coaCount}, Types: ${r.coaTypes.join(', ')}`);
      console.log(`  Missing accountCode: ${r.missingCode}`);
      console.log(`  Duplicate account codes: ${r.dupCodes.length ? JSON.stringify(r.dupCodes) : 'none'}`);

      console.log(`\n── ACCOUNT MAPPINGS (${r.mappings.length}) ──`);
      r.mappings.forEach(m => console.log(`  ${m.mappingType} [${m.isActive ? 'active' : '⚠️ INACTIVE'}]`));
      if (r.inactiveMappings.length) console.log(`  ⚠️ Inactive mappings: ${r.inactiveMappings.map(m => m.mappingType).join(', ')}`);

      console.log(`\n── CURRENCIES (${r.currencies.length}) ──`);
      r.currencies.forEach(c => console.log(`  ${c.code} | base:${c.baseCurrency} | rate:${c.exchangeRate}`));

      console.log(`\n── LEDGER ──`);
      console.log(`  Total: ${r.ledgerCount}, Soft-deleted: ${r.ledgerDeleted}`);
      console.log(`  Orphan entries (first 500 checked): ${r.orphans.length}`);

      console.log(`\n── TRANSACTIONS (${r.txTotal}) ──`);
      console.log(`  By status: ${r.txByStatus.map(s => `${s._id}:${s.count}`).join(', ') || 'none'}`);
      console.log(`  By type:   ${r.txByType.map(s => `${s._id}:${s.count}`).join(', ') || 'none'}`);

      console.log(`\n── MASTER DATA ──`);
      console.log(`  Customers:${r.customers}  Vendors:${r.vendors}  Suppliers:${r.suppliers}  Employees:${r.employees}  Inventory:${r.inventory}`);
      console.log(`  Direct Deals:${r.deals}  Unfixed:${r.unfixedDeals}  CRM Leads:${r.leads}  CRM Deals:${r.crmDeals}`);

      console.log(`\n── OPERATIONAL DATA ──`);
      console.log(`  Tasks:${r.tasks}  Overdue:${r.overdueTasks}  Messages:${r.messages}`);
      console.log(`  Finance Invoices:${r.invoices}  Expenses:${r.expenses}  Payrolls:${r.payrolls}`);
      console.log(`  Training Sessions:${r.trainingSessions}  Certs:${r.trainingCerts}  Compliance Docs:${r.complianceDocs}`);

      console.log(`\n── REPORT BRANDING ──`);
      if (r.reportBranding) {
        console.log(`  Company name: ${r.reportBranding.companyName || '—'}`);
        console.log(`  Address: ${r.reportBranding.address || '—'}`);
        console.log(`  Logo: ${r.reportBranding.logoUrl ? 'set' : 'not set'}`);
      } else {
        console.log(`  ⚠️ No report branding configured`);
      }
    } catch(e) {
      console.error(`\n${t.name} ERROR: ${e.message}`);
    }
  }
  console.log('\n\nDone.');
})();
