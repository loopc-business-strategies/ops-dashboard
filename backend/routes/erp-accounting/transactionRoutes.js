function registerTransactionRoutes(deps) {
  const {
    router,
    protect,
    validateBody,
    validateBodyStrict,
    transactionCreateSchema,
    transactionPatchSchema,
    transactionUpload,
    TRANSACTION_STATUSES,
    Transaction,
    Ledger,
    Currency,
    populateTransactionQuery,
    normalizeMoneyValue,
    normalizeExchangeRateValue,
    validateTransactionPayload,
    validateFxReferenceRateRequirement,
    normalizeMetalFixStatus,
    sanitizeOptionalRef,
    normalizeTransactionNote,
    appendTransactionAudit,
    appendTransactionComment,
    respondWorkflowError,
    applyTransactionWorkflowAction,
    buildFxJournalRevaluationPreview,
    applyFxJournalRevaluation,
    buildTransactionAttachment,
    validateAttachmentContent,
    canAccessReports,
    isSuperAdmin,
    toMoney,
    parsePagination,
    canCreateTransactionFor,
    canAccessTransactions,
    isFinance,
    getRoleTransactionTypes,
    BASE_CURRENCY_CODE,
    applyPartyAccountPriority,
  } = deps

const strictBody = validateBodyStrict || validateBody

router.get('/transactions', protect, async (req, res) => {
  try {
    if (!canAccessTransactions(req.user)) {
      return res.status(403).json({ success: false, message: 'Forbidden' })
    }

    const { page, limit, skip } = parsePagination(req.query, 50, 200)
    const query = { isDeleted: { $ne: true } }
    const allowedTypes = getRoleTransactionTypes(req.user)

    query.type = allowedTypes.length === 1 ? allowedTypes[0] : { $in: allowedTypes }

    if (req.query.type) {
      const requestedType = String(req.query.type)
      if (!allowedTypes.includes(requestedType)) {
        query.type = { $in: [] }
      } else {
        query.type = requestedType
      }
    }

    if (req.query.status && TRANSACTION_STATUSES.includes(String(req.query.status))) {
      query.status = String(req.query.status)
    }

    if (req.query.customerId) query.customerId = req.query.customerId
    if (req.query.vendorId) query.vendorId = req.query.vendorId

    if (req.query.startDate || req.query.endDate) {
      query.date = {}
      if (req.query.startDate) query.date.$gte = new Date(req.query.startDate)
      if (req.query.endDate) query.date.$lte = new Date(`${req.query.endDate}T23:59:59.999Z`)
    }

    if (req.query.search) {
      const search = String(req.query.search).trim()
      if (search) {
        const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
        query.$or = [
          { description: regex },
          { type: regex },
          { currency: regex },
        ]
      }
    }

    const [transactions, total, summaryRows] = await Promise.all([
      populateTransactionQuery(Transaction.find(query))
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Transaction.countDocuments(query),
      Transaction.aggregate([
        { $match: query },
        {
          $group: {
            _id: null,
            totalCount: { $sum: 1 },
            totalAmount: { $sum: '$amount' },
            draft: { $sum: { $cond: [{ $eq: ['$status', 'draft'] }, 1, 0] } },
            submitted: { $sum: { $cond: [{ $eq: ['$status', 'submitted'] }, 1, 0] } },
            approved: { $sum: { $cond: [{ $eq: ['$status', 'approved'] }, 1, 0] } },
            posted: { $sum: { $cond: [{ $eq: ['$status', 'posted'] }, 1, 0] } },
            returned: { $sum: { $cond: [{ $eq: ['$status', 'returned'] }, 1, 0] } },
            rejected: { $sum: { $cond: [{ $eq: ['$status', 'rejected'] }, 1, 0] } },
          },
        },
      ]),
    ])

    const summary = summaryRows[0] || {
      totalCount: 0,
      totalAmount: 0,
      draft: 0,
      submitted: 0,
      approved: 0,
      posted: 0,
      returned: 0,
      rejected: 0,
    }

    res.json({ success: true, transactions, total, page, limit, summary })
  } catch {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.post('/transactions', protect, validateBody(transactionCreateSchema), async (req, res) => {
  try {
    const { type, amount, date, description, currency, exchangeRate, customerId, vendorId, inventoryItemId, mappingId, debitAccountId, creditAccountId, voucherMeta, metalFixStatus } = req.body
    if (!type || amount === undefined || amount === null || amount === '') return res.status(400).json({ success: false, message: 'Type and amount are required' })
    if (!canCreateTransactionFor(req.user, type)) {
      return res.status(403).json({ success: false, message: 'You are not allowed to create this transaction type' })
    }

    const normalizedAmount = normalizeMoneyValue(amount, 'amount')
    const normalizedExchangeRate = normalizeExchangeRateValue(exchangeRate ?? 1)

    const validationMessage = validateTransactionPayload({
      type,
      amount,
      customerId,
      vendorId,
      voucherMeta,
    })
    if (validationMessage) {
      return res.status(400).json({ success: false, message: validationMessage })
    }

    const baseCurrency = await Currency.findOne({ baseCurrency: true, isActive: true }).select('code').lean()
    const baseCurrencyCode = String(baseCurrency?.code || BASE_CURRENCY_CODE || 'USD').toUpperCase()
    const fxValidationMessage = validateFxReferenceRateRequirement({
      type,
      currency: String(currency || 'USD').toUpperCase(),
      voucherMeta,
      baseCurrencyCode,
    })
    if (fxValidationMessage) {
      return res.status(400).json({ success: false, message: fxValidationMessage })
    }

    const normalizedMetalFixStatus = normalizeMetalFixStatus(metalFixStatus)
    const voucherMetaPayload = (['sale', 'purchase'].includes(String(type || '').toLowerCase()) && normalizedMetalFixStatus)
      ? {
          ...(voucherMeta || {}),
          fixingType: normalizedMetalFixStatus === 'unfixed' ? 'non-fixing' : 'fixing',
        }
      : (voucherMeta || undefined)

    const tx = await Transaction.create({
      type,
      amount: normalizedAmount,
      date: date ? new Date(date) : new Date(),
      description,
      currency: (currency || 'USD').toUpperCase(),
      exchangeRate: normalizedExchangeRate,
      customerId: sanitizeOptionalRef(customerId),
      vendorId: sanitizeOptionalRef(vendorId),
      inventoryItemId: sanitizeOptionalRef(inventoryItemId),
      mappingId: sanitizeOptionalRef(mappingId),
      debitAccountId: sanitizeOptionalRef(debitAccountId),
      creditAccountId: sanitizeOptionalRef(creditAccountId),
      voucherMeta: voucherMetaPayload,
      status: 'draft',
      createdBy: req.user._id,
      updatedBy: req.user._id,
    })

    appendTransactionAudit(tx, req.user, 'create', { fromStatus: '', toStatus: 'draft', comment: description })
    await tx.save()

    res.status(201).json({ success: true, transaction: tx })
  } catch (e) {
    if (/Invalid|exceeds allowed maximum/i.test(e?.message || '')) {
      return res.status(400).json({ success: false, message: e.message })
    }
    console.error('Create transaction error:', e)
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.put('/transactions/:id', protect, strictBody(transactionPatchSchema), async (req, res) => {
  try {
    if (!canAccessTransactions(req.user)) {
      return res.status(403).json({ success: false, message: 'Forbidden' })
    }

    const tx = await Transaction.findById(req.params.id)
    if (!tx || tx.isDeleted) return res.status(404).json({ success: false, message: 'Transaction not found' })

    const wasPosted = tx.status === 'posted'

    // If editing a posted transaction, reverse its ledger entries and reset to draft
    if (wasPosted) {
      const now = new Date()
      await Ledger.updateMany(
        { referenceId: tx._id, isDeleted: { $ne: true } },
        { $set: { isDeleted: true, deletedAt: now, updatedBy: req.user._id } }
      )
      if (tx.journalEntryId) {
        await Ledger.updateMany(
          { _id: tx.journalEntryId, isDeleted: { $ne: true } },
          { $set: { isDeleted: true, deletedAt: now, updatedBy: req.user._id } }
        )
      }
      tx.status = 'draft'
      tx.journalEntryId = null
    }

    const nextType = req.body.type || tx.type
    if (!canCreateTransactionFor(req.user, nextType) && !isFinance(req.user) && !isSuperAdmin(req.user)) {
      return res.status(403).json({ success: false, message: 'Forbidden' })
    }

    const validationMessage = validateTransactionPayload({
      ...tx.toObject(),
      ...req.body,
      type: nextType,
      customerId: req.body.customerId !== undefined ? sanitizeOptionalRef(req.body.customerId) : tx.customerId,
      vendorId: req.body.vendorId !== undefined ? sanitizeOptionalRef(req.body.vendorId) : tx.vendorId,
      voucherMeta: req.body.voucherMeta !== undefined ? req.body.voucherMeta : tx.voucherMeta,
    })
    if (validationMessage) {
      return res.status(400).json({ success: false, message: validationMessage })
    }

    const baseCurrency = await Currency.findOne({ baseCurrency: true, isActive: true }).select('code').lean()
    const baseCurrencyCode = String(baseCurrency?.code || BASE_CURRENCY_CODE || 'USD').toUpperCase()
    const nextCurrency = req.body.currency !== undefined
      ? String(req.body.currency || 'USD').toUpperCase()
      : String(tx.currency || 'USD').toUpperCase()
    const nextVoucherMeta = req.body.voucherMeta !== undefined ? req.body.voucherMeta : tx.voucherMeta
    const fxValidationMessage = validateFxReferenceRateRequirement({
      type: nextType,
      currency: nextCurrency,
      voucherMeta: nextVoucherMeta,
      baseCurrencyCode,
    })
    if (fxValidationMessage) {
      return res.status(400).json({ success: false, message: fxValidationMessage })
    }

    if (req.body.type !== undefined) tx.type = req.body.type
    if (req.body.amount !== undefined) tx.amount = normalizeMoneyValue(req.body.amount, 'amount')
    if (req.body.date !== undefined) tx.date = req.body.date ? new Date(req.body.date) : tx.date
    if (req.body.description !== undefined) tx.description = req.body.description
    if (req.body.currency !== undefined) tx.currency = String(req.body.currency || 'USD').toUpperCase()
    if (req.body.exchangeRate !== undefined) tx.exchangeRate = normalizeExchangeRateValue(req.body.exchangeRate ?? 1)
    if (req.body.customerId !== undefined) tx.customerId = sanitizeOptionalRef(req.body.customerId)
    if (req.body.vendorId !== undefined) tx.vendorId = sanitizeOptionalRef(req.body.vendorId)
    if (req.body.inventoryItemId !== undefined) tx.inventoryItemId = sanitizeOptionalRef(req.body.inventoryItemId)
    if (req.body.mappingId !== undefined) tx.mappingId = sanitizeOptionalRef(req.body.mappingId)
    if (req.body.debitAccountId !== undefined) tx.debitAccountId = sanitizeOptionalRef(req.body.debitAccountId)
    if (req.body.creditAccountId !== undefined) tx.creditAccountId = sanitizeOptionalRef(req.body.creditAccountId)
    if (req.body.voucherMeta !== undefined) tx.voucherMeta = req.body.voucherMeta
    if (req.body.metalFixStatus !== undefined) {
      const normalizedMetalFixStatus = normalizeMetalFixStatus(req.body.metalFixStatus)
      if (!tx.voucherMeta || typeof tx.voucherMeta !== 'object') tx.voucherMeta = {}
      if (normalizedMetalFixStatus) {
        tx.voucherMeta.fixingType = normalizedMetalFixStatus === 'unfixed' ? 'non-fixing' : 'fixing'
      }
    }
    tx.updatedBy = req.user._id
    appendTransactionAudit(tx, req.user, 'update', { fromStatus: tx.status, toStatus: tx.status, comment: req.body.description || '' })
    await tx.save()
    res.json({ success: true, transaction: tx })
  } catch (e) {
    if (/Invalid|exceeds allowed maximum/i.test(e?.message || '')) {
      return res.status(400).json({ success: false, message: e.message })
    }
    console.error('Update transaction error:', e)
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.post('/transactions/:id/void', protect, async (req, res) => {
  try {
    if (!isSuperAdmin(req.user) && !isFinance(req.user)) {
      return res.status(403).json({ success: false, message: 'Forbidden' })
    }

    const tx = await Transaction.findById(req.params.id)
    if (!tx || tx.isDeleted) return res.status(404).json({ success: false, message: 'Transaction not found' })

    const now = new Date()

    // Soft-delete all ledger entries linked to this transaction
    await Ledger.updateMany(
      { referenceId: tx._id, isDeleted: { $ne: true } },
      { $set: { isDeleted: true, deletedAt: now, updatedBy: req.user._id } }
    )

    // Also soft-delete the journalEntryId ledger entry if present
    if (tx.journalEntryId) {
      await Ledger.updateMany(
        { _id: tx.journalEntryId, isDeleted: { $ne: true } },
        { $set: { isDeleted: true, deletedAt: now, updatedBy: req.user._id } }
      )
    }

    tx.isDeleted = true
    tx.deletedAt = now
    tx.updatedBy = req.user._id
    appendTransactionAudit(tx, req.user, 'void', { fromStatus: tx.status, toStatus: 'voided', comment: req.body?.reason || 'Voided by user' })
    await tx.save()

    res.json({ success: true, message: 'Transaction voided and ledger entries removed' })
  } catch (e) {
    console.error('Void transaction error:', e)
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.delete('/transactions/:id', protect, async (req, res) => {
  try {
    if (!isSuperAdmin(req.user) && !isFinance(req.user)) {
      return res.status(403).json({ success: false, message: 'Forbidden' })
    }

    const tx = await Transaction.findById(req.params.id)
    if (!tx || tx.isDeleted) return res.status(404).json({ success: false, message: 'Transaction not found' })
    if (tx.status === 'posted') {
      return res.status(400).json({ success: false, message: 'Posted transaction cannot be deleted' })
    }
    tx.isDeleted = true
    tx.deletedAt = new Date()
    tx.updatedBy = req.user._id
    appendTransactionAudit(tx, req.user, 'delete', { fromStatus: tx.status, toStatus: tx.status })
    await tx.save()
    res.json({ success: true, message: 'Transaction deleted (soft)', transaction: tx })
  } catch {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.post('/transactions/:id/submit', protect, async (req, res) => {
  try {
    const tx = await Transaction.findById(req.params.id)
    if (!tx || tx.isDeleted) return res.status(404).json({ success: false, message: 'Transaction not found' })
    if (!canCreateTransactionFor(req.user, tx.type) && !isFinance(req.user) && !isSuperAdmin(req.user)) {
      return res.status(403).json({ success: false, message: 'Forbidden' })
    }
    const result = await applyTransactionWorkflowAction(tx, req.user, 'submit', { comment: req.body?.comment })
    const populated = await populateTransactionQuery(Transaction.findById(result.transaction._id))
    res.json({ success: true, transaction: populated })
  } catch (e) {
    respondWorkflowError(res, e)
  }
})

router.post('/transactions/:id/approve', protect, async (req, res) => {
  try {
    const tx = await Transaction.findById(req.params.id)
    if (!tx || tx.isDeleted) return res.status(404).json({ success: false, message: 'Transaction not found' })
    const result = await applyTransactionWorkflowAction(tx, req.user, 'approve', { comment: req.body?.comment })
    const populated = await populateTransactionQuery(Transaction.findById(result.transaction._id))
    res.json({ success: true, transaction: populated })
  } catch (e) {
    respondWorkflowError(res, e)
  }
})

router.post('/transactions/:id/post', protect, async (req, res) => {
  try {
    const tx = await Transaction.findById(req.params.id)
    if (!tx || tx.isDeleted) return res.status(404).json({ success: false, message: 'Transaction not found' })
    const result = await applyTransactionWorkflowAction(tx, req.user, 'post', { comment: req.body?.comment, mappingOverride: req.body || {} })
    const populated = await populateTransactionQuery(Transaction.findById(result.transaction._id))
    res.json({ success: true, transaction: populated, ledgerEntry: result.ledgerEntry })
  } catch (e) {
    respondWorkflowError(res, e)
  }
})

router.post('/transactions/:id/revalue-fx-journal', protect, async (req, res) => {
  try {
    if (!isSuperAdmin(req.user)) {
      return res.status(403).json({ success: false, message: 'Only Admin can revalue FX journals' })
    }

    const tx = await Transaction.findById(req.params.id)
    if (!tx || tx.isDeleted) return res.status(404).json({ success: false, message: 'Transaction not found' })
    if (!['receipt', 'payment'].includes(String(tx.type || '').toLowerCase())) {
      return res.status(400).json({ success: false, message: 'Only receipt/payment vouchers support FX revaluation' })
    }
    if (tx.status !== 'posted') {
      return res.status(400).json({ success: false, message: 'Only posted vouchers can be revalued' })
    }

    const preview = await buildFxJournalRevaluationPreview(tx)
    if (!preview.ok) {
      return res.status(400).json({ success: false, message: preview.message, dryRun: true, ...preview })
    }

    const apply = Boolean(req.body?.apply)
    if (!apply) {
      return res.json({ success: true, dryRun: true, ...preview })
    }

    const applied = await applyFxJournalRevaluation({ transaction: tx, user: req.user, preview })
    res.json({ success: true, dryRun: false, ...applied })
  } catch (e) {
    console.error('FX journal revaluation error:', e)
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.post('/transactions/:id/comments', protect, async (req, res) => {
  try {
    if (!canAccessTransactions(req.user)) {
      return res.status(403).json({ success: false, message: 'Forbidden' })
    }

    const tx = await Transaction.findById(req.params.id)
    if (!tx || tx.isDeleted) return res.status(404).json({ success: false, message: 'Transaction not found' })

    const message = normalizeTransactionNote(req.body?.message)
    if (!message) return res.status(400).json({ success: false, message: 'Comment is required' })

    appendTransactionComment(tx, req.user, message, 'comment')
    appendTransactionAudit(tx, req.user, 'comment', { fromStatus: tx.status, toStatus: tx.status, comment: message })
    tx.updatedBy = req.user._id
    await tx.save()

    const populated = await populateTransactionQuery(Transaction.findById(tx._id))
    res.json({ success: true, transaction: populated })
  } catch (e) {
    console.error('Add transaction comment error:', e)
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.post('/transactions/:id/attachments', protect, transactionUpload.single('file'), async (req, res) => {
  try {
    if (!canAccessTransactions(req.user)) {
      return res.status(403).json({ success: false, message: 'Forbidden' })
    }

    const tx = await Transaction.findById(req.params.id)
    if (!tx || tx.isDeleted) return res.status(404).json({ success: false, message: 'Transaction not found' })
    if (!req.file) return res.status(400).json({ success: false, message: 'Attachment file is required' })

    if (!validateAttachmentContent(req.file)) {
      const filePath = path.resolve(transactionUploadDir, req.file.filename)
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
      return res.status(400).json({ success: false, message: 'Attachment content does not match file type' })
    }

    const attachment = buildTransactionAttachment(req, req.file, req.user)
    tx.attachments.push(attachment)
    tx.updatedBy = req.user._id
    appendTransactionAudit(tx, req.user, 'upload_attachment', { fromStatus: tx.status, toStatus: tx.status, comment: attachment.originalName })
    await tx.save()

    const populated = await populateTransactionQuery(Transaction.findById(tx._id))
    res.status(201).json({ success: true, transaction: populated, attachment: populated.attachments[populated.attachments.length - 1] })
  } catch (e) {
    respondWorkflowError(res, e)
  }
})

router.delete('/transactions/:id/attachments/:attachmentId', protect, async (req, res) => {
  try {
    if (!canAccessTransactions(req.user)) {
      return res.status(403).json({ success: false, message: 'Forbidden' })
    }

    const tx = await Transaction.findById(req.params.id)
    if (!tx || tx.isDeleted) return res.status(404).json({ success: false, message: 'Transaction not found' })

    const attachment = tx.attachments.id(req.params.attachmentId)
    if (!attachment) return res.status(404).json({ success: false, message: 'Attachment not found' })

    const filePath = path.resolve(transactionUploadDir, attachment.fileName)
    tx.attachments.pull({ _id: attachment._id })
    tx.updatedBy = req.user._id
    appendTransactionAudit(tx, req.user, 'delete_attachment', { fromStatus: tx.status, toStatus: tx.status, comment: attachment.originalName })
    await tx.save()

    if (fs.existsSync(filePath)) fs.unlinkSync(filePath)

    const populated = await populateTransactionQuery(Transaction.findById(tx._id))
    res.json({ success: true, transaction: populated })
  } catch (e) {
    respondWorkflowError(res, e)
  }
})

router.post('/transactions/:id/return', protect, async (req, res) => {
  try {
    const tx = await Transaction.findById(req.params.id)
    if (!tx || tx.isDeleted) return res.status(404).json({ success: false, message: 'Transaction not found' })
    const result = await applyTransactionWorkflowAction(tx, req.user, 'return', { comment: req.body?.comment })
    const populated = await populateTransactionQuery(Transaction.findById(result.transaction._id))
    res.json({ success: true, transaction: populated })
  } catch (e) {
    respondWorkflowError(res, e)
  }
})

router.post('/transactions/:id/reject', protect, async (req, res) => {
  try {
    const tx = await Transaction.findById(req.params.id)
    if (!tx || tx.isDeleted) return res.status(404).json({ success: false, message: 'Transaction not found' })
    const result = await applyTransactionWorkflowAction(tx, req.user, 'reject', { comment: req.body?.comment })
    const populated = await populateTransactionQuery(Transaction.findById(result.transaction._id))
    res.json({ success: true, transaction: populated })
  } catch (e) {
    respondWorkflowError(res, e)
  }
})

router.post('/transactions/bulk-action', protect, async (req, res) => {
  try {
    if (!canAccessTransactions(req.user)) {
      return res.status(403).json({ success: false, message: 'Forbidden' })
    }

    const ids = Array.isArray(req.body?.ids) ? req.body.ids.filter(Boolean) : []
    const action = String(req.body?.action || '')
    const comment = normalizeTransactionNote(req.body?.comment)
    const mappingOverride = req.body?.mappingOverride || {}

    if (!ids.length) return res.status(400).json({ success: false, message: 'Select at least one transaction' })
    if (!['submit', 'approve', 'post'].includes(action)) return res.status(400).json({ success: false, message: 'Invalid bulk action' })

    const transactions = await Transaction.find({ _id: { $in: ids }, isDeleted: { $ne: true } }).sort({ createdAt: -1 })
    const results = { successIds: [], failed: [] }

    for (const tx of transactions) {
      try {
        if (!canCreateTransactionFor(req.user, tx.type) && !isFinance(req.user) && !isSuperAdmin(req.user)) {
          throw new Error('Forbidden')
        }
        const actionResult = await applyTransactionWorkflowAction(tx, req.user, action, { comment, mappingOverride })
        results.successIds.push(String(actionResult.transaction._id))
      } catch (e) {
        results.failed.push({ id: String(tx._id), message: e.message || 'Failed' })
      }
    }

    const refreshed = await populateTransactionQuery(Transaction.find({ _id: { $in: results.successIds } }))
    res.json({ success: true, action, processed: transactions.length, successCount: results.successIds.length, failureCount: results.failed.length, transactions: refreshed, ...results })
  } catch (e) {
    console.error('Bulk transaction action error:', e)
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.get('/transactions/source-by-ledger/:ledgerId', protect, async (req, res) => {
  try {
    if (!canAccessTransactions(req.user) && !canAccessReports(req.user)) {
      return res.status(403).json({ success: false, message: 'Forbidden' })
    }

    const ledgerEntry = await Ledger.findById(req.params.ledgerId)
      .populate('debitAccountId', 'accountCode accountName')
      .populate('creditAccountId', 'accountCode accountName')

    if (!ledgerEntry || ledgerEntry.isDeleted) {
      return res.status(404).json({ success: false, message: 'Ledger entry not found' })
    }

    const sourceTransaction = await Transaction.findOne({
      isDeleted: { $ne: true },
      $or: [
        { journalEntryId: ledgerEntry._id },
        { _id: ledgerEntry.referenceId },
      ],
    })
      .populate('customerId', 'name')
      .populate('vendorId', 'name')
      .populate('inventoryItemId', 'sku name')
      .populate('debitAccountId', 'accountCode accountName')
      .populate('creditAccountId', 'accountCode accountName')
      .populate('mappingId', 'mappingType')
      .populate('createdBy', 'name email')
      .populate('approvedBy', 'name email')
      .populate('postedBy', 'name email')

    res.json({
      success: true,
      ledgerEntry,
      sourceTransaction: sourceTransaction || null,
      sourceType: sourceTransaction ? 'transaction' : 'manual_journal',
    })
  } catch {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

// ==========================================
// REPORTS ENDPOINTS
// ==========================================

}

module.exports = {
  registerTransactionRoutes,
}
