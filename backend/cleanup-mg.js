const mongoose = require('mongoose')

;(async () => {
  try {
    const MONGO_URI_MG = process.env.MONGO_URI_MG || 'mongodb+srv://admin:loopCAdmin2024@loopcluster.mongodb.net/mg?retryWrites=true&w=majority'
    
    console.log('\n=== Direct MongoDB Cleanup for MG ===\n')
    console.log('Connecting to MongoDB...')
    
    await mongoose.connect(MONGO_URI_MG, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      serverSelectionTimeoutMS: 5000,
    })
    console.log('✓ Connected\n')

    const db = mongoose.connection.db

    // Delete all transactions
    console.log('[1/2] Deleting transactions...')
    const txResult = await db.collection('transactions').deleteMany({})
    console.log(`✓ Deleted ${txResult.deletedCount} transactions`)

    // Delete all ledger entries
    console.log('[2/2] Deleting ledger entries...')
    const ledResult = await db.collection('ledgers').deleteMany({})
    console.log(`✓ Deleted ${ledResult.deletedCount} ledger entries\n`)

    console.log(`=== Total Cleared: ${txResult.deletedCount + ledResult.deletedCount} entries ===\n`)

    await mongoose.disconnect()
    process.exit(0)
  } catch (e) {
    console.error(`\n❌ Error: ${e.message}\n`)
    process.exit(1)
  }
})()
