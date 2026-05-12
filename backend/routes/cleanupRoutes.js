/**
 * Cleanup endpoint for deleting bad exchange entries
 * POST /api/admin/cleanup/exchange-entries
 */

const express = require('express')
const mongoose = require('mongoose')
const router = express.Router()

router.post('/cleanup/exchange-entries', async (req, res) => {
  try {
    // Get database connection
    const connection = mongoose.connection
    
    if (!connection || !connection.db) {
      console.error('[Cleanup] No database connection')
      return res.status(500).json({ 
        error: 'No database connection available',
        ok: false 
      })
    }

    const db = connection.db

    // Find cash account 1000 using raw collection
    const accountCollection = db.collection('chartofaccounts')
    const cash = await accountCollection.findOne({ 
      accountCode: '1000'
    })

    if (!cash) {
      console.error('[Cleanup] Cash account 1000 not found')
      return res.status(404).json({ 
        error: 'Cash account 1000 not found',
        ok: false 
      })
    }

    console.log(`[Cleanup] Found Cash account: ${cash.accountName}`)

    // Find bad entries posted to cash - search by specific amounts and descriptions
    const ledgerCollection = db.collection('ledgers')
    const badEntries = await ledgerCollection.find({
      referenceType: 'journal',
      isDeleted: { $ne: true },
      $and: [
        // Entry must be posted to cash
        {
          $or: [
            { debitAccountId: cash._id },
            { creditAccountId: cash._id }
          ]
        },
        // Must be an exchange entry OR have a suspicious amount
        {
          $or: [
            { description: /Exchange/i },
            { amount: { $in: [5954.65, 85.95, 8.26] } }  // Known bad amounts
          ]
        }
      ]
    }).toArray()

    console.log(`[Cleanup] Found ${badEntries.length} bad entries`)

    if (badEntries.length === 0) {
      return res.json({
        ok: true,
        message: 'No bad entries found - already clean',
        deletedCount: 0,
        entries: []
      })
    }

    // Show what will be deleted
    const toDelete = badEntries.map(e => ({
      id: e._id.toString(),
      description: e.description,
      amount: e.amount,
      date: e.date ? e.date.toISOString().split('T')[0] : 'unknown'
    }))

    console.log('[Cleanup] Entries to delete:', toDelete)

    // Delete entries
    const result = await ledgerCollection.updateMany(
      {
        _id: { $in: badEntries.map(e => e._id) }
      },
      {
        $set: {
          isDeleted: true,
          deletedAt: new Date(),
          notes: 'Cleaned up by API endpoint - Option B exchange routing',
          updatedAt: new Date()
        }
      }
    )

    console.log(`[Cleanup] Deleted ${result.modifiedCount} entries`)

    return res.json({
      ok: true,
      message: `Successfully deleted ${result.modifiedCount} bad exchange entries`,
      deletedCount: result.modifiedCount,
      entries: toDelete
    })

  } catch (error) {
    console.error('[Cleanup Error]', error.message, error.stack)
    res.status(500).json({
      ok: false,
      error: error.message
    })
  }
})

module.exports = router
