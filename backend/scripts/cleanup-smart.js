#!/usr/bin/env node
/**
 * Cleanup with direct connection string bypass
 */

require('dotenv').config()
const mongoose = require('mongoose')

async function cleanup() {
  try {
    let mongoUri = process.env.MONGO_URI_MG
    if (!mongoUri) throw new Error('MONGO_URI_MG not set')

    console.log('🔌 Preparing MongoDB connection...')
    
    // Try with SRV first
    try {
      console.log('Attempting SRV connection...')
      await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 5000,
      })
      console.log('✓ Connected via SRV')
    } catch (srvError) {
      console.log('✗ SRV failed, trying direct...')
      
      // Convert SRV to direct connection
      mongoUri = mongoUri.replace('+srv', '')
      console.log('Attempting direct connection...')
      
      await mongoose.connect(mongoUri, {
        serverSelectionTimeoutMS: 10000,
        connectTimeoutMS: 10000,
        socketTimeoutMS: 45000,
        retryWrites: false,
      })
      console.log('✓ Connected via direct URI')
    }

    const db = mongoose.connection.db
    
    // Find cash account
    console.log('\n📍 Finding Cash account (1000)...')
    const cash = await db.collection('chartofaccounts').findOne({ 
      accountCode: '1000',
      isActive: { $ne: false }
    })

    if (!cash) throw new Error('Cash account 1000 not found')
    console.log(`✓ Found: ${cash.accountName} (ID: ${cash._id})`)

    // Find bad entries
    console.log('\n🔍 Searching for bad exchange entries...')
    const badEntries = await db.collection('ledgers').find({
      referenceType: 'journal',
      isDeleted: { $ne: true },
      description: /Exchange (gain|loss) adjustment/i,
      $or: [
        { debitAccountId: cash._id },
        { creditAccountId: cash._id }
      ]
    }).toArray()

    console.log(`Found: ${badEntries.length} bad entries\n`)

    if (badEntries.length === 0) {
      console.log('✓ Already clean - no bad entries found')
      await mongoose.disconnect()
      process.exit(0)
    }

    badEntries.forEach((entry, i) => {
      console.log(`[${i + 1}] ${entry.description}`)
      console.log(`    ID: ${entry._id}`)
      console.log(`    Amount: ${entry.amount}`)
      console.log(`    Date: ${entry.date?.toISOString().split('T')[0]}\n`)
    })

    // Delete entries
    console.log('🗑️  Deleting...')
    const result = await db.collection('ledgers').updateMany(
      {
        _id: { $in: badEntries.map(e => e._id) }
      },
      {
        $set: {
          isDeleted: true,
          deletedAt: new Date(),
          updatedBy: mongoose.Types.ObjectId('000000000000000000000000'),
          notes: 'Cleaned by cleanup script - Option B exchange routing'
        }
      }
    )

    console.log(`✅ Deleted ${result.modifiedCount} entries\n`)
    console.log('✓ Cash account 1000 is now CLEAN!')
    console.log('  - Balance will show 0 (or opening balance only)')
    console.log('  - No exchange entries on cash statement')
    console.log('\n💡 Next: Refresh the dashboard to see the clean statement')

    await mongoose.disconnect()
    process.exit(0)

  } catch (error) {
    console.error(`\n✗ Error: ${error.message}`)
    
    if (error.message.includes('ECONNREFUSED') || error.message.includes('ENOTFOUND')) {
      console.error('\n⚠️  Network/DNS Issue Detected')
      console.error('This usually means:')
      console.error('  1. MongoDB Atlas IP whitelist needs your IP')
      console.error('  2. Network/firewall blocking connection')
      console.error('  3. Invalid MongoDB URI\n')
      console.error('Solution: Use MongoDB Atlas UI directly')
      console.error('See: MONGODB-CLEANUP-QUERY.md')
    }
    
    process.exit(1)
  }
}

cleanup()
