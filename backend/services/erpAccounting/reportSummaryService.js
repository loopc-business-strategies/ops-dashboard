const defaultToMoney = (value) => Number(Number(value || 0).toFixed(2))

const toStartOfDay = (value) => {
  const date = new Date(value)
  date.setHours(0, 0, 0, 0)
  return date
}

const toEndOfDay = (value) => {
  const date = new Date(value)
  date.setHours(23, 59, 59, 999)
  return date
}

/** P&L date filter — endDate is inclusive through end of calendar day (matches ledger drilldown). */
function buildProfitLossDateQuery(startDate, endDate) {
  const date = {}
  if (startDate) date.$gte = toStartOfDay(startDate)
  if (endDate) date.$lte = toEndOfDay(endDate)
  return Object.keys(date).length ? date : null
}

function ensurePnlBreakdownRow(map, key, accountById) {
  if (map.has(key)) return
  const account = accountById.get(key)
  map.set(key, {
    accountId: key,
    accountCode: account?.accountCode || '',
    accountName: account?.accountName || '',
    amount: 0,
  })
}

/**
 * Net period P&L rollup: expense = debits − credits; income = credits − debits.
 * Totals and breakdown rows use max(net, 0) per account (audit-script parity).
 */
function summarizeProfitLossEntriesFromLedgerRows(
  entries,
  { incomeById, expenseById, incomeIds, expenseIds },
  includeZero = false,
  toMoney = defaultToMoney,
) {
  const incomeNetMap = includeZero
    ? new Map([...incomeById.entries()].map(([key, account]) => [key, {
      accountId: key,
      accountCode: account.accountCode,
      accountName: account.accountName,
      amount: 0,
    }]))
    : new Map()
  const expenseNetMap = includeZero
    ? new Map([...expenseById.entries()].map(([key, account]) => [key, {
      accountId: key,
      accountCode: account.accountCode,
      accountName: account.accountName,
      amount: 0,
    }]))
    : new Map()

  entries.forEach((entry) => {
    const amount = Number(entry.amount || 0) * Number(entry.exchangeRate || 1)
    const creditKey = String(entry.creditAccountId || '')
    const debitKey = String(entry.debitAccountId || '')

    if (incomeIds.has(creditKey)) {
      if (!includeZero) ensurePnlBreakdownRow(incomeNetMap, creditKey, incomeById)
      incomeNetMap.get(creditKey).amount += amount
    }
    if (incomeIds.has(debitKey)) {
      if (!includeZero) ensurePnlBreakdownRow(incomeNetMap, debitKey, incomeById)
      incomeNetMap.get(debitKey).amount -= amount
    }
    if (expenseIds.has(debitKey)) {
      if (!includeZero) ensurePnlBreakdownRow(expenseNetMap, debitKey, expenseById)
      expenseNetMap.get(debitKey).amount += amount
    }
    if (expenseIds.has(creditKey)) {
      if (!includeZero) ensurePnlBreakdownRow(expenseNetMap, creditKey, expenseById)
      expenseNetMap.get(creditKey).amount -= amount
    }
  })

  let totalIncome = 0
  let totalExpense = 0
  const incomeBreakdown = []
  const expenseBreakdown = []

  incomeNetMap.forEach((row) => {
    const clamped = Math.max(Number(row.amount || 0), 0)
    if (!includeZero && clamped < 0.005) return
    totalIncome += clamped
    incomeBreakdown.push({ ...row, amount: toMoney(clamped) })
  })

  expenseNetMap.forEach((row) => {
    const clamped = Math.max(Number(row.amount || 0), 0)
    if (!includeZero && clamped < 0.005) return
    totalExpense += clamped
    expenseBreakdown.push({ ...row, amount: toMoney(clamped) })
  })

  incomeBreakdown.sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0))
  expenseBreakdown.sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0))

  return {
    totalIncome: toMoney(totalIncome),
    totalExpense: toMoney(totalExpense),
    netProfit: toMoney(totalIncome - totalExpense),
    incomeBreakdown,
    expenseBreakdown,
    topIncome: incomeBreakdown.slice(0, 10),
    topExpenses: expenseBreakdown.slice(0, 10),
    grossMarginPct: totalIncome > 0 ? toMoney(((totalIncome - totalExpense) / totalIncome) * 100) : 0,
  }
}

function createReportSummaryService({ Ledger, ChartOfAccount, toMoney }) {
  const parseBool = (value, fallback = false) => {
    if (value === undefined || value === null || value === '') return fallback
    return ['1', 'true', 'yes', 'y'].includes(String(value).toLowerCase())
  }

  const buildDateQuery = buildProfitLossDateQuery

  const buildPreviousPeriod = (startDate, endDate) => {
    if (!startDate || !endDate) return null
    const start = new Date(startDate)
    const end = new Date(endDate)
    const diff = end.getTime() - start.getTime()
    const prevEnd = new Date(start.getTime() - 24 * 60 * 60 * 1000)
    const prevStart = new Date(prevEnd.getTime() - diff)
    return { startDate: prevStart, endDate: prevEnd }
  }

  let pnlAccountCache = null
  const getPnlAccountSets = async () => {
    if (pnlAccountCache) return pnlAccountCache
    const accounts = await ChartOfAccount.find({
      isActive: true,
      accountType: { $in: ['Income', 'Expense'] },
    }).select('_id accountCode accountName accountType').lean()
    const incomeById = new Map()
    const expenseById = new Map()
    const incomeIds = new Set()
    const expenseIds = new Set()
    accounts.forEach((account) => {
      const key = String(account._id)
      if (account.accountType === 'Income') {
        incomeIds.add(key)
        incomeById.set(key, account)
      }
      if (account.accountType === 'Expense') {
        expenseIds.add(key)
        expenseById.set(key, account)
      }
    })
    pnlAccountCache = { incomeById, expenseById, incomeIds, expenseIds }
    return pnlAccountCache
  }

  const summarizeProfitLossEntries = (entries, pnlAccounts, includeZero = false) =>
    summarizeProfitLossEntriesFromLedgerRows(entries, pnlAccounts, includeZero, toMoney)

  const fetchProfitLossEntries = async (startDate, endDate) => {
    const query = { isDeleted: { $ne: true } }
    const dateQuery = buildDateQuery(startDate, endDate)
    if (dateQuery) query.date = dateQuery
    return Ledger.find(query)
      .select('date debitAccountId creditAccountId amount exchangeRate')
      .lean()
  }

  const buildProfitLossSummary = async (startDate, endDate, includeZero = false) => {
    const [entries, pnlAccounts] = await Promise.all([
      fetchProfitLossEntries(startDate, endDate),
      getPnlAccountSets(),
    ])
    return summarizeProfitLossEntries(entries, pnlAccounts, includeZero)
  }

  const buildProfitLossComparisons = async (comparisonAnchor, includeZero = false) => {
    const anchor = comparisonAnchor ? new Date(comparisonAnchor) : new Date()
    const monthRanges = []
    for (let i = 5; i >= 0; i -= 1) {
      const monthStart = new Date(anchor.getFullYear(), anchor.getMonth() - i, 1)
      const monthEnd = new Date(anchor.getFullYear(), anchor.getMonth() - i + 1, 0)
      monthEnd.setHours(23, 59, 59, 999)
      monthRanges.push({ label: monthStart.toLocaleString('en-US', { month: 'short', year: 'numeric' }), monthStart, monthEnd })
    }

    const anchorQuarter = Math.floor(anchor.getMonth() / 3)
    const quarterRanges = []
    for (let i = 3; i >= 0; i -= 1) {
      const quarterIndex = anchorQuarter - i
      const yearOffset = Math.floor(quarterIndex / 4)
      const normalizedQuarter = ((quarterIndex % 4) + 4) % 4
      const year = anchor.getFullYear() + yearOffset
      const quarterStart = new Date(year, normalizedQuarter * 3, 1)
      const quarterEnd = new Date(year, normalizedQuarter * 3 + 3, 0)
      quarterEnd.setHours(23, 59, 59, 999)
      quarterRanges.push({
        label: `Q${normalizedQuarter + 1} ${year}`,
        quarterStart,
        quarterEnd,
      })
    }

    const earliest = monthRanges[0]?.monthStart || quarterRanges[0]?.quarterStart || anchor
    const latest = monthRanges[monthRanges.length - 1]?.monthEnd || anchor
    const [entries, pnlAccounts] = await Promise.all([
      fetchProfitLossEntries(earliest, latest),
      getPnlAccountSets(),
    ])

    const monthlyComparison = monthRanges.map(({ label, monthStart, monthEnd }) => {
      const periodEntries = entries.filter((entry) => {
        const entryDate = new Date(entry.date)
        return entryDate >= monthStart && entryDate <= monthEnd
      })
      const summary = summarizeProfitLossEntries(periodEntries, pnlAccounts, includeZero)
      return {
        label,
        startDate: monthStart,
        endDate: monthEnd,
        totalIncome: summary.totalIncome,
        totalExpense: summary.totalExpense,
        netProfit: summary.netProfit,
      }
    })

    const quarterlyComparison = quarterRanges.map(({ label, quarterStart, quarterEnd }) => {
      const periodEntries = entries.filter((entry) => {
        const entryDate = new Date(entry.date)
        return entryDate >= quarterStart && entryDate <= quarterEnd
      })
      const summary = summarizeProfitLossEntries(periodEntries, pnlAccounts, includeZero)
      return {
        label,
        startDate: quarterStart,
        endDate: quarterEnd,
        totalIncome: summary.totalIncome,
        totalExpense: summary.totalExpense,
        netProfit: summary.netProfit,
      }
    })

    return { monthlyComparison, quarterlyComparison }
  }

  const buildBalanceSheetSummaryFromBalances = (accounts, balanceByAccount) => {
    const assets = []
    const liabilities = []
    const equity = []
    let incomeSignedTotal = 0
    let expenseSignedTotal = 0

    const isCurrentBalanceSheetAccount = (account) => {
      const text = `${String(account.accountCode || '')} ${String(account.accountName || '')}`
      return /(cash|bank|receivable|debtor|customer|inventory|stock|payable|creditor|tax|accrual|short)/i.test(text)
    }

    const buildBalanceSheetRow = (account, signedBalance, balance, classification, direction) => {
      const normalSection = account.accountType === 'Asset'
        ? 'Asset'
        : account.accountType === 'Liability'
          ? 'Liability'
          : account.accountType === 'Equity'
            ? 'Equity'
            : account.accountType
      return {
        accountId: account._id,
        accountCode: account.accountCode,
        accountName: account.accountName,
        accountType: account.accountType,
        normalSection,
        classification,
        balance: toMoney(balance),
        signedBalance: toMoney(signedBalance),
        direction,
        isReclassified: classification !== normalSection,
        isCurrent: isCurrentBalanceSheetAccount(account),
      }
    }

    accounts.forEach((account) => {
      const bal = Number(account.openingBalance || 0) + Number(balanceByAccount.get(String(account._id)) || 0)
      if (account.accountType === 'Asset') {
        if (bal >= 0) assets.push(buildBalanceSheetRow(account, bal, bal, 'Asset', 'Dr'))
        else liabilities.push(buildBalanceSheetRow(account, bal, Math.abs(bal), 'Liability', 'Cr'))
        return
      }
      if (account.accountType === 'Liability') {
        if (bal <= 0) liabilities.push(buildBalanceSheetRow(account, bal, Math.abs(bal), 'Liability', 'Cr'))
        else assets.push(buildBalanceSheetRow(account, bal, bal, 'Asset', 'Dr'))
        return
      }
      if (account.accountType === 'Equity') {
        equity.push(buildBalanceSheetRow(account, bal, -bal, 'Equity', bal <= 0 ? 'Cr' : 'Dr'))
        return
      }
      if (account.accountType === 'Income') incomeSignedTotal += bal
      if (account.accountType === 'Expense') expenseSignedTotal += bal
    })

    const retainedEarnings = toMoney(-(Number(incomeSignedTotal) + Number(expenseSignedTotal)))
    if (Math.abs(retainedEarnings) >= 0.01) {
      equity.push({
        accountId: null,
        accountCode: 'RETAINED',
        accountName: 'Current Period Earnings',
        balance: retainedEarnings,
        signedBalance: toMoney(-retainedEarnings),
        direction: retainedEarnings >= 0 ? 'Cr' : 'Dr',
        classification: 'Equity',
        normalSection: 'Equity',
        isReclassified: false,
        isCurrent: false,
      })
    }

    const totalAssets = toMoney(assets.reduce((s, x) => s + Number(x.balance || 0), 0))
    const totalLiabilities = toMoney(liabilities.reduce((s, x) => s + Number(x.balance || 0), 0))
    const totalEquity = toMoney(equity.reduce((s, x) => s + Number(x.balance || 0), 0))
    const liabilitiesPlusEquity = toMoney(Number(totalLiabilities) + Number(totalEquity))
    const currentAssets = toMoney(assets.filter((x) => x.isCurrent).reduce((s, x) => s + Number(x.balance || 0), 0))
    const currentLiabilities = toMoney(liabilities.filter((x) => x.isCurrent).reduce((s, x) => s + Number(x.balance || 0), 0))
    const workingCapital = toMoney(Number(currentAssets) - Number(currentLiabilities))
    const currentRatio = Number(currentLiabilities) > 0 ? toMoney(Number(currentAssets) / Number(currentLiabilities)) : null

    return {
      assets,
      liabilities,
      equity,
      totalAssets,
      totalLiabilities,
      totalEquity,
      liabilitiesPlusEquity,
      difference: toMoney(Number(totalAssets) - Number(liabilitiesPlusEquity)),
      currentAssets,
      currentLiabilities,
      workingCapital,
      currentRatio,
      balanced: Math.abs(Number(totalAssets) - Number(liabilitiesPlusEquity)) < 0.01,
    }
  }

  const buildBalanceSheetSummary = async (endDate) => {
    const [accounts, entries] = await Promise.all([
      ChartOfAccount.find({ isActive: true }).lean(),
      Ledger.find({
        isDeleted: { $ne: true },
        ...(endDate ? { date: { $lte: new Date(endDate) } } : {}),
      }).select('debitAccountId creditAccountId amount exchangeRate').lean(),
    ])

    const balanceByAccount = new Map()
    entries.forEach((entry) => {
      const amount = Number(entry.amount || 0) * Number(entry.exchangeRate || 1)
      const debitKey = String(entry.debitAccountId || '')
      const creditKey = String(entry.creditAccountId || '')
      if (debitKey) balanceByAccount.set(debitKey, Number(balanceByAccount.get(debitKey) || 0) + amount)
      if (creditKey) balanceByAccount.set(creditKey, Number(balanceByAccount.get(creditKey) || 0) - amount)
    })

    return buildBalanceSheetSummaryFromBalances(accounts, balanceByAccount)
  }

  const buildBalanceSheetComparisons = async (comparisonAnchor) => {
    const anchorDate = comparisonAnchor ? new Date(comparisonAnchor) : new Date()
    const monthEnds = []
    for (let i = 5; i >= 0; i -= 1) {
      const monthEnd = new Date(anchorDate.getFullYear(), anchorDate.getMonth() - i + 1, 0)
      monthEnd.setHours(23, 59, 59, 999)
      monthEnds.push(monthEnd)
    }

    const anchorQuarter = Math.floor(anchorDate.getMonth() / 3)
    const quarterEnds = []
    for (let i = 3; i >= 0; i -= 1) {
      const quarterIndex = anchorQuarter - i
      const yearOffset = Math.floor(quarterIndex / 4)
      const normalizedQuarter = ((quarterIndex % 4) + 4) % 4
      const year = anchorDate.getFullYear() + yearOffset
      quarterEnds.push(new Date(year, normalizedQuarter * 3 + 3, 0))
    }

    const maxEnd = [...monthEnds, ...quarterEnds].reduce((max, date) => (date > max ? date : max), anchorDate)
    const [accounts, entries] = await Promise.all([
      ChartOfAccount.find({ isActive: true }).lean(),
      Ledger.find({
        isDeleted: { $ne: true },
        date: { $lte: maxEnd },
      }).select('date debitAccountId creditAccountId amount exchangeRate').lean(),
    ])

    const summarizeAt = (asOfDate) => {
      const balanceByAccount = new Map()
      entries.forEach((entry) => {
        if (new Date(entry.date) > asOfDate) return
        const amount = Number(entry.amount || 0) * Number(entry.exchangeRate || 1)
        const debitKey = String(entry.debitAccountId || '')
        const creditKey = String(entry.creditAccountId || '')
        if (debitKey) balanceByAccount.set(debitKey, Number(balanceByAccount.get(debitKey) || 0) + amount)
        if (creditKey) balanceByAccount.set(creditKey, Number(balanceByAccount.get(creditKey) || 0) - amount)
      })
      return buildBalanceSheetSummaryFromBalances(accounts, balanceByAccount)
    }

    const monthlyComparison = monthEnds.map((monthEnd) => {
      const summary = summarizeAt(monthEnd)
      return {
        label: monthEnd.toLocaleString('en-US', { month: 'short', year: 'numeric' }),
        endDate: monthEnd,
        totalAssets: summary.totalAssets,
        totalLiabilities: summary.totalLiabilities,
        totalEquity: summary.totalEquity,
        workingCapital: summary.workingCapital,
      }
    })

    const quarterlyComparison = quarterEnds.map((quarterEnd) => {
      const summary = summarizeAt(quarterEnd)
      const quarter = Math.floor(quarterEnd.getMonth() / 3)
      return {
        label: `Q${quarter + 1} ${quarterEnd.getFullYear()}`,
        endDate: quarterEnd,
        totalAssets: summary.totalAssets,
        totalLiabilities: summary.totalLiabilities,
        totalEquity: summary.totalEquity,
        workingCapital: summary.workingCapital,
      }
    })

    return { monthlyComparison, quarterlyComparison }
  }

  return {
    parseBool,
    buildDateQuery,
    buildPreviousPeriod,
    buildProfitLossSummary,
    buildProfitLossComparisons,
    buildBalanceSheetSummary,
    buildBalanceSheetComparisons,
  }
}

module.exports = {
  createReportSummaryService,
  summarizeProfitLossEntriesFromLedgerRows,
  buildProfitLossDateQuery,
  toEndOfDay,
  toStartOfDay,
}
