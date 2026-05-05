require('dotenv').config()
const mongoose = require('mongoose')

const Customer = require('../models/Customer')
const ChartOfAccount = require('../models/ChartOfAccount')
const Transaction = require('../models/Transaction')
const Ledger = require('../models/Ledger')
const AccountMapping = require('../models/AccountMapping')
const DirectDeal = require('../models/DirectDeal')

function buildTenantUri(tenant) {
  const envVar = `MONGO_URI_${tenant.toUpperCase()}`
  const uri = process.env[envVar]
  if (!uri) {
    throw new Error(`${envVar} not set in .env`)
  }
  return uri
}

async function removeMarkFromTenant(tenant) {
  const mongoUri = buildTenantUri(tenant)
  console.log(`\n[${tenant.toUpperCase()}] Connecting to MongoDB...`)
  
  await mongoose.connect(mongoUri)

  // Find all MARK accounts
  const markAccounts = await Customer.find({ name: { $regex: /^mark$/i } }).select('_id name ledgerAccountId').lean()
  
  if (!markAccounts.length) {
    console.log(`✓ No MARK accounts found in ${tenant.toUpperCase()}`)
    await mongoose.disconnect()
    return { tenant, found: 0, removed: 0 }
  }

  console.log(`Found ${markAccounts.length} MARK account(s):`)
  markAccounts.forEach(acc => console.log(`  - ${acc.name} (ID: ${acc._id})`))

  const markCustomerIds = markAccounts.map(c => c._id)
  const markLedgerAccountIds = markAccounts.map(c => c.ledgerAccountId).filter(Boolean)

  // Check for data associated with MARK
  const [txCount, ledgerCount, mappingCount, dealCount] = await Promise.all([
    Transaction.countDocuments({
      $or: [
        { customerId: { $in: markCustomerIds } },
        { debitAccountId: { $in: markLedgerAccountIds } },
        { creditAccountId: { $in: markLedgerAccountIds } },
      ],
    }),
    Ledger.countDocuments({
      $or: [
        { debitAccountId: { $in: markLedgerAccountIds } },
        { creditAccountId: { $in: markLedgerAccountIds } },
      ],
    }),
    AccountMapping.countDocuments({
      $or: [
        { debitAccountId: { $in: markLedgerAccountIds } },
        { creditAccountId: { $in: markLedgerAccountIds } },
      ],
    }),
    DirectDeal.countDocuments({ 'lineItems.customerId': { $in: markCustomerIds } }),
  ])

  console.log(`\nData associated with MARK:`)
  console.log(`  - Transactions: ${txCount}`)
  console.log(`  - Ledger entries: ${ledgerCount}`)
  console.log(`  - Account mappings: ${mappingCount}`)
  console.log(`  - Direct deals: ${dealCount}`)

  // Delete all MARK-related data
  console.log(`\nRemoving MARK data from ${tenant.toUpperCase()}...`)
  
  const [deletedTransactions, deletedLedgers, deletedMappings, deletedDirectDeals, deletedCustomers] = await Promise.all([
    Transaction.deleteMany({
      $or: [
        { customerId: { $in: markCustomerIds } },
        { debitAccountId: { $in: markLedgerAccountIds } },
        { creditAccountId: { $in: markLedgerAccountIds } },
      ],
    }),
    Ledger.deleteMany({
      $or: [
        { debitAccountId: { $in: markLedgerAccountIds } },
        { creditAccountId: { $in: markLedgerAccountIds } },
      ],
    }),
    AccountMapping.deleteMany({
      $or: [
        { debitAccountId: { $in: markLedgerAccountIds } },
        { creditAccountId: { $in: markLedgerAccountIds } },
      ],
    }),
    DirectDeal.deleteMany({ 'lineItems.customerId': { $in: markCustomerIds } }),
    Customer.deleteMany({ _id: { $in: markCustomerIds } }),
  ])

  // Detach any child accounts
  const detachedChildAccounts = await ChartOfAccount.updateMany(
    { parentAccountId: { $in: markLedgerAccountIds } },
    { $set: { parentAccountId: null } }
  )

  // Delete MARK ledger accounts
  const deletedAccounts = await ChartOfAccount.deleteMany({ _id: { $in: markLedgerAccountIds } })

  // Verify removal
  const remainingMark = await Customer.countDocuments({ name: { $regex: /^mark$/i } })

  console.log(`\n✓ Removal complete for ${tenant.toUpperCase()}:`)
  console.log(`  - Removed customer records: ${deletedCustomers.deletedCount || 0}`)
  console.log(`  - Removed chart accounts: ${deletedAccounts.deletedCount || 0}`)
  console.log(`  - Detached child accounts: ${detachedChildAccounts.modifiedCount || 0}`)
  console.log(`  - Removed transactions: ${deletedTransactions.deletedCount || 0}`)
  console.log(`  - Removed ledger entries: ${deletedLedgers.deletedCount || 0}`)
  console.log(`  - Removed account mappings: ${deletedMappings.deletedCount || 0}`)
  console.log(`  - Removed direct deals: ${deletedDirectDeals.deletedCount || 0}`)
  console.log(`  - Remaining MARK accounts: ${remainingMark}`)

  await mongoose.disconnect()
  
  return {
    tenant,
    found: markAccounts.length,
    removed: deletedCustomers.deletedCount || 0,
  }
}

async function run() {
  const tenants = ['mg', 'cg', 'loopc']
  
  console.log(`\n=== Removing MARK Accounts ===`)
  console.log(`Tenants: ${tenants.join(', ')}`)
  
  const results = []
  for (const tenant of tenants) {
    try {
      const result = await removeMarkFromTenant(tenant)
      results.push(result)
    } catch (error) {
      console.error(`✗ Error for ${tenant}: ${error.message}`)
      results.push({ tenant, error: error.message })
    }
  }

  console.log(`\n=== Summary ===`)
  results.forEach(r => {
    if (r.error) {
      console.log(`${r.tenant.toUpperCase()}: ERROR - ${r.error}`)
    } else {
      console.log(`${r.tenant.toUpperCase()}: Found ${r.found}, Removed ${r.removed}`)
    }
  })
}

run().catch(error => {
  console.error('Fatal error:', error.message)
  process.exit(1)
})
