 */
require('./_requireGuard')

const path = require('path')
const { createRequire } = require('module')
const mongoose = createRequire(path.join(__dirname, '../../backend/package.json'))('mongoose')

const APPLY = process.argv.includes('--apply')

;(async () => {
  try {
    const MONGO_URI_MG = process.env.MONGO_URI_MG
    if (!MONGO_URI_MG) {
      throw new Error('MONGO_URI_MG is required. No placeholder URI fallback is allowed.')
    }

    console.log('\n=== Direct MongoDB Cleanup for MG ===\n')
    if (!APPLY) {
      console.log('Dry-run only. Pass --apply --reason="..." --confirm=... to delete data.\n')
    }

    await mongoose.connect(MONGO_URI_MG, { maxPoolSize: 2 })
    console.log('✓ Connected to MongoDB\n')

    const db = mongoose.connection.db
    const txCount = await db.collection('transactions').countDocuments({})
    const ledCount = await db.collection('ledgers').countDocuments({})

    console.log(`Transactions: ${txCount}`)
    console.log(`Ledger entries: ${ledCount}\n`)

    if (!APPLY) {
      console.log('No changes made (dry-run).')
      await mongoose.disconnect()
      return
    }

    console.log('[1/2] Deleting all transactions (vouchers)...')
    const txResult = await db.collection('transactions').deleteMany({})
    console.log(`✓ Deleted ${txResult.deletedCount} transactions\n`)

    console.log('[2/2] Deleting all ledger entries (JVs)...')
    const ledResult = await db.collection('ledgers').deleteMany({})
    console.log(`✓ Deleted ${ledResult.deletedCount} ledger entries\n`)

    console.log('=== Cleanup Complete ===')
    await mongoose.disconnect()
  } catch (e) {
    console.error(`\n❌ Error: ${e.message}\n`)
    process.exit(1)
  }
})()
