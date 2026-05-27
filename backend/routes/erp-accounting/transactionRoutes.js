function registerTransactionRoutes(deps) {
  const fs = require('fs')
  const path = require('path')
  const { requireDestructiveAdminGuard } = require('../../middleware/destructiveAction')
  const { reverseMetalVoucherStockForVoid } = require('../../utils/metalVoucherStockReversal')
  const { runInTransaction, writeOpts } = require('../../utils/mongoTransaction')
  const User = require('../../models/User')
  const Message = require('../../models/Message')
  const { publishRealtimeEvent } = require('../../utils/realtimeBus')
  const {
    router,
    protect,
    validateBody,
    validateBodyStrict,
    transactionCreateSchema,
    transactionPatchSchema,
    transactionUpload,
    transactionUploadDir,
    TRANSACTION_STATUSES,
    Transaction,
    Ledger,
    Currency,
    Customer,
    Vendor,
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
    storeTransactionAttachment,
    removeStoredAttachment,
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
    StockMovement,
    InventoryItem,
    toQty,
  } = deps

const strictBody = validateBodyStrict || validateBody

const decodeCursor = (cursor) => {
  if (!cursor) return null
  try {
    const parsed = JSON.parse(Buffer.from(String(cursor), 'base64').toString('utf8'))
    if (!parsed?.createdAt || !parsed?.id) return null
    return { createdAt: new Date(parsed.createdAt), id: String(parsed.id) }
  } catch {
    return null
  }
}

const encodeCursor = (doc) => {
  if (!doc?._id || !doc?.createdAt) return null
  return Buffer.from(JSON.stringify({ createdAt: doc.createdAt, id: String(doc._id) })).toString('base64')
}

const parseDateBoundary = (value, endOfDay = false) => {
  if (!value) return null
  const raw = String(value).trim()
  if (!raw) return null
  const date = /^\d{4}-\d{2}-\d{2}$/.test(raw)
    ? new Date(`${raw}T${endOfDay ? '23:59:59.999' : '00:00:00.000'}Z`)
    : new Date(raw)
  return Number.isNaN(date.getTime()) ? null : date
}

const emitRealtime = (req, cb) => {
  const realtimeServer = req.app.get('realtimeServer')
  if (!realtimeServer || typeof cb !== 'function') return
  try { cb(realtimeServer) } catch { void 0 }
}

const reversePostedTransactionEffects = async ({ tx, user, session, deleteReason }) => {
  const now = new Date()

  await Ledger.updateMany(
    { referenceId: tx._id, isDeleted: { $ne: true } },
    { $set: { isDeleted: true, deletedAt: now, updatedBy: user._id } },
    writeOpts(session),
  )

  if (tx.journalEntryId) {
    await Ledger.updateMany(
      { _id: tx.journalEntryId, isDeleted: { $ne: true } },
      { $set: { isDeleted: true, deletedAt: now, updatedBy: user._id } },
      writeOpts(session),
    )
  }

  await reverseMetalVoucherStockForVoid({
    tx,
    user,
    StockMovement,
    InventoryItem,
    toQty,
    deleteReason,
    session,
  })
}

const escapeRegex = (value) => String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const extractMentionNames = (message) => {
  const matches = String(message || '').matchAll(/@([A-Za-z0-9._-]+)/g)
  return Array.from(new Set(Array.from(matches).map((match) => String(match[1] || '').trim()).filter(Boolean)))
}

const resolveMentionedUsers = async (message, payload = {}) => {
  const requestedIds = Array.isArray(payload.mentionedUserIds)
    ? payload.mentionedUserIds.map((id) => String(id || '').trim()).filter((id) => /^[a-f\d]{24}$/i.test(id))
    : []
  const requestedNames = [
    ...extractMentionNames(message),
    ...(Array.isArray(payload.mentionedNames) ? payload.mentionedNames : []),
  ]
    .map((name) => String(name || '').replace(/^@/, '').trim())
    .filter(Boolean)

  const or = []
  if (requestedIds.length) or.push({ _id: { $in: requestedIds } })
  requestedNames.forEach((name) => {
    const exact = new RegExp(`^${escapeRegex(name)}$`, 'i')
    or.push({ name: exact }, { fullName: exact }, { employeeCode: exact }, { email: exact })
  })
  if (!or.length) return []

  return User.find({ isDeleted: { $ne: true }, isActive: { $ne: false }, $or: or })
    .select('_id name email role')
    .limit(20)
}

router.get('/transactions', protect, async (req, res) => {
  try {
    if (!canAccessTransactions(req.user)) {
      return res.status(403).json({ success: false, message: 'Forbidden' })
    }

    const { page, limit, skip } = parsePagination(req.query, 50, 200)
    const cursor = decodeCursor(req.query.cursor)
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
      const startDate = parseDateBoundary(req.query.startDate, false)
      const endDate = parseDateBoundary(req.query.endDate, true)
      if (startDate) query.date.$gte = startDate
      if (endDate) query.date.$lte = endDate
      if (!Object.keys(query.date).length) delete query.date
    }

    if (req.query.search) {
      const search = String(req.query.search).trim()
      if (search) {
        const regex = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
        query.$or = [
          { description: regex },
          { type: regex },
          { currency: regex },
          { 'voucherMeta.partyCode': regex },
          { 'voucherMeta.partyName': regex },
          { 'voucherMeta.vocNo': regex },
          { 'voucherMeta.refNo': regex },
          { 'voucherMeta.lineItems.narration': regex },
        ]
        const [matchingCustomers, matchingVendors] = await Promise.all([
          Customer ? Customer.find({ name: regex, isActive: { $ne: false } }).select('_id').limit(100).lean() : Promise.resolve([]),
          Vendor ? Vendor.find({ name: regex, deletedAt: null }).select('_id').limit(100).lean() : Promise.resolve([]),
        ])
        const customerIds = matchingCustomers.map((row) => row._id)
        const vendorIds = matchingVendors.map((row) => row._id)
        if (customerIds.length) query.$or.push({ customerId: { $in: customerIds } })
        if (vendorIds.length) query.$or.push({ vendorId: { $in: vendorIds } })
      }
    }

    const summaryQuery = { ...query }

    let listQuery = { ...query }
    if (cursor) {
      listQuery = {
        ...listQuery,
        $and: [
          ...(listQuery.$and || []),
          {
            $or: [
              { createdAt: { $lt: cursor.createdAt } },
              { createdAt: cursor.createdAt, _id: { $lt: cursor.id } },
            ],
          },
        ],
      }
    }

    let transactions
    if (cursor) {
      transactions = await populateTransactionQuery(Transaction.find(listQuery))
        .sort({ createdAt: -1, _id: -1 })
        .limit(limit + 1)
    } else {
      transactions = await populateTransactionQuery(Transaction.find(listQuery))
        .sort({ createdAt: -1, _id: -1 })
        .skip(skip)
        .limit(limit + 1)
    }

    const hasMore = transactions.length > limit
    const rows = hasMore ? transactions.slice(0, limit) : transactions
    const nextCursor = hasMore ? encodeCursor(rows[rows.length - 1]) : null

    const blockedQuery = query.type && query.type.$in && query.type.$in.length === 0
    const metricsMatch = blockedQuery ? { _id: null } : summaryQuery

    const [total, summaryRows] = await Promise.all([
      Transaction.countDocuments(metricsMatch),
      Transaction.aggregate([
        { $match: metricsMatch },
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

    res.json({
      success: true,
      transactions: rows,
      total,
      page,
      limit,
      summary,
      hasMore,
      nextCursor,
      cursor: req.query.cursor || null,
    })
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
    const voucherMetaPayload = (['sale', 'purchase', 'metal_receipt', 'metal_payment'].includes(String(type || '').toLowerCase()) && normalizedMetalFixStatus)
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

    const tenantKey = String(req.tenant?.key || req.user?.tenant || 'default')
    emitRealtime(req, (realtimeServer) => {
      if (typeof realtimeServer.broadcastTransactionUpdate === 'function') {
        realtimeServer.broadcastTransactionUpdate(tenantKey, {
          action: 'created',
          transactionId: String(tx._id),
          status: tx.status,
          type: tx.type,
        })
      }
    })

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
      await runInTransaction(async (session) => {
        await reversePostedTransactionEffects({
          tx,
          user: req.user,
          session,
          deleteReason: 'Posted transaction edited — inventory reversal',
        })
        tx.status = 'draft'
        tx.journalEntryId = null
        await tx.save(writeOpts(session))
      })
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

    const tenantKey = String(req.tenant?.key || req.user?.tenant || 'default')
    emitRealtime(req, (realtimeServer) => {
      if (typeof realtimeServer.broadcastTransactionUpdate === 'function') {
        realtimeServer.broadcastTransactionUpdate(tenantKey, {
          action: 'updated',
          transactionId: String(tx._id),
          status: tx.status,
          type: tx.type,
        })
      }
    })

    res.json({ success: true, transaction: tx })
  } catch (e) {
    if (/Invalid|exceeds allowed maximum/i.test(e?.message || '')) {
      return res.status(400).json({ success: false, message: e.message })
    }
    console.error('Update transaction error:', e)
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

const requireTransactionVoidRole = (req, res, next) => {
  if (!isSuperAdmin(req.user) && !isFinance(req.user)) {
    return res.status(403).json({ success: false, message: 'Forbidden' })
  }
  return next()
}

router.post('/transactions/:id/void', protect, requireTransactionVoidRole, requireDestructiveAdminGuard('transactions/void'), async (req, res) => {
  try {
    const tx = await Transaction.findById(req.params.id)
    if (!tx || tx.isDeleted) return res.status(404).json({ success: false, message: 'Transaction not found' })

    await runInTransaction(async (session) => {
      await reversePostedTransactionEffects({
        tx,
        user: req.user,
        session,
        deleteReason: req.destructiveAction?.reason,
      })

      const now = new Date()
      tx.isDeleted = true
      tx.deletedAt = now
      tx.updatedBy = req.user._id
      appendTransactionAudit(tx, req.user, 'void', { fromStatus: tx.status, toStatus: 'voided', comment: req.destructiveAction.reason })
      await tx.save(writeOpts(session))
    })

    const tenantKey = String(req.tenant?.key || req.user?.tenant || 'default')
    emitRealtime(req, (realtimeServer) => {
      if (typeof realtimeServer.broadcastTransactionUpdate === 'function') {
        realtimeServer.broadcastTransactionUpdate(tenantKey, {
          action: 'voided',
          transactionId: String(tx._id),
          status: 'voided',
          type: tx.type,
        })
      }
      if (typeof realtimeServer.broadcastLedgerUpdate === 'function') {
        realtimeServer.broadcastLedgerUpdate(tenantKey, {
          action: 'voided_from_transaction',
          transactionId: String(tx._id),
          ledgerEntryId: String(tx.journalEntryId || ''),
        })
      }
    })

    res.json({ success: true, message: 'Transaction voided and linked ledger entries soft-deleted' })
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

    const tenantKey = String(req.tenant?.key || req.user?.tenant || 'default')
    emitRealtime(req, (realtimeServer) => {
      if (typeof realtimeServer.broadcastTransactionUpdate === 'function') {
        realtimeServer.broadcastTransactionUpdate(tenantKey, {
          action: 'deleted',
          transactionId: String(tx._id),
          status: tx.status,
          type: tx.type,
        })
      }
    })

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
    const tenantKey = String(req.tenant?.key || req.user?.tenant || 'default')
    emitRealtime(req, (realtimeServer) => {
      if (typeof realtimeServer.broadcastTransactionUpdate === 'function') {
        realtimeServer.broadcastTransactionUpdate(tenantKey, {
          action: 'submitted',
          transactionId: String(result.transaction._id),
          status: result.transaction.status,
          type: result.transaction.type,
        })
      }
    })
    res.json({ success: true, transaction: populated })
  } catch (e) {
    respondWorkflowError(res, e)
  }
})

router.post('/transactions/:id/approve', protect, async (req, res) => {
  try {
    const tx = await Transaction.findById(req.params.id)
    if (!tx || tx.isDeleted) return res.status(404).json({ success: false, message: 'Transaction not found' })
    const result = await runInTransaction(async (session) => {
      const freshTx = await Transaction.findById(req.params.id).session(session)
      if (!freshTx || freshTx.isDeleted) throw new Error('Transaction not found')
      return applyTransactionWorkflowAction(freshTx, req.user, 'approve', { comment: req.body?.comment }, session)
    })
    const populated = await populateTransactionQuery(Transaction.findById(result.transaction._id))
    const tenantKey = String(req.tenant?.key || req.user?.tenant || 'default')
    emitRealtime(req, (realtimeServer) => {
      if (typeof realtimeServer.broadcastTransactionUpdate === 'function') {
        realtimeServer.broadcastTransactionUpdate(tenantKey, {
          action: 'approved',
          transactionId: String(result.transaction._id),
          status: result.transaction.status,
          type: result.transaction.type,
        })
      }
      // Notify the transaction owner that their submission was approved
      const ownerId = String(result.transaction.createdBy || '')
      if (ownerId && typeof realtimeServer.sendUserNotification === 'function') {
        realtimeServer.sendUserNotification(ownerId, 'transaction_approved', {
          transactionId: String(result.transaction._id),
          type: result.transaction.type,
          approvedBy: String(req.user?.name || req.user?._id || ''),
        })
      }
    })
    res.json({ success: true, transaction: populated })
  } catch (e) {
    respondWorkflowError(res, e)
  }
})

router.post('/transactions/:id/post', protect, async (req, res) => {
  try {
    const tx = await Transaction.findById(req.params.id)
    if (!tx || tx.isDeleted) return res.status(404).json({ success: false, message: 'Transaction not found' })
    if (tx.status === 'posted') {
      return res.status(409).json({ success: false, message: 'Transaction is already posted.' })
    }
    const result = await runInTransaction(async (session) => {
      const freshTx = await Transaction.findById(req.params.id).session(session)
      if (!freshTx || freshTx.isDeleted) throw new Error('Transaction not found')
      if (freshTx.status === 'posted') throw new Error('Transaction is already posted.')
      return applyTransactionWorkflowAction(freshTx, req.user, 'post', { comment: req.body?.comment, mappingOverride: req.body || {} }, session)
    })
    const populated = await populateTransactionQuery(Transaction.findById(result.transaction._id))
    const tenantKey = String(req.tenant?.key || req.user?.tenant || 'default')
    emitRealtime(req, (realtimeServer) => {
      if (typeof realtimeServer.broadcastTransactionUpdate === 'function') {
        realtimeServer.broadcastTransactionUpdate(tenantKey, {
          action: 'posted',
          transactionId: String(result.transaction._id),
          status: result.transaction.status,
          type: result.transaction.type,
          ledgerEntryId: String(result.ledgerEntry?._id || result.transaction.journalEntryId || ''),
        })
      }
      if (typeof realtimeServer.broadcastLedgerUpdate === 'function') {
        realtimeServer.broadcastLedgerUpdate(tenantKey, {
          action: 'created_from_transaction',
          transactionId: String(result.transaction._id),
          ledgerEntryId: String(result.ledgerEntry?._id || result.transaction.journalEntryId || ''),
          referenceType: result.ledgerEntry?.referenceType || result.transaction.type,
        })
      }
      // Notify dashboard subscribers that financial metrics may have changed
      if (typeof realtimeServer.broadcastMetricsUpdate === 'function') {
        realtimeServer.broadcastMetricsUpdate(tenantKey, {
          trigger: 'transaction_posted',
          transactionId: String(result.transaction._id),
          type: result.transaction.type,
        })
      }
    })
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

    const applied = await runInTransaction(async (session) => (
      applyFxJournalRevaluation({ transaction: tx, user: req.user, preview, session })
    ))
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

    const mentionedUsers = await resolveMentionedUsers(message, req.body)
    appendTransactionComment(tx, req.user, message, 'comment')
    const comment = tx.comments[tx.comments.length - 1]
    if (comment) {
      comment.mentionedUsers = mentionedUsers.map((mentionedUser) => mentionedUser._id)
      comment.readBy = [{ userId: req.user._id, readAt: new Date() }]
    }
    appendTransactionAudit(tx, req.user, 'comment', { fromStatus: tx.status, toStatus: tx.status, comment: message })
    tx.updatedBy = req.user._id
    await tx.save()

    let deliveredMessage = null
    if (mentionedUsers.length) {
      const transactionRef = tx.voucherMeta?.vocNo || tx.voucherMeta?.refNo || String(tx._id)
      deliveredMessage = await Message.create({
        type: 'dm',
        room: `ERP Transaction ${transactionRef}`,
        department: String(req.user?.department || ''),
        senderId: req.user._id,
        senderName: req.user.name,
        recipientIds: mentionedUsers.map((mentionedUser) => mentionedUser._id),
        recipientNames: mentionedUsers.map((mentionedUser) => mentionedUser.name).filter(Boolean),
        text: `ERP transaction ${transactionRef}: ${message}`,
      })

      publishRealtimeEvent({
        type: 'message.created',
        tenant: req.tenant?.key,
        data: {
          id: deliveredMessage._id,
          room: deliveredMessage.room,
          type: deliveredMessage.type,
          senderName: deliveredMessage.senderName,
          createdAt: deliveredMessage.createdAt,
          transactionId: String(tx._id),
        },
      })
    }

    emitRealtime(req, (realtimeServer) => {
      if (typeof realtimeServer.sendUserNotification !== 'function') return
      mentionedUsers.forEach((mentionedUser) => {
        const mentionedUserId = String(mentionedUser._id)
        if (mentionedUserId === String(req.user._id)) return
        realtimeServer.sendUserNotification(mentionedUserId, 'transaction_chat_mention', {
          transactionId: String(tx._id),
          commentId: String(comment?._id || ''),
          message,
          senderId: String(req.user._id),
          senderName: String(req.user?.name || ''),
          type: tx.type,
          createdAt: new Date().toISOString(),
        })
      })
    })

    const populated = await populateTransactionQuery(Transaction.findById(tx._id))
    res.json({
      success: true,
      transaction: populated,
      comment: populated.comments?.[populated.comments.length - 1] || null,
      deliveredTo: mentionedUsers.map((mentionedUser) => ({
        _id: mentionedUser._id,
        name: mentionedUser.name,
        email: mentionedUser.email,
      })),
      messageId: deliveredMessage?._id || null,
    })
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

    const attachment = await storeTransactionAttachment({
      req,
      file: req.file,
      user: req.user,
      transactionModel: Transaction,
    })
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

    await removeStoredAttachment({
      attachment,
      transactionModel: Transaction,
      localFilePath: filePath,
    })

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
    const tenantKey = String(req.tenant?.key || req.user?.tenant || 'default')
    emitRealtime(req, (realtimeServer) => {
      if (typeof realtimeServer.broadcastTransactionUpdate === 'function') {
        realtimeServer.broadcastTransactionUpdate(tenantKey, {
          action: 'returned',
          transactionId: String(result.transaction._id),
          status: result.transaction.status,
          type: result.transaction.type,
        })
      }
      // Notify the transaction owner their submission was returned for revision
      const ownerId = String(result.transaction.createdBy || '')
      if (ownerId && typeof realtimeServer.sendUserNotification === 'function') {
        realtimeServer.sendUserNotification(ownerId, 'transaction_returned', {
          transactionId: String(result.transaction._id),
          type: result.transaction.type,
          returnedBy: String(req.user?.name || req.user?._id || ''),
          comment: String(req.body?.comment || ''),
        })
      }
    })
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
    const tenantKey = String(req.tenant?.key || req.user?.tenant || 'default')
    emitRealtime(req, (realtimeServer) => {
      if (typeof realtimeServer.broadcastTransactionUpdate === 'function') {
        realtimeServer.broadcastTransactionUpdate(tenantKey, {
          action: 'rejected',
          transactionId: String(result.transaction._id),
          status: result.transaction.status,
          type: result.transaction.type,
        })
      }
      // Notify the transaction owner their submission was rejected
      const ownerId = String(result.transaction.createdBy || '')
      if (ownerId && typeof realtimeServer.sendUserNotification === 'function') {
        realtimeServer.sendUserNotification(ownerId, 'transaction_rejected', {
          transactionId: String(result.transaction._id),
          type: result.transaction.type,
          rejectedBy: String(req.user?.name || req.user?._id || ''),
          comment: String(req.body?.comment || ''),
        })
      }
    })
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
        const actionResult = ['approve', 'post'].includes(action)
          ? await runInTransaction(async (session) => {
            const freshTx = await Transaction.findById(tx._id).session(session)
            if (!freshTx || freshTx.isDeleted) throw new Error('Transaction not found')
            return applyTransactionWorkflowAction(freshTx, req.user, action, { comment, mappingOverride }, session)
          })
          : await applyTransactionWorkflowAction(tx, req.user, action, { comment, mappingOverride })
        results.successIds.push(String(actionResult.transaction._id))
      } catch (e) {
        results.failed.push({ id: String(tx._id), message: e.message || 'Failed' })
      }
    }

    const refreshed = await populateTransactionQuery(Transaction.find({ _id: { $in: results.successIds } }))
    const tenantKey = String(req.tenant?.key || req.user?.tenant || 'default')
    emitRealtime(req, (realtimeServer) => {
      if (typeof realtimeServer.broadcastTransactionUpdate === 'function' && results.successIds.length) {
        realtimeServer.broadcastTransactionUpdate(tenantKey, {
          action: `bulk_${action}`,
          transactionIds: results.successIds,
          successCount: results.successIds.length,
          failureCount: results.failed.length,
        })
      }
      if (action === 'post' && typeof realtimeServer.broadcastLedgerUpdate === 'function' && results.successIds.length) {
        realtimeServer.broadcastLedgerUpdate(tenantKey, {
          action: 'bulk_posted_from_transaction',
          transactionIds: results.successIds,
        })
      }
    })
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
