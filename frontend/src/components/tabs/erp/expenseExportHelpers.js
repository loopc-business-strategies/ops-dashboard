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
    ['Payment filter', filters.paymentSource || 'All'],
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

export function buildExpenseMomExportPayload({ year, monthRows = [] } = {}) {
  const stamp = new Date().toISOString().slice(0, 10)
  const rows = [
    ['Ops Dashboard — Expense Month-on-Month Summary'],
    ['Generated', new Date().toLocaleString()],
    ['Year', String(year || '')],
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
