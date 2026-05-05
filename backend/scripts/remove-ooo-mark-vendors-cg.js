require('dotenv').config()
const mongoose = require('mongoose')

const Vendor = require('../models/Vendor')

async function removeOOOMarkVendorsFromCG() {
  const mongoUri = process.env.MONGO_URI_CG
  console.log(`Connecting to CG...`)
  
  await mongoose.connect(mongoUri)

  // Find vendors with ooo or mark in the name
  const vendors = await Vendor.find({
    $or: [
      { name: { $regex: /ooo/i } },
      { name: { $regex: /mark/i } }
    ]
  }).select('_id name vendorCode').lean()

  if (vendors.length) {
    console.log(`\nFound ${vendors.length} vendor(s) to remove:`)
    vendors.forEach(v => {
      console.log(`  - ${v.name} (Code: ${v.vendorCode}, ID: ${v._id})`)
    })

    // Delete them
    console.log(`\nDeleting vendors...`)
    const result = await Vendor.deleteMany({
      $or: [
        { name: { $regex: /ooo/i } },
        { name: { $regex: /mark/i } }
      ]
    })

    console.log(`✓ Deleted ${result.deletedCount} vendor(s)`)

    // Verify
    const remaining = await Vendor.countDocuments({
      $or: [
        { name: { $regex: /ooo/i } },
        { name: { $regex: /mark/i } }
      ]
    })

    console.log(`✓ Remaining OOO/MARK vendors: ${remaining}`)
  } else {
    console.log(`✓ No OOO or MARK vendors found in CG`)
  }

  // Also check ChartOfAccount for orphaned OOO/MARK accounts
  const ChartOfAccount = require('../models/ChartOfAccount')
  const orphanedAccounts = await ChartOfAccount.find({
    $or: [
      { name: { $regex: /ooo/i } },
      { name: { $regex: /mark/i } }
    ]
  }).select('_id name code').lean()

  if (orphanedAccounts.length) {
    console.log(`\nFound ${orphanedAccounts.length} orphaned chart account(s):`)
    orphanedAccounts.forEach(acc => {
      console.log(`  - ${acc.name} (Code: ${acc.code})`)
    })

    console.log(`\nDeleting orphaned accounts...`)
    const delResult = await ChartOfAccount.deleteMany({
      $or: [
        { name: { $regex: /ooo/i } },
        { name: { $regex: /mark/i } }
      ]
    })
    console.log(`✓ Deleted ${delResult.deletedCount} chart account(s)`)
  } else {
    console.log(`✓ No orphaned OOO/MARK chart accounts in CG`)
  }

  await mongoose.disconnect()
  console.log(`\n=== Complete ===\n`)
}

removeOOOMarkVendorsFromCG().catch(error => {
  console.error('Error:', error.message)
  process.exit(1)
})
