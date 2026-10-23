const TYPE_LABELS = {
  expense: 'Expense',
  sale: 'Sale',
  purchase: 'Purchase',
  receipt: 'Receipt',
  payment: 'Payment',
  payroll: 'Payroll',
  metal_receipt: 'Metal receipt',
  metal_payment: 'Metal payment',
  metal_transfer: 'Metal transfer',
  journal: 'Journal',
  bank_jv: 'Bank JV',
}

const ACTION_LABELS = {
  create: 'Created',
  update: 'Updated',
  submit: 'Submitted',
  approve: 'Approved',
  post: 'Posted',
  void: 'Voided',
  delete: 'Deleted',
  return: 'Returned',
  reject: 'Rejected',
}

function formatMoney(amount, currency = 'USD') {
  const n = Number(amount)
  if (!Number.isFinite(n)) return ''
  const formatted = n.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  const cur = String(currency || 'USD').trim().toUpperCase() || 'USD'
  return `${formatted} ${cur}`
}

function accountLabel(docOrId) {
  if (!docOrId) return ''
  if (typeof docOrId === 'object') {
    const code = String(docOrId.accountCode || '').trim()
    const name = String(docOrId.accountName || '').trim()
    if (code && name) return `${code} ${name}`
    return name || code || ''
  }
  return ''
}

function idOf(ref) {
  if (!ref) return null
  if (typeof ref === 'object' && ref._id) return String(ref._id)
  return String(ref)
}

async function resolveAccountLabels(debitRef, creditRef) {
  const debitPop = accountLabel(debitRef)
  const creditPop = accountLabel(creditRef)
  if (debitPop && creditPop) return { debit: debitPop, credit: creditPop }

  const ids = []
  const debitId = idOf(debitRef)
  const creditId = idOf(creditRef)
  if (!debitPop && debitId) ids.push(debitId)
  if (!creditPop && creditId && creditId !== debitId) ids.push(creditId)
  if (!ids.length) return { debit: debitPop, credit: creditPop }

  try {
    const ChartOfAccount = require('../models/ChartOfAccount')
    const rows = await ChartOfAccount.find({ _id: { $in: ids } })
      .select('accountCode accountName')
      .lean()
    const byId = new Map(rows.map((row) => [String(row._id), accountLabel(row)]))
    return {
      debit: debitPop || byId.get(debitId) || '',
      credit: creditPop || byId.get(creditId) || '',
    }
  } catch {
    return { debit: debitPop, credit: creditPop }
  }
}

function metalLineSummary(transaction) {
  const lines = Array.isArray(transaction?.voucherMeta?.lineItems)
    ? transaction.voucherMeta.lineItems
    : []
  if (!lines.length) {
    const rate = Number(transaction?.voucherMeta?.metalRate || 0)
    return rate > 0 ? `metal rate ${rate}` : ''
  }

  const parts = []
  for (const line of lines.slice(0, 4)) {
    const stock = String(line.stockCode || line.productType || line.acCode || '').trim()
    const wt = Number(line.pureWeight || line.grossWeight || 0)
    const rate = Number(line.metalRate || transaction?.voucherMeta?.metalRate || 0)
    const metalAmt = Number(line.metalAmount || 0)
    const bits = []
    if (stock) bits.push(stock)
    if (Number.isFinite(wt) && wt !== 0) bits.push(`${wt}`)
    if (Number.isFinite(rate) && rate > 0) bits.push(`@ ${rate}`)
    if (Number.isFinite(metalAmt) && metalAmt !== 0) {
      bits.push(`= ${formatMoney(metalAmt, line.currCode || transaction?.currency)}`)
    }
    if (bits.length) parts.push(bits.join(' '))
  }
  return parts.join('; ')
}

function partyName(transaction) {
  return String(
    transaction?.voucherMeta?.partyName
    || transaction?.customerId?.name
    || transaction?.vendorId?.name
    || ''
  ).trim()
}

function joinDetailParts(parts) {
  return parts.map((p) => String(p || '').trim()).filter(Boolean).join(' · ')
}

/**
 * Human-readable Activity Log detail for vouchers.
 * Example: "Posted Sale SV/2026/0001 · ABC Trading · XAU 10 @ 4000 · Dr 1100 Cash / Cr 4000 Sales · 40,000.00 USD"
 */
async function buildVoucherActivityDetail(transaction, action, options = {}) {
  const typeKey = String(transaction?.type || '').toLowerCase()
  const typeLabel = TYPE_LABELS[typeKey] || (typeKey ? typeKey.replace(/_/g, ' ') : 'Voucher')
  const actionLabel = ACTION_LABELS[action] || String(action || 'Updated')
  const docNo = String(transaction?.voucherMeta?.vocNo || '').trim()
  const party = partyName(transaction)
  const money = formatMoney(transaction?.amount, transaction?.currency)
  const metal = /metal_/i.test(typeKey) ? metalLineSummary(transaction) : ''
  const { debit, credit } = await resolveAccountLabels(
    transaction?.debitAccountId,
    transaction?.creditAccountId,
  )
  const accounts = [debit && `Dr ${debit}`, credit && `Cr ${credit}`].filter(Boolean).join(' / ')

  const head = joinDetailParts([
    `${actionLabel} ${typeLabel}${docNo ? ` ${docNo}` : ''}`,
    party,
    metal,
    accounts,
    money,
  ])

  const note = String(options.comment || '').trim()
  const statusTrail = [options.fromStatus, options.toStatus].filter(Boolean).join(' → ')
  // Keep note only when it adds info beyond the structured summary
  const extra = []
  if (statusTrail && !['create', 'post', 'submit', 'approve', 'void', 'delete'].includes(action)) {
    extra.push(statusTrail)
  }
  if (note && !head.includes(note) && note.length < 120) {
    extra.push(note)
  }
  return extra.length ? `${head} · ${extra.join(' · ')}` : head
}

/**
 * JV Activity Log detail.
 * Example: "Created Journal voucher JV-001 · Dr 5000 Expense / Cr 1000 Cash · 12.34 USD (1 line)"
 */
async function buildJournalActivityDetail({
  mode = 'journal',
  documentNo = '',
  entries = [],
  totalAmount,
  currency,
} = {}) {
  const label = mode === 'bank_jv' ? 'Bank JV' : 'Journal voucher'
  const first = entries[0] || {}
  const { debit, credit } = await resolveAccountLabels(first.debitAccountId, first.creditAccountId)
  const accounts = [debit && `Dr ${debit}`, credit && `Cr ${credit}`].filter(Boolean).join(' / ')
  const money = formatMoney(
    totalAmount != null ? totalAmount : first.amount,
    currency || first.currency || 'USD',
  )
  const lineCount = entries.length
  const lines = lineCount === 1 ? '1 line' : `${lineCount} lines`
  return joinDetailParts([
    `Created ${label}${documentNo ? ` ${documentNo}` : ''}`,
    accounts,
    money,
    lines,
  ])
}

function buildAccountActivityDetail(account) {
  const code = String(account?.accountCode || '').trim()
  const name = String(account?.accountName || '').trim()
  const type = String(account?.accountType || '').trim()
  const title = [code, name].filter(Boolean).join(' — ') || 'account'
  return joinDetailParts([
    `Created account ${title}`,
    type,
  ])
}

module.exports = {
  formatMoney,
  accountLabel,
  buildVoucherActivityDetail,
  buildJournalActivityDetail,
  buildAccountActivityDetail,
  TYPE_LABELS,
  ACTION_LABELS,
}
