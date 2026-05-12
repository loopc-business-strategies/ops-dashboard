#!/usr/bin/env node
/**
 * List existing bad exchange entries (posted to cash 1000) for manual review/deletion
 * This script identifies entries that need cleanup but does not delete them
 */

require('dotenv').config()
const mongoose = require('mongoose')

async function auditBadEntries() {
  try {
    const mongoUri = process.env.MONGO_URI_MG
    if (!mongoUri) {
      console.error('✗ MONGO_URI_MG not configured in .env')
      console.log('\nManual cleanup via MongoDB Atlas:')
      console.log('1. Go to mongodb.com/atlas → Your cluster')
      console.log('2. Click "Collections" tab')
      console.log('3. Find "ledgers" collection')
      console.log('4. Click ">" to expand query editor')
      console.log('5. Paste this filter:')
      console.log(`
db.ledgers.find({
  referenceType: 'journal',
  isDeleted: { $ne: true },
  description: /Exchange (gain|loss) adjustment/i,
  debitAccountId: ObjectId('CASH_ACCOUNT_1000_ID')
})
      `)
      console.log('6. Update results → Click delete → Confirm')
      process.exit(1)
    }

    console.log('Auditing bad exchange entries (posted to Cash 1000)...')
    console.log('=' .repeat(60))

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
    
    console.log(`✓ Cash account: ${cashAccount.accountName} (ID: ${cashAccount._id})`)
    
    // Find bad exchange entries
    const badEntries = await db.collection('ledgers').find({
      referenceType: 'journal',
      isDeleted: { $ne: true },
      description: /Exchange (gain|loss) adjustment/i,
      $or: [
        { debitAccountId: cashAccount._id },
        { creditAccountId: cashAccount._id }
      ]
    }).toArray()

    console.log(`\n📊 Found ${badEntries.length} bad exchange entries:\n`)

    if (badEntries.length === 0) {
      console.log('✓ No bad entries found - Cash account is already clean!')
      await mongoose.disconnect()
      process.exit(0)
    }

    const cleanupIds = []
    badEntries.forEach((entry, i) => {
      const isDebit = entry.debitAccountId?.toString() === cashAccount._id.toString()
      const side = isDebit ? 'DEBIT' : 'CREDIT'
      
      console.log(`[${i + 1}] ${entry.description}`)
      console.log(`    ID: ${entry._id}`)
      console.log(`    Amount: ${entry.amount} ${entry.currency || 'USD'} (${side} side)`)
      console.log(`    Date: ${entry.date?.toISOString().split('T')[0]}`)
      console.log(`    Reference Tx: ${entry.referenceId}`)
      console.log(``)
      
      cleanupIds.push(entry._id.toString())
    })

    console.log('=' .repeat(60))
    console.log('\n📋 Cleanup Options:\n')

    console.log('Option A: Automated Cleanup')
    console.log('  $ node scripts/cleanup-exchange-entries.js\n')

    console.log('Option B: MongoDB Atlas Manual Deletion')
    console.log('  Collection: ledgers')
    console.log('  Filter:')
    console.log('  {')
    console.log('    "_id": {')
    console.log('      "$in": [')
    cleanupIds.forEach(id => {
      console.log(`        ObjectId("${id}"),`)
    })
    console.log('      ]')
    console.log('    }')
    console.log('  }')
    console.log('  Action: Update → Set isDeleted: true, deletedAt: new Date()\n')

    console.log('Option C: Direct MongoDB Update (if you have shell access)')
    console.log('  $ mongo')
    console.log(`  > db.ledgers.updateMany(`)
    console.log(`      { "_id": { "$in": [${cleanupIds.map(id => `ObjectId("${id}")`).join(', ')}] } },`)
    console.log(`      { "$set": { "isDeleted": true, "deletedAt": new Date() } }`)
    console.log(`    )`)

    console.log('\n✓ Audit complete. Choose cleanup option above.')
    
    await mongoose.disconnect()
    process.exit(0)

  } catch (error) {
    console.error(`✗ Error: ${error.message}`)
    console.log('\nFallback: Manual cleanup via MongoDB Atlas UI')
    process.exit(1)
  }
}

auditBadEntries()
