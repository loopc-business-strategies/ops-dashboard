/**
 * Cleanup endpoint for deleting bad exchange entries
 * POST /api/admin/cleanup/exchange-entries
 */

const express = require('express')
const mongoose = require('mongoose')
const { protect, restrictTo } = require('../middleware/auth')
const router = express.Router()

function envBool(value, defaultValue = false) {
  if (value === undefined || value === null || value === '') return defaultValue
  return String(value).trim().toLowerCase() === 'true'
}

function ensureCleanupRouteEnabled(req, res, next) {
  const enabledInProduction = envBool(process.env.ENABLE_ADMIN_CLEANUP_API, false)
  if (process.env.NODE_ENV === 'production' && !enabledInProduction) {
    return res.status(403).json({
      ok: false,
      error: 'Cleanup API is disabled in production. Set ENABLE_ADMIN_CLEANUP_API=true to allow it.',
    })
  }
  return next()
}

function requireCleanupConfirmationToken(req, res, next) {
  const expectedToken = String(process.env.CLEANUP_CONFIRM_TOKEN || '').trim()
  if (!expectedToken) return next()

  const providedToken = String(req.headers['x-cleanup-token'] || req.body?.confirmToken || '').trim()
  if (!providedToken || providedToken !== expectedToken) {
    return res.status(403).json({
      ok: false,
      error: 'Invalid or missing cleanup confirmation token.',
    })
  }
  return next()
}

router.use(protect)
router.use(restrictTo('super_admin'))
router.use(ensureCleanupRouteEnabled)
router.use(requireCleanupConfirmationToken)

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

    // Find bad entries posted to cash - multiple search strategies
    const ledgerCollection = db.collection('ledgers')
    
    // Strategy 1: Search by date range and amounts (the ones we see on dashboard)
    const badEntries = await ledgerCollection.find({
      referenceType: 'journal',
      isDeleted: { $ne: true },
      date: {
        $gte: new Date('2026-05-05'),
        $lte: new Date('2026-05-10')
      },
      $and: [
        {
          $or: [
            { debitAccountId: cash._id },
            { creditAccountId: cash._id }
          ]
        },
        {
          $or: [
            { amount: 5954.65 },
            { amount: 85.95 },
            { amount: 8.26 },
            { description: /Exchange/i }
          ]
        }
      ]
    }).toArray()

    if (badEntries.length === 0) {
      // Strategy 2: If not found, search ALL exchange entries on Cash 1000
      const allExchangeOnCash = await ledgerCollection.find({
        referenceType: 'journal',
        isDeleted: { $ne: true },
        description: /Exchange/i,
        $or: [
          { debitAccountId: cash._id },
          { creditAccountId: cash._id }
        ]
      }).toArray()
      
      badEntries.push(...allExchangeOnCash)
    }

    console.log(`[Cleanup] Found ${badEntries.length} bad entries`)
    
    if (badEntries.length === 0) {
      // Debug: Log what we're looking for
      console.log('[Cleanup] Debug - searching for Cash account entries...')
      const allCashEntries = await ledgerCollection.find({
        $or: [
          { debitAccountId: cash._id },
          { creditAccountId: cash._id }
        ]
      }).limit(5).toArray()
      console.log(`[Cleanup] Found ${allCashEntries.length} entries on Cash account`)
      allCashEntries.forEach(e => {
        console.log(`  - ${e.date?.toISOString().split('T')[0]} | ${e.referenceType} | ${e.amount} | ${e.description}`)
      })
    }

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
