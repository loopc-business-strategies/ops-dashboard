#!/usr/bin/env node
require('./_destructive-guard')({ scriptName: __filename })
/**
 * Direct MongoDB cleanup for bad exchange entries
 * Connects and removes entries that posted to cash account 1000
 */

require('dotenv').config()
const mongoose = require('mongoose')

async function cleanup() {
  try {
    const mongoUri = process.env.MONGO_URI_MG
    if (!mongoUri) throw new Error('MONGO_URI_MG not configured')

    console.log('Connecting to MongoDB...')
    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 10000,
      connectTimeoutMS: 10000,
    })
    console.log('✓ Connected to MongoDB')

    const db = mongoose.connection.db
    
    // Find cash account 1000
    const cashAccount = await db.collection('chartofaccounts').findOne({ accountCode: '1000' })
    if (!cashAccount) {
      console.log('✗ Cash account 1000 not found')
      await mongoose.disconnect()
      process.exit(1)
    }
    
    console.log(`✓ Found Cash account: ${cashAccount.accountName}`)
    
    // Find bad exchange entries (posted to cash)
    const badEntries = await db.collection('ledgers').find({
      referenceType: 'journal',
      isDeleted: { $ne: true },
      description: /Exchange (gain|loss) adjustment/i,
      $or: [
        { debitAccountId: cashAccount._id },
        { creditAccountId: cashAccount._id }
      ]
    }).toArray()

    console.log(`\nFound ${badEntries.length} exchange entries posted to cash account:`)
    
    badEntries.forEach((entry, i) => {
      const desc = entry.description || '(no description)'
      console.log(`  [${i + 1}] ${desc}`)
      console.log(`      Amount: ${entry.amount} USD | Date: ${entry.date?.toISOString().split('T')[0]}`)
    })

    if (badEntries.length === 0) {
      console.log('✓ No bad entries to clean up')
      await mongoose.disconnect()
      process.exit(0)
    }

    // Soft delete
    const result = await db.collection('ledgers').updateMany(
      {
        _id: { $in: badEntries.map(e => e._id) }
      },
      {
        $set: {
          isDeleted: true,
          deletedAt: new Date(),
          notes: 'Cleaned up by fix-exchange-entries-option-b.js - replaced with AR/AP posting'
        }
      }
    )

    console.log(`\n✓ Soft-deleted ${result.modifiedCount} bad exchange entries`)
    console.log(`\nCash account (1000) is now clean!`)
    console.log(`Next: Create new payment/receipt transactions with foreign currency`)
    console.log(`       New entries will post to AR/AP and P&L accounts per Option B`)

    await mongoose.disconnect()
    process.exit(0)

  } catch (error) {
    console.error('✗ Error:', error.message)
    process.exit(1)
  }
}

cleanup()
