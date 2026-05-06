require('dotenv').config()
const mongoose = require('mongoose')
const dns = require('dns')

const Customer = require('../models/Customer')

const dnsServers = (process.env.ATLAS_DNS_SERVERS || '8.8.8.8,1.1.1.1')
  .split(',')
  .map((v) => v.trim())
  .filter(Boolean)

if (dnsServers.length) {
  dns.setServers(dnsServers)
}

async function findAndRemoveOOOMarkFromCG() {
  const mongoUri = process.env.MONGO_URI_CG
  if (!mongoUri) {
    throw new Error('MONGO_URI_CG not set in .env')
  }

  console.log('\n=== Finding and Removing OOO/MARK from CG ===')
  await mongoose.connect(mongoUri)

  // Find all customers in CG to see what's actually there
  const allCustomers = await Customer.find({}).select('_id name').lean()
  console.log(`\nAll customers in CG (${allCustomers.length}):`)
  allCustomers.forEach(c => console.log(`  - ${c.name} (${c._id})`))

  // Find OOO and MARK specifically (case-insensitive exact match)
  const oooMarkAccounts = await Customer.find({
    $or: [
      { name: { $regex: /^ooo$/i } },
      { name: { $regex: /^mark$/i } }
    ]
  }).select('_id name ledgerAccountId').lean()

  if (oooMarkAccounts.length) {
    console.log(`\n⚠ Found ${oooMarkAccounts.length} account(s) to remove:`)
    oooMarkAccounts.forEach(acc => {
      console.log(`  - ID: ${acc._id}`)
      console.log(`    Name: ${acc.name}`)
      console.log(`    LedgerAccountId: ${acc.ledgerAccountId}`)
    })

    // Delete them
    console.log(`\nDeleting...`)
    const result = await Customer.deleteMany({
      $or: [
        { name: { $regex: /^ooo$/i } },
        { name: { $regex: /^mark$/i } }
      ]
    })

    console.log(`✓ Deleted ${result.deletedCount} customer(s)`)

    // Verify they're gone
    const remaining = await Customer.find({
      $or: [
        { name: { $regex: /^ooo$/i } },
        { name: { $regex: /^mark$/i } }
      ]
    }).countDocuments()

    console.log(`✓ Remaining OOO/MARK accounts: ${remaining}`)
  } else {
    console.log(`\n✓ No OOO or MARK accounts found in CG`)
  }

  await mongoose.disconnect()
  console.log(`\n=== Done ===\n`)
}

findAndRemoveOOOMarkFromCG().catch(error => {
  console.error('Error:', error.message)
  process.exit(1)
})
