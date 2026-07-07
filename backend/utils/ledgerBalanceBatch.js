const mongoose = require('mongoose')

function normalizeAccountIds(accountIds) {
  return [...new Set((accountIds || []).filter(Boolean).map((id) => String(id)))]
    .map((id) => new mongoose.Types.ObjectId(id))
}

/**
 * Ledger net balance per account (debits minus credits), excluding opening balance.
 */
async function getOutstandingMapForAccounts(Ledger, accountIds) {
  const ids = normalizeAccountIds(accountIds)
  const map = new Map(ids.map((id) => [String(id), 0]))
  if (!ids.length) return map

  const amountExpr = { $multiply: ['$amount', { $ifNull: ['$exchangeRate', 1] }] }
  const [debitAgg, creditAgg] = await Promise.all([
    Ledger.aggregate([
      { $match: { isDeleted: { $ne: true }, debitAccountId: { $in: ids } } },
      { $group: { _id: '$debitAccountId', total: { $sum: amountExpr } } },
    ]),
    Ledger.aggregate([
      { $match: { isDeleted: { $ne: true }, creditAccountId: { $in: ids } } },
      { $group: { _id: '$creditAccountId', total: { $sum: amountExpr } } },
    ]),
  ])

  debitAgg.forEach((row) => {
    const key = String(row._id)
    map.set(key, (map.get(key) || 0) + Number(row.total || 0))
  })
  creditAgg.forEach((row) => {
    const key = String(row._id)
    map.set(key, (map.get(key) || 0) - Number(row.total || 0))
  })
  return map
}

async function loadAccountMetaMap(ChartOfAccount, { accountIds } = {}) {
  const query = { isActive: true }
  const ids = normalizeAccountIds(accountIds)
  if (ids.length) query._id = { $in: ids }
  const docs = await ChartOfAccount.find(query)
    .select('_id accountCode accountName accountType openingBalance')
    .lean()
  return new Map(docs.map((acc) => [String(acc._id), acc]))
}

function getAccountType(accountMetaMap, accountId) {
  return accountMetaMap.get(String(accountId))?.accountType || ''
}

function buildMonthlyCashFlow(entries, accountMetaMap, today, toMoney) {
  const monthlyCashFlow = []
  for (let i = 5; i >= 0; i -= 1) {
    const ms = new Date(today.getFullYear(), today.getMonth() - i, 1)
    const me = new Date(today.getFullYear(), today.getMonth() - i + 1, 0)
    me.setHours(23, 59, 59, 999)
    let inc = 0
    let exp = 0
    let cfIn = 0
    let cfOut = 0
    entries.forEach((entry) => {
      const entryDate = new Date(entry.date)
      if (entryDate < ms || entryDate > me) return
      const amount = Number(entry.amount || 0) * Number(entry.exchangeRate || 1)
      const debitType = getAccountType(accountMetaMap, entry.debitAccountId)
      const creditType = getAccountType(accountMetaMap, entry.creditAccountId)
      if (creditType === 'Income') inc += amount
      if (debitType === 'Expense') exp += amount
      if (debitType === 'Asset') cfIn += amount
      if (creditType === 'Asset') cfOut += amount
    })
    monthlyCashFlow.push({
      month: ms.toLocaleString('en-US', { month: 'short', year: '2-digit' }),
      income: toMoney(inc),
      expense: toMoney(exp),
      inflow: toMoney(cfIn),
      outflow: toMoney(cfOut),
      cashIn: toMoney(cfIn),
      cashOut: toMoney(cfOut),
      net: toMoney(cfIn - cfOut),
    })
  }
  return monthlyCashFlow
}

function computeCustomerPeriodMetrics(entries, customerLedgerIdSet, accountMetaMap) {
  const metrics = new Map()
  customerLedgerIdSet.forEach((id) => {
    metrics.set(String(id), { expense: 0, cashIn: 0, cashOut: 0 })
  })
  entries.forEach((entry) => {
    const debitId = String(entry.debitAccountId)
    const creditId = String(entry.creditAccountId)
    if (!customerLedgerIdSet.has(debitId) && !customerLedgerIdSet.has(creditId)) return
    const amount = Number(entry.amount || 0) * Number(entry.exchangeRate || 1)
    const debitType = getAccountType(accountMetaMap, entry.debitAccountId)
    const creditType = getAccountType(accountMetaMap, entry.creditAccountId)
    const customerLedgerId = customerLedgerIdSet.has(debitId) ? debitId : creditId
    const row = metrics.get(customerLedgerId) || { expense: 0, cashIn: 0, cashOut: 0 }
    if (debitType === 'Expense') row.expense += amount
    if (debitType === 'Asset') row.cashIn += amount
    if (creditType === 'Asset') row.cashOut += amount
    metrics.set(customerLedgerId, row)
  })
  return metrics
}

function computeAgingFromEntries(entries, accountKey, asOfDate = new Date()) {
  const openDebits = []
  entries.forEach((entry) => {
    const amount = Number(entry.amount || 0) * Number(entry.exchangeRate || 1)
    const debitMatch = String(entry.debitAccountId) === accountKey
    const creditMatch = String(entry.creditAccountId) === accountKey
    if (debitMatch && amount > 0) {
      openDebits.push({ date: entry.date, remaining: amount })
      return
    }
    if (creditMatch && amount > 0) {
      let creditLeft = amount
      for (const debit of openDebits) {
        if (creditLeft <= 0) break
        if (debit.remaining <= 0) continue
        const applied = Math.min(debit.remaining, creditLeft)
        debit.remaining -= applied
        creditLeft -= applied
      }
    }
  })

  const buckets = {
    bucket0to30: 0,
    bucket31to60: 0,
    bucket61to90: 0,
    bucket90Plus: 0,
    total: 0,
  }
  openDebits.forEach((debit) => {
    if (debit.remaining <= 0) return
    const ageMs = new Date(asOfDate) - new Date(debit.date)
    const ageDays = Math.floor(ageMs / (1000 * 60 * 60 * 24))
    buckets.total += debit.remaining
    if (ageDays <= 30) buckets.bucket0to30 += debit.remaining
    else if (ageDays <= 60) buckets.bucket31to60 += debit.remaining
    else if (ageDays <= 90) buckets.bucket61to90 += debit.remaining
    else buckets.bucket90Plus += debit.remaining
  })
  return buckets
}

async function getAgingMapForAccounts(Ledger, accountIds, asOfDate = new Date()) {
  const ids = normalizeAccountIds(accountIds)
  const map = new Map(ids.map((id) => [String(id), {
    bucket0to30: 0,
    bucket31to60: 0,
    bucket61to90: 0,
    bucket90Plus: 0,
    total: 0,
  }]))
  if (!ids.length) return map

  const entries = await Ledger.find({
    isDeleted: { $ne: true },
    $or: [{ debitAccountId: { $in: ids } }, { creditAccountId: { $in: ids } }],
  })
    .select('date debitAccountId creditAccountId amount exchangeRate')
    .sort({ date: 1, _id: 1 })
    .lean()

  const entriesByAccount = new Map(ids.map((id) => [String(id), []]))
  entries.forEach((entry) => {
    const debitKey = String(entry.debitAccountId)
    const creditKey = String(entry.creditAccountId)
    if (entriesByAccount.has(debitKey)) entriesByAccount.get(debitKey).push(entry)
    if (creditKey !== debitKey && entriesByAccount.has(creditKey)) entriesByAccount.get(creditKey).push(entry)
  })

  entriesByAccount.forEach((accountEntries, accountKey) => {
    map.set(accountKey, computeAgingFromEntries(accountEntries, accountKey, asOfDate))
  })
  return map
}

async function getLedgerBalanceMap(Ledger, { endDate } = {}) {
  const match = { isDeleted: { $ne: true } }
  if (endDate) match.date = { $lte: new Date(endDate) }
  const amountExpr = { $multiply: ['$amount', { $ifNull: ['$exchangeRate', 1] }] }
  const [debitAgg, creditAgg] = await Promise.all([
    Ledger.aggregate([
      { $match: match },
      { $group: { _id: '$debitAccountId', total: { $sum: amountExpr } } },
    ]),
    Ledger.aggregate([
      { $match: match },
      { $group: { _id: '$creditAccountId', total: { $sum: amountExpr } } },
    ]),
  ])
  const balanceByAccount = new Map()
  debitAgg.forEach((row) => {
    const key = String(row._id)
    balanceByAccount.set(key, Number(balanceByAccount.get(key) || 0) + Number(row.total || 0))
  })
  creditAgg.forEach((row) => {
    const key = String(row._id)
    balanceByAccount.set(key, Number(balanceByAccount.get(key) || 0) - Number(row.total || 0))
  })
  return balanceByAccount
}

const DASHBOARD_EXPENSE_REFERENCE_TYPES = new Set([
  'expense',
  'purchase',
  'payroll',
  'cogs',
])

function getLedgerEntryAmount(entry) {
  return Number(entry.amount || 0) * Number(entry.exchangeRate || 1)
}

function isDashboardExpenseLedgerEntry(entry, getAccountType) {
  const ref = String(entry?.referenceType || 'journal').toLowerCase()
  if (typeof getAccountType === 'function' && getAccountType(entry?.debitAccountId) === 'Expense') return true
  return DASHBOARD_EXPENSE_REFERENCE_TYPES.has(ref)
}

function getDashboardExpenseCategory(entry, accountMetaMap) {
  const accountName = accountMetaMap.get(String(entry?.debitAccountId))?.accountName
  if (accountName) return accountName
  const ref = String(entry?.referenceType || 'journal').toLowerCase()
  if (ref === 'purchase') return 'Purchases'
  if (ref === 'payroll') return 'Payroll'
  if (ref === 'cogs') return 'Cost of Goods Sold'
  return 'Other'
}

function getExpenseAccountCategory(accountId, accountMetaMap) {
  return accountMetaMap.get(String(accountId))?.accountName || null
}

function isDashboardExpenseRegisterEntry(entry, getAccountType) {
  if (typeof getAccountType === 'function') {
    if (getAccountType(entry?.debitAccountId) === 'Expense') return true
    if (getAccountType(entry?.creditAccountId) === 'Expense') return true
  }
  return isDashboardExpenseLedgerEntry(entry, getAccountType)
}

function buildReversedLedgerOriginalIdSet(entries) {
  const ids = new Set()
  ;(entries || []).forEach((entry) => {
    if (String(entry?.referenceType || '').toLowerCase() !== 'reversal') return
    const refId = String(entry?.referenceId || '').trim()
    if (refId) {
      ids.add(refId)
      return
    }
    const match = String(entry?.description || '').match(/REVERSAL of Entry\s+([a-f0-9]{24})/i)
    if (match?.[1]) ids.add(match[1])
  })
  return ids
}

function isVoidedExpenseLedgerDisplayEntry(entry, reversedOriginalIds) {
  if (!entry) return false
  if (String(entry?.referenceType || '').toLowerCase() === 'reversal') return true
  const id = String(entry?._id || '')
  return Boolean(id) && reversedOriginalIds.has(id)
}

function filterVoidedExpenseLedgerEntries(entries, reversalSourceEntries) {
  const reversedOriginalIds = buildReversedLedgerOriginalIdSet(reversalSourceEntries || entries)
  return (entries || []).filter((entry) => !isVoidedExpenseLedgerDisplayEntry(entry, reversedOriginalIds))
}

function accumulateDashboardExpenseAmounts(entry, accountMetaMap, getType, buckets) {
  const amount = getLedgerEntryAmount(entry)
  const debitType = getType(entry.debitAccountId)
  const creditType = getType(entry.creditAccountId)
  let handled = false

  if (debitType === 'Expense') {
    const key = getExpenseAccountCategory(entry.debitAccountId, accountMetaMap) || 'Other'
    buckets[key] = (buckets[key] || 0) + amount
    handled = true
  }
  if (creditType === 'Expense') {
    const key = getExpenseAccountCategory(entry.creditAccountId, accountMetaMap) || 'Other'
    buckets[key] = (buckets[key] || 0) - amount
    handled = true
  }
  if (!handled && isDashboardExpenseLedgerEntry(entry, getType)) {
    const key = getDashboardExpenseCategory(entry, accountMetaMap)
    buckets[key] = (buckets[key] || 0) + amount
  }
}

const DASHBOARD_EXPENSE_ZERO_EPS = 0.005

function summarizeDashboardExpenses(entries, accountMetaMap, options = {}) {
  const getType = (accountId) => accountMetaMap.get(String(accountId))?.accountType || ''
  const buckets = {}
  const activeEntries = filterVoidedExpenseLedgerEntries(entries, options.reversalSourceEntries)
  activeEntries.forEach((entry) => {
    accumulateDashboardExpenseAmounts(entry, accountMetaMap, getType, buckets)
  })

  const byCategory = {}
  let total = 0
  Object.entries(buckets).forEach(([name, raw]) => {
    const value = Math.max(Number(raw || 0), 0)
    if (value < DASHBOARD_EXPENSE_ZERO_EPS) return
    byCategory[name] = value
    total += value
  })

  return { total, byCategory }
}

function buildDashboardExpenseMonthlyTrend(ledgerEntries, accountMetaMap, today = new Date()) {
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

  const getType = (accountId) => accountMetaMap.get(String(accountId))?.accountType || ''
  const reversedOriginalIds = buildReversedLedgerOriginalIdSet(ledgerEntries)
  const entriesByMonth = new Map()
  ledgerEntries.forEach((entry) => {
    const entryDate = new Date(entry.date)
    if (Number.isNaN(entryDate.getTime())) return
    const key = `${entryDate.getFullYear()}-${String(entryDate.getMonth() + 1).padStart(2, '0')}`
    if (!entriesByMonth.has(key)) entriesByMonth.set(key, [])
    entriesByMonth.get(key).push(entry)
  })

  entriesByMonth.forEach((monthEntries) => {
    const anchorDate = new Date(monthEntries[0].date)
    const row = ensureExpenseTrendMonth(new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1))
    const activeMonthEntries = monthEntries.filter((entry) => !isVoidedExpenseLedgerDisplayEntry(entry, reversedOriginalIds))
    const { total } = summarizeDashboardExpenses(activeMonthEntries, accountMetaMap)
    row.amount = total
    row.count = activeMonthEntries.filter((entry) => isDashboardExpenseRegisterEntry(entry, getType)).length
  })

  return Array.from(expenseTrendMap.values())
    .sort((a, b) => (a.year - b.year) || (a.monthIndex - b.monthIndex))
}

module.exports = {
  getOutstandingMapForAccounts,
  getAgingMapForAccounts,
  getLedgerBalanceMap,
  loadAccountMetaMap,
  buildMonthlyCashFlow,
  computeCustomerPeriodMetrics,
  computeAgingFromEntries,
  getLedgerEntryAmount,
  isDashboardExpenseLedgerEntry,
  isDashboardExpenseRegisterEntry,
  buildReversedLedgerOriginalIdSet,
  isVoidedExpenseLedgerDisplayEntry,
  filterVoidedExpenseLedgerEntries,
  getDashboardExpenseCategory,
  accumulateDashboardExpenseAmounts,
  summarizeDashboardExpenses,
  buildDashboardExpenseMonthlyTrend,
  DASHBOARD_EXPENSE_REFERENCE_TYPES,
}
