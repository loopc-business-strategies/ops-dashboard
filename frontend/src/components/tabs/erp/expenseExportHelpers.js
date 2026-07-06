import { expenseMonthLabel } from './expenseMonthFilterUtils'

function formatExportDate(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' })
}

function formatMoney(value) {
  return Number(value || 0).toFixed(2)
}

function formatPct(value) {
  const n = Number(value || 0)
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`
}

function paymentFilterLabel(value) {
  if (!value || value === 'all') return 'All'
  return String(value).charAt(0).toUpperCase() + String(value).slice(1)
}

export function buildExpenseMonthExportPayload({
  items = [],
  year,
  monthIndex = '',
  filters = {},
} = {}) {
  const stamp = new Date().toISOString().slice(0, 10)
  const monthLabel = expenseMonthLabel(monthIndex).replace(/\s+/g, '-').toLowerCase()
  const rows = [
    ['Ops Dashboard — Expense Register'],
    ['Generated', new Date().toLocaleString()],
    ['Year', String(year || '')],
    ['Month', expenseMonthLabel(monthIndex)],
    ['Date range', filters.startDate && filters.endDate ? `${filters.startDate} to ${filters.endDate}` : ''],
    ['Payment filter', paymentFilterLabel(filters.paymentSource)],
    ['Category filter', filters.category || 'All categories'],
    [],
    ['Date', 'Category', 'Description', 'Amount', 'Type', 'Account route', 'Ledger ref'],
  ]

  items.forEach((row) => {
    rows.push([
      formatExportDate(row.date),
      row.category || '',
      row.description || '',
      formatMoney(row.amount),
      row.paymentMethod || row.paymentSource || '',
      row.paymentRoute || `${row.fundingAccount || ''} → ${row.expenseAccount || ''}`,
      row.ledgerRef || row.referenceType || '',
    ])
  })

  return {
    rows,
    fileBase: `expenses-${year || 'year'}-${monthLabel}-${stamp}`,
    sheetName: 'Expenses',
  }
}

export function buildExpenseMomExportPayload({ year, monthRows = [], filters = {} } = {}) {
  const stamp = new Date().toISOString().slice(0, 10)
  const rows = [
    ['Ops Dashboard — Expense Month-on-Month Summary'],
    ['Generated', new Date().toLocaleString()],
    ['Year', String(year || '')],
    ['Payment filter', paymentFilterLabel(filters.paymentSource)],
    ['Category filter', filters.category || 'All categories'],
    [],
    ['Month', 'Total Expenses', 'Transaction Count', 'Prior Month', 'Change', 'Change %'],
  ]

  monthRows.forEach((row) => {
    rows.push([
      row.label,
      formatMoney(row.total),
      String(row.count || 0),
      formatMoney(row.priorMonth),
      formatMoney(row.change),
      formatPct(row.changePct),
    ])
  })

  return {
    rows,
    fileBase: `expenses-mom-${year || 'year'}-${stamp}`,
    sheetName: 'MoM Summary',
  }
}

export function buildExpenseMonthlyReportsFileBase({ year, monthIndex = '' } = {}) {
  const stamp = new Date().toISOString().slice(0, 10)
  const monthLabel = expenseMonthLabel(monthIndex).replace(/\s+/g, '-').toLowerCase()
  return `expenses-monthly-${year || 'year'}-${monthLabel}-${stamp}`
}

function truncateText(value, max = 80) {
  const text = String(value || '').trim()
  if (text.length <= max) return text
  return `${text.slice(0, max - 1)}…`
}

function formatPdfAmount(value) {
  const n = Number(value || 0)
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

/** Rows for jsPDF autoTable body (expense register PDF). */
export function buildExpensesPdfTableBody(items = []) {
  return items.map((row) => [
    formatExportDate(row.date),
    row.category || '',
    truncateText(row.description),
    formatPdfAmount(row.amount),
    row.paymentMethod || row.paymentSource || '',
    truncateText(row.paymentRoute || `${row.fundingAccount || ''} → ${row.expenseAccount || ''}`, 100),
    row.ledgerRef || row.referenceType || '',
  ])
}

export function buildExpensePdfMeta({
  year,
  monthIndex = '',
  filters = {},
  total = 0,
  exportedCount = 0,
  totalAmount = 0,
} = {}) {
  const lines = [
    `Generated: ${new Date().toLocaleString()}`,
    `Year: ${year || '—'}`,
    `Month: ${expenseMonthLabel(monthIndex)}`,
  ]
  if (filters.startDate && filters.endDate) {
    lines.push(`Date range: ${filters.startDate} to ${filters.endDate}`)
  }
  lines.push(`Payment: ${paymentFilterLabel(filters.paymentSource)}`)
  lines.push(`Category: ${filters.category || 'All categories'}`)
  lines.push(`Entries: ${exportedCount}${total > exportedCount ? ` of ${total}` : ''}`)
  lines.push(`Total amount: ${formatPdfAmount(totalAmount)}`)
  return {
    title: 'Expense Register Report',
    lines,
    truncated: total > exportedCount,
    exportedCount,
    total,
    totalAmount,
  }
}

export function buildExpensePdfFileName({ year, monthIndex = '' } = {}) {
  const stamp = new Date().toISOString().slice(0, 10)
  const monthLabel = expenseMonthLabel(monthIndex).replace(/\s+/g, '-').toLowerCase()
  return `expenses-report-${year || 'year'}-${monthLabel}-${stamp}.pdf`
}
