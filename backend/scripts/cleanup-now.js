#!/usr/bin/env node
/**
 * Direct cleanup of bad exchange entries
 * Deletes entries posted to Cash 1000 account
 */

require('dotenv').config()
const mongoose = require('mongoose')

async function cleanup() {
  try {
    const mongoUri = process.env.MONGO_URI_MG
    if (!mongoUri) throw new Error('MONGO_URI_MG not set')

    console.log('🔌 Connecting to MongoDB...')
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000,
      socketTimeoutMS: 45000,
    })
    console.log('✓ Connected')

    const Ledger = mongoose.connection.db.collection('ledgers')
    const CoA = mongoose.connection.db.collection('chartofaccounts')

    // Get cash account
    const cash = await CoA.findOne({ accountCode: '1000' })
    if (!cash) throw new Error('Cash account 1000 not found')

    console.log(`✓ Found Cash account: ${cash.accountName}`)

    // Find bad entries
    const result = await Ledger.updateMany(
      {
        referenceType: 'journal',
        isDeleted: { $ne: true },
        description: /Exchange (gain|loss) adjustment/i,
        $or: [
          { debitAccountId: cash._id },
          { creditAccountId: cash._id }
        ]
      },
      {
        $set: {
          isDeleted: true,
          deletedAt: new Date(),
          notes: 'Cleaned up by cleanup script - Option B'
        }
      }
    )

    if (result.modifiedCount === 0) {
      console.log('✓ No bad entries found - already clean')
    } else {
      console.log(`✓ Deleted ${result.modifiedCount} bad exchange entries`)
      console.log(`\n✅ Cash account 1000 is now CLEAN!`)
      console.log(`   Balance should now show 0 (or opening balance only)`)
    }

    await mongoose.disconnect()
    process.exit(0)

  } catch (error) {
    console.error('✗ Error:', error.message)
    process.exit(1)
  }
}

cleanup()
