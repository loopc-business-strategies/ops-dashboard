/**
 * Normalize ACCOUNTING_PERIOD_CLOSED API errors for UI toasts,
 * and helpers for closed-period view-only checks.
 */

function toDate(value) {
  if (!value) return null
  const d = value instanceof Date ? value : new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

export function getAccountingPeriodClosedMessage(error, fallback = 'Accounting period closed') {
  const data = error?.response?.data
  if (data?.code === 'ACCOUNTING_PERIOD_CLOSED' || error?.code === 'ACCOUNTING_PERIOD_CLOSED') {
    return data?.message || error?.message || fallback
  }
  if (String(data?.message || error?.message || '').includes('is closed')) {
    return data?.message || error?.message
  }
  return null
}

export function isAccountingPeriodClosedError(error) {
  return Boolean(getAccountingPeriodClosedMessage(error))
}

/** Month row status after applying yearly lock (year CLOSED => all months effectively CLOSED). */
export function effectiveMonthStatus(monthRow, yearly) {
  if (String(yearly?.status || '').toUpperCase() === 'CLOSED') return 'CLOSED'
  return String(monthRow?.status || 'OPEN').toUpperCase() === 'CLOSED' ? 'CLOSED' : 'OPEN'
}

/**
 * True when the accounting date falls in a closed month or closed financial year.
 * @param {Date|string|number} date
 * @param {{ yearly?: object, months?: object[] }} periods
 */
export function isDateLocked(date, periods = {}) {
  const d = toDate(date)
  if (!d) return false
  const { yearly, months } = periods
  if (String(yearly?.status || '').toUpperCase() === 'CLOSED') return true
  const month = d.getUTCMonth() + 1
  const row = Array.isArray(months)
    ? months.find((m) => Number(m.month) === month)
    : null
  return String(row?.status || '').toUpperCase() === 'CLOSED'
}

export function accountingDateFromEntry(entry) {
  if (!entry) return null
  return toDate(
    entry.voucherMeta?.valueDate
    || entry.valueDate
    || entry.date
    || null,
  )
}
