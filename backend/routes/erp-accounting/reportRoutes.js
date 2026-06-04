/** Short-lived cache so many dashboard clients do not hammer the upstream spot provider. */
const metalSpotCache = {
  key: '',
  payload: null,
  expiresAt: 0,
}

/** Short-lived cache for dashboard report responses (per tenant + period). */
const dashboardReportCache = new Map()
const DASHBOARD_CACHE_TTL_MS = 120000

const { createReportResponseCache } = require('../../utils/reportResponseCache')
const rateLimit = require('express-rate-limit')
const reportCache = createReportResponseCache(60000)

const {
  getOutstandingMapForAccounts,
  getAgingMapForAccounts,
  loadAccountMetaMap,
  buildMonthlyCashFlow,
  computeCustomerPeriodMetrics,
  getLedgerEntryAmount,
  isDashboardExpenseLedgerEntry,
  getDashboardExpenseCategory,
} = require('../../utils/ledgerBalanceBatch')

const {
  fetchFredPreciousMetalSpotBundle,
  fetchAlphaVantagePreciousMetalSpotBundle,
  fetchSilvDataPreciousMetalSpotBundle,
} = require('../../services/metalSpotFeeds')
const {
  isMockRealtimeMetalsSpotEnabled,
  advanceMockMetals,
} = require('../../services/metalSpotMockRealtime')
const {
  computeMarginMetricsRaw,
  shouldSuppressSpotMetalMtmForCustomerDashboard,
} = require('../../services/erpAccounting/metalMarginPolicy')
const { createMetalPricingHelpers } = require('./reportRoutesMetalPricing')

function registerReportRoutes(deps) {
  const {
    router,
    protect,
    Ledger,
    ChartOfAccount,
    AccountMapping,
    Customer,
    Vendor,
    Transaction,
    DirectDeal,
    InventoryItem,
    StockMovement,
    MetalRate,
    Currency,
    getLatestMetalRate,
    DEFAULT_METAL_RATES,
    toMoney,
    parseBool,
    buildDateQuery,
    buildPreviousPeriod,
    buildProfitLossSummary,
    buildProfitLossComparisons,
    buildBalanceSheetSummary,
    buildBalanceSheetComparisons,
    getAgingForAccount,
    getOutstandingForAccount,
    buildDocumentExpiryBuckets,
    evaluateVendorCompliance,
    canAccessReports,
    canReadErpDashboardReport,
  } = deps

  const {
    isUnfixedFixingType,
    roundPosition,
    calculateMarginMetrics,
    normalizeMetalPayload,
    getCurrencyMultiplier,
    buildInventoryMetalPriceMap,
    normalizeMetalsDevApiKey,
    fetchExternalMetalPrices,
    buildFallbackMetalPrices,
    buildMetalRates,
  } = createMetalPricingHelpers(
    { Currency, InventoryItem, MetalRate, toMoney },
    computeMarginMetricsRaw,
  )

  const isProduction = process.env.NODE_ENV === 'production'
  const reportExportLimiter = rateLimit({
    windowMs: Number(process.env.ERP_REPORT_RATE_LIMIT_WINDOW_MS || 60 * 1000),
    max: Number(process.env.ERP_REPORT_RATE_LIMIT_MAX || 30),
    standardHeaders: true,
    legacyHeaders: false,
    skip: () => !isProduction,
    message: { success: false, message: 'Too many report requests. Please wait and try again.' },
  })

router.get('/reports/trial-balance', protect, reportExportLimiter, async (req, res) => {
  try {
    if (!canAccessReports(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })
    const {
      startDate,
      endDate,
      accountType,
      includeZero = 'true',
      sortBy = 'accountCode',
      sortDir = 'asc',
      minAbsolute = '0',
    } = req.query
    const cacheKey = reportCache.buildKey([
      req.user?.tenant || req.user?.company || 'default',
      'trial-balance',
      startDate,
      endDate,
      accountType,
      includeZero,
      sortBy,
      sortDir,
      minAbsolute,
    ])
    const cached = reportCache.get(cacheKey)
    if (cached) return res.json(cached)
    const query = { isDeleted: { $ne: true } }
    const dateQuery = buildDateQuery(startDate, endDate)
    if (dateQuery) query.date = dateQuery

    const accountDocs = await ChartOfAccount.find({ isActive: true }).select('accountCode accountName accountType openingBalance')
    const accountById = new Map(accountDocs.map((acc) => [String(acc._id), acc]))

    const entries = await Ledger.find(query)
      .select('debitAccountId creditAccountId amount exchangeRate')
      .lean()

    const accountTotals = new Map()

    // Seed opening balances from account master so accounts without period movement still show their true balance.
    accountDocs.forEach((acc) => {
      accountTotals.set(String(acc._id), {
        account: acc,
        debit: 0,
        credit: 0,
        openingNet: Number(acc.openingBalance || 0),
      })
    })

    // When a start date is provided, include brought-forward movement prior to the period.
    if (startDate) {
      const broughtForwardEntries = await Ledger.find({
        isDeleted: { $ne: true },
        date: { $lt: new Date(startDate) },
      }).select('debitAccountId creditAccountId amount exchangeRate')

      broughtForwardEntries.forEach((entry) => {
        const amount = Number(entry.amount || 0) * Number(entry.exchangeRate || 1)
        const debitKey = String(entry.debitAccountId || '')
        const creditKey = String(entry.creditAccountId || '')

        if (debitKey && accountById.has(debitKey)) {
          if (!accountTotals.has(debitKey)) {
            accountTotals.set(debitKey, { account: accountById.get(debitKey), debit: 0, credit: 0, openingNet: 0 })
          }
          accountTotals.get(debitKey).openingNet += amount
        }

        if (creditKey && accountById.has(creditKey)) {
          if (!accountTotals.has(creditKey)) {
            accountTotals.set(creditKey, { account: accountById.get(creditKey), debit: 0, credit: 0, openingNet: 0 })
          }
          accountTotals.get(creditKey).openingNet -= amount
        }
      })
    }
    entries.forEach((entry) => {
      const debitKey = String(entry.debitAccountId || '')
      const creditKey = String(entry.creditAccountId || '')
      const amount = Number(entry.amount || 0) * Number(entry.exchangeRate || 1)
      const debitAccount = accountById.get(debitKey)
      const creditAccount = accountById.get(creditKey)
      if (!debitAccount || !creditAccount) return

      if (!accountTotals.has(debitKey)) {
        accountTotals.set(debitKey, { account: debitAccount, debit: 0, credit: 0, openingNet: 0 })
      }
      if (!accountTotals.has(creditKey)) {
        accountTotals.set(creditKey, { account: creditAccount, debit: 0, credit: 0, openingNet: 0 })
      }

      accountTotals.get(debitKey).debit += amount
      accountTotals.get(creditKey).credit += amount
    })

    let trialBalance = Array.from(accountTotals.values()).map((item) => ({
      accountName: item.account.accountName,
      accountCode: item.account.accountCode,
      accountType: item.account.accountType,
      debit: toMoney(item.debit),
      credit: toMoney(item.credit),
      net: toMoney(Number(item.openingNet || 0) + item.debit - item.credit),
    }))

    if (parseBool(includeZero, true)) {
      const allAccountsQuery = { isActive: true }
      if (accountType) allAccountsQuery.accountType = accountType
      const allAccounts = await ChartOfAccount.find(allAccountsQuery).select('accountCode accountName accountType openingBalance')
      const existingCodes = new Set(trialBalance.map((row) => row.accountCode))
      allAccounts.forEach((acc) => {
        if (!existingCodes.has(acc.accountCode)) {
          const opening = Number(acc.openingBalance || 0)
          trialBalance.push({
            accountName: acc.accountName,
            accountCode: acc.accountCode,
            accountType: acc.accountType,
            debit: 0,
            credit: 0,
            net: toMoney(opening),
          })
        }
      })
    }

    // When includeZero is false, omit accounts with zero net balance (checkbox label). Includes
    // wash rows (debit = credit, net ~0). Each removed row drops equal debit and credit, so totals stay balanced.
    const TRIAL_BALANCE_NET_ZERO_EPS = 1e-6
    if (!parseBool(includeZero, true)) {
      trialBalance = trialBalance.filter((row) => {
        const n = Math.abs(Number(row.net ?? 0))
        return n > TRIAL_BALANCE_NET_ZERO_EPS
      })
    }

    if (accountType) {
      trialBalance = trialBalance.filter((row) => row.accountType === accountType)
    }

    const minAbsoluteValue = Number(minAbsolute || 0)
    if (minAbsoluteValue > 0) {
      trialBalance = trialBalance.filter((row) => Math.abs(Number(row.net || 0)) >= minAbsoluteValue)
    }

    const sortMultiplier = String(sortDir).toLowerCase() === 'desc' ? -1 : 1
    const sortable = ['accountCode', 'accountName', 'accountType', 'debit', 'credit', 'net'].includes(sortBy) ? sortBy : 'accountCode'
    trialBalance.sort((a, b) => {
      if (['debit', 'credit', 'net'].includes(sortable)) {
        return (Number(a[sortable] || 0) - Number(b[sortable] || 0)) * sortMultiplier
      }
      return String(a[sortable] || '').localeCompare(String(b[sortable] || '')) * sortMultiplier
    })

    const totalDebit = trialBalance.reduce((sum, item) => sum + item.debit, 0)
    const totalCredit = trialBalance.reduce((sum, item) => sum + item.credit, 0)
    const byType = trialBalance.reduce((acc, row) => {
      const key = row.accountType || 'Unknown'
      if (!acc[key]) acc[key] = { debit: 0, credit: 0, net: 0 }
      acc[key].debit += Number(row.debit || 0)
      acc[key].credit += Number(row.credit || 0)
      acc[key].net += Number(row.net || 0)
      return acc
    }, {})

    const payload = {
      success: true,
      period: { startDate: startDate || null, endDate: endDate || null },
      trialBalance,
      totalDebit: toMoney(totalDebit),
      totalCredit: toMoney(totalCredit),
      difference: toMoney(totalDebit - totalCredit),
      balanced: Math.abs(totalDebit - totalCredit) < 0.01,
      byType,
      rowCount: trialBalance.length,
      generatedAt: new Date(),
    }
    reportCache.set(cacheKey, payload)
    res.json(payload)
  } catch {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.get('/reports/ledger', protect, reportExportLimiter, async (req, res) => {
  try {
    if (!canAccessReports(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })
    const { accountId, startDate, endDate } = req.query
    if (!accountId) return res.status(400).json({ success: false, message: 'Account ID required' })

    const query = {
      isDeleted: { $ne: true },
      $or: [{ debitAccountId: accountId }, { creditAccountId: accountId }],
    }
    if (startDate || endDate) {
      query.date = {}
      if (startDate) {
        query.date.$gte = new Date(startDate)
      }
      if (endDate) {
        const inclusiveEnd = new Date(endDate)
        inclusiveEnd.setHours(23, 59, 59, 999)
        query.date.$lte = inclusiveEnd
      }
    }

    const entries = await Ledger.find(query)
      .populate('debitAccountId', 'accountName accountCode')
      .populate('creditAccountId', 'accountName accountCode')
      .sort({ date: 1, createdAt: 1 })

    const targetAccountId = String(accountId)
    let runningBalance = 0
    const report = entries.map((entry) => {
      const debitId = String(entry?.debitAccountId?._id || entry?.debitAccountId || '')
      const creditId = String(entry?.creditAccountId?._id || entry?.creditAccountId || '')
      const lineAmount = Number(entry.amount || 0) * Number(entry.exchangeRate || 1)

      // If target account is on debit side, running moves positive; credit side moves negative.
      const amount = debitId === targetAccountId ? lineAmount : (creditId === targetAccountId ? -lineAmount : 0)
      runningBalance += amount

      const debitAccount = entry?.debitAccountId && typeof entry.debitAccountId === 'object'
        ? entry.debitAccountId
        : { accountCode: '', accountName: '' }
      const creditAccount = entry?.creditAccountId && typeof entry.creditAccountId === 'object'
        ? entry.creditAccountId
        : { accountCode: '', accountName: '' }

      return {
        entryId: entry._id,
        date: entry.date,
        referenceType: entry.referenceType,
        description: entry.description,
        currency: entry.currency,
        amount: toMoney(lineAmount),
        debitAccount,
        creditAccount,
        debit: debitId === targetAccountId ? toMoney(lineAmount) : 0,
        credit: creditId === targetAccountId ? toMoney(lineAmount) : 0,
        runningBalance,
      }
    })

    res.json({ success: true, report })
  } catch {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.get('/reports/profit-loss', protect, reportExportLimiter, async (req, res) => {
  try {
    if (!canAccessReports(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })
    const { startDate, endDate, comparePrevious = 'false', includeZero = 'false', includeComparisons = 'true' } = req.query
    const includeZeroRows = parseBool(includeZero, false)
    const withComparisons = parseBool(includeComparisons, true)
    const cacheKey = reportCache.buildKey([
      req.user?.tenant || req.user?.company || 'default',
      'profit-loss',
      startDate,
      endDate,
      comparePrevious,
      includeZero,
      includeComparisons,
    ])
    const cached = reportCache.get(cacheKey)
    if (cached) return res.json(cached)

    const comparisonAnchor = endDate ? new Date(endDate) : new Date()
    const [currentPeriod, comparisonData, previousPeriodData] = await Promise.all([
      buildProfitLossSummary(startDate, endDate, includeZeroRows),
      withComparisons ? buildProfitLossComparisons(comparisonAnchor, includeZeroRows) : Promise.resolve({ monthlyComparison: [], quarterlyComparison: [] }),
      (async () => {
        if (!parseBool(comparePrevious, false) || !startDate || !endDate) return null
        const prevRange = buildPreviousPeriod(startDate, endDate)
        if (!prevRange) return null
        const prevSummary = await buildProfitLossSummary(prevRange.startDate, prevRange.endDate, includeZeroRows)
        return {
          startDate: prevRange.startDate,
          endDate: prevRange.endDate,
          totalIncome: prevSummary.totalIncome,
          totalExpense: prevSummary.totalExpense,
          netProfit: prevSummary.netProfit,
        }
      })(),
    ])

    const previousPeriod = previousPeriodData
    const netProfit = currentPeriod.netProfit
    const prevNet = Number(previousPeriod?.netProfit || 0)
    const varianceVsPrevious = previousPeriod ? toMoney(Number(netProfit) - prevNet) : null

    const payload = {
      success: true,
      period: { startDate: startDate || null, endDate: endDate || null },
      totalIncome: currentPeriod.totalIncome,
      totalExpense: currentPeriod.totalExpense,
      netProfit,
      incomeBreakdown: currentPeriod.incomeBreakdown,
      expenseBreakdown: currentPeriod.expenseBreakdown,
      topIncome: currentPeriod.topIncome,
      topExpenses: currentPeriod.topExpenses,
      grossMarginPct: currentPeriod.grossMarginPct,
      previousPeriod,
      varianceVsPrevious,
      monthlyComparison: comparisonData.monthlyComparison,
      quarterlyComparison: comparisonData.quarterlyComparison,
      generatedAt: new Date(),
    }
    reportCache.set(cacheKey, payload)
    res.json(payload)
  } catch {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.get('/reports/balance-sheet', protect, reportExportLimiter, async (req, res) => {
  try {
    if (!canAccessReports(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })
    const { endDate, includeComparisons = 'true' } = req.query
    const withComparisons = parseBool(includeComparisons, true)
    const cacheKey = reportCache.buildKey([
      req.user?.tenant || req.user?.company || 'default',
      'balance-sheet',
      endDate,
      includeComparisons,
    ])
    const cached = reportCache.get(cacheKey)
    if (cached) return res.json(cached)

    const anchorDate = endDate ? new Date(endDate) : new Date()
    const [snapshot, comparisonData] = await Promise.all([
      buildBalanceSheetSummary(endDate),
      withComparisons ? buildBalanceSheetComparisons(anchorDate) : Promise.resolve({ monthlyComparison: [], quarterlyComparison: [] }),
    ])

    const payload = {
      success: true,
      asOfDate: endDate || null,
      assets: snapshot.assets,
      liabilities: snapshot.liabilities,
      equity: snapshot.equity,
      totalAssets: snapshot.totalAssets,
      totalLiabilities: snapshot.totalLiabilities,
      totalEquity: snapshot.totalEquity,
      liabilitiesPlusEquity: snapshot.liabilitiesPlusEquity,
      difference: snapshot.difference,
      currentAssets: snapshot.currentAssets,
      currentLiabilities: snapshot.currentLiabilities,
      workingCapital: snapshot.workingCapital,
      currentRatio: snapshot.currentRatio,
      balanced: snapshot.balanced,
      monthlyComparison: comparisonData.monthlyComparison,
      quarterlyComparison: comparisonData.quarterlyComparison,
      generatedAt: new Date(),
    }
    reportCache.set(cacheKey, payload)
    res.json(payload)
  } catch {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.get('/reports/day-book', protect, reportExportLimiter, async (req, res) => {
  try {
    if (!canAccessReports(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })
    const { startDate, endDate, referenceType, minAmount = '0' } = req.query
    const query = {
      isDeleted: { $ne: true },
      amount: { $gt: 0 },
      debitAccountId: { $ne: null },
      creditAccountId: { $ne: null },
    }
    const dateQuery = buildDateQuery(startDate, endDate)
    if (dateQuery) query.date = dateQuery
    if (referenceType) query.referenceType = referenceType
    if (Number(minAmount || 0) > 0) query.amount = { $gte: Number(minAmount) }

    const [accountDocs, rawEntries] = await Promise.all([
      ChartOfAccount.find({ isActive: true }).select('_id accountCode accountName').lean(),
      Ledger.find(query)
        .select('date referenceType amount exchangeRate debitAccountId creditAccountId description createdAt')
        .sort({ date: 1, createdAt: 1 })
        .lean(),
    ])
    const accountById = new Map(accountDocs.map((acc) => [String(acc._id), acc]))
    const entries = rawEntries.map((entry) => ({
      ...entry,
      debitAccountId: accountById.get(String(entry.debitAccountId)) || entry.debitAccountId,
      creditAccountId: accountById.get(String(entry.creditAccountId)) || entry.creditAccountId,
    }))

    const totals = entries.reduce((acc, entry) => {
      const amount = Number(entry.amount || 0) * Number(entry.exchangeRate || 1)
      acc.debit += amount
      acc.credit += amount
      acc.count += 1
      return acc
    }, { debit: 0, credit: 0, count: 0 })

    const summaryByType = entries.reduce((acc, entry) => {
      const key = entry.referenceType || 'journal'
      if (!acc[key]) acc[key] = { count: 0, amount: 0 }
      acc[key].count += 1
      acc[key].amount += Number(entry.amount || 0) * Number(entry.exchangeRate || 1)
      return acc
    }, {})

    res.json({
      success: true,
      period: { startDate: startDate || null, endDate: endDate || null },
      entries,
      totals: {
        debit: toMoney(totals.debit),
        credit: toMoney(totals.credit),
        count: totals.count,
      },
      summaryByType,
      generatedAt: new Date(),
    })
  } catch {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.get('/reports/customer-outstanding', protect, reportExportLimiter, async (req, res) => {
  try {
    if (!canAccessReports(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })
    const cacheKey = reportCache.buildKey([req.user?.tenant || req.user?.company || 'default', 'customer-outstanding'])
    const cached = reportCache.get(cacheKey)
    if (cached) return res.json(cached)

    const customers = await Customer.find({ isActive: true }).populate('ledgerAccountId', 'accountCode accountName').lean()
    const ledgerAccountIds = customers.map((customer) => customer.ledgerAccountId?._id).filter(Boolean)
    const agingMap = await getAgingMapForAccounts(Ledger, ledgerAccountIds)

    const rows = customers.map((customer) => {
      const ledgerId = customer.ledgerAccountId?._id
      const aging = ledgerId
        ? (agingMap.get(String(ledgerId)) || {
          bucket0to30: 0,
          bucket31to60: 0,
          bucket61to90: 0,
          bucket90Plus: 0,
          total: 0,
        })
        : { bucket0to30: 0, bucket31to60: 0, bucket61to90: 0, bucket90Plus: 0, total: 0 }
      return {
        customerId: customer._id,
        customerName: customer.name,
        ledgerAccount: customer.ledgerAccountId,
        outstanding: toMoney(aging.total),
        aging,
        creditLimit: toMoney(customer.creditLimit || 0),
        limitExceeded: Number(aging.total || 0) > Number(customer.creditLimit || 0) && Number(customer.creditLimit || 0) > 0,
      }
    })

    const totals = rows.reduce((acc, row) => {
      acc.outstanding += Number(row.outstanding || 0)
      acc.bucket0to30 += Number(row.aging?.bucket0to30 || 0)
      acc.bucket31to60 += Number(row.aging?.bucket31to60 || 0)
      acc.bucket61to90 += Number(row.aging?.bucket61to90 || 0)
      acc.bucket90Plus += Number(row.aging?.bucket90Plus || 0)
      if (row.limitExceeded) acc.limitExceededCount += 1
      return acc
    }, { outstanding: 0, bucket0to30: 0, bucket31to60: 0, bucket61to90: 0, bucket90Plus: 0, limitExceededCount: 0 })

    const payload = {
      success: true,
      rows,
      totals: {
        outstanding: toMoney(totals.outstanding),
        bucket0to30: toMoney(totals.bucket0to30),
        bucket31to60: toMoney(totals.bucket31to60),
        bucket61to90: toMoney(totals.bucket61to90),
        bucket90Plus: toMoney(totals.bucket90Plus),
        limitExceededCount: totals.limitExceededCount,
      },
      generatedAt: new Date(),
    }
    reportCache.set(cacheKey, payload)
    res.json(payload)
  } catch {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.get('/reports/vendor-outstanding', protect, reportExportLimiter, async (req, res) => {
  try {
    if (!canAccessReports(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })
    const cacheKey = reportCache.buildKey([req.user?.tenant || req.user?.company || 'default', 'vendor-outstanding'])
    const cached = reportCache.get(cacheKey)
    if (cached) return res.json(cached)

    const vendors = await Vendor.find({ isActive: true, deletedAt: null }).populate('ledgerAccountId', 'accountCode accountName').lean()
    const ledgerAccountIds = vendors.map((vendor) => vendor.ledgerAccountId?._id).filter(Boolean)
    const outstandingMap = await getOutstandingMapForAccounts(Ledger, ledgerAccountIds)

    const rows = vendors.map((vendor) => {
      const outstanding = vendor.ledgerAccountId?._id
        ? Number(outstandingMap.get(String(vendor.ledgerAccountId._id)) || 0)
        : 0
      return {
        vendorId: vendor._id,
        vendorName: vendor.name,
        ledgerAccount: vendor.ledgerAccountId,
        outstanding: toMoney(Math.abs(outstanding)),
        outstandingType: outstanding >= 0 ? 'Debit' : 'Credit',
      }
    })

    const totals = rows.reduce((acc, row) => {
      acc.outstanding += Number(row.outstanding || 0)
      if (row.outstandingType === 'Credit') acc.credit += Number(row.outstanding || 0)
      if (row.outstandingType === 'Debit') acc.debit += Number(row.outstanding || 0)
      return acc
    }, { outstanding: 0, credit: 0, debit: 0 })

    const payload = {
      success: true,
      rows,
      totals: {
        outstanding: toMoney(totals.outstanding),
        credit: toMoney(totals.credit),
        debit: toMoney(totals.debit),
      },
      generatedAt: new Date(),
    }
    reportCache.set(cacheKey, payload)
    res.json(payload)
  } catch {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.get('/reports/forex-gain-loss', protect, reportExportLimiter, async (req, res) => {
  try {
    if (!canAccessReports(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })
    const { startDate, endDate } = req.query
    const query = { isDeleted: { $ne: true } }
    const dateQuery = buildDateQuery(startDate, endDate)
    if (dateQuery) query.date = dateQuery

    // FX report should reflect realized FX postings, not only rows with exchangeRate != 1.
    // Pull dedicated FX accounts and summarize ledger lines that hit those accounts.
    const fxAccounts = await ChartOfAccount.find({
      isActive: true,
      $or: [
        { accountCode: { $in: ['4190', '5190'] } },
        { accountName: /exchange gain|exchange loss|fx gain|fx loss/i },
      ],
    }).select('_id accountCode accountName')

    const gainAccountIds = new Set(
      fxAccounts
        .filter((acc) => String(acc.accountCode || '').trim() === '4190' || /exchange gain|fx gain/i.test(String(acc.accountName || '')))
        .map((acc) => String(acc._id))
    )
    const lossAccountIds = new Set(
      fxAccounts
        .filter((acc) => String(acc.accountCode || '').trim() === '5190' || /exchange loss|fx loss/i.test(String(acc.accountName || '')))
        .map((acc) => String(acc._id))
    )

    if (gainAccountIds.size === 0 && lossAccountIds.size === 0) {
      return res.json({
        success: true,
        entriesCount: 0,
        forexImpact: 0,
        exchangeGainTotal: 0,
        exchangeLossTotal: 0,
        netFxImpact: 0,
        byCurrency: {},
        generatedAt: new Date(),
      })
    }

    const fxAccountIds = Array.from(new Set([...gainAccountIds, ...lossAccountIds]))
    query.$or = [
      { debitAccountId: { $in: fxAccountIds } },
      { creditAccountId: { $in: fxAccountIds } },
    ]

    const entries = await Ledger.find(query).select('debitAccountId creditAccountId amount exchangeRate currency')

    let netImpact = 0
    let gainTotal = 0
    let lossTotal = 0
    const byCurrency = entries.reduce((acc, entry) => {
      const amount = Number(entry.amount || 0) * Number(entry.exchangeRate || 1)
      if (!Number.isFinite(amount) || amount === 0) return acc

      const debitId = String(entry.debitAccountId || '')
      const creditId = String(entry.creditAccountId || '')
      const key = String(entry.currency || 'BASE')

      // Net effect convention: gains increase net, losses decrease net.
      let impact = 0
      if (gainAccountIds.has(creditId)) {
        impact += amount
        gainTotal += amount
      }
      if (gainAccountIds.has(debitId)) {
        impact -= amount
        gainTotal -= amount
      }
      if (lossAccountIds.has(debitId)) {
        impact -= amount
        lossTotal += amount
      }
      if (lossAccountIds.has(creditId)) {
        impact += amount
        lossTotal -= amount
      }

      if (!acc[key]) acc[key] = { count: 0, impact: 0 }
      acc[key].count += 1
      acc[key].impact += impact
      netImpact += impact
      return acc
    }, {})

    const byCurrencyRounded = Object.fromEntries(
      Object.entries(byCurrency).map(([currency, row]) => [
        currency,
        {
          count: row.count,
          impact: toMoney(row.impact),
        },
      ])
    )

    res.json({
      success: true,
      entriesCount: entries.length,
      forexImpact: toMoney(netImpact),
      exchangeGainTotal: toMoney(gainTotal),
      exchangeLossTotal: toMoney(lossTotal),
      netFxImpact: toMoney(netImpact),
      byCurrency: byCurrencyRounded,
      generatedAt: new Date(),
    })
  } catch {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

  const scaleUsdPerOzMetalsToRequest = async (metalsObj, targetCurrency, targetUnit) => {
    const mult = await getCurrencyMultiplier('USD', String(targetCurrency || 'USD').toUpperCase())
    const unitFactor =
      String(targetUnit || 'toz').toLowerCase() === 'g'
        ? 1 / 31.1034768
        : String(targetUnit || 'toz').toLowerCase() === 'kg'
          ? 32.1507465686
          : 1
    const out = {}
    for (const k of ['gold', 'silver', 'platinum', 'palladium']) {
      const raw = Number(metalsObj[k] || 0)
      out[k] = Number.isFinite(raw) && raw > 0 ? toMoney(raw * mult * unitFactor) : 0
    }
    return out
  }

  const buildMarketPricesBody = async ({ currency, unit, cacheBypass }) => {
    const cacheKey = `${currency}:${unit}`
    const now = Date.now()
    const mockRealtime = isMockRealtimeMetalsSpotEnabled()

    if (!cacheBypass && !mockRealtime && metalSpotCache.key === cacheKey && metalSpotCache.payload && metalSpotCache.expiresAt > now) {
      return {
        body: {
          ...metalSpotCache.payload,
          generatedAt: new Date(),
          cached: true,
        },
      }
    }

    const apiKeyMd = normalizeMetalsDevApiKey(process.env.METALS_DEV_API_KEY || process.env.METALS_API_KEY || '')
    const defaultMetalsDev = 'https://api.metals.dev/v1/latest'
    const configuredUrl = String(process.env.METALS_MARKET_URL || '').trim()
    const targetUrl = configuredUrl || defaultMetalsDev
    const norm = (u) => String(u || '').trim().replace(/\/+$/, '').toLowerCase()
    const usingDefaultMetalsDev = norm(targetUrl) === norm(defaultMetalsDev)
    const canTryMetalsDev = !usingDefaultMetalsDev || Boolean(apiKeyMd)
    const fredKey = String(process.env.FRED_API_KEY || '').trim()
    const alphaKey = String(process.env.METALS_ALPHA_VANTAGE_API_KEY || process.env.ALPHA_VANTAGE_API_KEY || '').trim()

    let market
    const liveErrors = []

    if (mockRealtime) {
      const { metals: usdTozMetals } = advanceMockMetals()
      market = {
        source: 'mock-realtime',
        currency: 'USD',
        unit: 'toz',
        updatedAt: new Date(),
        metals: { ...usdTozMetals },
      }
      market.metals = await scaleUsdPerOzMetalsToRequest(market.metals, currency, unit)
      market.currency = String(currency || 'USD').toUpperCase()
      market.unit = String(unit || 'toz').toLowerCase()
      market.feedStatus = 'live'
      market.warning =
        'Synthetic spot (METALS_SPOT_MOCK_REALTIME) — for UI / latency testing only, not real prices.'
      const ttlMs = 0
      const body = {
        success: true,
        ...market,
        generatedAt: new Date(),
      }
      return { body, ttlMs }
    }

    if (canTryMetalsDev) {
      try {
        market = await fetchExternalMetalPrices({ currency, unit })
      } catch (e) {
        liveErrors.push(e.message)
      }
    }

    if (!market) {
      try {
        const rawSilv = await fetchSilvDataPreciousMetalSpotBundle()
        market = {
          ...rawSilv,
          metals: await scaleUsdPerOzMetalsToRequest(rawSilv.metals, currency, unit),
          currency: String(currency || 'USD').toUpperCase(),
          unit: String(unit || 'toz').toLowerCase(),
        }
      } catch (e) {
        liveErrors.push(e.message)
      }
    }

    if (!market && fredKey) {
      try {
        const rawFred = await fetchFredPreciousMetalSpotBundle()
        market = {
          ...rawFred,
          metals: await scaleUsdPerOzMetalsToRequest(rawFred.metals, currency, unit),
          currency: String(currency || 'USD').toUpperCase(),
          unit: String(unit || 'toz').toLowerCase(),
        }
      } catch (e) {
        liveErrors.push(e.message)
      }
    }

    if (!market && alphaKey) {
      try {
        const rawAv = await fetchAlphaVantagePreciousMetalSpotBundle({ apiKey: alphaKey })
        market = {
          ...rawAv,
          metals: await scaleUsdPerOzMetalsToRequest(rawAv.metals, currency, unit),
          currency: String(currency || 'USD').toUpperCase(),
          unit: String(unit || 'toz').toLowerCase(),
        }
      } catch (e) {
        liveErrors.push(e.message)
      }
    }

    if (!market) {
      market = await buildFallbackMetalPrices({ currency, unit })
      market.feedStatus = 'fallback'
      market.warning = liveErrors[0] || 'Live feed unavailable'
    } else {
      market.feedStatus = 'live'
      market.warning = ''
    }

    const ttlMs = market.feedStatus === 'live'
      ? Math.max(1000, Math.min(15000, Number(process.env.METALS_SPOT_CACHE_MS || 1500)))
      : Math.max(8000, Math.min(120000, Number(process.env.METALS_SPOT_FALLBACK_CACHE_MS || 20000)))

    const body = {
      success: true,
      ...market,
      generatedAt: new Date(),
    }

    metalSpotCache.key = cacheKey
    metalSpotCache.payload = body
    metalSpotCache.expiresAt = now + ttlMs

    return { body, ttlMs }
  }

router.get('/reports/market-prices', protect, async (req, res) => {
  try {
    if (!canAccessReports(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })

    const currency = String(req.query.currency || 'USD').trim().toUpperCase()
    const unit = String(req.query.unit || 'toz').trim().toLowerCase()
    const cacheBypass = String(req.query.nocache || '').toLowerCase() === '1' || String(req.query.fresh || '').toLowerCase() === '1'

    const { body } = await buildMarketPricesBody({ currency, unit, cacheBypass })
    res.json(body)
  } catch (err) {
    console.error('[reports] market-prices error:', err)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

router.get('/reports/market-prices/stream', protect, async (req, res) => {
  try {
    if (!canAccessReports(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })

    const currency = String(req.query.currency || 'USD').trim().toUpperCase()
    const unit = String(req.query.unit || 'toz').trim().toLowerCase()
    const pollMs = Math.max(400, Math.min(5000, Number(process.env.METALS_SPOT_SSE_POLL_MS || 1000)))

    res.status(200)
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
    res.setHeader('Cache-Control', 'no-cache, no-transform')
    res.setHeader('Connection', 'keep-alive')
    res.setHeader('X-Accel-Buffering', 'no')
    if (typeof res.flushHeaders === 'function') res.flushHeaders()

    let streamSeq = 0
    const writeEvent = (obj) => {
      res.write(`data: ${JSON.stringify(obj)}\n\n`)
    }

    const tick = async () => {
      try {
        const { body } = await buildMarketPricesBody({ currency, unit, cacheBypass: false })
        streamSeq += 1
        writeEvent({
          ...body,
          streamSeq,
          streamAt: Date.now(),
        })
      } catch (err) {
        writeEvent({ success: false, message: err.message || 'stream tick failed' })
      }
    }

    await tick()

    const interval = setInterval(() => { void tick() }, pollMs)
    const keepAlive = setInterval(() => {
      try {
        res.write(':ka\n\n')
      } catch {
        /* ignore */
      }
    }, 25000)

    const cleanup = () => {
      clearInterval(interval)
      clearInterval(keepAlive)
      try {
        res.end()
      } catch {
        /* ignore */
      }
    }

    req.on('close', cleanup)
    req.on('aborted', cleanup)
  } catch (err) {
    console.error('[reports] market-prices stream error:', err)
    if (!res.headersSent) res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

router.get('/reports/dashboard', protect, reportExportLimiter, async (req, res) => {
  try {
    if (!canReadErpDashboardReport(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })

    const today = new Date()
    const { startDate, endDate } = req.query
    const periodStart = startDate ? new Date(startDate) : new Date(today.getFullYear(), today.getMonth(), 1)
    const periodEnd = endDate ? new Date(endDate) : new Date(today.getFullYear(), today.getMonth() + 1, 0)
    periodEnd.setHours(23, 59, 59, 999)

    const cacheKey = `${req.user?.tenant || req.user?.company || 'default'}:${periodStart.toISOString()}:${periodEnd.toISOString()}`
    const cached = dashboardReportCache.get(cacheKey)
    if (cached && cached.expiresAt > Date.now()) {
      return res.json(cached.payload)
    }

    const sixMonthsStart = new Date(today.getFullYear(), today.getMonth() - 5, 1)
    const ytdStart = new Date(today.getFullYear(), 0, 1)
    const ledgerFetchStart = [periodStart, sixMonthsStart, ytdStart].reduce((earliest, date) => (
      date < earliest ? date : earliest
    ))

    const [
      accountMetaMap,
      customers,
      vendors,
      bankAccounts,
      assets,
      liabilities,
      ledgerEntries,
      purchaseMappings,
    ] = await Promise.all([
      loadAccountMetaMap(ChartOfAccount),
      Customer.find({ isActive: true }).populate('ledgerAccountId', 'accountCode accountName accountType openingBalance').lean(),
      Vendor.find({ isActive: true, deletedAt: null }).populate('ledgerAccountId', 'accountCode accountName').lean(),
      ChartOfAccount.find({
        isActive: true,
        accountType: 'Asset',
        $or: [{ accountName: /cash|bank/i }, { accountCode: /^10/ }],
      }).select('accountCode accountName').lean(),
      ChartOfAccount.find({ accountType: 'Asset' }).select('accountName accountCode').lean(),
      ChartOfAccount.find({ accountType: 'Liability' }).select('accountName accountCode').lean(),
      Ledger.find({
        date: { $gte: ledgerFetchStart, $lte: periodEnd },
        isDeleted: { $ne: true },
      }).select('date amount exchangeRate debitAccountId creditAccountId description referenceType currency paymentType').lean(),
      AccountMapping.find({ isActive: true, mappingType: { $in: ['purchase', 'expense', 'vendor_payment'] } })
        .populate('debitAccountId', 'accountCode accountName accountType')
        .populate('creditAccountId', 'accountCode accountName accountType')
        .lean(),
    ])

    const periodLedger = ledgerEntries.filter((entry) => {
      const entryDate = new Date(entry.date)
      return entryDate >= periodStart && entryDate <= periodEnd
    })

    const getType = (accountId) => accountMetaMap.get(String(accountId))?.accountType || ''

    let income = 0
    let expenseTotal = 0
    const expenseByAccount = {}
    periodLedger.forEach((entry) => {
      const debitType = getType(entry.debitAccountId)
      const creditType = getType(entry.creditAccountId)
      if (creditType === 'Income') income += getLedgerEntryAmount(entry)
      if (isDashboardExpenseLedgerEntry(entry, getType)) {
        const amount = getLedgerEntryAmount(entry)
        expenseTotal += amount
        const key = getDashboardExpenseCategory(entry, accountMetaMap)
        expenseByAccount[key] = (expenseByAccount[key] || 0) + amount
      }
    })
    const expenseBreakdown = Object.entries(expenseByAccount)
      .map(([name, amount]) => ({ name, amount: toMoney(amount) }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 6)
    const expenseEntries = periodLedger
      .filter((entry) => isDashboardExpenseLedgerEntry(entry, getType))
      .sort((a, b) => new Date(b.date) - new Date(a.date))
    const recentExpenses = expenseEntries.slice(0, 5).map((entry) => {
      const debitAccount = accountMetaMap.get(String(entry.debitAccountId)) || {}
      return {
        date: entry.date,
        category: getDashboardExpenseCategory(entry, accountMetaMap) || debitAccount.accountName || 'Other',
        description: entry.description || entry.notes || '-',
        amount: toMoney(getLedgerEntryAmount(entry)),
        paymentMethod: entry.paymentType || (String(entry.referenceType || '').includes('bank') ? 'Bank Transfer' : 'General'),
      }
    })
    const expenseTrendMap = new Map()
    const ensureExpenseTrendMonth = (date) => {
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      if (!expenseTrendMap.has(key)) {
        expenseTrendMap.set(key, {
          key,
          month: date.toLocaleString('en-US', { month: 'short' }),
          label: date.toLocaleString('en-US', { month: 'short', year: 'numeric' }),
          year: date.getFullYear(),
          monthIndex: date.getMonth(),
          amount: 0,
          count: 0,
        })
      }
      return expenseTrendMap.get(key)
    }
    for (let i = 5; i >= 0; i -= 1) {
      ensureExpenseTrendMonth(new Date(today.getFullYear(), today.getMonth() - i, 1))
    }
    ledgerEntries.forEach((entry) => {
      if (!isDashboardExpenseLedgerEntry(entry, getType)) return
      const entryDate = new Date(entry.date)
      if (Number.isNaN(entryDate.getTime())) return
      const row = ensureExpenseTrendMonth(new Date(entryDate.getFullYear(), entryDate.getMonth(), 1))
      row.amount += getLedgerEntryAmount(entry)
      row.count += 1
    })
    const expenseMonthlyTrend = Array.from(expenseTrendMap.values())
      .sort((a, b) => (a.year - b.year) || (a.monthIndex - b.monthIndex))
      .map((row) => ({ ...row, amount: toMoney(row.amount) }))
    const currentMonthKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
    const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1)
    const lastMonthKey = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`
    const ytdExpenseTotal = ledgerEntries.reduce((sum, entry) => {
      const entryDate = new Date(entry.date)
      if (!isDashboardExpenseLedgerEntry(entry, getType) || entryDate < ytdStart || entryDate > periodEnd) return sum
      return sum + getLedgerEntryAmount(entry)
    }, 0)

    const activityFlow = {
      operating: { inflow: 0, outflow: 0, net: 0, count: 0 },
      investing: { inflow: 0, outflow: 0, net: 0, count: 0 },
      financing: { inflow: 0, outflow: 0, net: 0, count: 0 },
      other: { inflow: 0, outflow: 0, net: 0, count: 0 },
    }
    const resolveCashflowActivity = (counterType) => {
      if (counterType === 'Income' || counterType === 'Expense') return 'operating'
      if (counterType === 'Liability' || counterType === 'Equity') return 'financing'
      if (counterType === 'Asset') return 'investing'
      return 'other'
    }

    let cashInflow = 0
    let cashOutflow = 0
    periodLedger.forEach((entry) => {
      const debitType = getType(entry.debitAccountId)
      const creditType = getType(entry.creditAccountId)
      const amount = Number(entry.amount || 0) * Number(entry.exchangeRate || 1)

      if (debitType === 'Asset') {
        cashInflow += amount
        const bucket = resolveCashflowActivity(creditType)
        activityFlow[bucket].inflow += amount
        activityFlow[bucket].net += amount
        activityFlow[bucket].count += 1
      }
      if (creditType === 'Asset') {
        cashOutflow += amount
        const bucket = resolveCashflowActivity(debitType)
        activityFlow[bucket].outflow += amount
        activityFlow[bucket].net -= amount
        activityFlow[bucket].count += 1
      }
    })

    const monthlyCashFlow = buildMonthlyCashFlow(ledgerEntries, accountMetaMap, today, toMoney)

    const balanceAccountIds = new Set()
    bankAccounts.forEach((account) => balanceAccountIds.add(String(account._id)))
    customers.forEach((customer) => {
      if (customer.ledgerAccountId?._id) balanceAccountIds.add(String(customer.ledgerAccountId._id))
    })
    vendors.forEach((vendor) => {
      if (vendor.ledgerAccountId?._id) balanceAccountIds.add(String(vendor.ledgerAccountId._id))
    })
    const customerLedgerIds = customers.map((customer) => customer.ledgerAccountId?._id).filter(Boolean)
    const [outstandingMap, agingMap] = await Promise.all([
      getOutstandingMapForAccounts(Ledger, [...balanceAccountIds]),
      getAgingMapForAccounts(Ledger, customerLedgerIds),
    ])

    const cashBankBalances = bankAccounts.map((account) => {
      const balance = outstandingMap.get(String(account._id)) || 0
      return { accountCode: account.accountCode, accountName: account.accountName, balance: toMoney(balance) }
    })
    const totalBankBalance = cashBankBalances.reduce((s, a) => s + Number(a.balance || 0), 0)
    const bankRows = cashBankBalances.filter((a) => /bank/i.test(a.accountName))
    const cashRows = cashBankBalances.filter((a) => /cash/i.test(a.accountName))

    const monthlyOutflows = monthlyCashFlow.map((m) => Number(m.outflow || m.cashOut || 0))
    const monthlyInflows = monthlyCashFlow.map((m) => Number(m.inflow || m.cashIn || 0))
    const monthlyNets = monthlyCashFlow.map((m) => Number(m.net || 0))
    const last3Outflows = monthlyOutflows.slice(-3)
    const last3Inflows = monthlyInflows.slice(-3)
    const last3Nets = monthlyNets.slice(-3)
    const avgOutflow3m = last3Outflows.length ? (last3Outflows.reduce((s, n) => s + n, 0) / last3Outflows.length) : 0
    const avgInflow3m = last3Inflows.length ? (last3Inflows.reduce((s, n) => s + n, 0) / last3Inflows.length) : 0
    const rolling3MonthNet = last3Nets.reduce((s, n) => s + n, 0)

    const latestNet = monthlyNets.length ? monthlyNets[monthlyNets.length - 1] : 0
    const prevNet = monthlyNets.length > 1 ? monthlyNets[monthlyNets.length - 2] : 0
    const trendDelta = latestNet - prevNet
    const trendDirection = trendDelta > 0 ? 'up' : trendDelta < 0 ? 'down' : 'flat'

    const meanNet = monthlyNets.length ? (monthlyNets.reduce((s, n) => s + n, 0) / monthlyNets.length) : 0
    const variance = monthlyNets.length
      ? (monthlyNets.reduce((s, n) => s + ((n - meanNet) ** 2), 0) / monthlyNets.length)
      : 0
    const netVolatility = Math.sqrt(variance)

    const operating = activityFlow.operating
    const operatingCoverage = operating.outflow > 0 ? (operating.inflow / operating.outflow) : null
    const runwayMonths = avgOutflow3m > 0 ? (totalBankBalance / avgOutflow3m) : null

    const activityRounded = Object.fromEntries(
      Object.entries(activityFlow).map(([key, row]) => [
        key,
        {
          inflow: toMoney(row.inflow),
          outflow: toMoney(row.outflow),
          net: toMoney(row.net),
          count: row.count,
        },
      ])
    )

    // --- AP & AR (via customer / vendor ledger accounts) ---
    // AR uses open-invoice aging (same as /reports/customer-outstanding), not raw ledger net,
    // so customer credits/advances do not inflate totals while the detail table stays empty.
    const customerOutstanding = customers.map((customer) => {
      const ledgerId = customer.ledgerAccountId?._id
      const aging = ledgerId
        ? (agingMap.get(String(ledgerId)) || { total: 0 })
        : { total: 0 }
      const outstanding = ledgerId ? Number(aging.total || 0) : Number(customer.outstandingBalance || 0)
      return { customerName: customer.name, outstanding: toMoney(Math.max(0, outstanding)) }
    })
    const vendorOutstanding = vendors.map((vendor) => {
      const ledgerId = vendor.ledgerAccountId?._id
      const out = ledgerId ? Number(outstandingMap.get(String(ledgerId)) || 0) : Number(vendor.outstanding || 0)
      return { vendorName: vendor.name, outstanding: toMoney(Math.abs(out)) }
    })
    const totalAR = customerOutstanding.reduce((s, r) => s + Number(r.outstanding || 0), 0)
    const totalAP = vendorOutstanding.reduce((s, r) => s + Number(r.outstanding || 0), 0)

    // --- Customer / Supplier margin: show every created party account ---
    const customerIdsForMargin = customers.map((c) => c._id).filter(Boolean)
    const customerLedgerIdSet = new Set(
      customers.filter((c) => c.ledgerAccountId?._id).map((c) => String(c.ledgerAccountId._id)),
    )
    const customerPeriodMetrics = computeCustomerPeriodMetrics(periodLedger, customerLedgerIdSet, accountMetaMap)

    const vendorIdsForMargin = vendors.map((v) => v._id).filter(Boolean)
    const [latestMarginRate, customerMetalTxs, supplierMetalTxs] = await Promise.all([
      typeof getLatestMetalRate === 'function' ? getLatestMetalRate() : Promise.resolve(null),
      customerIdsForMargin.length && Transaction
        ? Transaction.find({
            customerId: { $in: customerIdsForMargin },
            type: { $in: ['sale', 'purchase'] },
            status: 'posted',
            isDeleted: { $ne: true },
          }).select('customerId type metalFixStatus voucherMeta.fixingType voucherMeta.lineItems').lean()
        : Promise.resolve([]),
      vendorIdsForMargin.length && Transaction
        ? Transaction.find({
            vendorId: { $in: vendorIdsForMargin },
            type: { $in: ['sale', 'purchase'] },
            status: 'posted',
            isDeleted: { $ne: true },
          }).select('vendorId type amount exchangeRate metalFixStatus voucherMeta.grandTotal voucherMeta.fixingType voucherMeta.lineItems').lean()
        : Promise.resolve([]),
    ])
    const marginRates = latestMarginRate
      ? {
          goldPrice: Number(latestMarginRate.goldPrice || 0),
          silverPrice: Number(latestMarginRate.silverPrice || 0),
        }
      : DEFAULT_METAL_RATES || { goldPrice: 0, silverPrice: 0 }
    const marginMetalPositionMap = new Map()
    ;(customerMetalTxs || []).forEach((tx) => {
      const customerId = String(tx.customerId || '')
      if (!customerId) return
      const fixingType = tx?.voucherMeta?.fixingType || tx?.metalFixStatus || ''
      if (!isUnfixedFixingType(fixingType)) return
      const position = marginMetalPositionMap.get(customerId) || { goldPosition: 0, silverPosition: 0 }
      const sign = tx.type === 'purchase' ? 1 : -1
      const lines = Array.isArray(tx.voucherMeta?.lineItems) ? tx.voucherMeta.lineItems : []
      lines.forEach((line) => {
        const pureWeight = Number(line?.pureWeight || 0)
        if (!Number.isFinite(pureWeight) || pureWeight === 0) return
        const stockCode = String(line?.stockCode || '').toUpperCase()
        if (stockCode.includes('XAG') || stockCode.includes('SILV')) {
          position.silverPosition += sign * pureWeight
        } else {
          position.goldPosition += sign * pureWeight
        }
      })
      marginMetalPositionMap.set(customerId, position)
    })

    const customerMargins = customers.map((customer) => {
      const opening = Number(customer.ledgerAccountId?.openingBalance ?? customer.openingBalance ?? 0)
      const ledgerId = customer.ledgerAccountId?._id
      const rawOutstanding = ledgerId
        ? opening + Number(outstandingMap.get(String(ledgerId)) || 0)
        : Number(customer.outstandingBalance || 0)
      const rawPosition = marginMetalPositionMap.get(String(customer._id || '')) || { goldPosition: 0, silverPosition: 0 }
      const goldPosition = roundPosition(rawPosition.goldPosition)
      const silverPosition = roundPosition(rawPosition.silverPosition)
      const marginMetrics = calculateMarginMetrics({
        totalFunds: rawOutstanding < 0 ? Math.abs(rawOutstanding) : rawOutstanding,
        goldPosition,
        silverPosition,
        goldPrice: marginRates.goldPrice,
        silverPrice: marginRates.silverPrice,
        suppressMetalSpotMtm: shouldSuppressSpotMetalMtmForCustomerDashboard(customer.ledgerAccountId?.accountType),
      })

      if (!ledgerId) {
        return {
          id: customer._id,
          customerName: customer.name,
          accountCode: '',
          description: `${customer.name} customer`,
          expenses: 0,
          cashInflow: 0,
          cashOutflow: 0,
          netCashFlow: marginMetrics.equity,
          equity: marginMetrics.equity,
          status: marginMetrics.status,
          marginPercent: marginMetrics.marginPercent,
          goldPosition,
          silverPosition,
          marginAmount: marginMetrics.margin,
          marginExcess: marginMetrics.excess,
          marginRevaluation: marginMetrics.revaluation,
        }
      }

      const periodMetrics = customerPeriodMetrics.get(String(ledgerId)) || { expense: 0, cashIn: 0, cashOut: 0 }
      return {
        id: customer._id,
        customerName: customer.name,
        accountCode: customer.ledgerAccountId?.accountCode || '',
        description: customer.ledgerAccountId?.accountName || `${customer.name} customer`,
        expenses: toMoney(periodMetrics.expense),
        cashInflow: toMoney(periodMetrics.cashIn),
        cashOutflow: toMoney(periodMetrics.cashOut),
        netCashFlow: marginMetrics.equity,
        equity: marginMetrics.equity,
        status: marginMetrics.status,
        marginPercent: marginMetrics.marginPercent,
        goldPosition,
        silverPosition,
        marginAmount: marginMetrics.margin,
        marginExcess: marginMetrics.excess,
        marginRevaluation: marginMetrics.revaluation,
      }
    })

    const supplierMetalPositionMap = new Map()
    const supplierUnfixedRevaluationMap = new Map()
    const calculateUnfixedPremiumAmount = (lines = []) => (Array.isArray(lines) ? lines : []).reduce((sum, line) => {
      const premiumVal = Number(line?.premiumValue || 0)
      if (!premiumVal) return sum
      const purity = Number(line?.purity || 0)
      const purityRatio = purity > 1.2 ? purity / 1000 : purity
      const grossWeight = Number(line?.grossWeight || 0)
      const storedPureWeight = Number(line?.pureWeight || 0)
      const ozOnly = Number(line?.weightInOz || 0)
      const pureFromOz = ozOnly > 0 ? ozOnly * 31.1034768 : 0
      const pureWeight = storedPureWeight > 0 ? storedPureWeight : (pureFromOz > 0 ? pureFromOz : (grossWeight * purityRatio))
      const rateType = String(line?.rateType || 'OZ').trim().toUpperCase()
      const weightInOz = pureWeight / 31.1034768
      const rateQty = rateType === 'GRAM' ? pureWeight : rateType === 'KG' ? pureWeight / 1000 : weightInOz
      return sum + (premiumVal * rateQty)
    }, 0)
    ;(supplierMetalTxs || []).forEach((tx) => {
      const vendorId = String(tx.vendorId || '')
      if (!vendorId) return
      const fixingType = tx?.voucherMeta?.fixingType || tx?.metalFixStatus || ''
      if (!isUnfixedFixingType(fixingType)) return
      const position = supplierMetalPositionMap.get(vendorId) || { goldPosition: 0, silverPosition: 0 }
      const sign = tx.type === 'purchase' ? 1 : -1
      const lines = Array.isArray(tx.voucherMeta?.lineItems) ? tx.voucherMeta.lineItems : []
      lines.forEach((line) => {
        const pureWeight = Number(line?.pureWeight || 0)
        if (!Number.isFinite(pureWeight) || pureWeight === 0) return
        const stockCode = String(line?.stockCode || '').toUpperCase()
        if (stockCode.includes('XAG') || stockCode.includes('SILV')) {
          position.silverPosition += sign * pureWeight
        } else {
          position.goldPosition += sign * pureWeight
        }
      })
      supplierMetalPositionMap.set(vendorId, position)
      const voucherAmount = Math.abs(Number(tx.amount || tx.voucherMeta?.grandTotal || 0) * Number(tx.exchangeRate || 1))
      const premiumAmount = Math.abs(calculateUnfixedPremiumAmount(lines) * Number(tx.exchangeRate || 1))
      const unpricedAmount = Number(Math.max(voucherAmount - premiumAmount, 0).toFixed(2))
      if (unpricedAmount > 0) {
        const signedRevaluation = tx.type === 'purchase' ? -unpricedAmount : unpricedAmount
        supplierUnfixedRevaluationMap.set(
          vendorId,
          Number(((supplierUnfixedRevaluationMap.get(vendorId) || 0) + signedRevaluation).toFixed(2))
        )
      }
    })

    const supplierMarginRows = vendors.map((vendor) => {
      const ledgerId = vendor.ledgerAccountId?._id
      const outstanding = ledgerId
        ? Number(outstandingMap.get(String(ledgerId)) || 0)
        : Number(vendor.outstanding || 0)
      const equity = -Math.abs(outstanding)
      const rawPosition = supplierMetalPositionMap.get(String(vendor._id || '')) || { goldPosition: 0, silverPosition: 0 }
      const goldPosition = roundPosition(rawPosition.goldPosition)
      const silverPosition = roundPosition(rawPosition.silverPosition)
      const marginMetrics = calculateMarginMetrics({
        totalFunds: equity,
        goldPosition,
        silverPosition,
        goldPrice: marginRates.goldPrice,
        silverPrice: marginRates.silverPrice,
        suppressMetalSpotMtm: true,
        revaluationOverride: supplierUnfixedRevaluationMap.get(String(vendor._id || '')) || 0,
      })
      return {
        id: vendor._id,
        supplierName: vendor.name,
        vendorName: vendor.name,
        accountCode: vendor.ledgerAccountId?.accountCode || '',
        description: vendor.ledgerAccountId?.accountName || `${vendor.name} supplier`,
        expenses: 0,
        cashInflow: 0,
        cashOutflow: 0,
        netCashFlow: marginMetrics.equity,
        equity: marginMetrics.equity,
        status: marginMetrics.status,
        marginPercent: marginMetrics.marginPercent,
        goldPosition,
        silverPosition,
        marginAmount: marginMetrics.margin,
        marginExcess: marginMetrics.excess,
        marginRevaluation: marginMetrics.revaluation,
      }
    })

    // --- Legacy supplier totals retained for compatibility ---
    const supplierAccountIds = new Set(purchaseMappings.map((mapping) => String(mapping.debitAccountId?._id || '')).filter(Boolean))
    let supplierExpenseTotal = 0
    let supplierCashOut = 0
    if (supplierAccountIds.size) {
      periodLedger.forEach((entry) => {
        const debitId = String(entry.debitAccountId || '')
        const creditId = String(entry.creditAccountId || '')
        if (!supplierAccountIds.has(debitId) && !supplierAccountIds.has(creditId)) return
        const debitType = getType(entry.debitAccountId)
        const creditType = getType(entry.creditAccountId)
        if (debitType === 'Expense') supplierExpenseTotal += Number(entry.amount || 0)
        if (creditType === 'Asset') supplierCashOut += Number(entry.amount || 0)
      })
    }

    // --- Fixing net positions from posted metal vouchers + confirmed DirectDeal rows ---
    const resolveDashboardMetalCode = (value = '') => {
      const raw = String(value || '').trim().toUpperCase()
      if (!raw) return ''
      if (raw.includes('XAU') || raw.includes('GOLD')) return 'XAU'
      if (raw.includes('XAG') || raw.includes('SILV')) return 'XAG'
      if (raw.includes('XPT') || raw.includes('PLAT')) return 'XPT'
      if (raw.includes('XPD') || raw.includes('PALL')) return 'XPD'
      return raw
    }
    const resolveVoucherPureWeightOz = (line = {}) => {
      const explicitOz = Number(line?.weightInOz || 0)
      if (Number.isFinite(explicitOz) && explicitOz > 0) return explicitOz
      const pureWeight = Number(line?.pureWeight || 0)
      if (Number.isFinite(pureWeight) && pureWeight > 0) return pureWeight / 31.1034768
      const grossWeight = Number(line?.grossWeight || 0)
      const purity = Number(line?.purity || 0)
      const purityRatio = purity > 1.2 ? purity / 1000 : purity
      if (Number.isFinite(grossWeight) && grossWeight > 0 && Number.isFinite(purityRatio) && purityRatio > 0) {
        return (grossWeight * purityRatio) / 31.1034768
      }
      return 0
    }
    const fixingByMetal = {
      XAU: { metal: 'Gold', code: 'XAU', netPosition: 0 },
      XAG: { metal: 'Silver', code: 'XAG', netPosition: 0 },
      XPT: { metal: 'Platinum', code: 'XPT', netPosition: 0 },
    }
    const [
      fixingVoucherTxs,
      fixingDeals,
      stockMoves,
      metalRates,
      inventoryLowStock,
    ] = await Promise.all([
      Transaction.find({
        type: { $in: ['sale', 'purchase'] },
        status: 'posted',
        isDeleted: { $ne: true },
        date: { $gte: periodStart, $lte: periodEnd },
      }).select('type metalFixStatus voucherMeta.fixingType voucherMeta.lineItems').lean(),
      DirectDeal.find({
        entryType: 'fixing',
        isDeleted: { $ne: true },
        docDate: { $gte: periodStart, $lte: periodEnd },
        status: 'confirmed',
      }).lean(),
      StockMovement.find({
        isDeleted: { $ne: true },
        date: { $gte: periodStart, $lte: periodEnd },
      }).select('category metal quantity totalValue unitCost').lean(),
      buildMetalRates(),
      InventoryItem.find({
        isDeleted: { $ne: true },
        $expr: { $lt: ['$quantity', '$minThreshold'] },
      }).select('name sku quantity minThreshold').limit(10).lean(),
    ])
    fixingVoucherTxs.forEach((tx) => {
      const fixingType = String(tx?.voucherMeta?.fixingType || tx?.metalFixStatus || '').trim().toLowerCase()
      if (isUnfixedFixingType(fixingType)) return
      const sign = tx.type === 'purchase' ? 1 : -1
      const lines = Array.isArray(tx?.voucherMeta?.lineItems) ? tx.voucherMeta.lineItems : []
      lines.forEach((line) => {
        const metalCode = resolveDashboardMetalCode(`${line?.stockCode || ''} ${line?.productType || ''} ${line?.narration || ''}`)
        if (!fixingByMetal[metalCode]) return
        fixingByMetal[metalCode].netPosition += sign * resolveVoucherPureWeightOz(line)
      })
    })

    fixingDeals.forEach((deal) => {
      deal.lineItems.forEach((line) => {
        const metalCode = resolveDashboardMetalCode(line.metal || 'XAU')
        if (!fixingByMetal[metalCode]) return
        const qty = Number(line.eqOz || line.qty || 0)
        const sign = String(line.direction || '').trim().toLowerCase() === 'buy' ? 1 : -1
        fixingByMetal[metalCode].netPosition += sign * (Number.isFinite(qty) ? qty : 0)
      })
    })
    const fixingPositions = Object.values(fixingByMetal).map((row) => ({
      metal: row.metal,
      code: row.code,
      unit: 'GOZ',
      netPosition: toMoney(row.netPosition),
    }))

    // --- Volume traded from StockMovement + DirectDeal lines ---
    const volumeByMetal = {}
    stockMoves.forEach((m) => {
      const metal = String(m.category || m.metal || 'Other').toUpperCase()
      if (!volumeByMetal[metal]) volumeByMetal[metal] = { qty: 0, value: 0 }
      volumeByMetal[metal].qty += Number(m.quantity || 0)
      volumeByMetal[metal].value += Number(m.totalValue || m.unitCost * m.quantity || 0)
    })
    fixingDeals.forEach((deal) => {
      deal.lineItems.forEach((line) => {
        const metal = line.metal || 'XAU'
        if (!volumeByMetal[metal]) volumeByMetal[metal] = { qty: 0, value: 0 }
        volumeByMetal[metal].qty += Number(line.eqOz || line.qty || 0)
        volumeByMetal[metal].value += Number(line.amount || 0)
      })
    })
    const volumeTraded = Object.entries(volumeByMetal).map(([metal, data]) => ({
      metal,
      qty: toMoney(data.qty),
      value: toMoney(data.value),
    }))

    // --- Vendor compliance / doc expiry ---
    const vendorDocumentExpiry = buildDocumentExpiryBuckets(vendors, today)
    const complianceRows = vendors.map((v) => evaluateVendorCompliance(v, today))
    const vendorComplianceRisk = {
      nonCompliant: complianceRows.filter((r) => !r.compliant).length,
      averageScore: complianceRows.length > 0
        ? toMoney(complianceRows.reduce((s, r) => s + Number(r.complianceScore || 0), 0) / complianceRows.length)
        : 0,
    }

    const dashboardPayload = {
      success: true,
      period: { startDate: periodStart, endDate: periodEnd },
      summary: {
        monthIncome: toMoney(income),
        monthExpense: toMoney(expenseTotal),
        monthProfit: toMoney(income - expenseTotal),
      },
      metalRates,
      bankBalances: bankRows,
      cashBalances: cashRows,
      allCashBankBalances: cashBankBalances,
      totalBankBalance: toMoney(totalBankBalance),
      cashFlow: {
        inflow: toMoney(cashInflow),
        outflow: toMoney(cashOutflow),
        net: toMoney(cashInflow - cashOutflow),
        monthly: monthlyCashFlow,
        activity: activityRounded,
        quality: {
          avgInflow3m: toMoney(avgInflow3m),
          avgOutflow3m: toMoney(avgOutflow3m),
          rolling3MonthNet: toMoney(rolling3MonthNet),
          trendDelta: toMoney(trendDelta),
          trendDirection,
          netVolatility: toMoney(netVolatility),
          operatingCoverage: operatingCoverage === null ? null : toMoney(operatingCoverage),
          runwayMonths: runwayMonths === null ? null : toMoney(runwayMonths),
        },
      },
      expenses: {
        total: toMoney(expenseTotal),
        breakdown: expenseBreakdown,
        monthlyTrend: expenseMonthlyTrend,
        currentMonthTotal: toMoney(expenseTrendMap.get(currentMonthKey)?.amount || 0),
        lastMonthTotal: toMoney(expenseTrendMap.get(lastMonthKey)?.amount || 0),
        ytdTotal: toMoney(ytdExpenseTotal),
        transactionCount: expenseEntries.length,
        recent: recentExpenses,
      },
      apAr: {
        totalAR: toMoney(totalAR),
        totalAP: toMoney(totalAP),
        netPosition: toMoney(totalAR - totalAP),
        arCount: customerOutstanding.filter((x) => x.outstanding > 0).length,
        apCount: vendorOutstanding.filter((x) => x.outstanding > 0).length,
        customerOutstanding: customerOutstanding.filter((x) => x.outstanding > 0).slice(0, 10),
        vendorOutstanding: vendorOutstanding.filter((x) => x.outstanding > 0).slice(0, 10),
        supplierOutstanding: vendorOutstanding
          .filter((x) => x.outstanding > 0)
          .slice(0, 10)
          .map((x) => ({ supplierName: x.vendorName, outstanding: x.outstanding })),
      },
      customerMargins,
      supplierMargins: {
        expenses: toMoney(supplierExpenseTotal),
        cashOutflow: toMoney(supplierCashOut),
        mappingsCount: purchaseMappings.length,
        rows: supplierMarginRows,
      },
      fixingPositions,
      volumeTraded,
      assets: assets.slice(0, 5),
      liabilities: liabilities.slice(0, 5),
      vendorDocumentExpiry: vendorDocumentExpiry.buckets,
      vendorComplianceRisk,
      lowStockAlerts: inventoryLowStock,
      generatedAt: new Date(),
    }

    dashboardReportCache.set(cacheKey, {
      payload: dashboardPayload,
      expiresAt: Date.now() + DASHBOARD_CACHE_TTL_MS,
    })
    res.json(dashboardPayload)
  } catch (err) {
    console.error('[reports] error:', err)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

}

module.exports = {
  registerReportRoutes,
}
