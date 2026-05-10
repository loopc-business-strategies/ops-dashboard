const mongoose = require('mongoose')

function registerAccountsRoutes(deps) {
  const {
    router,
    protect,
    validateBody,
    validateParams,
    accountCreateSchema,
    accountPatchSchema,
    idParam,
    Ledger,
    ChartOfAccount,
    AccountMapping,
    Currency,
    InventoryItem,
    Vendor,
    Transaction,
    DirectDeal,
    Customer,
    BASE_CURRENCY_CODE,
    DEFAULT_METAL_RATES,
    toMoney,
    parsePagination,
    getLatestMetalRate,
    getAccountSummaryScope,
    validateAccountParentAssignment,
    canViewAccounts,
    canViewAccountSummary,
    canManageAccounts,
    isSuperAdmin,
  } = deps

router.get('/accounts', protect, async (req, res) => {
  try {
    const isSummaryScope = String(req.query.scope || '').trim().toLowerCase() === 'summary'
    if (!canViewAccounts(req.user) && !(isSummaryScope && canViewAccountSummary(req.user))) {
      return res.status(403).json({ success: false, message: 'Forbidden' })
    }
    const { page, limit, skip } = parsePagination(req.query, 50, 200)
    const query = { isActive: true }
    if (isSummaryScope) {
      const scopedIds = await getAccountSummaryScope(req.user)
      if (Array.isArray(scopedIds)) {
        query._id = { $in: scopedIds }
      }
    }
    const [accounts, total] = await Promise.all([
      ChartOfAccount.find(query)
        .populate('parentAccountId', 'accountName accountCode')
        .sort({ accountCode: 1 })
        .skip(skip)
        .limit(limit),
      ChartOfAccount.countDocuments(query),
    ])
    res.json({ success: true, accounts, total, page, limit })
  } catch {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.get('/accounts/enquiry', protect, async (req, res) => {
  try {
    if (!canViewAccountSummary(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })

    const accountCode = String(req.query.accountCode || '').trim()
    if (!accountCode) {
      return res.status(400).json({ success: false, message: 'Account number is required' })
    }

    const scopedIds = await getAccountSummaryScope(req.user)
    const accountQuery = { accountCode }
    if (Array.isArray(scopedIds)) {
      accountQuery._id = { $in: scopedIds }
    }

    const accountMatches = await ChartOfAccount.find(accountQuery)
      .sort({ isActive: -1, createdAt: 1, _id: 1 })

    if (!accountMatches.length) {
      return res.status(404).json({ success: false, message: 'Account not found' })
    }

    const account = accountMatches.find((row) => row.isActive) || accountMatches[0]

    const relatedAccountIds = accountMatches.map((row) => row._id)
    if (account.accountCode === '1100') {
      const customerLedgerIds = await Customer.find({ isActive: true, ledgerAccountId: { $ne: null } }).distinct('ledgerAccountId')
      customerLedgerIds.forEach((id) => {
        if (id && String(id) !== String(account._id)) relatedAccountIds.push(id)
      })
    }
    if (account.accountCode === '2100') {
      const vendorLedgerIds = await Vendor.find({ isActive: true, deletedAt: null, ledgerAccountId: { $ne: null } }).distinct('ledgerAccountId')
      vendorLedgerIds.forEach((id) => {
        if (id && String(id) !== String(account._id)) relatedAccountIds.push(id)
      })
    }

    const scopedRelatedAccountIds = Array.isArray(scopedIds)
      ? relatedAccountIds.filter((id) => scopedIds.some((scopedId) => String(scopedId) === String(id)))
      : relatedAccountIds

    const targetAccountIds = scopedRelatedAccountIds.length ? scopedRelatedAccountIds : [account._id]

    const [debitAgg, creditAgg] = await Promise.all([
      Ledger.aggregate([
        { $match: { debitAccountId: { $in: targetAccountIds }, isDeleted: { $ne: true } } },
        { $group: { _id: null, total: { $sum: { $multiply: ['$amount', { $ifNull: ['$exchangeRate', 1] }] } } } },
      ]),
      Ledger.aggregate([
        { $match: { creditAccountId: { $in: targetAccountIds }, isDeleted: { $ne: true } } },
        { $group: { _id: null, total: { $sum: { $multiply: ['$amount', { $ifNull: ['$exchangeRate', 1] }] } } } },
      ]),
    ])

    const debitTotal = Number(debitAgg[0]?.total || 0)
    const creditTotal = Number(creditAgg[0]?.total || 0)
    const openingBalance = Number(account.openingBalance || 0)
    const netBalance = openingBalance + debitTotal - creditTotal
    const netDirection = netBalance > 0 ? 'Debit' : netBalance < 0 ? 'Credit' : 'Flat'
    const isUnfixedFixingType = (value) => {
      const normalized = String(value || '').trim().toLowerCase()
      return ['non-fixing', 'non_fixing', 'nonfixing', 'unfixed', 'unfix'].includes(normalized)
    }

    const latestRate = await getLatestMetalRate()
    const rates = latestRate
      ? {
          goldPrice: Number(latestRate.goldPrice || 0),
          silverPrice: Number(latestRate.silverPrice || 0),
          priceCurrency: latestRate.priceCurrency || 'USD',
          updatedAt: latestRate.updatedAt,
        }
      : {
          ...DEFAULT_METAL_RATES,
          updatedAt: null,
        }

    const baseCurrency = await Currency.findOne({ baseCurrency: true, isActive: true })
    const baseCurrencyCode = String(baseCurrency?.code || BASE_CURRENCY_CODE || 'USD').toUpperCase()
    const accountCurrencyCode = String(account.currency || baseCurrencyCode).toUpperCase()
    // netBalance is already aggregated in base currency (amount * exchangeRate).
    const convertedToRateCurrency = Number(netBalance)

    // Metal position: sum pureWeight from actual UNFIXED metal sale/purchase transactions for this account's customer.
    // Fixed deals must affect value only, while unfixed deals affect metal balance.
    // Do NOT derive metal position from cash balance — that produces fabricated metal positions.
    let goldBalance = 0
    let silverBalance = 0
    const linkedCustomer = await Customer.findOne({ ledgerAccountId: account._id, isActive: true }).lean()
    if (linkedCustomer) {
      const metalTxs = await Transaction.find({
        customerId: linkedCustomer._id,
        type: { $in: ['sale', 'purchase'] },
        status: 'posted',
        isDeleted: { $ne: true },
      }).select('type metalFixStatus voucherMeta.fixingType voucherMeta.lineItems').lean()

      for (const tx of metalTxs) {
        const fixingType = tx?.voucherMeta?.fixingType || tx?.metalFixStatus || ''
        if (!isUnfixedFixingType(fixingType)) continue
        const lines = Array.isArray(tx.voucherMeta?.lineItems) ? tx.voucherMeta.lineItems : []
        for (const line of lines) {
          const pw = Number(line.pureWeight || 0)
          if (pw === 0) continue
          const sc = String(line.stockCode || '').toUpperCase()
          const isSilver = sc.includes('XAG') || sc.includes('SILV')
          const sign = tx.type === 'purchase' ? 1 : -1
          if (isSilver) {
            silverBalance += sign * pw
          } else {
            goldBalance += sign * pw
          }
        }
      }
    }

    const ledgerEntries = await Ledger.find({
      isDeleted: { $ne: true },
      $or: [{ debitAccountId: { $in: targetAccountIds } }, { creditAccountId: { $in: targetAccountIds } }],
    })
      .populate('debitAccountId', 'accountCode accountName')
      .populate('creditAccountId', 'accountCode accountName')
      .populate('createdBy', 'name')
      .sort({ date: -1, createdAt: -1 })
      .limit(12)

    const ledgerIds = ledgerEntries.map((entry) => entry._id)
    const referenceIds = ledgerEntries.map((entry) => entry.referenceId).filter(Boolean)
    const normalizeFixingStatus = (value) => {
      const normalized = String(value || '').trim().toLowerCase()
      if (['fixing', 'fixed'].includes(normalized)) return 'fixed'
      if (['non-fixing', 'non_fixing', 'nonfixing', 'unfixed', 'unfix'].includes(normalized)) return 'unfixed'
      return ''
    }
    const resolveMetalCodeFromLines = (lines = []) => {
      const arr = Array.isArray(lines) ? lines : []
      for (const line of arr) {
        const stockText = String(line?.stockCode || '').trim().toUpperCase()
        if (stockText === 'XAU' || stockText.includes('GOLD')) return 'XAU'
        if (stockText === 'XAG' || stockText.includes('SILV')) return 'XAG'
        const productText = `${String(line?.productType || '')} ${String(line?.narration || '')}`.toLowerCase()
        if (productText.includes('gold') || productText.includes('xau')) return 'XAU'
        if (productText.includes('silver') || productText.includes('xag')) return 'XAG'
      }
      return ''
    }
    const resolveLineMetalCode = (line = {}) => {
      const stockText = String(line?.stockCode || '').trim().toUpperCase()
      if (stockText === 'XAU' || stockText.includes('GOLD')) return 'XAU'
      if (stockText === 'XAG' || stockText.includes('SILV')) return 'XAG'
      const productText = `${String(line?.productType || '')} ${String(line?.narration || '')}`.toLowerCase()
      if (productText.includes('gold') || productText.includes('xau')) return 'XAU'
      if (productText.includes('silver') || productText.includes('xag')) return 'XAG'
      return ''
    }
    const resolveSignedPureWeight = (txType, lines = [], txMetalCode = '') => {
      const arr = Array.isArray(lines) ? lines : []
      const gross = arr.reduce((sum, line) => {
        const explicitPureWeight = Number(line?.pureWeight || 0)
        const grossWeight = Number(line?.grossWeight || 0)
        const purityValue = Number(line?.purity || 0)
        const purityRatio = purityValue > 1.2 ? (purityValue / 1000) : purityValue
        const derivedPureWeight = grossWeight > 0 && purityRatio > 0 ? (grossWeight * purityRatio) : 0
        const pw = explicitPureWeight > 0 ? explicitPureWeight : derivedPureWeight
        if (!Number.isFinite(pw) || pw <= 0) return sum
        const lineMetalCode = resolveLineMetalCode(line)
        if (txMetalCode && lineMetalCode && lineMetalCode !== txMetalCode) return sum
        return sum + pw
      }, 0)
      if (txType === 'purchase') return Number(gross || 0)
      if (txType === 'sale') return Number(-(gross || 0))
      return 0
    }
    const resolveDirectDealLineWeightGram = (line = {}) => {
      const qty = Number(line?.qty || 0)
      if (!Number.isFinite(qty) || qty <= 0) return 0
      const stockCode = String(line?.stockCode || 'OZ').trim().toUpperCase()
      if (stockCode === 'KG') return qty * 1000
      if (stockCode === 'GRAM') return qty
      return qty * 31.1034768
    }
    const resolveDirectDealLineSignedWeight = (line = {}) => {
      const grams = resolveDirectDealLineWeightGram(line)
      if (grams <= 0) return 0
      const direction = String(line?.direction || '').trim().toLowerCase()
      // Customer direction semantics:
      // buy  => company sold metal to customer => metal credit (negative sign)
      // sell => company bought metal from customer => metal debit (positive sign)
      return direction === 'buy' ? -grams : grams
    }
    const resolveDirectDealLineType = (line = {}) => {
      const direction = String(line?.direction || '').trim().toLowerCase()
      return direction === 'buy' ? 'sale' : 'purchase'
    }
    const resolveDirectDealLineMetalCode = (line = {}) => {
      return String(line?.metal || '').trim().toUpperCase() || ''
    }
    const resolveDirectDealLineIndexFromNotes = (notes = '') => {
      const match = String(notes || '').match(/line\s+(\d+)/i)
      if (!match) return -1
      const idx = Number(match[1]) - 1
      return Number.isInteger(idx) && idx >= 0 ? idx : -1
    }
    const linkedTransactions = await Transaction.find({
      isDeleted: { $ne: true },
      $or: [
        { journalEntryId: { $in: ledgerIds } },
        { _id: { $in: referenceIds } },
      ],
    })
      .select('_id journalEntryId type voucherMeta.vocNo voucherMeta.refNo voucherMeta.fixingType voucherMeta.lineItems.vatNumber voucherMeta.lineItems.stockCode voucherMeta.lineItems.productType voucherMeta.lineItems.narration voucherMeta.lineItems.pureWeight voucherMeta.lineItems.grossWeight voucherMeta.lineItems.purity')
      .lean()

    const transactionByLedgerId = new Map()
    const transactionById = new Map()
    const directDealById = new Map()
    linkedTransactions.forEach((tx) => {
      const lineTxNo = Array.isArray(tx.voucherMeta?.lineItems)
        ? String(tx.voucherMeta.lineItems.find((line) => String(line?.vatNumber || '').trim())?.vatNumber || '').trim()
        : ''
      const txNumber = String(tx.voucherMeta?.vocNo || tx.voucherMeta?.refNo || lineTxNo || '').trim()
      const txType = String(tx.type || '').trim().toLowerCase()
      const fixingStatus = normalizeFixingStatus(tx.voucherMeta?.fixingType)
      const metalCode = resolveMetalCodeFromLines(tx.voucherMeta?.lineItems)
      const hasVoucherLines = Array.isArray(tx.voucherMeta?.lineItems) && tx.voucherMeta.lineItems.length > 0
      const isMetalTrade = ['sale', 'purchase'].includes(txType) && Boolean(metalCode || hasVoucherLines)
      const metalSignedWeight = (isMetalTrade && fixingStatus === 'unfixed')
        ? resolveSignedPureWeight(txType, tx.voucherMeta?.lineItems, metalCode)
        : 0
      const txRef = {
        id: String(tx._id),
        number: txNumber,
        transactionType: txType,
        metalFixStatus: isMetalTrade ? fixingStatus : '',
        metalCode,
        isMetalTrade,
        metalSignedWeight,
      }
      if (tx.journalEntryId) transactionByLedgerId.set(String(tx.journalEntryId), txRef)
      transactionById.set(String(tx._id), txRef)
    })

    const directDealIds = ledgerEntries
      .filter((entry) => String(entry.referenceType || '').toLowerCase() === 'direct_deal' && entry.referenceId)
      .map((entry) => String(entry.referenceId))

    if (directDealIds.length > 0) {
      const directDeals = await DirectDeal.find({ _id: { $in: directDealIds }, isDeleted: { $ne: true } })
        .select('_id docNo lineItems.customerId lineItems.customerCode lineItems.customerName lineItems.direction lineItems.metal lineItems.qty lineItems.stockCode')
        .lean()

      directDeals.forEach((deal) => {
        directDealById.set(String(deal._id), deal)
      })
    }

    let runningBalance = netBalance
    const statementEntries = ledgerEntries.map((entry) => {
      const debitId = String(entry.debitAccountId?._id || entry.debitAccountId || '')
      const isDebitEntry = targetAccountIds.some((id) => String(id) === debitId)
      const entryRate = Number(entry.exchangeRate || 1)
      const convertedAmount = Number(entry.amount || 0) * entryRate
      const signedAmount = isDebitEntry ? convertedAmount : -convertedAmount
      let linkedTx = transactionByLedgerId.get(String(entry._id)) || transactionById.get(String(entry.referenceId || '')) || null
      if (!linkedTx && String(entry.referenceType || '').toLowerCase() === 'direct_deal') {
        const deal = directDealById.get(String(entry.referenceId || ''))
        if (deal) {
          const lines = Array.isArray(deal.lineItems) ? deal.lineItems : []
          const lineIndex = resolveDirectDealLineIndexFromNotes(entry.notes)
          const line = lineIndex >= 0 && lineIndex < lines.length ? lines[lineIndex] : lines[0]
          if (line) {
            const txType = resolveDirectDealLineType(line)
            linkedTx = {
              id: String(deal._id),
              number: String(deal.docNo || '').trim(),
              transactionType: txType,
              metalFixStatus: '',
              metalCode: resolveDirectDealLineMetalCode(line),
              isMetalTrade: true,
              metalSignedWeight: resolveDirectDealLineSignedWeight(line),
            }
          }
        }
      }
      const row = {
        _id: entry._id,
        date: entry.date,
        description: entry.description || entry.notes || '',
        referenceType: entry.referenceType || 'journal',
        department: entry.department || '',
        currency: entry.currency || accountCurrencyCode,
        exchangeRate: Number(entry.exchangeRate || 1),
        debitAmount: isDebitEntry ? convertedAmount : 0,
        creditAmount: isDebitEntry ? 0 : convertedAmount,
        signedAmount,
        runningBalance,
        currentValue: Number(runningBalance || 0),
        limitValue: Number(account.openingBalance || 0),
        offsetAccountCode: isDebitEntry ? (entry.creditAccountId?.accountCode || '') : (entry.debitAccountId?.accountCode || ''),
        offsetAccountName: isDebitEntry ? (entry.creditAccountId?.accountName || '') : (entry.debitAccountId?.accountName || ''),
        createdBy: entry.createdBy?.name || '',
        sourceTransactionId: linkedTx?.id || '',
        sourceTransactionNumber: linkedTx?.number || '',
        sourceTransactionType: linkedTx?.transactionType || '',
        metalDealType: ['sale', 'purchase'].includes(String(linkedTx?.transactionType || '')) ? String(linkedTx.transactionType) : '',
        metalFixStatus: linkedTx?.metalFixStatus || '',
        metalCode: linkedTx?.metalCode || '',
        isMetalTrade: Boolean(linkedTx?.isMetalTrade),
        metalSignedWeight: Number(linkedTx?.metalSignedWeight || 0),
      }
      runningBalance -= signedAmount
      return row
    })

    const positions = [
      {
        key: 'base-currency',
        type: 'Base Currency',
        limitValue: Number(account.openingBalance || 0),
        balance: Number(Math.abs(netBalance) || 0),
        price: 1,
        currentValue: Number(convertedToRateCurrency || 0),
        valueCurrency: rates.priceCurrency,
        unit: accountCurrencyCode,
      },
      {
        key: 'gold',
        type: 'Gold Equivalent',
        limitValue: 0,
        balance: Number(goldBalance || 0),
        price: Number(rates.goldPrice || 0),
        currentValue: Number(convertedToRateCurrency || 0),
        valueCurrency: rates.priceCurrency,
        unit: 'gram',
      },
      {
        key: 'silver',
        type: 'Silver Equivalent',
        limitValue: 0,
        balance: Number(silverBalance || 0),
        price: Number(rates.silverPrice || 0),
        currentValue: Number(convertedToRateCurrency || 0),
        valueCurrency: rates.priceCurrency,
        unit: 'gram',
      },
    ]

    res.json({
      success: true,
      account: {
        _id: account._id,
        accountCode: account.accountCode,
        accountName: account.accountName,
        accountType: account.accountType,
        currency: accountCurrencyCode,
        department: account.department || '',
        isActive: account.isActive,
        description: account.description || '',
        openingBalance: Number(account.openingBalance || 0),
      },
      balances: {
        debitTotal,
        creditTotal,
        netBalance,
        netDirection,
        absoluteNetBalance: Math.abs(netBalance),
        rateCurrencyBalance: convertedToRateCurrency,
        rateCurrency: baseCurrencyCode,
      },
      metals: {
        goldPrice: rates.goldPrice,
        silverPrice: rates.silverPrice,
        priceCurrency: rates.priceCurrency,
        updatedAt: rates.updatedAt,
        goldBalance,
        silverBalance,
      },
      statement: {
        limitValue: Number(account.openingBalance || 0),
        entryCount: statementEntries.length,
        entries: statementEntries,
      },
      positions,
    })
  } catch (e) {
    console.error('Account enquiry error:', e)
    res.status(500).json({ success: false, message: e?.message || 'Server error' })
  }
})

router.get('/accounts/:id', protect, async (req, res) => {
  try {
    if (!canViewAccounts(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })
    const account = await ChartOfAccount.findById(req.params.id).populate('parentAccountId')
    if (!account) return res.status(404).json({ success: false, message: 'Account not found' })
    res.json({ success: true, account })
  } catch {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.post('/accounts', protect, validateBody(accountCreateSchema), async (req, res) => {
  try {
    if (!canManageAccounts(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })
    const { accountName, accountCode, accountType, parentAccountId, currency, description } = req.body
    if (!accountName || !accountCode || !accountType) return res.status(400).json({ success: false, message: 'Required fields missing' })
    if (parentAccountId) {
      await validateAccountParentAssignment({ parentAccountId, accountType })
    }
    const account = await ChartOfAccount.create({
      accountName, accountCode, accountType, parentAccountId, currency, description, createdBy: req.user._id,
    })
    res.status(201).json({ success: true, account })
  } catch (e) {
    if (/Circular account hierarchy|Parent account not found|Account hierarchy depth/i.test(e?.message || '')) {
      return res.status(400).json({ success: false, message: e.message })
    }
    if (e?.code === 11000) {
      const existing = await ChartOfAccount.findOne({ accountCode: req.body?.accountCode })
      if (existing && existing.isActive === false) {
        return res.status(409).json({ success: false, message: 'Account code already exists and is inactive' })
      }
      return res.status(409).json({ success: false, message: 'Account code already exists' })
    }
    console.error('Create account error:', e)
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

// Bulk upsert — super_admin only, used for seeding/copying accounts across tenants
router.post('/accounts/bulk-seed', protect, async (req, res) => {
  try {
    if (!isSuperAdmin(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })
    const { accounts } = req.body
    if (!Array.isArray(accounts) || accounts.length === 0) {
      return res.status(400).json({ success: false, message: 'accounts array required' })
    }
    let created = 0, updated = 0
    for (const acc of accounts) {
      if (!acc.accountName || !acc.accountCode || !acc.accountType) continue
      const result = await ChartOfAccount.updateOne(
        { accountCode: acc.accountCode },
        { $set: { accountName: acc.accountName, accountType: acc.accountType, currency: acc.currency || 'USD', isActive: acc.isActive !== false, description: acc.description || '', openingBalance: acc.openingBalance || 0, department: acc.department || '', createdBy: req.user._id } },
        { upsert: true }
      )
      if (result.upsertedCount > 0) created++
      else updated++
    }
    res.json({ success: true, created, updated })
  } catch (e) {
    console.error('Bulk seed accounts error:', e)
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.put('/accounts/:id', protect, validateParams(idParam), validateBody(accountPatchSchema), async (req, res) => {
  try {
    if (!canManageAccounts(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })
    const existingAccount = await ChartOfAccount.findById(req.params.id).select('accountType')
    if (!existingAccount) return res.status(404).json({ success: false, message: 'Account not found' })

    const updates = {}
    const allowedFields = ['accountName', 'description', 'isActive', 'currency', 'department', 'parentAccountId']
    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) updates[field] = req.body[field]
    })
    // Allow explicitly clearing the parent (move to root)
    if (Object.prototype.hasOwnProperty.call(req.body, 'parentAccountId') && req.body.parentAccountId === null) {
      updates.parentAccountId = null
    }
    if (Object.prototype.hasOwnProperty.call(req.body, 'parentAccountId') && req.body.parentAccountId) {
      await validateAccountParentAssignment({ accountId: req.params.id, parentAccountId: req.body.parentAccountId, accountType: existingAccount.accountType })
    }
    const account = await ChartOfAccount.findByIdAndUpdate(req.params.id, updates, { new: true })
    if (!account) return res.status(404).json({ success: false, message: 'Account not found' })
    res.json({ success: true, account })
  } catch (e) {
    if (/Circular account hierarchy|Parent account not found|Account hierarchy depth/i.test(e?.message || '')) {
      return res.status(400).json({ success: false, message: e.message })
    }
    console.error('Update account error:', e)
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.delete('/accounts/:id', protect, validateParams(idParam), async (req, res) => {
  try {
    if (!canManageAccounts(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })
    const account = await ChartOfAccount.findByIdAndUpdate(req.params.id, { isActive: false }, { new: true })
    if (!account) return res.status(404).json({ success: false, message: 'Account not found' })
    res.json({ success: true, message: 'Account deactivated', account })
  } catch {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.post('/accounts/hard-delete-by-code', protect, async (req, res) => {
  const session = await mongoose.startSession()
  session.startTransaction()

  try {
    if (!isSuperAdmin(req.user)) {
      await session.abortTransaction()
      return res.status(403).json({ success: false, message: 'Forbidden' })
    }

    const codes = Array.isArray(req.body?.accountCodes)
      ? Array.from(new Set(req.body.accountCodes.map((value) => String(value || '').trim()).filter(Boolean)))
      : []

    if (!codes.length) {
      await session.abortTransaction()
      return res.status(400).json({ success: false, message: 'accountCodes array is required' })
    }

    const accounts = await ChartOfAccount.find({ accountCode: { $in: codes } }).select('_id accountCode accountName accountType').session(session)
    if (!accounts.length) {
      await session.abortTransaction()
      return res.status(404).json({ success: false, message: 'No matching accounts found' })
    }

    const accountIds = accounts.map((account) => account._id)
    const ledgerIds = await Ledger.find({
      $or: [{ debitAccountId: { $in: accountIds } }, { creditAccountId: { $in: accountIds } }],
    }).distinct('_id').session(session)

    const [
      detachedChildren,
      unlinkedCustomers,
      unlinkedVendors,
      unlinkedInventoryItems,
      deletedMappings,
      deletedTransactions,
      deletedLedger,
      deletedAccounts,
    ] = await Promise.all([
      ChartOfAccount.updateMany({ parentAccountId: { $in: accountIds } }, { $set: { parentAccountId: null } }, { session }),
      Customer.updateMany({ ledgerAccountId: { $in: accountIds } }, { $set: { ledgerAccountId: null } }, { session }),
      Vendor.updateMany({ ledgerAccountId: { $in: accountIds } }, { $set: { ledgerAccountId: null } }, { session }),
      InventoryItem.updateMany({ ledgerAccountId: { $in: accountIds } }, { $set: { ledgerAccountId: null } }, { session }),
      AccountMapping.deleteMany({
        $or: [{ debitAccountId: { $in: accountIds } }, { creditAccountId: { $in: accountIds } }],
      }, { session }),
      Transaction.deleteMany({
        $or: [
          { debitAccountId: { $in: accountIds } },
          { creditAccountId: { $in: accountIds } },
          ...(ledgerIds.length ? [{ journalEntryId: { $in: ledgerIds } }] : []),
        ],
      }, { session }),
      Ledger.deleteMany({ _id: { $in: ledgerIds } }, { session }),
      ChartOfAccount.deleteMany({ _id: { $in: accountIds } }, { session }),
    ])

    const deletedCodes = accounts.map((account) => account.accountCode)
    const missingCodes = codes.filter((code) => !deletedCodes.includes(code))

    await session.commitTransaction()
    res.json({
      success: true,
      message: 'Accounts deleted permanently',
      deleted: accounts.map((account) => ({
        id: account._id,
        accountCode: account.accountCode,
        accountName: account.accountName,
        accountType: account.accountType,
      })),
      counts: {
        detachedChildren: detachedChildren.modifiedCount || 0,
        unlinkedCustomers: unlinkedCustomers.modifiedCount || 0,
        unlinkedVendors: unlinkedVendors.modifiedCount || 0,
        unlinkedInventoryItems: unlinkedInventoryItems.modifiedCount || 0,
        deletedMappings: deletedMappings.deletedCount || 0,
        deletedTransactions: deletedTransactions.deletedCount || 0,
        deletedLedger: deletedLedger.deletedCount || 0,
        deletedAccounts: deletedAccounts.deletedCount || 0,
      },
      missingCodes,
    })
  } catch (e) {
    await session.abortTransaction()
    console.error('Hard delete accounts error:', e)
    res.status(500).json({ success: false, message: 'Server error' })
  } finally {
    await session.endSession()
  }
})

}

module.exports = {
  registerAccountsRoutes,
}
