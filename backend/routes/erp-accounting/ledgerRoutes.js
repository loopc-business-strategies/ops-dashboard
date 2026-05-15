const { requireDestructiveAdminGuard } = require('../../middleware/destructiveAction')
const { Joi, validateBodyStrict, validateParams } = require('../../middleware/validate')

const objectId = Joi.string().hex().length(24)
const idParamSchema = Joi.object({ id: objectId.required() })
const ledgerPatchSchema = Joi.object({
  date: Joi.date().allow('', null).optional(),
  debitAccountId: objectId.allow('', null).optional(),
  creditAccountId: objectId.allow('', null).optional(),
  amount: Joi.number().positive().optional(),
  description: Joi.string().trim().allow('').max(1000).optional(),
  referenceType: Joi.string().trim().allow('').max(80).optional(),
  currency: Joi.string().trim().allow('').max(10).optional(),
}).min(1)

function registerLedgerRoutes(deps) {
  const {
    router,
    protect,
    validateBody,
    canViewLedger,
    canCreateTransaction,
    canCreateTransactionFor,
    isFinance,
    bankSlipUpload,
    ledgerEntrySchema,
    Ledger,
    Transaction,
    Currency,
    BASE_CURRENCY_CODE,
  } = deps

const decodeCursor = (cursor) => {
  if (!cursor) return null
  try {
    const parsed = JSON.parse(Buffer.from(String(cursor), 'base64').toString('utf8'))
    if (!parsed?.date || !parsed?.id) return null
    return { date: new Date(parsed.date), id: String(parsed.id) }
  } catch {
    return null
  }
}

const encodeCursor = (doc) => {
  if (!doc?._id || !doc?.date) return null
  return Buffer.from(JSON.stringify({ date: doc.date, id: String(doc._id) })).toString('base64')
}

const emitRealtime = (req, cb) => {
  const realtimeServer = req.app.get('realtimeServer')
  if (!realtimeServer || typeof cb !== 'function') return
  try { cb(realtimeServer) } catch {}
}

router.get('/ledger', protect, async (req, res) => {
  try {
    if (!canViewLedger(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })
    const TenantLedger = await Ledger.getTenantModel(req.tenant)
    const { startDate, endDate, accountId, department, referenceType, limit = 100, page } = req.query
    const safeLimit = Math.min(500, Math.max(1, Number(limit) || 100))
    const query = { isDeleted: { $ne: true } }

    if (startDate || endDate) {
      query.date = {}
      if (startDate) query.date.$gte = new Date(startDate)
      if (endDate) query.date.$lte = new Date(endDate)
    }
    if (accountId) {
      query.$or = [{ debitAccountId: accountId }, { creditAccountId: accountId }]
    }
    if (department) {
      query.department = department
    }
    if (referenceType) {
      query.referenceType = referenceType
    }

    const useOffset = page && !req.query.cursor
    if (useOffset) {
      const safePage = Math.max(1, Number(page) || 1)
      const skip = (safePage - 1) * safeLimit
      const [entries, total] = await Promise.all([
        TenantLedger.find(query)
          .populate('debitAccountId', 'accountName accountCode')
          .populate('creditAccountId', 'accountName accountCode')
          .populate('createdBy', 'name')
          .sort({ date: -1, _id: -1 })
          .skip(skip)
          .limit(safeLimit),
        TenantLedger.countDocuments(query),
      ])

      return res.json({
        success: true,
        count: entries.length,
        limit: safeLimit,
        page: safePage,
        total,
        entries,
        hasMore: skip + entries.length < total,
        nextCursor: entries.length ? encodeCursor(entries[entries.length - 1]) : null,
        cursor: null,
      })
    }

    const cursor = decodeCursor(req.query.cursor)
    if (cursor) {
      const operator = '$lt'
      query.$and = [
        ...(query.$and || []),
        {
          $or: [
            { date: { [operator]: cursor.date } },
            { date: cursor.date, _id: { [operator]: cursor.id } },
          ],
        },
      ]
    }

    const rows = await TenantLedger.find(query)
      .populate('debitAccountId', 'accountName accountCode')
      .populate('creditAccountId', 'accountName accountCode')
      .populate('createdBy', 'name')
      .sort({ date: -1, _id: -1 })
      .limit(safeLimit + 1)

    const hasMore = rows.length > safeLimit
    const entries = hasMore ? rows.slice(0, safeLimit) : rows
    const nextCursor = hasMore ? encodeCursor(entries[entries.length - 1]) : null

    res.json({
      success: true,
      count: entries.length,
      limit: safeLimit,
      entries,
      hasMore,
      nextCursor,
      cursor: req.query.cursor || null,
    })
  } catch {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.post('/ledger', protect, bankSlipUpload.single('attachment'), validateBody(ledgerEntrySchema), async (req, res) => {
  try {
    if (!canCreateTransaction(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })
    const { date, debitAccountId, creditAccountId, amount, description, referenceType, referenceId,
      txRefNo, chequeNo, bankRemarks, paymentType } = req.body
    if (!debitAccountId || !creditAccountId || !amount) return res.status(400).json({ success: false, message: 'Required fields missing' })
    // Validation: debit account cannot equal credit account
    if (debitAccountId === creditAccountId) return res.status(400).json({ success: false, message: 'Debit and Credit accounts must be different' })
    // Enhanced role-based check for transaction type
    if (!canCreateTransactionFor(req.user, referenceType || 'journal')) {
      return res.status(403).json({ success: false, message: `Your department cannot post ${referenceType} transactions` })
    }
    const base = await Currency.findOne({ baseCurrency: true, isActive: true })
    const baseCurrencyCode = String(base?.code || BASE_CURRENCY_CODE || 'USD').toUpperCase()

    const isBankJV = referenceType === 'bank_jv'

    // Auto-generate transaction number for Bank JV
    let autoTxNo = ''
    if (isBankJV) {
      const today = new Date()
      const yyyymmdd = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`
      autoTxNo = `BJV-${yyyymmdd}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`
    }

    // Handle attachment
    let attachmentUrl = ''
    let attachmentName = ''
    if (req.file) {
      attachmentUrl = `/uploads/bank-slips/${req.file.filename}`
      attachmentName = req.file.originalname || req.file.filename
    }

    const entry = await Ledger.create({
      date: new Date(date),
      debitAccountId,
      creditAccountId,
      amount,
      description,
      referenceType,
      referenceId,
      currency: baseCurrencyCode,
      exchangeRate: 1,
      createdBy: req.user._id,
      department: req.user.department,
      ...(isBankJV && {
        autoTxNo,
        txRefNo: txRefNo || '',
        chequeNo: chequeNo || '',
        bankRemarks: bankRemarks || '',
        paymentType: paymentType || 'bank',
        bankReconciled: false,
        attachmentUrl,
        attachmentName,
      }),
    })

    const tenantKey = String(req.tenant?.key || req.user?.tenant || 'default')
    emitRealtime(req, (realtimeServer) => {
      realtimeServer.broadcastLedgerEntry(String(debitAccountId), entry)
      realtimeServer.broadcastLedgerEntry(String(creditAccountId), entry)
      if (typeof realtimeServer.broadcastLedgerUpdate === 'function') {
        realtimeServer.broadcastLedgerUpdate(tenantKey, {
          action: 'created',
          entryId: String(entry._id),
          referenceType: entry.referenceType,
          amount: Number(entry.amount || 0),
        })
      }
    })

    res.status(201).json({ success: true, entry })
  } catch (err) {
    console.error('[ledger] error:', err)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

// ==========================================
// LEDGER EDIT/DELETE ENDPOINTS
// ==========================================
router.put('/ledger/:id', protect, validateParams(idParamSchema), validateBodyStrict(ledgerPatchSchema), async (req, res) => {
  try {
    if (!canCreateTransaction(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })
    const TenantLedger = await Ledger.getTenantModel(req.tenant)
    const entry = await TenantLedger.findById(req.params.id)
    if (!entry) return res.status(404).json({ success: false, message: 'Ledger entry not found' })
    // Only creator or finance can edit
    if (entry.createdBy.toString() !== req.user._id.toString() && !isFinance(req.user)) {
      return res.status(403).json({ success: false, message: 'Can only edit your own entries' })
    }
    const { date, debitAccountId, creditAccountId, amount, description, referenceType } = req.body
    if (debitAccountId && creditAccountId && debitAccountId === creditAccountId) {
      return res.status(400).json({ success: false, message: 'Debit and Credit accounts must be different' })
    }
    const updates = {}
    if (date !== undefined) updates.date = new Date(date)
    if (debitAccountId !== undefined) updates.debitAccountId = debitAccountId
    if (creditAccountId !== undefined) updates.creditAccountId = creditAccountId
    if (amount !== undefined) updates.amount = amount
    if (description !== undefined) updates.description = description
    if (referenceType !== undefined) updates.referenceType = referenceType
    if (req.body.currency !== undefined) {
      const base = await Currency.findOne({ baseCurrency: true, isActive: true })
      updates.currency = String(base?.code || BASE_CURRENCY_CODE || 'USD').toUpperCase()
      updates.exchangeRate = 1
    }
    const updated = await TenantLedger.findByIdAndUpdate(req.params.id, updates, { returnDocument: 'after' })
    const tenantKey = String(req.tenant?.key || req.user?.tenant || 'default')
    emitRealtime(req, (realtimeServer) => {
      if (typeof realtimeServer.broadcastLedgerUpdate === 'function') {
        realtimeServer.broadcastLedgerUpdate(tenantKey, {
          action: 'updated',
          entryId: String(updated?._id || req.params.id),
          referenceType: updated?.referenceType,
          amount: Number(updated?.amount || 0),
        })
      }
    })
    res.json({ success: true, entry: updated })
  } catch {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.delete('/ledger/:id', protect, validateParams(idParamSchema), async (req, res) => {
  try {
    if (!canCreateTransaction(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })
    const TenantLedger = await Ledger.getTenantModel(req.tenant)
    const entry = await TenantLedger.findById(req.params.id)
    if (!entry) return res.status(404).json({ success: false, message: 'Ledger entry not found' })
    // Only creator or finance can delete
    if (entry.createdBy.toString() !== req.user._id.toString() && !isFinance(req.user)) {
      return res.status(403).json({ success: false, message: 'Can only delete your own entries' })
    }
    // Create reversal entry instead of hard delete (for audit trail)
    const reversalEntry = await TenantLedger.create({
      date: new Date(),
      debitAccountId: entry.creditAccountId,
      creditAccountId: entry.debitAccountId,
      amount: entry.amount,
      description: `REVERSAL of Entry ${entry._id}: ${entry.description}`,
      referenceType: 'reversal',
      referenceId: entry._id,
      currency: entry.currency,
      createdBy: req.user._id,
      department: req.user.department,
    })
    const tenantKey = String(req.tenant?.key || req.user?.tenant || 'default')
    emitRealtime(req, (realtimeServer) => {
      if (typeof realtimeServer.broadcastLedgerUpdate === 'function') {
        realtimeServer.broadcastLedgerUpdate(tenantKey, {
          action: 'reversed',
          entryId: String(entry._id),
          reversalEntryId: String(reversalEntry._id),
          referenceType: entry.referenceType,
        })
      }
    })
    res.json({ success: true, message: 'Entry reversed', reversalEntry })
  } catch {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.delete('/ledger/:id/permanent', protect, validateParams(idParamSchema), requireDestructiveAdminGuard('ledger/permanent-delete'), async (req, res) => {
  try {
    if (!canCreateTransaction(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })
    const TenantLedger = await Ledger.getTenantModel(req.tenant)
    const TenantTransaction = await Transaction.getTenantModel(req.tenant)
    const entry = await TenantLedger.findById(req.params.id)
    if (!entry) return res.status(404).json({ success: false, message: 'Ledger entry not found' })
    // Only creator or finance can permanently delete
    if (entry.createdBy.toString() !== req.user._id.toString() && !isFinance(req.user)) {
      return res.status(403).json({ success: false, message: 'Can only delete your own entries' })
    }

    const linkedTx = await TenantTransaction.findOne({ journalEntryId: entry._id }).select('_id')
    if (linkedTx) {
      return res.status(400).json({
        success: false,
        message: 'Cannot permanently delete a ledger entry linked to a transaction. Use Reverse instead.',
      })
    }

    entry.isDeleted = true
    entry.deletedAt = new Date()
    entry.updatedBy = req.user._id
    entry.notes = [entry.notes, `Permanent delete reason: ${req.destructiveAction.reason}`].filter(Boolean).join('\n')
    await entry.save()

    const tenantKey = String(req.tenant?.key || req.user?.tenant || 'default')
    emitRealtime(req, (realtimeServer) => {
      if (typeof realtimeServer.broadcastLedgerUpdate === 'function') {
        realtimeServer.broadcastLedgerUpdate(tenantKey, {
          action: 'deleted',
          entryId: String(entry._id),
          referenceType: entry.referenceType,
        })
      }
    })

    res.json({ success: true, message: 'Entry deleted permanently' })
  } catch {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

// Bank JV reconciliation toggle
router.put('/ledger/:id/reconcile', protect, validateParams(idParamSchema), async (req, res) => {
  try {
    if (!canCreateTransaction(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })
    const TenantLedger = await Ledger.getTenantModel(req.tenant)
    const entry = await TenantLedger.findById(req.params.id).select('referenceType bankReconciled')
    if (!entry) return res.status(404).json({ success: false, message: 'Ledger entry not found' })
    if (entry.referenceType !== 'bank_jv') return res.status(400).json({ success: false, message: 'Only Bank JV entries can be reconciled' })

    const nextReconciled = !Boolean(entry.bankReconciled)
    await TenantLedger.updateOne(
      { _id: entry._id },
      { $set: { bankReconciled: nextReconciled, updatedBy: req.user._id } }
    )

    const tenantKey = String(req.tenant?.key || req.user?.tenant || 'default')
    emitRealtime(req, (realtimeServer) => {
      if (typeof realtimeServer.broadcastLedgerUpdate === 'function') {
        realtimeServer.broadcastLedgerUpdate(tenantKey, {
          action: 'reconciled',
          entryId: String(entry._id),
          bankReconciled: nextReconciled,
          referenceType: entry.referenceType,
        })
      }
    })

    res.json({ success: true, bankReconciled: nextReconciled })
  } catch (error) {
    console.error('[reconcile] error:', error.message, error.stack)
    console.error('[ledger] error:', error)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

}

module.exports = {
  registerLedgerRoutes,
}
