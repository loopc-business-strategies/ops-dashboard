const mongoose = require('mongoose')

;(async () => {
  try {
    const MONGO_URI_MG = process.env.MONGO_URI_MG || 'mongodb+srv://user:pass@cluster.mongodb.net/mg?retryWrites=true&w=majority'
    
    console.log('\n=== Direct MongoDB Cleanup for MG ===\n')
    console.log('Attempting connection to MongoDB...')
    
    // Connect to MongoDB
    await mongoose.connect(MONGO_URI_MG, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    })
    console.log('✓ Connected to MongoDB\n')

    const db = mongoose.connection.db

    // Delete transactions (vouchers)
    console.log('[1/3] Deleting all transactions (vouchers)...')
    const txResult = await db.collection('transactions').deleteMany({})
    console.log(`✓ Deleted ${txResult.deletedCount} transactions\n`)

    // Delete ledger entries (journal vouchers)
    console.log('[2/3] Deleting all ledger entries (JVs)...')
    const ledResult = await db.collection('ledgers').deleteMany({})
    console.log(`✓ Deleted ${ledResult.deletedCount} ledger entries\n`)

    // Verify counts
    console.log('[3/3] Verifying deletion...')
    const txCount = await db.collection('transactions').countDocuments({})
    const ledCount = await db.collection('ledgers').countDocuments({})
    console.log(`Transactions remaining: ${txCount}`)
    console.log(`Ledger entries remaining: ${ledCount}\n`)

    console.log('=== Cleanup Complete ===')
    console.log(`Total transactions deleted: ${txResult.deletedCount}`)
    console.log(`Total ledger entries deleted: ${ledResult.deletedCount}\n`)

    await mongoose.disconnect()
  } catch (e) {
    console.error(`\n❌ Error: ${e.message}\n`)
    process.exit(1)
  }
})()
