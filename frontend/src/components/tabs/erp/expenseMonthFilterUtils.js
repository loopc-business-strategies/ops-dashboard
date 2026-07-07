const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export const EXPENSE_MONTH_OPTIONS = [
  { value: '', label: 'All months' },
  ...MONTH_NAMES.map((label, index) => ({ value: String(index), label })),
]

export const REPORT_MONTH_OPTIONS = MONTH_NAMES.map((label, index) => ({
  value: String(index),
  label,
}))

export function currentExpenseYear() {
  return String(new Date().getFullYear())
}

export function currentExpenseMonthIndex() {
  return String(new Date().getMonth())
}

export function expenseMonthLabel(monthIndex) {
  if (monthIndex === '' || monthIndex === null || monthIndex === undefined) return 'All months'
  const idx = Number(monthIndex)
  return MONTH_NAMES[idx] || 'All months'
}

export function expenseMonthShortLabel(monthIndex) {
  const idx = Number(monthIndex)
  return MONTH_SHORT[idx] || 'all'
}

function pad2(n) {
  return String(n).padStart(2, '0')
}

function formatYmd(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

/**
 * @param {string|number} year
 * @param {string} monthIndex - '' for all months in year, or '0'..'11'
 */
export function expenseMonthDateRange(year, monthIndex = '') {
  const y = Number(year) || new Date().getFullYear()
  const today = new Date()

  if (monthIndex === '' || monthIndex === null || monthIndex === undefined) {
    const start = new Date(y, 0, 1)
    const endOfYear = new Date(y, 11, 31)
    const end = endOfYear > today ? today : endOfYear
    return { startDate: formatYmd(start), endDate: formatYmd(end) }
  }

  const m = Number(monthIndex)
  const start = new Date(y, m, 1)
  const endOfMonth = new Date(y, m + 1, 0)
  const end = endOfMonth > today ? today : endOfMonth
  return { startDate: formatYmd(start), endDate: formatYmd(end) }
}

export function buildYearOptions(monthlyTrend = [], selectedYear) {
  const years = new Set(monthlyTrend.map((row) => String(row.year)).filter(Boolean))
  years.add(String(selectedYear || currentExpenseYear()))
  return [...years].sort()
}

export function buildReportYearOptions(selectedYear) {
  const anchor = Number(selectedYear) || new Date().getFullYear()
  return [anchor - 2, anchor - 1, anchor, anchor + 1].map(String)
}

export function aggregateExpensesByMonth(items = [], year) {
  const y = Number(year) || new Date().getFullYear()
  const buckets = MONTH_NAMES.map((label, monthIndex) => ({
    monthIndex,
    label,
    month: MONTH_SHORT[monthIndex],
    year: y,
    amount: 0,
    count: 0,
  }))

  items.forEach((item) => {
    const d = new Date(item.date)
    if (Number.isNaN(d.getTime()) || d.getFullYear() !== y) return
    const bucket = buckets[d.getMonth()]
    bucket.amount += Number(item.amount || 0)
    bucket.count += 1
  })

  return buckets
}

export function buildMomRowsFromTrend(monthlyTrend = [], year) {
  const y = Number(year) || new Date().getFullYear()
  const buckets = aggregateExpensesByMonth([], year)

  monthlyTrend.forEach((row) => {
    if (Number(row.year) !== y) return
    const idx = row.monthIndex ?? MONTH_SHORT.indexOf(String(row.month || '').slice(0, 3))
    if (idx < 0 || idx > 11) return
    buckets[idx].amount = Number(row.amount || 0)
    buckets[idx].count = Number(row.count || 0)
  })

  return buckets
}

export function buildMomSummaryRows(monthBuckets = []) {
  let priorAmount = 0
  return monthBuckets.map((row) => {
    const total = Number(row.amount || 0)
    const count = Number(row.count || 0)
    const change = total - priorAmount
    const changePct = priorAmount > 0 ? (change / priorAmount) * 100 : (total > 0 ? 100 : 0)
    const summary = {
      label: row.label,
      monthIndex: row.monthIndex,
      total,
      count,
      priorMonth: priorAmount,
      change,
      changePct,
    }
    priorAmount = total
    return summary
  })
}

export function aggregateRegisterItemsByCategory(items = []) {
  const map = new Map()
  items.forEach((item) => {
    const key = item.category || 'Other'
    map.set(key, (map.get(key) || 0) + Number(item.amount || 0))
  })
  return [...map.entries()]
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount)
}

export function buildExpenseBreakdownFromRegister(items = []) {
  const categories = aggregateRegisterItemsByCategory(items)
  const total = categories.reduce((sum, row) => sum + Number(row.amount || 0), 0)
  return { categories, total }
}

/**
 * Monthly trend rows from filtered register items for chart display.
 * @param {'6m'|'12m'} range
 */
export function buildExpenseTrendBuckets(items = [], year, range = '6m') {
  const y = Number(year) || new Date().getFullYear()
  const buckets = aggregateExpensesByMonth(items, y)
  const today = new Date()
  const endIdx = y === today.getFullYear() ? today.getMonth() : 11
  const monthCount = range === '12m' ? endIdx + 1 : Math.min(6, endIdx + 1)
  const startIdx = range === '12m' ? 0 : Math.max(0, endIdx - monthCount + 1)

  return buckets.slice(startIdx, endIdx + 1).map((row) => ({
    ...row,
    key: `${y}-${String(row.monthIndex + 1).padStart(2, '0')}`,
    label: `${row.month} ${y}`,
    year: y,
  }))
}

export function peakExpenseTrendMonthIndex(trendRows = []) {
  if (!trendRows.length) return -1
  let peak = trendRows[0]
  trendRows.forEach((row) => {
    if (Number(row.amount || 0) > Number(peak.amount || 0)) peak = row
  })
  return Number(peak.amount || 0) > 0 ? peak.monthIndex : -1
}
