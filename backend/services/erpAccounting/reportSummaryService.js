function createReportSummaryService({ Ledger, ChartOfAccount, toMoney }) {
  const parseBool = (value, fallback = false) => {
    if (value === undefined || value === null || value === '') return fallback
    return ['1', 'true', 'yes', 'y'].includes(String(value).toLowerCase())
  }

  const buildDateQuery = (startDate, endDate) => {
    const date = {}
    if (startDate) date.$gte = new Date(startDate)
    if (endDate) date.$lte = new Date(endDate)
    return Object.keys(date).length ? date : null
  }

  const buildPreviousPeriod = (startDate, endDate) => {
    if (!startDate || !endDate) return null
    const start = new Date(startDate)
    const end = new Date(endDate)
    const diff = end.getTime() - start.getTime()
    const prevEnd = new Date(start.getTime() - 24 * 60 * 60 * 1000)
    const prevStart = new Date(prevEnd.getTime() - diff)
    return { startDate: prevStart, endDate: prevEnd }
  }

  const buildProfitLossSummary = async (startDate, endDate, includeZero = false) => {
    const query = { isDeleted: { $ne: true } }
    const dateQuery = buildDateQuery(startDate, endDate)
    if (dateQuery) query.date = dateQuery

    const entries = await Ledger.find(query)
      .populate('debitAccountId', 'accountType accountName accountCode')
      .populate('creditAccountId', 'accountType accountName accountCode')

    let totalIncome = 0
    let totalExpense = 0
    const incomeBreakdownMap = new Map()
    const expenseBreakdownMap = new Map()

    if (includeZero) {
      const pnlAccounts = await ChartOfAccount.find({
        isActive: true,
        accountType: { $in: ['Income', 'Expense'] },
      }).select('accountCode accountName accountType')

      pnlAccounts.forEach((account) => {
        const key = account._id.toString()
        const baseRow = {
          accountId: key,
          accountCode: account.accountCode,
          accountName: account.accountName,
          amount: 0,
        }
        if (account.accountType === 'Income') incomeBreakdownMap.set(key, baseRow)
        if (account.accountType === 'Expense') expenseBreakdownMap.set(key, baseRow)
      })
    }

    entries.forEach((entry) => {
      const amount = Number(entry.amount || 0) * Number(entry.exchangeRate || 1)
      if (entry.creditAccountId?.accountType === 'Income') {
        totalIncome += amount
        const key = entry.creditAccountId._id.toString()
        if (!incomeBreakdownMap.has(key)) {
          incomeBreakdownMap.set(key, {
            accountId: key,
            accountCode: entry.creditAccountId.accountCode,
            accountName: entry.creditAccountId.accountName,
            amount: 0,
          })
        }
        incomeBreakdownMap.get(key).amount += amount
      }
      if (entry.debitAccountId?.accountType === 'Expense') {
        totalExpense += amount
        const key = entry.debitAccountId._id.toString()
        if (!expenseBreakdownMap.has(key)) {
          expenseBreakdownMap.set(key, {
            accountId: key,
            accountCode: entry.debitAccountId.accountCode,
            accountName: entry.debitAccountId.accountName,
            amount: 0,
          })
        }
        expenseBreakdownMap.get(key).amount += amount
      }
    })

    const incomeBreakdown = Array.from(incomeBreakdownMap.values())
      .map((row) => ({ ...row, amount: toMoney(row.amount) }))
      .sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0))

    const expenseBreakdown = Array.from(expenseBreakdownMap.values())
      .map((row) => ({ ...row, amount: toMoney(row.amount) }))
      .sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0))

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

  const buildBalanceSheetSummary = async (endDate) => {
    const accounts = await ChartOfAccount.find({ isActive: true })
    const entryQuery = { isDeleted: { $ne: true } }
    if (endDate) {
      entryQuery.date = { $lte: new Date(endDate) }
    }
    const entries = await Ledger.find(entryQuery)

    const balanceByAccount = new Map()
    entries.forEach((entry) => {
      const debitKey = entry.debitAccountId?.toString()
      const creditKey = entry.creditAccountId?.toString()
      const amount = Number(entry.amount || 0) * Number(entry.exchangeRate || 1)
      if (debitKey) balanceByAccount.set(debitKey, Number(balanceByAccount.get(debitKey) || 0) + amount)
      if (creditKey) balanceByAccount.set(creditKey, Number(balanceByAccount.get(creditKey) || 0) - amount)
    })

    const assets = []
    const liabilities = []
    const equity = []
    let incomeSignedTotal = 0
    let expenseSignedTotal = 0

    const normalizeBalanceByType = (accountType, signedBalance) => {
      if (accountType === 'Asset') return signedBalance
      if (accountType === 'Liability' || accountType === 'Equity') return -signedBalance
      return signedBalance
    }

    accounts.forEach((account) => {
      const bal = Number(account.openingBalance || 0) + Number(balanceByAccount.get(account._id.toString()) || 0)
      const row = {
        accountId: account._id,
        accountCode: account.accountCode,
        accountName: account.accountName,
        balance: toMoney(normalizeBalanceByType(account.accountType, bal)),
        signedBalance: toMoney(bal),
      }
      if (account.accountType === 'Asset') assets.push(row)
      if (account.accountType === 'Liability') liabilities.push(row)
      if (account.accountType === 'Equity') equity.push(row)
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
      })
    }

    const totalAssets = toMoney(assets.reduce((s, x) => s + Number(x.balance || 0), 0))
    const totalLiabilities = toMoney(liabilities.reduce((s, x) => s + Number(x.balance || 0), 0))
    const totalEquity = toMoney(equity.reduce((s, x) => s + Number(x.balance || 0), 0))
    const liabilitiesPlusEquity = toMoney(Number(totalLiabilities) + Number(totalEquity))

    const currentAssets = toMoney(assets
      .filter((x) => /(cash|bank|receivable|inventory|stock)/i.test(`${x.accountCode} ${x.accountName}`))
      .reduce((s, x) => s + Number(x.balance || 0), 0))
    const currentLiabilities = toMoney(liabilities
      .filter((x) => /(payable|creditor|tax|accrual|short)/i.test(`${x.accountCode} ${x.accountName}`))
      .reduce((s, x) => s + Number(x.balance || 0), 0))
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

  return {
    parseBool,
    buildDateQuery,
    buildPreviousPeriod,
    buildProfitLossSummary,
    buildBalanceSheetSummary,
  }
}

module.exports = {
  createReportSummaryService,
}
