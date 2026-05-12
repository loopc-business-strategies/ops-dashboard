/**
 * Cleanup endpoint for deleting bad exchange entries
 * POST /api/admin/cleanup/exchange-entries
 */

const express = require('express')
const mongoose = require('mongoose')
const router = express.Router()

router.post('/cleanup/exchange-entries', async (req, res) => {
  try {
    const Ledger = mongoose.model('Ledger')
    const ChartOfAccount = mongoose.model('ChartOfAccount')

    // Find cash account 1000
    const cash = await ChartOfAccount.findOne({ 
      accountCode: '1000'
    })

    if (!cash) {
      return res.status(404).json({ 
        error: 'Cash account 1000 not found',
        ok: false 
      })
    }

    console.log(`[Cleanup] Found Cash account: ${cash.accountName}`)

    // Find bad entries posted to cash
    const badEntries = await Ledger.find({
      referenceType: 'journal',
      isDeleted: { $ne: true },
      description: /Exchange (gain|loss) adjustment/i,
      $or: [
        { debitAccountId: cash._id },
        { creditAccountId: cash._id }
      ]
    })

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
      date: e.date?.toISOString().split('T')[0]
    }))

    console.log('[Cleanup] Entries to delete:', toDelete)

    // Delete entries
    const result = await Ledger.updateMany(
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
    console.error('[Cleanup Error]', error.message)
    res.status(500).json({
      ok: false,
      error: error.message
    })
  }
})

module.exports = router
