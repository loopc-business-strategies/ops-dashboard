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

router.get('/ledger', protect, async (req, res) => {
  try {
    if (!canViewLedger(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })
    const TenantLedger = await Ledger.getTenantModel(req.tenant)
    const { startDate, endDate, accountId, department, referenceType, limit = 500 } = req.query
    const safeLimit = Math.min(500, Math.max(1, Number(limit) || 500))
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
    const entries = await TenantLedger.find(query)
      .populate('debitAccountId', 'accountName accountCode')
      .populate('creditAccountId', 'accountName accountCode')
      .populate('createdBy', 'name')
      .sort({ date: -1 })
      .limit(safeLimit)
    res.json({ success: true, count: entries.length, limit: safeLimit, entries })
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
    res.status(201).json({ success: true, entry })
  } catch (err) {
    res.status(500).json({ success: false, message: err.message || 'Server error' })
  }
})

// ==========================================
// LEDGER EDIT/DELETE ENDPOINTS
// ==========================================
router.put('/ledger/:id', protect, async (req, res) => {
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
    const updated = await TenantLedger.findByIdAndUpdate(req.params.id, updates, { new: true })
    res.json({ success: true, entry: updated })
  } catch {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.delete('/ledger/:id', protect, async (req, res) => {
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
    res.json({ success: true, message: 'Entry reversed', reversalEntry })
  } catch {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.delete('/ledger/:id/permanent', protect, async (req, res) => {
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
    await entry.save()

    res.json({ success: true, message: 'Entry deleted permanently' })
  } catch {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

// Bank JV reconciliation toggle
router.put('/ledger/:id/reconcile', protect, async (req, res) => {
  try {
    console.log('[RECONCILE] Starting reconciliation for entry:', req.params.id)
    console.log('[RECONCILE] User:', req.user._id, 'Tenant:', req.tenant)
    
    if (!canCreateTransaction(req.user)) {
      console.log('[RECONCILE] Permission denied for user:', req.user._id)
      return res.status(403).json({ success: false, message: 'Forbidden' })
    }
    
    console.log('[RECONCILE] Getting tenant model for:', req.tenant)
    const TenantLedger = await Ledger.getTenantModel(req.tenant)
    console.log('[RECONCILE] Tenant model obtained, fetching entry...')
    
    const entry = await TenantLedger.findById(req.params.id).select('referenceType bankReconciled')
    console.log('[RECONCILE] Entry fetched:', { id: entry?._id, refType: entry?.referenceType, reconciled: entry?.bankReconciled })
    
    if (!entry) {
      console.log('[RECONCILE] Entry not found:', req.params.id)
      return res.status(404).json({ success: false, message: 'Ledger entry not found' })
    }
    
    if (entry.referenceType !== 'bank_jv') {
      console.log('[RECONCILE] Invalid entry type:', entry.referenceType)
      return res.status(400).json({ success: false, message: 'Only Bank JV entries can be reconciled' })
    }

    const nextReconciled = !Boolean(entry.bankReconciled)
    console.log('[RECONCILE] Toggling reconciliation:', entry.bankReconciled, '->', nextReconciled)
    console.log('[RECONCILE] Performing updateOne with:', { _id: entry._id, bankReconciled: nextReconciled, updatedBy: req.user._id })
    
    const updateResult = await TenantLedger.updateOne(
      { _id: entry._id },
      { $set: { bankReconciled: nextReconciled, updatedBy: req.user._id } }
    )
    console.log('[RECONCILE] UpdateOne result:', { matched: updateResult.matchedCount, modified: updateResult.modifiedCount })

    console.log('[RECONCILE] SUCCESS - Entry reconciled')
    res.json({ success: true, bankReconciled: nextReconciled })
  } catch (error) {
    console.error('[RECONCILE] ERROR:', error.message)
    console.error('[RECONCILE] STACK:', error.stack)
    console.error('[RECONCILE] Full Error:', JSON.stringify(error, null, 2))
    
    // Always expose error details for debugging
    const errorDetails = {
      success: false,
      message: error?.message || 'Unknown server error',
      errorType: error?.constructor?.name || 'Error',
      stack: error?.stack,
      path: req.path,
      method: req.method,
      params: req.params,
      timestamp: new Date().toISOString(),
    }
    
    console.error('[RECONCILE] RESPONSE:', JSON.stringify(errorDetails, null, 2))
    res.status(500).json(errorDetails)
  }
})

}

module.exports = {
  registerLedgerRoutes,
}
