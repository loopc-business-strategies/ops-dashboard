require('./_destructive-guard')({ scriptName: __filename })
const mongoose = require('mongoose')
const path = require('path')

// Load env vars
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') })

const MONGO_URI_MG = process.env.MONGO_URI_MG

;(async () => {
  try {
    if (!MONGO_URI_MG) {
      console.log('MONGO_URI_MG not configured in environment')
      console.log('Trying from Railway env...')
    }

    console.log('\n=== MG Final Verification & Complete Cleanup ===\n')

    // Connect
    const conn = await mongoose.connect(MONGO_URI_MG, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    })

    const db = conn.connection.db
    console.log('✓ Connected to MongoDB\n')

    // Check collections
    console.log('[1] Checking collections...')
    const collections = await db.listCollections().toArray()
    console.log(`Total collections: ${collections.length}`)

    // Count documents in key collections
    console.log('[2] Counting documents...')
    const txCount = await db.collection('transactions').countDocuments({})
    const ledCount = await db.collection('ledgers').countDocuments({})
    console.log(`Transactions: ${txCount}`)
    console.log(`Ledgers: ${ledCount}\n`)

    if (txCount > 0 || ledCount > 0) {
      console.log('[3] DELETING ALL RECORDS NOW...')
      
      // Delete all
      const txDel = await db.collection('transactions').deleteMany({})
      const ledDel = await db.collection('ledgers').deleteMany({})
      
      console.log(`Deleted ${txDel.deletedCount} transactions`)
      console.log(`Deleted ${ledDel.deletedCount} ledgers\n`)

      // Verify
      const finalTx = await db.collection('transactions').countDocuments({})
      const finalLed = await db.collection('ledgers').countDocuments({})
      console.log(`[4] FINAL VERIFICATION:`)
      console.log(`Transactions remaining: ${finalTx}`)
      console.log(`Ledgers remaining: ${finalLed}\n`)

      console.log('✅ CLEANUP COMPLETE\n')
    } else {
      console.log('✅ DATABASE ALREADY CLEAN\n')
    }

    await mongoose.disconnect()
  } catch (e) {
    console.error(`\n❌ Error: ${e.message}\n`)
    process.exit(1)
  }
})()
