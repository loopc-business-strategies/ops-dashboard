require('dotenv').config()
const mongoose = require('mongoose')

async function inspectTenant(name, uri) {
  await mongoose.connect(uri)
  const db = mongoose.connection.getClient().db()

  const coa = db.collection('chartofaccounts')
  const ledgers = db.collection('ledgers')
  const tx = db.collection('transactions')
  const vendors = db.collection('vendors')
  const customers = db.collection('customers')

  const testAccounts = await coa.find({
    $or: [
      { name: /test/i },
      { code: { $in: ['1301', '2300'] } },
    ],
  }).project({ code: 1, name: 1, accountType: 1, balance: 1 }).toArray()

  const testVendors = await vendors.find({ name: /test/i }).project({ name: 1, vendorCode: 1, ledgerAccountId: 1 }).toArray()
  const testCustomers = await customers.find({ name: /test/i }).project({ name: 1, ledgerAccountId: 1 }).toArray()

  const accountIds = testAccounts.map((a) => a._id)
  const ledgerCount = accountIds.length
    ? await ledgers.countDocuments({ $or: [{ debitAccountId: { $in: accountIds } }, { creditAccountId: { $in: accountIds } }] })
    : 0
  const txCount = accountIds.length
    ? await tx.countDocuments({ $or: [{ debitAccountId: { $in: accountIds } }, { creditAccountId: { $in: accountIds } }] })
    : 0

  console.log(`\n[${name}]`)
  console.log(`chartofaccounts matches: ${testAccounts.length}`)
  testAccounts.forEach((a) => console.log(`- ${a.code || '-'} ${a.name || '-'} type=${a.accountType || '-'} id=${a._id}`))

  console.log(`vendors(test): ${testVendors.length}`)
  testVendors.forEach((v) => console.log(`- ${v.name} code=${v.vendorCode || '-'} ledger=${v.ledgerAccountId || '-'}`))

  console.log(`customers(test): ${testCustomers.length}`)
  testCustomers.forEach((c) => console.log(`- ${c.name} ledger=${c.ledgerAccountId || '-'}`))

  console.log(`ledgers linked to matched accounts: ${ledgerCount}`)
  console.log(`transactions linked to matched accounts: ${txCount}`)

  await mongoose.disconnect()
}

async function run() {
  await inspectTenant('MG', process.env.MONGO_URI_MG)
  await inspectTenant('CG', process.env.MONGO_URI_CG)
  await inspectTenant('LOOPC', process.env.MONGO_URI_LOOPC)
}

run().catch((err) => {
  console.error('Inspection failed:', err.message)
  process.exit(1)
})
