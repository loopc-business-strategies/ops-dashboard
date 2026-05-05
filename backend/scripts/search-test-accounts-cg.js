require('dotenv').config()
const mongoose = require('mongoose')

async function searchCGForTestAccounts() {
  const mongoUri = process.env.MONGO_URI_CG
  console.log(`\n=== Searching CG for test/supplier accounts ===\n`)
  
  await mongoose.connect(mongoUri)
  const db = mongoose.connection.getClient().db()
  
  // Check ChartOfAccount (1301, 2300 appear to be account codes)
  const accountsCol = db.collection('chartofaccounts')
  const allAccounts = await accountsCol.find({}).toArray()
  
  console.log(`Total Chart of Accounts: ${allAccounts.length}`)
  
  const testAccounts = allAccounts.filter(acc =>
    /test|supplier|1301|2300/i.test(acc.name || '') ||
    /test|supplier|1301|2300/i.test(acc.code || '')
  )
  
  if (testAccounts.length > 0) {
    console.log(`\nTest/Supplier accounts found:`)
    testAccounts.forEach(acc => {
      console.log(`  - ${acc.code}: ${acc.name} (ID: ${acc._id})`)
      console.log(`    Type: ${acc.accountType}, Status: ${acc.isActive ? 'Active' : 'Inactive'}`)
    })
  } else {
    console.log(`\nNo test/supplier accounts found in ChartOfAccount`)
  }
  
  // Check transactions/vouchers related to test
  console.log(`\nSearching for vouchers/transactions with test accounts...`)
  
  const transactionsCol = db.collection('transactions')
  const transCount = await transactionsCol.countDocuments({
    $or: [
      { description: { $regex: /test/i } },
      { remarks: { $regex: /test/i } }
    ]
  })
  console.log(`  Transactions with 'test': ${transCount}`)
  
  // Check ledgers
  const ledgersCol = db.collection('ledgers')
  const ledgerCount = await ledgersCol.countDocuments({})
  console.log(`  Total Ledger entries: ${ledgerCount}`)
  
  await mongoose.disconnect()
  console.log(`\n=== End Search ===\n`)
}

searchCGForTestAccounts().catch(error => {
  console.error('Error:', error.message)
  process.exit(1)
})
