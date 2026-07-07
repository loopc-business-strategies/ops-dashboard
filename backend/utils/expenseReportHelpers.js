const {
  getLedgerEntryAmount,
  isDashboardExpenseLedgerEntry,
  isDashboardExpenseRegisterEntry,
  getDashboardExpenseCategory,
} = require('./ledgerBalanceBatch')

const PAYMENT_SOURCE_LABELS = {
  bank: 'Bank',
  cash: 'Cash',
  transfer: 'Transfer',
  other: 'Other',
}

function formatAccountLabel(meta) {
  if (!meta) return 'Unknown'
  const name = String(meta.accountName || '').trim()
  const code = String(meta.accountCode || '').trim()
  if (name && code) return `${name} (${code})`
  return name || code || 'Unknown'
}

function classifyPaymentSource(creditAccountMeta, entry) {
  const paymentType = String(entry?.paymentType || '').trim().toLowerCase()
  if (paymentType === 'bank') return 'bank'
  if (paymentType === 'cash') return 'cash'
  if (paymentType === 'transfer') return 'transfer'

  const ref = String(entry?.referenceType || '').toLowerCase()
  if (ref.includes('bank')) return 'bank'

  const name = String(creditAccountMeta?.accountName || '').toLowerCase()
  const code = String(creditAccountMeta?.accountCode || '').trim()
  if (/bank/.test(name)) return 'bank'
  if (/cash/.test(name)) return 'cash'
  if (/^10/.test(code)) {
    if (/bank/.test(name)) return 'bank'
    if (/cash/.test(name)) return 'cash'
    return 'bank'
  }

  return 'other'
}

function buildExpensePaymentRoute(entry, accountMetaMap) {
  const debitMeta = accountMetaMap.get(String(entry?.debitAccountId)) || {}
  const creditMeta = accountMetaMap.get(String(entry?.creditAccountId)) || {}
  const debitLabel = formatAccountLabel(debitMeta)
  const creditLabel = formatAccountLabel(creditMeta)
  return `${creditLabel} → ${debitLabel}`
}

function paymentSourceToMethodLabel(paymentSource) {
  return PAYMENT_SOURCE_LABELS[paymentSource] || PAYMENT_SOURCE_LABELS.other
}

function resolveLedgerRef(entry) {
  const autoTxNo = String(entry?.autoTxNo || '').trim()
  const txRefNo = String(entry?.txRefNo || '').trim()
  const chequeNo = String(entry?.chequeNo || '').trim()
  return autoTxNo || txRefNo || chequeNo || ''
}

function mapExpenseLedgerEntry(entry, accountMetaMap, getAccountType, toMoney) {
  const debitMeta = accountMetaMap.get(String(entry.debitAccountId)) || {}
  const creditMeta = accountMetaMap.get(String(entry.creditAccountId)) || {}
  const debitType = getAccountType(entry.debitAccountId)
  const creditType = getAccountType(entry.creditAccountId)
  const isCreditExpense = creditType === 'Expense' && debitType !== 'Expense'

  if (isCreditExpense) {
    const category = creditMeta.accountName || 'Other'
    const paymentSource = classifyPaymentSource(debitMeta, entry)
    const signedAmount = -getLedgerEntryAmount(entry)
    return {
      id: String(entry._id),
      date: entry.date,
      amount: toMoney(signedAmount),
      currency: entry.currency || 'USD',
      category,
      description: entry.description || entry.notes || '-',
      paymentSource,
      paymentMethod: paymentSourceToMethodLabel(paymentSource),
      paymentRoute: `${formatAccountLabel(creditMeta)} → ${formatAccountLabel(debitMeta)}`,
      debitAccount: {
        code: debitMeta.accountCode || '',
        name: debitMeta.accountName || '',
      },
      creditAccount: {
        code: creditMeta.accountCode || '',
        name: creditMeta.accountName || '',
      },
      fundingAccount: formatAccountLabel(debitMeta),
      expenseAccount: formatAccountLabel(creditMeta),
      ledgerRef: resolveLedgerRef(entry),
      referenceType: entry.referenceType || 'journal',
    }
  }

  const category = getDashboardExpenseCategory(entry, accountMetaMap)
    || debitMeta.accountName
    || 'Other'
  const paymentSource = classifyPaymentSource(creditMeta, entry)
  const paymentRoute = buildExpensePaymentRoute(entry, accountMetaMap)

  return {
    id: String(entry._id),
    date: entry.date,
    amount: toMoney(getLedgerEntryAmount(entry)),
    currency: entry.currency || 'USD',
    category,
    description: entry.description || entry.notes || '-',
    paymentSource,
    paymentMethod: paymentSourceToMethodLabel(paymentSource),
    paymentRoute,
    debitAccount: {
      code: debitMeta.accountCode || '',
      name: debitMeta.accountName || '',
    },
    creditAccount: {
      code: creditMeta.accountCode || '',
      name: creditMeta.accountName || '',
    },
    fundingAccount: formatAccountLabel(creditMeta),
    expenseAccount: formatAccountLabel(debitMeta),
    ledgerRef: resolveLedgerRef(entry),
    referenceType: entry.referenceType || 'journal',
  }
}

function buildExpenseRegisterFromLedger({
  ledgerEntries,
  accountMetaMap,
  periodStart,
  periodEnd,
  categoryFilter = '',
  paymentSourceFilter = 'all',
  limit = 200,
  toMoney,
}) {
  const getType = (accountId) => accountMetaMap.get(String(accountId))?.accountType || ''
  const normalizedCategory = String(categoryFilter || '').trim()
  const normalizedPayment = String(paymentSourceFilter || 'all').trim().toLowerCase()

  const expenseEntries = ledgerEntries
    .filter((entry) => {
      const entryDate = new Date(entry.date)
      if (entryDate < periodStart || entryDate > periodEnd) return false
      return isDashboardExpenseRegisterEntry(entry, getType)
    })
    .sort((a, b) => {
      const dateDiff = new Date(b.date) - new Date(a.date)
      if (dateDiff !== 0) return dateDiff
      return String(b._id).localeCompare(String(a._id))
    })

  const allItems = expenseEntries.map((entry) => mapExpenseLedgerEntry(
    entry,
    accountMetaMap,
    getType,
    toMoney,
  ))

  const categories = [...new Set(allItems.map((item) => item.category).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b))

  let filtered = allItems
  if (normalizedCategory) {
    filtered = filtered.filter((item) => item.category === normalizedCategory)
  }
  if (normalizedPayment && normalizedPayment !== 'all') {
    filtered = filtered.filter((item) => item.paymentSource === normalizedPayment)
  }

  const cappedLimit = Math.min(Math.max(Number(limit) || 200, 1), 500)

  return {
    total: filtered.length,
    categories,
    items: filtered.slice(0, cappedLimit),
  }
}

module.exports = {
  classifyPaymentSource,
  buildExpensePaymentRoute,
  paymentSourceToMethodLabel,
  resolveLedgerRef,
  mapExpenseLedgerEntry,
  buildExpenseRegisterFromLedger,
  formatAccountLabel,
  PAYMENT_SOURCE_LABELS,
}
