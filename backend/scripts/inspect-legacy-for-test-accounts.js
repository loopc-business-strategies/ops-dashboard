require('dotenv').config()
const mongoose = require('mongoose')

async function run() {
  const uri = process.env.MONGO_URI_CG
  if (!uri) throw new Error('MONGO_URI_CG missing')

  await mongoose.connect(uri)
  const db = mongoose.connection.getClient().db()

  const coa = db.collection('chartofaccounts')
  const vendors = db.collection('vendors')
  const customers = db.collection('customers')
  const ledgers = db.collection('ledgers')
  const tx = db.collection('transactions')

  const accountHits = await coa.find({
    $or: [
      { name: /test|ooo|mark|supplier/i },
      { code: { $in: ['1301', '2300', '1300', '1302'] } },
    ],
  }).project({ code: 1, name: 1, accountType: 1, balance: 1, parentAccountId: 1 }).toArray()

  const vendorHits = await vendors.find({ name: /test|ooo|mark|supplier/i }).project({ name: 1, vendorCode: 1, ledgerAccountId: 1 }).toArray()
  const customerHits = await customers.find({ name: /test|ooo|mark/i }).project({ name: 1, ledgerAccountId: 1 }).toArray()

  const ids = accountHits.map((a) => a._id)
  const ledgerCount = ids.length ? await ledgers.countDocuments({ $or: [{ debitAccountId: { $in: ids } }, { creditAccountId: { $in: ids } }] }) : 0
  const txCount = ids.length ? await tx.countDocuments({ $or: [{ debitAccountId: { $in: ids } }, { creditAccountId: { $in: ids } }] }) : 0

  console.log('[LEGACY] chartofaccounts hits:', accountHits.length)
  accountHits.forEach((a) => console.log('-', a.code || '-', a.name || '-', 'type=' + (a.accountType || '-'), 'id=' + a._id))

  console.log('[LEGACY] vendors hits:', vendorHits.length)
  vendorHits.forEach((v) => console.log('-', v.name, 'code=' + (v.vendorCode || '-'), 'ledger=' + (v.ledgerAccountId || '-')))

  console.log('[LEGACY] customers hits:', customerHits.length)
  customerHits.forEach((c) => console.log('-', c.name, 'ledger=' + (c.ledgerAccountId || '-')))

  console.log('[LEGACY] ledgers linked to hit accounts:', ledgerCount)
  console.log('[LEGACY] transactions linked to hit accounts:', txCount)

  await mongoose.disconnect()
}

run().catch((e) => {
  console.error('Legacy inspection failed:', e.message)
  process.exit(1)
})
