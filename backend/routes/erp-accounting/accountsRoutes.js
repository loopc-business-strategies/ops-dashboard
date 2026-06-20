const mongoose = require('mongoose')
const { requireDestructiveAdminGuard } = require('../../middleware/destructiveAction')
const {
  shouldSuppressSpotMetalMtmForAccountEnquiry,
  computeBookedUnfixedRevaluationFromStatementRows,
} = require('../../services/erpAccounting/metalMarginPolicy')
const {
  _isUnfixedFixingType,
  accumulateUnfixedMetalFromTransactions,
  accumulateDirectDealMetalForCustomer,
  resolveDirectDealLineSignedWeight,
  resolveDirectDealLineMetalCode,
} = require('../../services/erpAccounting/metalPositionPolicy')
const { resolveTransferSignedPureWeight } = require('../../utils/metalStockVoucherTypes')
const { createReportResponseCache } = require('../../utils/reportResponseCache')
const { _getOutstandingMapForAccounts } = require('../../utils/ledgerBalanceBatch')

const enquiryCache = createReportResponseCache(180000)
const summaryAccountsCache = createReportResponseCache(120000)
const METAL_TRANSFER_LEDGER_TYPES = ['metal_receipt', 'metal_payment']

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
    _toMoney,
    parsePagination,
    getLatestMetalRate,
    getAccountSummaryScope,
    validateAccountParentAssignment,
    _canViewAccounts,
    canViewAccountSummary,
    canReadErpReferenceData,
    canManageAccounts,
    isSuperAdmin,
  } = deps

router.get('/accounts', protect, async (req, res) => {
  try {
    const isSummaryScope = String(req.query.scope || '').trim().toLowerCase() === 'summary'
    if (!canReadErpReferenceData(req.user)) {
      return res.status(403).json({ success: false, message: 'Forbidden' })
    }
    const summaryMaxLimit = 500
    const { page, limit, skip } = parsePagination(req.query, 50, isSummaryScope ? summaryMaxLimit : 5000)
    const query = { isActive: true }
    let summaryCacheKey = null
    if (isSummaryScope) {
      const scopedIds = await getAccountSummaryScope(req.user)
      if (Array.isArray(scopedIds)) {
        query._id = { $in: scopedIds }
      }
      summaryCacheKey = summaryAccountsCache.buildKey([
        req.user?.tenant || req.user?.company || 'default',
        req.user?._id || req.user?.id || 'user',
        'summary-accounts',
        page,
        limit,
      ])
      const cached = summaryAccountsCache.get(summaryCacheKey)
      if (cached) return res.json(cached)
    }
    const accountQuery = ChartOfAccount.find(query)
      .select('accountCode accountName accountType openingBalance currency isActive')
      .sort({ accountCode: 1 })
      .skip(skip)
      .limit(limit)
      .lean()
    if (!isSummaryScope) {
      accountQuery.populate('parentAccountId', 'accountName accountCode')
    }
    const [accounts, total] = await Promise.all([
      accountQuery,
      ChartOfAccount.countDocuments(query),
    ])
    const payload = { success: true, accounts, total, page, limit }
    if (isSummaryScope && summaryCacheKey) {
      summaryAccountsCache.set(summaryCacheKey, payload)
    }
    res.json(payload)
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
    const rawStatementLimit = Number(req.query.statementLimit || 150)
    const statementLimit = Math.min(Math.max(Number.isFinite(rawStatementLimit) ? rawStatementLimit : 150, 1), 500)

    const cacheKey = enquiryCache.buildKey([
      req.user?.tenant || req.user?.company || 'default',
      req.user?._id || req.user?.id || 'user',
      'account-enquiry',
      accountCode,
      statementLimit,
    ])
    const skipEnquiryCache = String(req.query.refresh || req.query.nocache || '').trim() === '1'
    const cached = skipEnquiryCache ? null : enquiryCache.get(cacheKey)
    if (cached) return res.json(cached)

    const scopedIds = await getAccountSummaryScope(req.user)
    const accountQuery = { accountCode }
    if (Array.isArray(scopedIds)) {
      accountQuery._id = { $in: scopedIds }
    }

    const accountMatches = await ChartOfAccount.find(accountQuery)
      .select('accountCode accountName accountType openingBalance currency isActive createdAt')
      .sort({ isActive: -1, createdAt: 1, _id: 1 })
      .lean()

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
    // Accounts Payable (2000) rolls up vendor sub-ledgers — not Payroll Payable (2100).
    if (account.accountCode === '2000') {
      const vendorLedgerIds = await Vendor.find({ isActive: true, deletedAt: null, ledgerAccountId: { $ne: null } }).distinct('ledgerAccountId')
      vendorLedgerIds.forEach((id) => {
        if (id && String(id) !== String(account._id)) relatedAccountIds.push(id)
      })
    }

    const scopedRelatedAccountIds = Array.isArray(scopedIds)
      ? relatedAccountIds.filter((id) => scopedIds.some((scopedId) => String(scopedId) === String(id)))
      : relatedAccountIds

    const targetAccountIds = scopedRelatedAccountIds.length ? scopedRelatedAccountIds : [account._id]

    const [linkedCustomer, linkedVendor] = await Promise.all([
      Customer.findOne({ ledgerAccountId: account._id, isActive: true }).select('_id').lean(),
      Vendor.findOne({ ledgerAccountId: account._id, deletedAt: null }).select('_id').lean(),
    ])

    const transferPartyOr = [
      { 'voucherMeta.partyAccountId': account._id },
      { 'voucherMeta.partyAccountId': String(account._id) },
    ]
    const partyCode = String(account.accountCode || '').trim()
    if (partyCode) transferPartyOr.push({ 'voucherMeta.partyCode': partyCode })
    if (linkedCustomer?._id) transferPartyOr.push({ customerId: linkedCustomer._id })
    if (linkedVendor?._id) transferPartyOr.push({ vendorId: linkedVendor._id })

    const transferMetalTxs = await Transaction.find({
      isDeleted: { $ne: true },
      status: 'posted',
      type: { $in: METAL_TRANSFER_LEDGER_TYPES },
      $or: transferPartyOr,
    })
      .select('_id type date voucherMeta.vocNo voucherMeta.refNo voucherMeta.valueDate voucherMeta.lineItems voucherMeta.partyAccountId')
      .lean()

    const transferTxIds = transferMetalTxs.map((tx) => tx._id).filter(Boolean)

    const ledgerExclusionMatch = {
      isDeleted: { $ne: true },
      ...(transferTxIds.length ? { referenceId: { $nin: transferTxIds } } : {}),
      referenceType: { $nin: METAL_TRANSFER_LEDGER_TYPES },
    }

    const [debitAgg, creditAgg, latestRate, baseCurrency] = await Promise.all([
      Ledger.aggregate([
        { $match: { debitAccountId: { $in: targetAccountIds }, ...ledgerExclusionMatch } },
        { $group: { _id: null, total: { $sum: { $multiply: ['$amount', { $ifNull: ['$exchangeRate', 1] }] } } } },
      ]),
      Ledger.aggregate([
        { $match: { creditAccountId: { $in: targetAccountIds }, ...ledgerExclusionMatch } },
        { $group: { _id: null, total: { $sum: { $multiply: ['$amount', { $ifNull: ['$exchangeRate', 1] }] } } } },
      ]),
      getLatestMetalRate(),
      Currency.findOne({ baseCurrency: true, isActive: true }).select('code').lean(),
    ])

    const debitTotal = Number(debitAgg[0]?.total || 0)
    const creditTotal = Number(creditAgg[0]?.total || 0)
    const openingBalance = Number(account.openingBalance || 0)
    const netBalance = openingBalance + debitTotal - creditTotal
    const netDirection = netBalance > 0 ? 'Debit' : netBalance < 0 ? 'Credit' : 'Flat'
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

    const baseCurrencyCode = String(baseCurrency?.code || BASE_CURRENCY_CODE || 'USD').toUpperCase()
    const accountCurrencyCode = String(account.currency || baseCurrencyCode).toUpperCase()
    const suppressMetalSpotMtm = shouldSuppressSpotMetalMtmForAccountEnquiry(account)
    // netBalance is already aggregated in base currency (amount * exchangeRate).
    const convertedToRateCurrency = Number(netBalance)

    // Metal position: unfixed sale/purchase + metal transfers + confirmed direct deals.
    // Fixed deals must affect value only, while unfixed deals affect metal balance.
    // Do NOT derive metal position from cash balance — that produces fabricated metal positions.
    let goldBalance = 0
    let silverBalance = 0

    const [customerMetalTxs, vendorMetalTxs] = await Promise.all([
      linkedCustomer
        ? Transaction.find({
            customerId: linkedCustomer._id,
            type: { $in: ['sale', 'purchase'] },
            status: 'posted',
            isDeleted: { $ne: true },
          }).select('type metalFixStatus voucherMeta.fixingType voucherMeta.lineItems').lean()
        : Promise.resolve([]),
      linkedVendor
        ? Transaction.find({
            vendorId: linkedVendor._id,
            type: { $in: ['sale', 'purchase'] },
            status: 'posted',
            isDeleted: { $ne: true },
          }).select('type metalFixStatus voucherMeta.fixingType voucherMeta.lineItems').lean()
        : Promise.resolve([]),
    ])
    const unfixedCustomerMetal = accumulateUnfixedMetalFromTransactions(customerMetalTxs)
    const unfixedVendorMetal = accumulateUnfixedMetalFromTransactions(vendorMetalTxs)
    goldBalance += unfixedCustomerMetal.gold + unfixedVendorMetal.gold
    silverBalance += unfixedCustomerMetal.silver + unfixedVendorMetal.silver

    const ledgerEntries = await Ledger.find({
      isDeleted: { $ne: true },
      $or: [{ debitAccountId: { $in: targetAccountIds } }, { creditAccountId: { $in: targetAccountIds } }],
    })
      .select('date referenceType referenceId description amount exchangeRate currency debitAccountId creditAccountId createdAt notes department')
      .populate('debitAccountId', 'accountCode accountName')
      .populate('creditAccountId', 'accountCode accountName')
      .sort({ date: -1, createdAt: -1 })
      .limit(statementLimit)
      .lean()

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
        if (stockText === 'XPT' || stockText.includes('PLAT')) return 'XPT'
        if (stockText === 'XPD' || stockText.includes('PALL')) return 'XPD'
        const productText = `${String(line?.productType || '')} ${String(line?.narration || '')}`.toLowerCase()
        if (productText.includes('gold') || productText.includes('xau')) return 'XAU'
        if (productText.includes('silver') || productText.includes('xag')) return 'XAG'
        if (productText.includes('platinum') || productText.includes('xpt')) return 'XPT'
        if (productText.includes('palladium') || productText.includes('xpd')) return 'XPD'
        if (productText.includes('other') || productText.includes('misc')) return 'OTHER'
      }
      return ''
    }
    const resolveLineMetalCode = (line = {}) => {
      const stockText = String(line?.stockCode || '').trim().toUpperCase()
      if (stockText === 'XAU' || stockText.includes('GOLD')) return 'XAU'
      if (stockText === 'XAG' || stockText.includes('SILV')) return 'XAG'
      if (stockText === 'XPT' || stockText.includes('PLAT')) return 'XPT'
      if (stockText === 'XPD' || stockText.includes('PALL')) return 'XPD'
      const productText = `${String(line?.productType || '')} ${String(line?.narration || '')}`.toLowerCase()
      if (productText.includes('gold') || productText.includes('xau')) return 'XAU'
      if (productText.includes('silver') || productText.includes('xag')) return 'XAG'
      if (productText.includes('platinum') || productText.includes('xpt')) return 'XPT'
      if (productText.includes('palladium') || productText.includes('xpd')) return 'XPD'
      if (productText.includes('other') || productText.includes('misc')) return 'OTHER'
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
    const accumulateTransferMetalFromTransactions = (metalTxs) => {
      for (const tx of metalTxs) {
        const txType = String(tx.type || '').toLowerCase()
        const lines = Array.isArray(tx.voucherMeta?.lineItems) ? tx.voucherMeta.lineItems : []
        const signedWeight = resolveTransferSignedPureWeight(txType, lines)
        if (!signedWeight) continue
        const metalCode = resolveMetalCodeFromLines(lines)
        const isSilver = metalCode === 'XAG' || lines.some((line) => {
          const sc = String(line?.stockCode || '').toUpperCase()
          return sc.includes('XAG') || sc.includes('SILV')
        })
        if (isSilver) {
          silverBalance += signedWeight
        } else {
          goldBalance += signedWeight
        }
      }
    }
    accumulateTransferMetalFromTransactions(transferMetalTxs)

    if (linkedCustomer?._id) {
      const customerDirectDeals = await DirectDeal.find({
        status: 'confirmed',
        isDeleted: { $ne: true },
        'lineItems.customerId': linkedCustomer._id,
      })
        .select('lineItems.customerId lineItems.direction lineItems.metal lineItems.qty lineItems.stockCode')
        .lean()
      const directDealMetal = accumulateDirectDealMetalForCustomer(customerDirectDeals, linkedCustomer._id)
      goldBalance += directDealMetal.gold
      silverBalance += directDealMetal.silver
    }

    const resolveDirectDealLineType = (line = {}) => {
      const direction = String(line?.direction || '').trim().toLowerCase()
      return direction === 'buy' ? 'sale' : 'purchase'
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
      .select('_id journalEntryId type amount exchangeRate voucherMeta.grandTotal voucherMeta.vocNo voucherMeta.refNo voucherMeta.fixingType voucherMeta.lineItems.vatNumber voucherMeta.lineItems.stockCode voucherMeta.lineItems.productType voucherMeta.lineItems.narration voucherMeta.lineItems.pureWeight voucherMeta.lineItems.grossWeight voucherMeta.lineItems.purity')
      .lean()

    const transactionByLedgerId = new Map()
    const transactionById = new Map()
    const directDealById = new Map()
    const transactionDisplayOffsetById = new Map()
    const referenceDisplayOffsetById = new Map()
    const documentDisplayOffsetByRef = new Map()
    linkedTransactions.forEach((tx) => {
      const lineTxNo = Array.isArray(tx.voucherMeta?.lineItems)
        ? String(tx.voucherMeta.lineItems.find((line) => String(line?.vatNumber || '').trim())?.vatNumber || '').trim()
        : ''
      const txNumber = String(tx.voucherMeta?.vocNo || tx.voucherMeta?.refNo || lineTxNo || '').trim()
      const txType = String(tx.type || '').trim().toLowerCase()
      const fixingStatus = normalizeFixingStatus(tx.voucherMeta?.fixingType)
      const metalCode = resolveMetalCodeFromLines(tx.voucherMeta?.lineItems)
      const hasVoucherLines = Array.isArray(tx.voucherMeta?.lineItems) && tx.voucherMeta.lineItems.length > 0
      const isMetalTransfer = METAL_TRANSFER_LEDGER_TYPES.includes(txType)
      const isMetalTrade = (['sale', 'purchase'].includes(txType) && Boolean(metalCode || hasVoucherLines)) || isMetalTransfer
      const voucherAmount = Number(tx.amount || tx.voucherMeta?.grandTotal || 0) * Number(tx.exchangeRate || 1)
      const metalSignedWeight = isMetalTransfer
        ? resolveTransferSignedPureWeight(txType, tx.voucherMeta?.lineItems)
        : (isMetalTrade && fixingStatus === 'unfixed')
          ? resolveSignedPureWeight(txType, tx.voucherMeta?.lineItems, metalCode)
          : 0
      const txRef = {
        id: String(tx._id),
        number: txNumber,
        transactionType: txType,
        metalFixStatus: isMetalTrade && !isMetalTransfer ? fixingStatus : '',
        metalCode,
        isMetalTrade,
        isMetalTransfer,
        metalSignedWeight,
        unfixedVoucherAmount: isMetalTrade && !isMetalTransfer && fixingStatus === 'unfixed' ? Number(voucherAmount.toFixed(2)) : 0,
      }
      if (tx.journalEntryId) transactionByLedgerId.set(String(tx.journalEntryId), txRef)
      transactionById.set(String(tx._id), txRef)
    })

    transferMetalTxs.forEach((tx) => {
      if (transactionById.has(String(tx._id))) return
      const txNumber = String(tx.voucherMeta?.vocNo || tx.voucherMeta?.refNo || '').trim()
      const txType = String(tx.type || '').trim().toLowerCase()
      const metalCode = resolveMetalCodeFromLines(tx.voucherMeta?.lineItems)
      transactionById.set(String(tx._id), {
        id: String(tx._id),
        number: txNumber,
        transactionType: txType,
        metalFixStatus: '',
        metalCode,
        isMetalTrade: true,
        isMetalTransfer: true,
        metalSignedWeight: resolveTransferSignedPureWeight(txType, tx.voucherMeta?.lineItems),
        unfixedVoucherAmount: 0,
      })
    })

    const scoreCounterpartyAccount = (candidate = {}) => {
      const code = String(candidate.accountCode || '').trim()
      const name = String(candidate.accountName || '').toLowerCase().trim()
      let score = 0
      if (/receivable|payable|creditor|debtor|customer|vendor/.test(name)) score += 8
      if (code === '1100' || code === '2000' || code === '2100') score += 8
      if (/exchange\s*gain|exchange\s*loss|forex|fx\s*gain|fx\s*loss/.test(name)) score -= 10
      if (code === '1000' || code === '1010' || /cash|bank/.test(name)) score -= 4
      return score
    }
    const isTargetAccount = (accountLike) => {
      const accountId = String(accountLike?._id || accountLike || '')
      return targetAccountIds.some((id) => String(id) === accountId)
    }
    const normalizeDocRef = (value) => String(value || '').trim().toLowerCase()
    const extractLedgerDocumentRef = (entry = {}) => {
      const text = `${String(entry.description || '')} ${String(entry.notes || '')}`
      const match = text.match(/\b((?:Pay|Receipt|Rec|BnkJV|JV|Jv)[/-]\d{4}[/-]\d{1,6})\b/i)
      return String(match?.[1] || '').trim()
    }

    if (linkedTransactions.length > 0) {
      const txIds = linkedTransactions.map((tx) => tx._id).filter(Boolean)
      const txLedgerEntries = await Ledger.find({
        isDeleted: { $ne: true },
        referenceId: { $in: txIds },
      })
        .populate('debitAccountId', 'accountCode accountName')
        .populate('creditAccountId', 'accountCode accountName')
        .select('referenceId debitAccountId creditAccountId amount exchangeRate')
        .lean()

      const txCounterpartyCandidates = new Map()
      txLedgerEntries.forEach((entry) => {
        const txId = String(entry.referenceId || '')
        if (!txId) return
        const debitAccount = entry.debitAccountId || null
        const creditAccount = entry.creditAccountId || null
        const debitId = String(debitAccount?._id || debitAccount || '')
        const creditId = String(creditAccount?._id || creditAccount || '')
        const involvesTargetOnDebit = targetAccountIds.some((id) => String(id) === debitId)
        const involvesTargetOnCredit = targetAccountIds.some((id) => String(id) === creditId)
        if (!involvesTargetOnDebit && !involvesTargetOnCredit) return

        const counterparty = involvesTargetOnDebit ? creditAccount : debitAccount
        if (!counterparty) return
        const counterpartyCode = String(counterparty.accountCode || '').trim()
        const counterpartyName = String(counterparty.accountName || '').trim()
        const amount = Number(entry.amount || 0) * Number(entry.exchangeRate || 1)
        const key = `${txId}:${counterpartyCode}:${counterpartyName}`

        const existing = txCounterpartyCandidates.get(key) || {
          txId,
          accountCode: counterpartyCode,
          accountName: counterpartyName,
          score: scoreCounterpartyAccount({ accountCode: counterpartyCode, accountName: counterpartyName }),
          amountWeight: 0,
        }
        existing.amountWeight += Math.abs(amount)
        txCounterpartyCandidates.set(key, existing)
      })

      const groupedByTx = new Map()
      for (const candidate of txCounterpartyCandidates.values()) {
        const arr = groupedByTx.get(candidate.txId) || []
        arr.push(candidate)
        groupedByTx.set(candidate.txId, arr)
      }

      for (const [txId, candidates] of groupedByTx.entries()) {
        candidates.sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score
          return b.amountWeight - a.amountWeight
        })
        const best = candidates[0]
        if (best?.accountCode || best?.accountName) {
          transactionDisplayOffsetById.set(txId, {
            accountCode: best.accountCode,
            accountName: best.accountName,
          })
        }
      }
    }

    if (referenceIds.length > 0) {
      const referencedLedgerEntries = await Ledger.find({
        isDeleted: { $ne: true },
        referenceId: { $in: referenceIds },
      })
        .populate('debitAccountId', 'accountCode accountName')
        .populate('creditAccountId', 'accountCode accountName')
        .select('referenceId debitAccountId creditAccountId amount exchangeRate')
        .lean()

      const refCounterpartyCandidates = new Map()
      referencedLedgerEntries.forEach((entry) => {
        const refId = String(entry.referenceId || '')
        if (!refId) return
        const debitAccount = entry.debitAccountId || null
        const creditAccount = entry.creditAccountId || null
        const amount = Number(entry.amount || 0) * Number(entry.exchangeRate || 1)

        ;[debitAccount, creditAccount].forEach((candidateAccount) => {
          if (!candidateAccount || isTargetAccount(candidateAccount)) return
          const counterpartyCode = String(candidateAccount.accountCode || '').trim()
          const counterpartyName = String(candidateAccount.accountName || '').trim()
          if (!counterpartyCode && !counterpartyName) return

          const key = `${refId}:${counterpartyCode}:${counterpartyName}`
          const existing = refCounterpartyCandidates.get(key) || {
            refId,
            accountCode: counterpartyCode,
            accountName: counterpartyName,
            score: scoreCounterpartyAccount({ accountCode: counterpartyCode, accountName: counterpartyName }),
            amountWeight: 0,
          }
          existing.amountWeight += Math.abs(amount)
          refCounterpartyCandidates.set(key, existing)
        })
      })

      const groupedByReference = new Map()
      for (const candidate of refCounterpartyCandidates.values()) {
        const arr = groupedByReference.get(candidate.refId) || []
        arr.push(candidate)
        groupedByReference.set(candidate.refId, arr)
      }

      for (const [refId, candidates] of groupedByReference.entries()) {
        candidates.sort((a, b) => {
          if (b.score !== a.score) return b.score - a.score
          return b.amountWeight - a.amountWeight
        })
        const best = candidates[0]
        if (best?.accountCode || best?.accountName) {
          referenceDisplayOffsetById.set(refId, {
            accountCode: best.accountCode,
            accountName: best.accountName,
          })
        }
      }
    }

    const statementDocRefs = Array.from(new Set(
      ledgerEntries
        .map((entry) => extractLedgerDocumentRef(entry))
        .filter(Boolean)
    ))

    const paymentReceiptDocRefs = statementDocRefs
      .map((ref) => String(ref || '').trim())
      .filter((ref) => /^(pay|receipt|rec)[/-]/i.test(ref))

    // Resolve payment/receipt offset accounts via posted transactions (indexed vocNo lookup).
    // Skip legacy regex scans over the full ledger — they were the main enquiry latency bottleneck.
    if (paymentReceiptDocRefs.length > 0) {
        const linkedDocTransactions = await Transaction.find({
          isDeleted: { $ne: true },
          $or: [
            { 'voucherMeta.vocNo': { $in: paymentReceiptDocRefs } },
            { 'voucherMeta.refNo': { $in: paymentReceiptDocRefs } },
          ],
        })
          .select('_id customerId vendorId voucherMeta.vocNo voucherMeta.refNo voucherMeta.partyAccountId voucherMeta.partyCode')
          .lean()

        const customerIds = Array.from(new Set(
          linkedDocTransactions
            .map((tx) => String(tx.customerId || '').trim())
            .filter(Boolean)
        ))
        const vendorIds = Array.from(new Set(
          linkedDocTransactions
            .map((tx) => String(tx.vendorId || '').trim())
            .filter(Boolean)
        ))

        const [docCustomers, docVendors] = await Promise.all([
          customerIds.length > 0
            ? Customer.find({ _id: { $in: customerIds } }).select('_id ledgerAccountId').lean()
            : Promise.resolve([]),
          vendorIds.length > 0
            ? Vendor.find({ _id: { $in: vendorIds } }).select('_id ledgerAccountId').lean()
            : Promise.resolve([]),
        ])

        const customerLedgerById = new Map(docCustomers.map((row) => [String(row._id), row.ledgerAccountId ? String(row.ledgerAccountId) : '']))
        const vendorLedgerById = new Map(docVendors.map((row) => [String(row._id), row.ledgerAccountId ? String(row.ledgerAccountId) : '']))

        const partyLedgerIds = Array.from(new Set(
          [...customerLedgerById.values(), ...vendorLedgerById.values()].filter(Boolean)
        ))
        const partyLedgerAccounts = partyLedgerIds.length > 0
          ? await ChartOfAccount.find({ _id: { $in: partyLedgerIds } }).select('_id accountCode accountName').lean()
          : []
        const partyAccountById = new Map(partyLedgerAccounts.map((row) => [String(row._id), row]))

        const directPartyLookups = Array.from(new Set(
          linkedDocTransactions
            .map((tx) => String(tx?.voucherMeta?.partyAccountId || tx?.voucherMeta?.partyCode || '').trim())
            .filter(Boolean)
        ))
        const directPartyObjectIds = directPartyLookups
          .filter((value) => mongoose.Types.ObjectId.isValid(value))
          .map((value) => new mongoose.Types.ObjectId(value))
        const directPartyCodes = directPartyLookups.filter((value) => !mongoose.Types.ObjectId.isValid(value))
        const directPartyAccounts = directPartyLookups.length > 0
          ? await ChartOfAccount.find({
            $or: [
              ...(directPartyObjectIds.length > 0 ? [{ _id: { $in: directPartyObjectIds } }] : []),
              ...(directPartyCodes.length > 0 ? [{ accountCode: { $in: directPartyCodes } }] : []),
            ],
          }).sort({ isActive: -1, createdAt: 1 }).select('_id accountCode accountName isActive').lean()
          : []
        const directPartyAccountByLookup = new Map()
        directPartyAccounts.forEach((account) => {
          const id = String(account._id || '').trim()
          const code = String(account.accountCode || '').trim()
          if (id && !directPartyAccountByLookup.has(id)) directPartyAccountByLookup.set(id, account)
          if (code && !directPartyAccountByLookup.has(code)) directPartyAccountByLookup.set(code, account)
        })

        linkedDocTransactions.forEach((tx) => {
          const docRefs = [
            normalizeDocRef(String(tx?.voucherMeta?.vocNo || '').trim()),
            normalizeDocRef(String(tx?.voucherMeta?.refNo || '').trim()),
          ].filter(Boolean)
          if (docRefs.length === 0) return

          const customerLedgerId = tx.customerId ? customerLedgerById.get(String(tx.customerId)) : ''
          const vendorLedgerId = tx.vendorId ? vendorLedgerById.get(String(tx.vendorId)) : ''
          const preferredLedgerId = customerLedgerId || vendorLedgerId
          const directPartyLookup = String(tx?.voucherMeta?.partyAccountId || tx?.voucherMeta?.partyCode || '').trim()
          const preferredAccount = (preferredLedgerId ? partyAccountById.get(String(preferredLedgerId)) : null)
            || (directPartyLookup ? directPartyAccountByLookup.get(directPartyLookup) : null)
          if (!preferredAccount || isTargetAccount(preferredAccount)) return

          const resolved = {
            accountCode: String(preferredAccount.accountCode || ''),
            accountName: String(preferredAccount.accountName || ''),
          }
          docRefs.forEach((ref) => {
            documentDisplayOffsetByRef.set(ref, resolved)
          })
        })
    }

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

    const transferTxIdSet = new Set(transferTxIds.map((id) => String(id)))
    const isMetalTransferLedger = (entry) => (
      METAL_TRANSFER_LEDGER_TYPES.includes(String(entry.referenceType || '').toLowerCase())
      || transferTxIdSet.has(String(entry.referenceId || ''))
    )
    const statementLedgerEntries = ledgerEntries.filter((entry) => !isMetalTransferLedger(entry))

    const buildLedgerStatementRow = (entry) => {
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
      const defaultOffsetCode = isDebitEntry ? (entry.creditAccountId?.accountCode || '') : (entry.debitAccountId?.accountCode || '')
      const defaultOffsetName = isDebitEntry ? (entry.creditAccountId?.accountName || '') : (entry.debitAccountId?.accountName || '')
      const linkedTxType = String(linkedTx?.transactionType || '').toLowerCase().trim()
      const referenceType = String(entry.referenceType || '').toLowerCase().trim()
      const effectiveRowType = linkedTxType || referenceType
      const txDisplayOffset = linkedTx?.id ? transactionDisplayOffsetById.get(String(linkedTx.id)) : null
      const refDisplayOffset = entry.referenceId ? referenceDisplayOffsetById.get(String(entry.referenceId)) : null
      const docDisplayOffset = documentDisplayOffsetByRef.get(normalizeDocRef(extractLedgerDocumentRef(entry))) || null
      const preferredDisplayOffset = txDisplayOffset || refDisplayOffset || docDisplayOffset || null
      const effectiveOffsetCode = (effectiveRowType === 'payment' || effectiveRowType === 'receipt') && preferredDisplayOffset
        ? String(preferredDisplayOffset.accountCode || defaultOffsetCode)
        : defaultOffsetCode
      const effectiveOffsetName = (effectiveRowType === 'payment' || effectiveRowType === 'receipt') && preferredDisplayOffset
        ? String(preferredDisplayOffset.accountName || defaultOffsetName)
        : defaultOffsetName
      const dealType = String(linkedTx?.transactionType || '')
      return {
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
        currentValue: 0,
        limitValue: Number(account.openingBalance || 0),
        offsetAccountCode: effectiveOffsetCode,
        offsetAccountName: effectiveOffsetName,
        createdBy: entry.createdBy?.name || '',
        sourceTransactionId: linkedTx?.id || '',
        sourceTransactionNumber: linkedTx?.number || '',
        sourceTransactionType: linkedTx?.transactionType || '',
        metalDealType: ['sale', 'purchase', 'metal_receipt', 'metal_payment'].includes(dealType) ? dealType : '',
        metalFixStatus: linkedTx?.metalFixStatus || '',
        metalCode: linkedTx?.metalCode || '',
        isMetalTrade: Boolean(linkedTx?.isMetalTrade),
        isMetalTransfer: Boolean(linkedTx?.isMetalTransfer),
        metalSignedWeight: Number(linkedTx?.metalSignedWeight || 0),
        unfixedVoucherAmount: Number(linkedTx?.unfixedVoucherAmount || 0),
      }
    }

    const transferStatementEntries = transferMetalTxs.map((tx) => {
      const txType = String(tx.type || '').toLowerCase()
      const lines = Array.isArray(tx.voucherMeta?.lineItems) ? tx.voucherMeta.lineItems : []
      const metalCode = resolveMetalCodeFromLines(lines)
      const txNumber = String(tx.voucherMeta?.vocNo || tx.voucherMeta?.refNo || '').trim()
      return {
        _id: `transfer:${tx._id}`,
        date: tx.voucherMeta?.valueDate || tx.date || new Date(),
        description: `${txType.replace('_', ' ')} transfer`,
        referenceType: txType,
        department: '',
        currency: accountCurrencyCode,
        exchangeRate: 1,
        debitAmount: 0,
        creditAmount: 0,
        signedAmount: 0,
        currentValue: 0,
        limitValue: Number(account.openingBalance || 0),
        offsetAccountCode: '',
        offsetAccountName: '',
        createdBy: '',
        sourceTransactionId: String(tx._id),
        sourceTransactionNumber: txNumber,
        sourceTransactionType: txType,
        metalDealType: txType,
        metalFixStatus: '',
        metalCode,
        isMetalTrade: true,
        isMetalTransfer: true,
        metalSignedWeight: resolveTransferSignedPureWeight(txType, lines),
        unfixedVoucherAmount: 0,
      }
    })

    const combinedStatementRows = [
      ...statementLedgerEntries.map(buildLedgerStatementRow),
      ...transferStatementEntries,
    ].sort((left, right) => {
      const leftDate = new Date(left.date).getTime()
      const rightDate = new Date(right.date).getTime()
      if (rightDate !== leftDate) return rightDate - leftDate
      return String(right._id).localeCompare(String(left._id))
    })

    let runningBalance = netBalance
    const statementEntries = combinedStatementRows.map((row) => {
      const signedAmount = Number(row.signedAmount || 0)
      const nextRow = {
        ...row,
        runningBalance,
        currentValue: Number(runningBalance || 0),
      }
      runningBalance -= signedAmount
      return nextRow
    })

    const bookedUnfixedRevaluation = suppressMetalSpotMtm
      ? computeBookedUnfixedRevaluationFromStatementRows(combinedStatementRows)
      : { gold: 0, silver: 0, total: 0 }

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
        currentValue: Number(goldBalance || 0) * Number(rates.goldPrice || 0),
        valueCurrency: rates.priceCurrency,
        unit: 'gram',
      },
      {
        key: 'silver',
        type: 'Silver Equivalent',
        limitValue: 0,
        balance: Number(silverBalance || 0),
        price: Number(rates.silverPrice || 0),
        currentValue: Number(silverBalance || 0) * Number(rates.silverPrice || 0),
        valueCurrency: rates.priceCurrency,
        unit: 'gram',
      },
    ]

    const enquiryPayload = {
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
        suppressMetalSpotMtm,
        bookedUnfixedRevaluation,
      },
      statement: {
        limitValue: Number(account.openingBalance || 0),
        entryCount: statementEntries.length,
        entries: statementEntries,
      },
      positions,
    }
    if (!skipEnquiryCache) enquiryCache.set(cacheKey, enquiryPayload)
    res.json(enquiryPayload)
  } catch (e) {
    console.error('Account enquiry error:', e)
    res.status(500).json({ success: false, message: e?.message || 'Server error' })
  }
})

router.get('/accounts/:id', protect, async (req, res) => {
  try {
    if (!canReadErpReferenceData(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })
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
    const { accountName, accountCode, accountType, parentAccountId, currency, description, address } = req.body
    if (!accountName || !accountCode || !accountType) return res.status(400).json({ success: false, message: 'Required fields missing' })
    if (parentAccountId) {
      await validateAccountParentAssignment({ parentAccountId, accountType })
    }
    const account = await ChartOfAccount.create({
      accountName, accountCode, accountType, parentAccountId, currency, description, address, createdBy: req.user._id,
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
        { $set: { accountName: acc.accountName, accountType: acc.accountType, currency: acc.currency || 'USD', isActive: acc.isActive !== false, description: acc.description || '', address: acc.address || '', openingBalance: acc.openingBalance || 0, department: acc.department || '', createdBy: req.user._id } },
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
    const allowedFields = ['accountName', 'description', 'address', 'isActive', 'currency', 'department', 'parentAccountId']
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
    const account = await ChartOfAccount.findByIdAndUpdate(req.params.id, updates, { returnDocument: 'after' })
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
    const account = await ChartOfAccount.findByIdAndUpdate(req.params.id, { isActive: false }, { returnDocument: 'after' })
    if (!account) return res.status(404).json({ success: false, message: 'Account not found' })
    res.json({ success: true, message: 'Account deactivated', account })
  } catch {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.post('/accounts/hard-delete-by-code', protect, requireDestructiveAdminGuard('accounts/hard-delete-by-code'), async (req, res) => {
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
      deactivatedMappings,
      softDeletedTransactions,
      softDeletedLedger,
      deactivatedAccounts,
    ] = await Promise.all([
      ChartOfAccount.updateMany({ parentAccountId: { $in: accountIds } }, { $set: { parentAccountId: null } }, { session }),
      Customer.updateMany({ ledgerAccountId: { $in: accountIds } }, { $set: { ledgerAccountId: null } }, { session }),
      Vendor.updateMany({ ledgerAccountId: { $in: accountIds } }, { $set: { ledgerAccountId: null } }, { session }),
      InventoryItem.updateMany({ ledgerAccountId: { $in: accountIds } }, { $set: { ledgerAccountId: null } }, { session }),
      AccountMapping.updateMany({
        $or: [{ debitAccountId: { $in: accountIds } }, { creditAccountId: { $in: accountIds } }],
      }, { $set: { isActive: false, updatedAt: new Date() } }, { session }),
      Transaction.updateMany({
        $or: [
          { debitAccountId: { $in: accountIds } },
          { creditAccountId: { $in: accountIds } },
          ...(ledgerIds.length ? [{ journalEntryId: { $in: ledgerIds } }] : []),
        ],
        isDeleted: { $ne: true },
      }, {
        $set: {
          isDeleted: true,
          deletedAt: new Date(),
          updatedBy: req.user._id,
        },
      }, { session }),
      Ledger.updateMany({ _id: { $in: ledgerIds }, isDeleted: { $ne: true } }, {
        $set: {
          isDeleted: true,
          deletedAt: new Date(),
          updatedBy: req.user._id,
          notes: `Soft-deleted by guarded account removal: ${req.destructiveAction.reason}`,
        },
      }, { session }),
      ChartOfAccount.updateMany({ _id: { $in: accountIds } }, {
        $set: {
          isActive: false,
          description: `Deactivated by guarded account removal: ${req.destructiveAction.reason}`,
        },
      }, { session }),
    ])

    const deletedCodes = accounts.map((account) => account.accountCode)
    const missingCodes = codes.filter((code) => !deletedCodes.includes(code))

    await session.commitTransaction()
    res.json({
      success: true,
      message: 'Accounts deactivated and related rows soft-deleted',
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
        deactivatedMappings: deactivatedMappings.modifiedCount || 0,
        softDeletedTransactions: softDeletedTransactions.modifiedCount || 0,
        softDeletedLedger: softDeletedLedger.modifiedCount || 0,
        deactivatedAccounts: deactivatedAccounts.modifiedCount || 0,
      },
      destructiveReason: req.destructiveAction.reason,
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
