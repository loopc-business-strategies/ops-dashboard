require('./_destructive-guard')({ scriptName: __filename })
require('dotenv').config()
const dns = require('dns')
const mongoose = require('mongoose')

dns.setServers((process.env.ATLAS_DNS_SERVERS || '8.8.8.8,1.1.1.1').split(',').map((s) => s.trim()).filter(Boolean))

async function main() {
  const uri = process.env.MONGO_URI_CG
  if (!uri) throw new Error('MONGO_URI_CG missing')

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 15000 })
  const db = mongoose.connection.getClient().db()

  const now = new Date()
  const partyNameRx = /^(test account|suplier test)$/i
  const fxValidationRx = /fx validation live test/i

  const txFilter = {
    $or: [
      { 'voucherMeta.partyName': partyNameRx },
      { description: fxValidationRx },
    ],
    isDeleted: { $ne: true },
  }

  const txDocs = await db.collection('transactions').find(txFilter).project({ _id: 1 }).toArray()
  const txIds = txDocs.map((d) => d._id)

  const ledgerFilter = {
    $and: [
      { isDeleted: { $ne: true } },
      {
        $or: [
          { description: fxValidationRx },
          ...(txIds.length ? [{ referenceId: { $in: txIds } }] : []),
        ],
      },
    ],
  }

  const coaFilter = {
    $or: [
      { accountName: /^(test account \(debtor\)|suplier test \(creditor\))$/i },
      { description: /auto-created (receivable|payable) account.*test/i },
    ],
    isActive: true,
  }

  const customerFilter = { name: /^test account$/i, isActive: true }
  const vendorFilter = { name: /^suplier test$/i, isActive: true }

  const [txRes, ledgerRes, coaRes, customerRes, vendorRes] = await Promise.all([
    db.collection('transactions').updateMany(txFilter, { $set: { isDeleted: true, deletedAt: now, updatedAt: now } }),
    db.collection('ledgers').updateMany(ledgerFilter, { $set: { isDeleted: true, deletedAt: now, updatedAt: now } }),
    db.collection('chartofaccounts').updateMany(coaFilter, { $set: { isActive: false, updatedAt: now } }),
    db.collection('customers').updateMany(customerFilter, { $set: { isActive: false, updatedAt: now } }),
    db.collection('vendors').updateMany(vendorFilter, { $set: { isActive: false, status: 'blacklisted', updatedAt: now } }),
  ])

  const output = {
    archivedTransactions: txRes.modifiedCount,
    archivedLedgers: ledgerRes.modifiedCount,
    deactivatedAccounts: coaRes.modifiedCount,
    deactivatedCustomers: customerRes.modifiedCount,
    deactivatedVendors: vendorRes.modifiedCount,
  }

  console.log(JSON.stringify(output, null, 2))

  await mongoose.disconnect()
}

main().catch((err) => {
  console.error('Fatal:', err.message)
  process.exit(1)
})
