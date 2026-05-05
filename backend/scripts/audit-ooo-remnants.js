require('dotenv').config()
const mongoose = require('mongoose')

const Customer = require('../models/Customer')
const ChartOfAccount = require('../models/ChartOfAccount')
const Transaction = require('../models/Transaction')
const Ledger = require('../models/Ledger')

function buildTenantUri(tenant) {
  const envVar = `MONGO_URI_${tenant.toUpperCase()}`
  const uri = process.env[envVar]
  if (!uri) {
    throw new Error(`${envVar} not set in .env`)
  }
  return uri
}

async function auditTenant(tenant) {
  const mongoUri = buildTenantUri(tenant)
  await mongoose.connect(mongoUri)

  console.log(`\n[${tenant.toUpperCase()}] Audit Results:`)
  
  // Check for any account with 'ooo' or 'mark' in name (case-insensitive)
  const oooMatches = await Customer.find({ name: { $regex: /ooo/i } }).select('_id name').lean()
  if (oooMatches.length) {
    console.log(`  ⚠ Found ${oooMatches.length} customer(s) with "ooo" in name:`)
    oooMatches.forEach(c => console.log(`    - ${c.name} (ID: ${c._id})`))
  } else {
    console.log(`  ✓ No customers with "ooo" in name`)
  }

  const markMatches = await Customer.find({ name: { $regex: /^mark$/i } }).select('_id name').lean()
  if (markMatches.length) {
    console.log(`  ⚠ Found ${markMatches.length} customer(s) with "mark" in name:`)
    markMatches.forEach(c => console.log(`    - ${c.name} (ID: ${c._id})`))
  } else {
    console.log(`  ✓ No customers with "mark" in name`)
  }

  // Check for orphaned ledger accounts with 'ooo' or 'mark'
  const orphanedLedgers = await ChartOfAccount.find({ 
    $or: [
      { name: { $regex: /ooo/i } },
      { name: { $regex: /^mark$/i } }
    ]
  }).select('_id name code').lean()
  
  if (orphanedLedgers.length) {
    console.log(`  ⚠ Found ${orphanedLedgers.length} chart account(s) with "ooo" or "mark":`)
    orphanedLedgers.forEach(acc => console.log(`    - ${acc.name} (${acc.code})`))
  } else {
    console.log(`  ✓ No chart accounts with "ooo" or "mark" in name`)
  }

  // Check for transactions with removed customer references
  const txCount = await Transaction.countDocuments({ 
    customerId: null,
    $or: [
      { description: { $regex: /ooo|mark/i } },
      { remarks: { $regex: /ooo|mark/i } }
    ]
  })
  
  if (txCount) {
    console.log(`  ⚠ Found ${txCount} transaction(s) with OOO/MARK references but no customer`)
  } else {
    console.log(`  ✓ No orphaned transactions with OOO/MARK references`)
  }

  // Summary stats
  const allCustomers = await Customer.countDocuments({})
  const allAccounts = await ChartOfAccount.countDocuments({})
  const allTransactions = await Transaction.countDocuments({})
  
  console.log(`  Summary: ${allCustomers} customers, ${allAccounts} accounts, ${allTransactions} transactions`)

  await mongoose.disconnect()
}

async function run() {
  const tenants = ['mg', 'cg', 'loopc']
  console.log(`=== Comprehensive OOO & MARK Cleanup Audit ===`)
  
  for (const tenant of tenants) {
    try {
      await auditTenant(tenant)
    } catch (error) {
      console.error(`✗ Error auditing ${tenant}: ${error.message}`)
    }
  }
  
  console.log(`\n=== Audit Complete ===`)
}

run().catch(error => {
  console.error('Fatal error:', error.message)
  process.exit(1)
})
