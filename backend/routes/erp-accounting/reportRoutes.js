/** Short-lived cache so many dashboard clients do not hammer the upstream spot provider. */
const metalSpotCache = {
  key: '',
  payload: null,
  expiresAt: 0,
}

const {
  fetchFredPreciousMetalSpotBundle,
  fetchAlphaVantagePreciousMetalSpotBundle,
} = require('../../services/metalSpotFeeds')
const {
  isMockRealtimeMetalsSpotEnabled,
  advanceMockMetals,
} = require('../../services/metalSpotMockRealtime')

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
    buildBalanceSheetSummary,
    getAgingForAccount,
    getOutstandingForAccount,
    buildDocumentExpiryBuckets,
    evaluateVendorCompliance,
    canAccessReports,
  } = deps

  const isUnfixedFixingType = (value) => {
    const normalized = String(value || '').trim().toLowerCase()
    return ['non-fixing', 'non_fixing', 'nonfixing', 'unfixed', 'unfix'].includes(normalized)
  }
  const roundPosition = (value) => Number(Number(value || 0).toFixed(6))
  const calculateMarginMetrics = ({ totalFunds, goldPosition, silverPosition, goldPrice, silverPrice }) => {
    const funds = Number(totalFunds || 0)
    const revaluation = (Number(goldPosition || 0) * Number(goldPrice || 0)) + (Number(silverPosition || 0) * Number(silverPrice || 0))
    const margin = Math.abs(revaluation) * 0.02
    const equity = funds + revaluation
    const excess = equity - margin
    const marginPercent = margin > 0 ? (Math.abs(funds) / margin) * 100 : 0
    return {
      totalFunds: toMoney(funds),
      revaluation: toMoney(revaluation),
      margin: toMoney(margin),
      equity: toMoney(equity),
      excess: toMoney(excess),
      marginPercent: toMoney(marginPercent),
      status: equity > 0 ? 'POSITIVE' : equity < 0 ? 'NEGATIVE' : 'NEUTRAL',
    }
  }

  const normalizeMetalPayload = (payload, requestedCurrency = 'USD', requestedUnit = 'toz') => {
    const metals = payload?.metals || payload?.rates || {}
    const sourceCurrency = String(payload?.currency || requestedCurrency || 'USD').toUpperCase()
    const sourceUnit = String(payload?.unit || requestedUnit || 'toz').toLowerCase()
    const lookup = (keys) => {
      for (const key of keys) {
        const raw = metals[key] ?? payload?.[key]
        const value = typeof raw === 'object' && raw !== null && 'price' in raw ? raw.price : raw
        const number = Number(value)
        if (Number.isFinite(number) && number > 0) return number
      }
      return 0
    }

    return {
      source: payload?.source || 'metals.dev',
      currency: sourceCurrency,
      unit: sourceUnit,
      updatedAt: payload?.timestamp || payload?.updatedAt || new Date(),
      currencies: payload?.currencies || {},
      metals: {
        gold: lookup(['gold', 'XAU', 'xau']),
        silver: lookup(['silver', 'XAG', 'xag']),
        platinum: lookup(['platinum', 'XPT', 'xpt']),
        palladium: lookup(['palladium', 'XPD', 'xpd']),
      },
    }
  }

  const getCurrencyMultiplier = async (fromCurrency, toCurrency) => {
    const from = String(fromCurrency || 'USD').toUpperCase()
    const to = String(toCurrency || 'USD').toUpperCase()
    if (from === to) return 1
    if (to === 'USD') {
      const fromDoc = await Currency.findOne({ code: from, isActive: true }).select('exchangeRate')
      const fromRate = Number(fromDoc?.exchangeRate || 0)
      return fromRate > 0 ? 1 / fromRate : 1
    }
    const targetDoc = await Currency.findOne({ code: to, isActive: true }).select('exchangeRate')
    const targetRate = Number(targetDoc?.exchangeRate || 0)
    return targetRate > 0 ? targetRate : 1
  }

  const buildInventoryMetalPriceMap = async () => {
    const stockTypeDocs = await InventoryItem.find({
      isDeleted: { $ne: true },
      $and: [
        { category: /mainStock=/i },
        { category: { $not: /recordType=product/i } },
      ],
    }).select('category unitCost currency updatedAt')

    const stockPriceMap = {}
    stockTypeDocs.forEach((doc) => {
      const raw = String(doc.category || '')
      const meta = {}
      raw.split(';').forEach((pair) => {
        const [key, ...rest] = pair.split('=')
        if (!key || rest.length === 0) return
        meta[String(key).trim()] = rest.join('=').trim()
      })
      const metal = String(meta.mainStock || meta.metalType || '').trim().toLowerCase()
      if (!metal) return

      const price = Number(doc.unitCost || 0)
      if (!Number.isFinite(price) || price <= 0) return

      const prev = stockPriceMap[metal]
      if (!prev || new Date(doc.updatedAt || 0) > new Date(prev.updatedAt || 0)) {
        stockPriceMap[metal] = {
          price,
          currency: String(doc.currency || meta.priceCurrency || 'USD').toUpperCase(),
          unit: String(meta.priceUnit || 'OZ').toUpperCase(),
          updatedAt: doc.updatedAt || null,
        }
      }
    })

    return stockPriceMap
  }

  const normalizeMetalsDevApiKey = (raw) => {
    let k = String(raw || '').trim()
    if ((k.startsWith('"') && k.endsWith('"')) || (k.startsWith("'") && k.endsWith("'"))) {
      k = k.slice(1, -1).trim()
    }
    return k.replace(/^\uFEFF/, '').replace(/\r?\n/g, '').replace(/\s+/g, '')
  }

  const fetchExternalMetalPrices = async ({ currency = 'USD', unit = 'toz' } = {}) => {
    const apiKey = normalizeMetalsDevApiKey(process.env.METALS_DEV_API_KEY || process.env.METALS_API_KEY || '')
    const defaultMetalsDev = 'https://api.metals.dev/v1/latest'
    const configuredUrl = String(process.env.METALS_MARKET_URL || '').trim()
    const targetUrl = configuredUrl || defaultMetalsDev
    const norm = (u) => String(u || '').trim().replace(/\/+$/, '').toLowerCase()
    const usingDefaultMetalsDev = norm(targetUrl) === norm(defaultMetalsDev)

    if (usingDefaultMetalsDev && !apiKey) {
      throw new Error(
        'Live spot feed needs METALS_DEV_API_KEY on the backend (see ENV-VARS-QUICK-REFERENCE.md). metals.dev requires a key; until then, inventory or saved metal rates are used.'
      )
    }

    const buildUrl = (includeUnit) => {
      const u = new URL(targetUrl)
      u.searchParams.set('currency', String(currency || 'USD').toUpperCase())
      if (includeUnit) u.searchParams.set('unit', String(unit || 'toz').toLowerCase())
      if (apiKey) u.searchParams.set('api_key', apiKey)
      return u.toString()
    }

    const parseMetalsDevError = (bodyText) => {
      let detail = String(bodyText || '').slice(0, 400).replace(/\s+/g, ' ').trim()
      try {
        const errJson = JSON.parse(bodyText)
        const code = errJson.error_code != null ? `[${errJson.error_code}] ` : ''
        detail = String(
          errJson.error_message
            || errJson.message
            || errJson.error
            || (errJson.status && errJson.status !== 'failure' ? errJson.status : '')
            || detail
        ).trim()
        if (!detail && errJson.status === 'failure') detail = 'Request rejected (see metals.dev dashboard / quota / API key).'
        return `${code}${detail}`.slice(0, 400)
      } catch {
        return detail
      }
    }

    const fetchOnce = async (urlStr) => {
      const response = await fetch(urlStr, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(8000),
      })
      const text = await response.text()
      return { response, text }
    }

    let { response, text } = await fetchOnce(buildUrl(true))
    if (!response.ok && (response.status === 400 || response.status === 401)) {
      const retry = await fetchOnce(buildUrl(false))
      if (retry.response.ok) {
        response = retry.response
        text = retry.text
      }
    }

    if (!response.ok) {
      const detail = parseMetalsDevError(text)
      throw new Error(`metals provider returned ${response.status}${detail ? `: ${detail}` : ''}`)
    }
    let payload
    try {
      payload = JSON.parse(text)
    } catch {
      throw new Error('metals provider returned non-JSON body')
    }
    if (payload && typeof payload === 'object' && String(payload.status || '').toLowerCase() === 'failure') {
      const detail = parseMetalsDevError(text)
      throw new Error(detail || 'metals.dev returned failure status')
    }
    const normalized = normalizeMetalPayload(payload, currency, unit)
    const hasAny = Object.values(normalized.metals || {}).some((n) => Number(n) > 0)
    if (!hasAny) throw new Error('metals provider returned no usable prices')

    return {
      ...normalized,
      source: normalized.source || (usingDefaultMetalsDev ? 'metals.dev' : 'external-metals'),
    }
  }

  const buildFallbackMetalPrices = async ({ currency = 'USD', unit = 'toz' } = {}) => {
    const [latestRate, stockPriceMap] = await Promise.all([
      MetalRate.findOne().sort({ updatedAt: -1 }),
      buildInventoryMetalPriceMap(),
    ])
    const sourceCurrency = stockPriceMap.gold?.currency || stockPriceMap.silver?.currency || (latestRate ? latestRate.priceCurrency : 'USD')
    const multiplier = await getCurrencyMultiplier(sourceCurrency, currency)
    const latestStockUpdatedAt = Object.values(stockPriceMap)
      .map((entry) => entry.updatedAt)
      .filter(Boolean)
      .sort((a, b) => new Date(b) - new Date(a))[0] || null

    const perOz = {
      gold: stockPriceMap.gold?.price || (latestRate ? latestRate.goldPrice : 0),
      silver: stockPriceMap.silver?.price || (latestRate ? latestRate.silverPrice : 0),
      platinum: stockPriceMap.platinum?.price || 0,
      palladium: stockPriceMap.palladium?.price || 0,
    }
    const unitFactor = String(unit || 'toz').toLowerCase() === 'g'
      ? 1 / 31.1034768
      : String(unit || 'toz').toLowerCase() === 'kg'
        ? 32.1507465686
        : 1

    return {
      source: latestStockUpdatedAt ? 'inventory' : 'local-metal-rate',
      currency: String(currency || sourceCurrency || 'USD').toUpperCase(),
      unit: String(unit || 'toz').toLowerCase(),
      updatedAt: latestStockUpdatedAt || latestRate?.updatedAt || null,
      metals: Object.fromEntries(Object.entries(perOz).map(([metal, price]) => [metal, toMoney(Number(price || 0) * multiplier * unitFactor)])),
      stockPrices: stockPriceMap,
    }
  }

  const buildMetalRates = async () => {
    const [latestRate, stockPriceMap] = await Promise.all([
      MetalRate.findOne().sort({ updatedAt: -1 }),
      buildInventoryMetalPriceMap(),
    ])
    const latestStockUpdatedAt = Object.values(stockPriceMap)
      .map((entry) => entry.updatedAt)
      .filter(Boolean)
      .sort((a, b) => new Date(b) - new Date(a))[0] || null

    return {
      gold: stockPriceMap.gold?.price || (latestRate ? latestRate.goldPrice : 0),
      silver: stockPriceMap.silver?.price || (latestRate ? latestRate.silverPrice : 0),
      platinum: stockPriceMap.platinum?.price || 0,
      palladium: stockPriceMap.palladium?.price || 0,
      currency: stockPriceMap.gold?.currency || stockPriceMap.silver?.currency || (latestRate ? latestRate.priceCurrency : 'USD'),
      updatedAt: latestStockUpdatedAt || (latestRate ? latestRate.updatedAt : null),
      stockPrices: stockPriceMap,
    }
  }

router.get('/reports/trial-balance', protect, async (req, res) => {
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
    const query = { isDeleted: { $ne: true } }
    const dateQuery = buildDateQuery(startDate, endDate)
    if (dateQuery) query.date = dateQuery

    const accountDocs = await ChartOfAccount.find({ isActive: true }).select('accountCode accountName accountType openingBalance')
    const accountById = new Map(accountDocs.map((acc) => [String(acc._id), acc]))

    const entries = await Ledger.find(query)
      .populate('debitAccountId', 'accountName accountCode accountType')
      .populate('creditAccountId', 'accountName accountCode accountType')

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
      const debitKey = entry.debitAccountId._id.toString()
      const creditKey = entry.creditAccountId._id.toString()
      const amount = Number(entry.amount || 0) * Number(entry.exchangeRate || 1)

      if (!accountTotals.has(debitKey)) {
        accountTotals.set(debitKey, { account: entry.debitAccountId, debit: 0, credit: 0, openingNet: 0 })
      }
      if (!accountTotals.has(creditKey)) {
        accountTotals.set(creditKey, { account: entry.creditAccountId, debit: 0, credit: 0, openingNet: 0 })
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

    res.json({
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
    })
  } catch {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.get('/reports/ledger', protect, async (req, res) => {
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

router.get('/reports/profit-loss', protect, async (req, res) => {
  try {
    if (!canAccessReports(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })
    const { startDate, endDate, comparePrevious = 'false', includeZero = 'false' } = req.query
    const includeZeroRows = parseBool(includeZero, false)
    const currentPeriod = await buildProfitLossSummary(startDate, endDate, includeZeroRows)

    let previousPeriod = null
    if (parseBool(comparePrevious, false) && startDate && endDate) {
      const prevRange = buildPreviousPeriod(startDate, endDate)
      if (prevRange) {
        const prevSummary = await buildProfitLossSummary(prevRange.startDate, prevRange.endDate, includeZeroRows)
        previousPeriod = {
          startDate: prevRange.startDate,
          endDate: prevRange.endDate,
          totalIncome: prevSummary.totalIncome,
          totalExpense: prevSummary.totalExpense,
          netProfit: prevSummary.netProfit,
        }
      }
    }

    const netProfit = currentPeriod.netProfit
    const prevNet = Number(previousPeriod?.netProfit || 0)
    const varianceVsPrevious = previousPeriod ? toMoney(Number(netProfit) - prevNet) : null

    const comparisonAnchor = endDate ? new Date(endDate) : new Date()
    const monthlyComparison = []
    for (let i = 5; i >= 0; i -= 1) {
      const monthStart = new Date(comparisonAnchor.getFullYear(), comparisonAnchor.getMonth() - i, 1)
      const monthEnd = new Date(comparisonAnchor.getFullYear(), comparisonAnchor.getMonth() - i + 1, 0)
      const summary = await buildProfitLossSummary(monthStart, monthEnd, false)
      monthlyComparison.push({
        label: monthStart.toLocaleString('en-US', { month: 'short', year: 'numeric' }),
        startDate: monthStart,
        endDate: monthEnd,
        totalIncome: summary.totalIncome,
        totalExpense: summary.totalExpense,
        netProfit: summary.netProfit,
      })
    }

    const quarterlyComparison = []
    const anchorQuarter = Math.floor(comparisonAnchor.getMonth() / 3)
    for (let i = 3; i >= 0; i -= 1) {
      const quarterIndex = anchorQuarter - i
      const yearOffset = Math.floor(quarterIndex / 4)
      const normalizedQuarter = ((quarterIndex % 4) + 4) % 4
      const year = comparisonAnchor.getFullYear() + yearOffset
      const quarterStart = new Date(year, normalizedQuarter * 3, 1)
      const quarterEnd = new Date(year, normalizedQuarter * 3 + 3, 0)
      const summary = await buildProfitLossSummary(quarterStart, quarterEnd, false)
      quarterlyComparison.push({
        label: `Q${normalizedQuarter + 1} ${year}`,
        startDate: quarterStart,
        endDate: quarterEnd,
        totalIncome: summary.totalIncome,
        totalExpense: summary.totalExpense,
        netProfit: summary.netProfit,
      })
    }

    res.json({
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
      monthlyComparison,
      quarterlyComparison,
      generatedAt: new Date(),
    })
  } catch {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.get('/reports/balance-sheet', protect, async (req, res) => {
  try {
    if (!canAccessReports(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })
    const { endDate } = req.query
    const snapshot = await buildBalanceSheetSummary(endDate)
    const anchorDate = endDate ? new Date(endDate) : new Date()
    const monthlyComparison = []
    for (let i = 5; i >= 0; i -= 1) {
      const monthEnd = new Date(anchorDate.getFullYear(), anchorDate.getMonth() - i + 1, 0)
      const summary = await buildBalanceSheetSummary(monthEnd)
      monthlyComparison.push({
        label: monthEnd.toLocaleString('en-US', { month: 'short', year: 'numeric' }),
        endDate: monthEnd,
        totalAssets: summary.totalAssets,
        totalLiabilities: summary.totalLiabilities,
        totalEquity: summary.totalEquity,
        workingCapital: summary.workingCapital,
      })
    }

    const quarterlyComparison = []
    const anchorQuarter = Math.floor(anchorDate.getMonth() / 3)
    for (let i = 3; i >= 0; i -= 1) {
      const quarterIndex = anchorQuarter - i
      const yearOffset = Math.floor(quarterIndex / 4)
      const normalizedQuarter = ((quarterIndex % 4) + 4) % 4
      const year = anchorDate.getFullYear() + yearOffset
      const quarterEnd = new Date(year, normalizedQuarter * 3 + 3, 0)
      const summary = await buildBalanceSheetSummary(quarterEnd)
      quarterlyComparison.push({
        label: `Q${normalizedQuarter + 1} ${year}`,
        endDate: quarterEnd,
        totalAssets: summary.totalAssets,
        totalLiabilities: summary.totalLiabilities,
        totalEquity: summary.totalEquity,
        workingCapital: summary.workingCapital,
      })
    }

    res.json({
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
      monthlyComparison,
      quarterlyComparison,
      generatedAt: new Date(),
    })
  } catch {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.get('/reports/day-book', protect, async (req, res) => {
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

    let entries = await Ledger.find(query)
      .populate('debitAccountId', 'accountCode accountName')
      .populate('creditAccountId', 'accountCode accountName')
      .sort({ date: 1, createdAt: 1 })

    const min = Number(minAmount || 0)
    if (min > 0) {
      entries = entries.filter((entry) => Number(entry.amount || 0) >= min)
    }

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

router.get('/reports/customer-outstanding', protect, async (req, res) => {
  try {
    if (!canAccessReports(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })
    const customers = await Customer.find({ isActive: true }).populate('ledgerAccountId', 'accountCode accountName')

    const rows = await Promise.all(customers.map(async (customer) => {
      const aging = await getAgingForAccount(customer.ledgerAccountId?._id)
      return {
        customerId: customer._id,
        customerName: customer.name,
        ledgerAccount: customer.ledgerAccountId,
        outstanding: toMoney(aging.total),
        aging,
        creditLimit: toMoney(customer.creditLimit || 0),
        limitExceeded: Number(aging.total || 0) > Number(customer.creditLimit || 0) && Number(customer.creditLimit || 0) > 0,
      }
    }))

    const totals = rows.reduce((acc, row) => {
      acc.outstanding += Number(row.outstanding || 0)
      acc.bucket0to30 += Number(row.aging?.bucket0to30 || 0)
      acc.bucket31to60 += Number(row.aging?.bucket31to60 || 0)
      acc.bucket61to90 += Number(row.aging?.bucket61to90 || 0)
      acc.bucket90Plus += Number(row.aging?.bucket90Plus || 0)
      if (row.limitExceeded) acc.limitExceededCount += 1
      return acc
    }, { outstanding: 0, bucket0to30: 0, bucket31to60: 0, bucket61to90: 0, bucket90Plus: 0, limitExceededCount: 0 })

    res.json({
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
    })
  } catch {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.get('/reports/vendor-outstanding', protect, async (req, res) => {
  try {
    if (!canAccessReports(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })
    const vendors = await Vendor.find({ isActive: true, deletedAt: null }).populate('ledgerAccountId', 'accountCode accountName')

    const rows = await Promise.all(vendors.map(async (vendor) => {
      const outstanding = await getOutstandingForAccount(vendor.ledgerAccountId?._id)
      return {
        vendorId: vendor._id,
        vendorName: vendor.name,
        ledgerAccount: vendor.ledgerAccountId,
        outstanding: toMoney(Math.abs(outstanding)),
        outstandingType: outstanding >= 0 ? 'Debit' : 'Credit',
      }
    }))

    const totals = rows.reduce((acc, row) => {
      acc.outstanding += Number(row.outstanding || 0)
      if (row.outstandingType === 'Credit') acc.credit += Number(row.outstanding || 0)
      if (row.outstandingType === 'Debit') acc.debit += Number(row.outstanding || 0)
      return acc
    }, { outstanding: 0, credit: 0, debit: 0 })

    res.json({
      success: true,
      rows,
      totals: {
        outstanding: toMoney(totals.outstanding),
        credit: toMoney(totals.credit),
        debit: toMoney(totals.debit),
      },
      generatedAt: new Date(),
    })
  } catch {
    res.status(500).json({ success: false, message: 'Server error' })
  }
})

router.get('/reports/forex-gain-loss', protect, async (req, res) => {
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

router.get('/reports/dashboard', protect, async (req, res) => {
  try {
    if (!canAccessReports(req.user)) return res.status(403).json({ success: false, message: 'Forbidden' })

    const today = new Date()
    const { startDate, endDate } = req.query
    const periodStart = startDate ? new Date(startDate) : new Date(today.getFullYear(), today.getMonth(), 1)
    const periodEnd = endDate ? new Date(endDate) : new Date(today.getFullYear(), today.getMonth() + 1, 0)
    periodEnd.setHours(23, 59, 59, 999)

    // --- Period ledger entries (for income / expense / cash-flow) ---
    const periodLedger = await Ledger.find({
      date: { $gte: periodStart, $lte: periodEnd },
      isDeleted: { $ne: true },
    })
      .populate('debitAccountId', 'accountCode accountName accountType')
      .populate('creditAccountId', 'accountCode accountName accountType')

    let income = 0
    let expenseTotal = 0
    const expenseByAccount = {}
    periodLedger.forEach((e) => {
      const debitType = e.debitAccountId?.accountType
      const creditType = e.creditAccountId?.accountType
      if (creditType === 'Income') income += Number(e.amount || 0)
      if (debitType === 'Expense') {
        expenseTotal += Number(e.amount || 0)
        const key = e.debitAccountId?.accountName || 'Other'
        expenseByAccount[key] = (expenseByAccount[key] || 0) + Number(e.amount || 0)
      }
    })
    const expenseBreakdown = Object.entries(expenseByAccount)
      .map(([name, amount]) => ({ name, amount: toMoney(amount) }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 6)

    // --- Cash flow: net movement in Asset accounts ---
    // Activity buckets are inferred from the counter-account type on each cash movement.
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
    periodLedger.forEach((e) => {
      const debitType = e.debitAccountId?.accountType
      const creditType = e.creditAccountId?.accountType
      const amount = Number(e.amount || 0) * Number(e.exchangeRate || 1)

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

    // Monthly cash-flow bar chart data (last 6 months)
    const monthlyCashFlow = []
    for (let i = 5; i >= 0; i -= 1) {
      const ms = new Date(today.getFullYear(), today.getMonth() - i, 1)
      const me = new Date(today.getFullYear(), today.getMonth() - i + 1, 0)
      me.setHours(23, 59, 59, 999)
      const mEntries = await Ledger.find({ date: { $gte: ms, $lte: me }, isDeleted: { $ne: true } })
        .populate('debitAccountId', 'accountType')
        .populate('creditAccountId', 'accountType')
      let inc = 0; let exp = 0; let cfIn = 0; let cfOut = 0
      mEntries.forEach((e) => {
        const amount = Number(e.amount || 0) * Number(e.exchangeRate || 1)
        if (e.creditAccountId?.accountType === 'Income') inc += amount
        if (e.debitAccountId?.accountType === 'Expense') exp += amount
        if (e.debitAccountId?.accountType === 'Asset') cfIn += amount
        if (e.creditAccountId?.accountType === 'Asset') cfOut += amount
      })
      monthlyCashFlow.push({
        month: ms.toLocaleString('en-US', { month: 'short', year: '2-digit' }),
        income: toMoney(inc),
        expense: toMoney(exp),
        // Keep both key styles for frontend compatibility.
        inflow: toMoney(cfIn),
        outflow: toMoney(cfOut),
        cashIn: toMoney(cfIn),
        cashOut: toMoney(cfOut),
        net: toMoney(cfIn - cfOut),
      })
    }

    // --- Bank & Cash balances ---
    const bankAccounts = await ChartOfAccount.find({
      isActive: true,
      accountType: 'Asset',
      $or: [{ accountName: /cash|bank/i }, { accountCode: /^10/ }],
    })
    const cashBankBalances = await Promise.all(bankAccounts.map(async (account) => {
      const balance = await getOutstandingForAccount(account._id)
      return { accountCode: account.accountCode, accountName: account.accountName, balance: toMoney(balance) }
    }))
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

    // --- Assets & Liabilities snapshot ---
    const [assets, liabilities] = await Promise.all([
      ChartOfAccount.find({ accountType: 'Asset' }).select('accountName accountCode'),
      ChartOfAccount.find({ accountType: 'Liability' }).select('accountName accountCode'),
    ])

    // --- AP & AR (via customer / vendor ledger accounts) ---
    const customers = await Customer.find({ isActive: true }).populate('ledgerAccountId', 'accountCode accountName openingBalance')
    const vendors = await Vendor.find({ isActive: true, deletedAt: null }).populate('ledgerAccountId', 'accountCode accountName')

    const customerOutstanding = await Promise.all(customers.map(async (c) => {
      const aging = await getAgingForAccount(c.ledgerAccountId?._id)
      return { customerName: c.name, outstanding: toMoney(aging.total) }
    }))
    const vendorOutstanding = await Promise.all(vendors.map(async (v) => {
      const out = await getOutstandingForAccount(v.ledgerAccountId?._id)
      return { vendorName: v.name, outstanding: toMoney(Math.abs(out)) }
    }))
    const totalAR = customerOutstanding.reduce((s, r) => s + Number(r.outstanding || 0), 0)
    const totalAP = vendorOutstanding.reduce((s, r) => s + Number(r.outstanding || 0), 0)

    // --- Customer / Supplier margin: show every created party account ---
    const customerIdsForMargin = customers.map((c) => c._id).filter(Boolean)
    const [latestMarginRate, customerMetalTxs] = await Promise.all([
      typeof getLatestMetalRate === 'function' ? getLatestMetalRate() : Promise.resolve(null),
      customerIdsForMargin.length && Transaction
        ? Transaction.find({
            customerId: { $in: customerIdsForMargin },
            type: { $in: ['sale', 'purchase'] },
            status: 'posted',
            isDeleted: { $ne: true },
          }).select('customerId type metalFixStatus voucherMeta.fixingType voucherMeta.lineItems').lean()
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

    const customerMargins = await Promise.all(customers.map(async (c) => {
      const opening = Number(c.ledgerAccountId?.openingBalance ?? c.openingBalance ?? 0)
      const rawOutstanding = c.ledgerAccountId?._id
        ? opening + Number(await getOutstandingForAccount(c.ledgerAccountId._id) || 0)
        : Number(c.outstandingBalance || 0)
      const rawPosition = marginMetalPositionMap.get(String(c._id || '')) || { goldPosition: 0, silverPosition: 0 }
      const goldPosition = roundPosition(rawPosition.goldPosition)
      const silverPosition = roundPosition(rawPosition.silverPosition)
      const marginMetrics = calculateMarginMetrics({
        totalFunds: rawOutstanding,
        goldPosition,
        silverPosition,
        goldPrice: marginRates.goldPrice,
        silverPrice: marginRates.silverPrice,
      })

      if (!c.ledgerAccountId?._id) {
        return {
          id: c._id,
          customerName: c.name,
          accountCode: '',
          description: `${c.name} customer`,
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
      const cLedger = await Ledger.find({
        $or: [{ debitAccountId: c.ledgerAccountId._id }, { creditAccountId: c.ledgerAccountId._id }],
        date: { $gte: periodStart, $lte: periodEnd },
        isDeleted: { $ne: true },
      }).populate('debitAccountId', 'accountType').populate('creditAccountId', 'accountType')
      let custExpense = 0; let custCashIn = 0; let custCashOut = 0
      cLedger.forEach((e) => {
        if (e.debitAccountId?.accountType === 'Expense') custExpense += Number(e.amount || 0)
        if (e.debitAccountId?.accountType === 'Asset') custCashIn += Number(e.amount || 0)
        if (e.creditAccountId?.accountType === 'Asset') custCashOut += Number(e.amount || 0)
      })
      return {
        id: c._id,
        customerName: c.name,
        accountCode: c.ledgerAccountId?.accountCode || '',
        description: c.ledgerAccountId?.accountName || `${c.name} customer`,
        expenses: toMoney(custExpense),
        cashInflow: toMoney(custCashIn),
        cashOutflow: toMoney(custCashOut),
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
    }))

    const supplierMarginRows = await Promise.all(vendors.map(async (v) => {
      const outstanding = v.ledgerAccountId?._id
        ? Number(await getOutstandingForAccount(v.ledgerAccountId._id) || 0)
        : Number(v.outstanding || 0)
      const equity = v.ledgerAccountId?._id ? outstanding : -Math.abs(outstanding)
      const base = Number(v.creditLimit || 0) > 0
        ? Number(v.creditLimit || 0)
        : Math.abs(Number(v.openingBalance || 0))
      const marginPercent = base > 0 ? (Math.abs(equity) / base) * 100 : null
      const status = equity > 0 ? 'POSITIVE' : equity < 0 ? 'NEGATIVE' : 'NEUTRAL'
      return {
        id: v._id,
        supplierName: v.name,
        vendorName: v.name,
        accountCode: v.ledgerAccountId?.accountCode || '',
        description: v.ledgerAccountId?.accountName || `${v.name} supplier`,
        expenses: 0,
        cashInflow: 0,
        cashOutflow: 0,
        netCashFlow: toMoney(equity),
        equity: toMoney(equity),
        status,
        marginPercent: marginPercent === null ? null : toMoney(marginPercent),
      }
    }))

    // --- Legacy supplier totals retained for compatibility ---
    const purchaseMappings = await AccountMapping.find({ isActive: true, mappingType: { $in: ['purchase', 'expense', 'vendor_payment'] } })
      .populate('debitAccountId', 'accountCode accountName accountType')
      .populate('creditAccountId', 'accountCode accountName accountType')
    const supplierAccountIds = [...new Set(purchaseMappings.map((m) => String(m.debitAccountId?._id || '')))]
    let supplierExpenseTotal = 0
    let supplierCashOut = 0
    if (supplierAccountIds.length) {
      const suppEntries = await Ledger.find({
        date: { $gte: periodStart, $lte: periodEnd },
        isDeleted: { $ne: true },
        $or: [
          { debitAccountId: { $in: supplierAccountIds } },
          { creditAccountId: { $in: supplierAccountIds } },
        ],
      }).populate('debitAccountId', 'accountType').populate('creditAccountId', 'accountType')
      suppEntries.forEach((e) => {
        if (e.debitAccountId?.accountType === 'Expense') supplierExpenseTotal += Number(e.amount || 0)
        if (e.creditAccountId?.accountType === 'Asset') supplierCashOut += Number(e.amount || 0)
      })
    }

    // --- Fixing positions from DirectDeal ---
    const fixingDeals = await DirectDeal.find({
      entryType: 'fixing',
      isDeleted: { $ne: true },
      docDate: { $gte: periodStart, $lte: periodEnd },
    })
    const fixingByMetal = {}
    fixingDeals.forEach((deal) => {
      deal.lineItems.forEach((line) => {
        const metal = line.metal || 'XAU'
        if (!fixingByMetal[metal]) fixingByMetal[metal] = { qty: 0, amount: 0 }
        fixingByMetal[metal].qty += Number(line.eqOz || line.qty || 0)
        fixingByMetal[metal].amount += Number(line.amount || 0)
      })
    })
    const fixingPositions = Object.entries(fixingByMetal).map(([metal, data]) => ({
      metal,
      qty: toMoney(data.qty),
      amount: toMoney(data.amount),
    }))

    // --- Volume traded from StockMovement + DirectDeal lines ---
    const stockMoves = await StockMovement.find({
      isDeleted: { $ne: true },
      date: { $gte: periodStart, $lte: periodEnd },
    })
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

    // --- Metal rates (latest) ---
    const metalRates = await buildMetalRates()

    // --- Vendor compliance / doc expiry ---
    const vendorDocumentExpiry = buildDocumentExpiryBuckets(vendors, today)
    const complianceRows = vendors.map((v) => evaluateVendorCompliance(v, today))
    const vendorComplianceRisk = {
      nonCompliant: complianceRows.filter((r) => !r.compliant).length,
      averageScore: complianceRows.length > 0
        ? toMoney(complianceRows.reduce((s, r) => s + Number(r.complianceScore || 0), 0) / complianceRows.length)
        : 0,
    }

    // --- Low stock ---
    const inventoryLowStock = await InventoryItem.find({
      isDeleted: { $ne: true },
      $expr: { $lt: ['$quantity', '$minThreshold'] },
    }).select('name sku quantity minThreshold').limit(10)

    res.json({
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
    })
  } catch (err) {
    console.error('[reports] error:', err)
    res.status(500).json({ success: false, message: 'Internal server error' })
  }
})

}

module.exports = {
  registerReportRoutes,
}
