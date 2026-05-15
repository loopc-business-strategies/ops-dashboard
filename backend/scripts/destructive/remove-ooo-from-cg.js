require('./_destructive-guard')({ scriptName: __filename })
require('dotenv').config()
const mongoose = require('mongoose')

const Customer = require('../../models/Customer')
const ChartOfAccount = require('../../models/ChartOfAccount')
const Transaction = require('../../models/Transaction')
const Ledger = require('../../models/Ledger')
const AccountMapping = require('../../models/AccountMapping')
const DirectDeal = require('../../models/DirectDeal')

function buildTenantUri(tenant) {
  const envVar = `MONGO_URI_${tenant.toUpperCase()}`
  const uri = process.env[envVar]
  if (!uri) {
    throw new Error(`${envVar} not set in .env`)
  }
  return uri
}

async function removeOOOFromTenant(tenant) {
  const mongoUri = buildTenantUri(tenant)
  console.log(`\n[${tenant.toUpperCase()}] Connecting to MongoDB...`)
  
  await mongoose.connect(mongoUri)

  // Find all OOO accounts
  const oooAccounts = await Customer.find({ name: { $regex: /^ooo$/i } }).select('_id name ledgerAccountId').lean()
  
  if (!oooAccounts.length) {
    console.log(`✓ No OOO accounts found in ${tenant.toUpperCase()}`)
    await mongoose.disconnect()
    return { tenant, found: 0, removed: 0 }
  }

  console.log(`Found ${oooAccounts.length} OOO account(s):`)
  oooAccounts.forEach(acc => console.log(`  - ${acc.name} (ID: ${acc._id})`))

  const oooCustomerIds = oooAccounts.map(c => c._id)
  const oooLedgerAccountIds = oooAccounts.map(c => c.ledgerAccountId).filter(Boolean)

  // Check for data associated with OOO
  const [txCount, ledgerCount, mappingCount, dealCount] = await Promise.all([
    Transaction.countDocuments({
      $or: [
        { customerId: { $in: oooCustomerIds } },
        { debitAccountId: { $in: oooLedgerAccountIds } },
        { creditAccountId: { $in: oooLedgerAccountIds } },
      ],
    }),
    Ledger.countDocuments({
      $or: [
        { debitAccountId: { $in: oooLedgerAccountIds } },
        { creditAccountId: { $in: oooLedgerAccountIds } },
      ],
    }),
    AccountMapping.countDocuments({
      $or: [
        { debitAccountId: { $in: oooLedgerAccountIds } },
        { creditAccountId: { $in: oooLedgerAccountIds } },
      ],
    }),
    DirectDeal.countDocuments({ 'lineItems.customerId': { $in: oooCustomerIds } }),
  ])

  console.log(`\nData associated with OOO:`)
  console.log(`  - Transactions: ${txCount}`)
  console.log(`  - Ledger entries: ${ledgerCount}`)
  console.log(`  - Account mappings: ${mappingCount}`)
  console.log(`  - Direct deals: ${dealCount}`)

  // Delete all OOO-related data
  console.log(`\nRemoving OOO data from ${tenant.toUpperCase()}...`)
  
  const [deletedTransactions, deletedLedgers, deletedMappings, deletedDirectDeals, deletedCustomers] = await Promise.all([
    Transaction.deleteMany({
      $or: [
        { customerId: { $in: oooCustomerIds } },
        { debitAccountId: { $in: oooLedgerAccountIds } },
        { creditAccountId: { $in: oooLedgerAccountIds } },
      ],
    }),
    Ledger.deleteMany({
      $or: [
        { debitAccountId: { $in: oooLedgerAccountIds } },
        { creditAccountId: { $in: oooLedgerAccountIds } },
      ],
    }),
    AccountMapping.deleteMany({
      $or: [
        { debitAccountId: { $in: oooLedgerAccountIds } },
        { creditAccountId: { $in: oooLedgerAccountIds } },
      ],
    }),
    DirectDeal.deleteMany({ 'lineItems.customerId': { $in: oooCustomerIds } }),
    Customer.deleteMany({ _id: { $in: oooCustomerIds } }),
  ])

  // Detach any child accounts
  const detachedChildAccounts = await ChartOfAccount.updateMany(
    { parentAccountId: { $in: oooLedgerAccountIds } },
    { $set: { parentAccountId: null } }
  )

  // Delete OOO ledger accounts
  const deletedAccounts = await ChartOfAccount.deleteMany({ _id: { $in: oooLedgerAccountIds } })

  // Verify removal
  const remainingOOO = await Customer.countDocuments({ name: { $regex: /^ooo$/i } })

  console.log(`\n✓ Removal complete for ${tenant.toUpperCase()}:`)
  console.log(`  - Removed customer records: ${deletedCustomers.deletedCount || 0}`)
  console.log(`  - Removed chart accounts: ${deletedAccounts.deletedCount || 0}`)
  console.log(`  - Detached child accounts: ${detachedChildAccounts.modifiedCount || 0}`)
  console.log(`  - Removed transactions: ${deletedTransactions.deletedCount || 0}`)
  console.log(`  - Removed ledger entries: ${deletedLedgers.deletedCount || 0}`)
  console.log(`  - Removed account mappings: ${deletedMappings.deletedCount || 0}`)
  console.log(`  - Removed direct deals: ${deletedDirectDeals.deletedCount || 0}`)
  console.log(`  - Remaining OOO accounts: ${remainingOOO}`)

  await mongoose.disconnect()
  
  return {
    tenant,
    found: oooAccounts.length,
    removed: deletedCustomers.deletedCount || 0,
  }
}

async function run() {
  const tenants = process.argv.slice(2).length ? process.argv.slice(2) : ['cg']
  
  console.log(`\n=== Removing OOO Accounts ===`)
  console.log(`Tenants: ${tenants.join(', ')}`)
  
  const results = []
  for (const tenant of tenants) {
    try {
      const result = await removeOOOFromTenant(tenant)
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
