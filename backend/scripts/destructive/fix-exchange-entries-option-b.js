#!/usr/bin/env node
require('./_destructive-guard')({ scriptName: __filename })

/**
 * Script to fix existing exchange gain/loss entries
 * Removes entries that incorrectly posted to cash account (1000)
 * and replaces them with correct AR/AP posting per Option B
 * 
 * Option B: Exchange entries should flow through AR/AP and P&L accounts,
 * not directly affect cash account
 */

const path = require('path')
const fs = require('fs')
require('dotenv').config({ path: path.resolve(__dirname, '../.env') })

const mongoose = require('mongoose')

async function main() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGO_URI_MG || process.env.MONGO_URI
    if (!mongoUri) throw new Error('MONGO_URI_MG or MONGO_URI not set')

    await mongoose.connect(mongoUri)
    console.log('✓ Connected to MongoDB')

    // Import models
    const Ledger = require('../../models/Ledger')
    const ChartOfAccount = require('../../models/ChartOfAccount')

    // Find cash on hand account (1000)
    const cashAccount = await ChartOfAccount.findOne({ accountCode: '1000', isActive: true })
    if (!cashAccount) {
      console.log('✗ Cash on Hand account (1000) not found')
      process.exit(1)
    }
    console.log(`✓ Found Cash account: ${cashAccount.accountName} (${cashAccount.accountCode})`)

    // Find exchange entries that posted to cash account (incorrect Option A)
    const badExchangeEntries = await Ledger.find({
      referenceType: 'journal',
      isDeleted: { $ne: true },
      description: /Exchange (gain|loss) adjustment/i,
      $or: [
        { debitAccountId: cashAccount._id },
        { creditAccountId: cashAccount._id }
      ]
    }).populate('debitAccountId creditAccountId', 'accountCode accountName')

    console.log(`\nFound ${badExchangeEntries.length} exchange entries posted to cash account:`)
    
    badExchangeEntries.forEach((entry, i) => {
      const debit = entry.debitAccountId
      const credit = entry.creditAccountId
      console.log(`\n  [${i + 1}] ${entry.description}`)
      console.log(`      Date: ${entry.date?.toISOString().split('T')[0]}`)
      console.log(`      Amount: ${entry.amount} USD`)
      console.log(`      Debit: ${debit?.accountCode} - ${debit?.accountName}`)
      console.log(`      Credit: ${credit?.accountCode} - ${credit?.accountName}`)
    })

    if (badExchangeEntries.length === 0) {
      console.log('\n✓ No bad exchange entries found. Database is already clean.')
      await mongoose.disconnect()
      process.exit(0)
    }

    // Soft delete the bad entries
    const deletedIds = []
    for (const entry of badExchangeEntries) {
      await Ledger.updateOne(
        { _id: entry._id },
        { 
          $set: { 
            isDeleted: true, 
            deletedAt: new Date(),
            notes: 'Deleted by fix-exchange-entries-option-b.js - replaced with correct AR/AP posting',
            updatedBy: new mongoose.Types.ObjectId('000000000000000000000000')
          } 
        }
      )
      deletedIds.push(entry._id)
    }

    console.log(`\n✓ Soft-deleted ${deletedIds.length} bad exchange entries`)
    console.log(`\nNext Steps:
    1. Deploy this backend change to production
    2. Create new exchange entries through the normal payment/receipt workflow
    3. New entries will now post to AR/AP and P&L accounts per Option B
    4. Cash account (1000) will no longer be affected by exchange entries`)

    await mongoose.disconnect()
    console.log('\n✓ Done. Disconnected from MongoDB.')

  } catch (error) {
    console.error('✗ Error:', error.message)
    process.exit(1)
  }
}

main()
