const { resolveRequestTenantKey } = require('../../config/tenants')
const { requireDestructiveAdminGuard } = require('../../middleware/destructiveAction')
const { runJvLedgerFxBackfillOnNativeDb } = require('../../services/jvLedgerFxBackfill')
const { notifyErpUsers } = require('../../services/notificationDispatch')
const { Joi, validateBodyStrict, validateParams } = require('../../middleware/validate')
const { escapeRegex } = require('../../utils/escapeRegex')

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
  exchangeRate: Joi.number().positive().optional(),
}).min(1)

function registerLedgerRoutes(deps) {
  const {
    router,
    protect,
    validateBody,
    canViewLedger,
    canCreateTransaction,
    canCreateTransactionFor,
    canEditLedgerEntry,
    canCloseLedgerPeriod,
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

const jvDescriptionHead = (description = '') => {
  const raw = String(description || '')
  return (raw.includes(' — ') ? raw.split(' — ')[0] : raw.split(' - ')[0]).trim()
}

const isValidObjectId = (value = '') => /^[a-fA-F0-9]{24}$/.test(String(value || '').trim())

async function assertJvDocNoNotDuplicate(TenantLedger, { referenceType, description, referenceId }) {
  const refType = String(referenceType || 'journal').toLowerCase()
  if (!['journal', 'bank_jv'].includes(refType)) return null
  const head = jvDescriptionHead(description)
  if (!/^(jv|bnkjv)\/\d{4}\/\d+$/i.test(head)) return null

  const matches = await TenantLedger.find({
    isDeleted: { $ne: true },
    referenceType: refType,
    description: new RegExp(`^${escapeRegex(head)}(\\s|$|—|-)`, 'i'),
  })
    .select('referenceId')
    .lean()

  const batchId = String(referenceId || '').trim()
  const duplicate = (matches || []).some((row) => {
    const rowBatch = String(row?.referenceId || '').trim()
    if (!batchId || !isValidObjectId(batchId)) return true
    if (!rowBatch || !isValidObjectId(rowBatch)) return true
    return rowBatch !== batchId
  })

  if (duplicate) {
    const err = new Error(`DUPLICATE_JV_DOCNO:${head}`)
    throw err
  }
  return null
}

const JV_MODE_PREFIX = {
  journal: { prefix: 'Jv', referenceType: 'journal' },
  bank_jv: { prefix: 'BnkJV', referenceType: 'bank_jv' },
}

const emitRealtime = (req, cb) => {
  const realtimeServer = req.app.get('realtimeServer')
  if (!realtimeServer || typeof cb !== 'function') return
  try { cb(realtimeServer) } catch { void 0 }
}

const normalizeLedgerCurrency = (code) => {
  const u = String(code || '').trim().toUpperCase()
  if (['SOM', 'SOMS', 'SUM'].includes(u)) return 'UZS'
  return u
}

/**
 * Ledger convention (matches customer/vendor aggregates): base equivalent = amount * exchangeRate.
 * amount is in `currency`; exchangeRate is from Currency master (foreign → base) when not base.
 */
const resolveLedgerPostingFx = async (Currency, BASE_CURRENCY_CODE, requestedCurrency, requestedRate, amount) => {
  const baseRow = await Currency.findOne({ baseCurrency: true, isActive: true })
  const baseCurrencyCode = String(baseRow?.code || BASE_CURRENCY_CODE || 'USD').toUpperCase()
  const cur = normalizeLedgerCurrency(requestedCurrency) || baseCurrencyCode
  const amt = Number(amount)
  if (!Number.isFinite(amt) || amt < 0) {
    const err = new Error('INVALID_AMOUNT')
    throw err
  }
  if (cur === baseCurrencyCode) {
    return { currency: baseCurrencyCode, exchangeRate: 1, amount: amt }
  }
  let exchangeRate = Number(requestedRate)
  if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) {
    const doc = await Currency.findOne({ code: cur, isActive: true }).select('exchangeRate').lean()
    exchangeRate = Number(doc?.exchangeRate || 0)
  }
  if (!Number.isFinite(exchangeRate) || exchangeRate <= 0) {
    throw new Error(`MISSING_FX:${cur}`)
  }
  return { currency: cur, exchangeRate, amount: amt }
}

router.get('/ledger/next-voucher-no', protect, async (req, res) => {
  try {
    if (!canViewLedger(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })
    const TenantLedger = await Ledger.getTenantModel(req.tenant)
    const ref = String(req.query.referenceType || 'journal').toLowerCase() === 'bank_jv' ? 'bank_jv' : 'journal'
    const { prefix } = JV_MODE_PREFIX[ref] || JV_MODE_PREFIX.journal
    const year = new Date().getFullYear()
    const yearStart = new Date(`${year}-01-01T00:00:00.000Z`)
    const yearEnd = new Date(`${year}-12-31T23:59:59.999Z`)

    const rows = await TenantLedger.find({
      isDeleted: { $ne: true },
      referenceType: ref,
      date: { $gte: yearStart, $lte: yearEnd },
    })
      .select('description')
      .limit(8000)
      .lean()

    let maxSeq = 0
    const formattedRe = new RegExp(`^(${prefix})/(${year})/(\\d+)`, 'i')
    const legacyRe = new RegExp(`^(${prefix})-(\\d+)`, 'i')

    for (const row of rows || []) {
      const rawDesc = String(row?.description || '')
      const head = (rawDesc.includes(' — ') ? rawDesc.split(' — ')[0] : rawDesc.split(' - ')[0]).trim()
      const fm = head.match(formattedRe)
      if (fm) {
        const n = Number(fm[3])
        if (Number.isFinite(n) && n > maxSeq) maxSeq = n
        continue
      }
      const lm = head.match(legacyRe)
      if (lm) {
        const n = Number(lm[2])
        if (Number.isFinite(n) && n > maxSeq) maxSeq = n
      }
    }

    const docNo = `${prefix}/${year}/${String(maxSeq + 1).padStart(4, '0')}`
    return res.json({ success: true, docNo, referenceType: ref, year })
  } catch (e) {
    console.error('[ledger/next-voucher-no]', e)
    return res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.get('/ledger', protect, async (req, res) => {
  try {
    if (!canViewLedger(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })
    const TenantLedger = await Ledger.getTenantModel(req.tenant)
    const { startDate, endDate, accountId, department, referenceType, limit = 100, page, docNoPrefix, referenceId } = req.query
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
    const rid = String(referenceId || '').trim()
    if (rid && /^[a-fA-F0-9]{24}$/.test(rid)) {
      query.referenceId = rid
    }
    const dnp = String(docNoPrefix || '').trim()
    if (dnp && dnp.length <= 120) {
      query.description = new RegExp(`^${escapeRegex(dnp)}(\\s|$|—)`, 'i')
    }

    const useOffset = page && !req.query.cursor
    if (useOffset) {
      const safePage = Math.max(1, Number(page) || 1)
      const skip = (safePage - 1) * safeLimit
      const [entries, total] = await Promise.all([
        TenantLedger.find(query)
          .populate('debitAccountId', 'accountName accountCode currency')
          .populate('creditAccountId', 'accountName accountCode currency')
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
      .populate('debitAccountId', 'accountName accountCode currency')
      .populate('creditAccountId', 'accountName accountCode currency')
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
      txRefNo, chequeNo, bankRemarks, paymentType, currency: bodyCurrency, exchangeRate: bodyExchangeRate,
      notes } = req.body
    if (!debitAccountId || !creditAccountId || !amount) return res.status(400).json({ success: false, message: 'Required fields missing' })
    // Validation: debit account cannot equal credit account
    if (debitAccountId === creditAccountId) return res.status(400).json({ success: false, message: 'Debit and Credit accounts must be different' })
    // Enhanced role-based check for transaction type
    if (!canCreateTransactionFor(req.user, referenceType || 'journal')) {
      return res.status(403).json({ success: false, message: `Your department cannot post ${referenceType} transactions` })
    }

    let posting
    try {
      posting = await resolveLedgerPostingFx(Currency, BASE_CURRENCY_CODE, bodyCurrency, bodyExchangeRate, amount)
    } catch (e) {
      const msg = String(e.message || '')
      if (msg === 'INVALID_AMOUNT') return res.status(400).json({ success: false, message: 'Invalid amount' })
      if (msg.startsWith('MISSING_FX')) {
        const cur = msg.split(':')[1] || ''
        return res.status(400).json({ success: false, message: `Missing or invalid exchange rate for ${cur}. Add the currency in Currencies (active, exchangeRate > 0).` })
      }
      throw e
    }

    const isBankJV = referenceType === 'bank_jv'

    const TenantLedger = await Ledger.getTenantModel(req.tenant)
    try {
      await assertJvDocNoNotDuplicate(TenantLedger, { referenceType, description, referenceId })
    } catch (e) {
      if (String(e.message || '').startsWith('DUPLICATE_JV_DOCNO:')) {
        const docNo = String(e.message).split(':')[1] || 'this voucher number'
        return res.status(409).json({
          success: false,
          message: `Voucher number ${docNo} already exists. Use the next available number.`,
        })
      }
      throw e
    }

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
      amount: posting.amount,
      description,
      notes: String(notes || '').trim(),
      referenceType,
      referenceId,
      currency: posting.currency,
      exchangeRate: posting.exchangeRate,
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

    const tenantKey = String(resolveRequestTenantKey(req) || 'default')
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

    const refType = String(referenceType || 'journal').toLowerCase()
    if (refType === 'journal' || refType === 'bank_jv') {
      const vocNo = jvDescriptionHead(description)
      const label = refType === 'bank_jv' ? 'Bank JV' : 'JV'
      void notifyErpUsers(tenantKey, 'jv_posted', {
        vocNo,
        amount: Number(entry.amount || 0),
        description: String(description || ''),
        accountCodes: [String(debitAccountId), String(creditAccountId)],
        message: `${label} ${vocNo || 'posted'}: ${Number(entry.amount || 0)}`,
      }).catch((err) => console.warn('[notify] jv_posted', err?.message || err))
    }

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
    if (!canEditLedgerEntry(req.user, entry)) {
      return res.status(403).json({ success: false, message: 'Can only edit your own entries' })
    }
    const { date, debitAccountId, creditAccountId, _amount, description, referenceType } = req.body
    if (debitAccountId && creditAccountId && debitAccountId === creditAccountId) {
      return res.status(400).json({ success: false, message: 'Debit and Credit accounts must be different' })
    }
    const updates = {}
    if (date !== undefined) updates.date = new Date(date)
    if (debitAccountId !== undefined) updates.debitAccountId = debitAccountId
    if (creditAccountId !== undefined) updates.creditAccountId = creditAccountId
    if (description !== undefined) updates.description = description
    if (referenceType !== undefined) updates.referenceType = referenceType
    if (req.body.currency !== undefined || req.body.exchangeRate !== undefined || req.body.amount !== undefined) {
      try {
        const post = await resolveLedgerPostingFx(
          Currency,
          BASE_CURRENCY_CODE,
          req.body.currency !== undefined ? req.body.currency : entry.currency,
          req.body.exchangeRate !== undefined ? req.body.exchangeRate : entry.exchangeRate,
          req.body.amount !== undefined ? req.body.amount : entry.amount,
        )
        updates.amount = post.amount
        updates.currency = post.currency
        updates.exchangeRate = post.exchangeRate
      } catch (e) {
        const msg = String(e.message || '')
        if (msg === 'INVALID_AMOUNT') return res.status(400).json({ success: false, message: 'Invalid amount' })
        if (msg.startsWith('MISSING_FX')) {
          const cur = msg.split(':')[1] || ''
          return res.status(400).json({ success: false, message: `Missing or invalid exchange rate for ${cur}` })
        }
        throw e
      }
    }
    const updated = await TenantLedger.findByIdAndUpdate(req.params.id, updates, { returnDocument: 'after' })
    const tenantKey = String(resolveRequestTenantKey(req) || 'default')
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
    if (!canEditLedgerEntry(req.user, entry)) {
      return res.status(403).json({ success: false, message: 'Can only delete your own entries' })
    }
    const refType = String(entry.referenceType || '').toLowerCase()
    const isManualJv = refType === 'journal' || refType === 'bank_jv'

    if (isManualJv) {
      entry.isDeleted = true
      entry.deletedAt = new Date()
      entry.updatedBy = req.user._id
      await entry.save()
      await TenantLedger.updateMany(
        { referenceType: 'reversal', referenceId: entry._id, isDeleted: { $ne: true } },
        { $set: { isDeleted: true, deletedAt: new Date(), updatedBy: req.user._id } },
      )
      const tenantKey = String(resolveRequestTenantKey(req) || 'default')
      emitRealtime(req, (realtimeServer) => {
        if (typeof realtimeServer.broadcastLedgerUpdate === 'function') {
          realtimeServer.broadcastLedgerUpdate(tenantKey, {
            action: 'deleted',
            entryId: String(entry._id),
            referenceType: entry.referenceType,
          })
        }
      })
      return res.json({ success: true, message: 'Journal voucher line removed' })
    }

    // Other types: create reversal entry instead of hard delete (for audit trail)
    const reversalEntry = await TenantLedger.create({
      date: new Date(),
      debitAccountId: entry.creditAccountId,
      creditAccountId: entry.debitAccountId,
      amount: entry.amount,
      description: `REVERSAL of Entry ${entry._id}: ${entry.description}`,
      referenceType: 'reversal',
      referenceId: entry._id,
      currency: entry.currency,
      exchangeRate: Number(entry.exchangeRate || 1),
      createdBy: req.user._id,
      department: req.user.department,
    })
    const tenantKey = String(resolveRequestTenantKey(req) || 'default')
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
    if (!canEditLedgerEntry(req.user, entry)) {
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

    const tenantKey = String(resolveRequestTenantKey(req) || 'default')
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

    const nextReconciled = !entry.bankReconciled
    await TenantLedger.updateOne(
      { _id: entry._id },
      { $set: { bankReconciled: nextReconciled, updatedBy: req.user._id } }
    )

    const tenantKey = String(resolveRequestTenantKey(req) || 'default')
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

/** Finance: preview JV/bank_jv rows that would move from base+1 to FC+rate (no writes). */
router.post('/ledger/repair-jv-fx/preview', protect, async (req, res) => {
  try {
    if (!canViewLedger(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })
    if (!canCloseLedgerPeriod(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })
    const TenantLedger = await Ledger.getTenantModel(req.tenant)
    const db = TenantLedger.db
    const mode = String(req.body?.mode || 'coa').toLowerCase()
    const forceCurrency = String(req.body?.forceCurrency || '').trim().toUpperCase()
    const result = await runJvLedgerFxBackfillOnNativeDb(db, {
      dryRun: true,
      mode,
      forceCurrency,
      verbose: Boolean(req.body?.verbose),
    })
    return res.json({ success: true, ...result })
  } catch (e) {
    if (e.code === 'FORCE_CURRENCY_REQUIRED') {
      return res.status(400).json({ success: false, message: 'mode=force requires forceCurrency (e.g. UZS)' })
    }
    if (e.code === 'INVALID_MODE') {
      return res.status(400).json({ success: false, message: 'mode must be coa or force' })
    }
    console.error('[ledger/repair-jv-fx/preview]', e)
    return res.status(500).json({ success: false, message: 'Server error' })
  }
})

/** Finance + destructive token: apply JV/bank_jv FX backfill for this tenant. */
router.post('/ledger/repair-jv-fx/apply', protect, requireDestructiveAdminGuard('ledger/repair-jv-fx-apply'), async (req, res) => {
  try {
    if (!canCloseLedgerPeriod(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })
    const TenantLedger = await Ledger.getTenantModel(req.tenant)
    const db = TenantLedger.db
    const mode = String(req.body?.mode || 'coa').toLowerCase()
    const forceCurrency = String(req.body?.forceCurrency || '').trim().toUpperCase()
    const result = await runJvLedgerFxBackfillOnNativeDb(db, {
      dryRun: false,
      mode,
      forceCurrency,
      verbose: false,
    })
    const tenantKey = String(resolveRequestTenantKey(req) || 'default')
    emitRealtime(req, (realtimeServer) => {
      if (typeof realtimeServer.broadcastLedgerUpdate === 'function') {
        realtimeServer.broadcastLedgerUpdate(tenantKey, {
          action: 'jv_fx_repair',
          updated: result.updated,
          skipped: result.skipped,
        })
      }
    })
    return res.json({
      success: true,
      message: `Updated ${result.updated} ledger postings (${result.skipped} skip line-events).`,
      ...result,
    })
  } catch (e) {
    if (e.code === 'FORCE_CURRENCY_REQUIRED') {
      return res.status(400).json({ success: false, message: 'mode=force requires forceCurrency (e.g. UZS)' })
    }
    if (e.code === 'INVALID_MODE') {
      return res.status(400).json({ success: false, message: 'mode must be coa or force' })
    }
    console.error('[ledger/repair-jv-fx/apply]', e)
    return res.status(500).json({ success: false, message: 'Server error' })
  }
})

}

module.exports = {
  registerLedgerRoutes,
}
