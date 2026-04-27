require('dotenv').config()
const mongoose = require('mongoose')

const Customer = require('../models/Customer')
const ChartOfAccount = require('../models/ChartOfAccount')
const Transaction = require('../models/Transaction')
const Ledger = require('../models/Ledger')
const AccountMapping = require('../models/AccountMapping')
const DirectDeal = require('../models/DirectDeal')

function buildMongoUri() {
  if (process.env.MONGO_URI) return process.env.MONGO_URI

  const user = process.env.DB_USER
  const pass = process.env.DB_PASS
  const cluster = process.env.DB_CLUSTER
  const dbName = process.env.DB_NAME || 'ops-dashboard'
  const params = process.env.DB_PARAMS || 'retryWrites=true&w=majority'

  if (!user || !pass || !cluster) return null
  return `mongodb+srv://${user}:${encodeURIComponent(pass)}@${cluster}/${dbName}?${params}`
}

function parseKeepNames() {
  const keepArg = process.argv.find((arg) => arg.startsWith('--keep='))
  const defaultNames = ['xxx', 'ooo', 'mark']
  if (!keepArg) return defaultNames

  const raw = keepArg.split('=')[1] || ''
  const list = raw.split(',').map((name) => name.trim().toLowerCase()).filter(Boolean)
  return list.length ? list : defaultNames
}

function toUniqueIds(values) {
  return Array.from(new Set(values.filter(Boolean).map((v) => String(v))))
}

async function run() {
  const keepNames = parseKeepNames()
  const mongoUri = buildMongoUri()

  if (!mongoUri) {
    throw new Error('Mongo config missing. Set MONGO_URI or DB_USER/DB_PASS/DB_CLUSTER in backend .env')
  }

  await mongoose.connect(mongoUri)

  const allCustomers = await Customer.find({}).sort({ createdAt: 1 }).select('_id name ledgerAccountId').lean()

  const keepCustomers = []
  for (const keepName of keepNames) {
    const found = allCustomers.find((c) => String(c.name || '').trim().toLowerCase() === keepName && !keepCustomers.some((k) => String(k._id) === String(c._id)))
    if (found) keepCustomers.push(found)
  }

  const keepCustomerIds = toUniqueIds(keepCustomers.map((c) => c._id))
  const keepLedgerAccountIds = toUniqueIds(keepCustomers.map((c) => c.ledgerAccountId))

  const removeCustomers = allCustomers.filter((c) => !keepCustomerIds.includes(String(c._id)))
  const removeCustomerIds = toUniqueIds(removeCustomers.map((c) => c._id))
  const removeLedgerAccountIds = toUniqueIds(
    removeCustomers
      .map((c) => c.ledgerAccountId)
      .filter((id) => !keepLedgerAccountIds.includes(String(id)))
  )

  if (!keepCustomerIds.length) {
    throw new Error(`No matching customers found to keep for names: ${keepNames.join(', ')}`)
  }

  const [deletedTransactions, deletedLedgers, deletedMappings, deletedDirectDeals, deletedCustomers] = await Promise.all([
    Transaction.deleteMany({
      $or: [
        { customerId: { $in: removeCustomerIds } },
        { debitAccountId: { $in: removeLedgerAccountIds } },
        { creditAccountId: { $in: removeLedgerAccountIds } },
      ],
    }),
    Ledger.deleteMany({
      $or: [
        { debitAccountId: { $in: removeLedgerAccountIds } },
        { creditAccountId: { $in: removeLedgerAccountIds } },
      ],
    }),
    AccountMapping.deleteMany({
      $or: [
        { debitAccountId: { $in: removeLedgerAccountIds } },
        { creditAccountId: { $in: removeLedgerAccountIds } },
      ],
    }),
    DirectDeal.deleteMany({ 'lineItems.customerId': { $in: removeCustomerIds } }),
    Customer.deleteMany({ _id: { $in: removeCustomerIds } }),
  ])

  const [detachedChildAccounts, deletedAccounts] = await Promise.all([
    ChartOfAccount.updateMany(
      { parentAccountId: { $in: removeLedgerAccountIds } },
      { $set: { parentAccountId: null } }
    ),
    ChartOfAccount.deleteMany({ _id: { $in: removeLedgerAccountIds } }),
  ])

  const remainingCustomers = await Customer.find({}).sort({ createdAt: 1 }).select('name').lean()

  console.log('Customer/account cleanup complete.')
  console.log(`Kept customer names target: ${keepNames.join(', ')}`)
  console.log(`Kept customer records: ${keepCustomerIds.length}`)
  console.log(`Removed customer records: ${deletedCustomers.deletedCount || 0}`)
  console.log(`Removed chart accounts: ${deletedAccounts.deletedCount || 0}`)
  console.log(`Detached child accounts from deleted parents: ${detachedChildAccounts.modifiedCount || 0}`)
  console.log(`Removed transactions: ${deletedTransactions.deletedCount || 0}`)
  console.log(`Removed ledger entries: ${deletedLedgers.deletedCount || 0}`)
  console.log(`Removed account mappings: ${deletedMappings.deletedCount || 0}`)
  console.log(`Removed direct deals: ${deletedDirectDeals.deletedCount || 0}`)
  console.log(`Remaining customers: ${remainingCustomers.map((c) => c.name).join(', ') || '(none)'}`)
}

run()
  .catch((error) => {
    console.error('Cleanup failed:', error.message)
    process.exitCode = 1
  })
  .finally(async () => {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect()
    }
  })
