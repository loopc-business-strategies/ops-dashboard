/**
 * Normalize ACCOUNTING_PERIOD_CLOSED / ACCOUNTING_ENTRY_24H_LOCKED API errors for UI toasts,
 * and helpers for closed-period / 24h view-only checks.
 */

const MS_24H = 24 * 60 * 60 * 1000

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

export function getAccountingEntry24hLockedMessage(error, fallback = 'Accounting entry locked') {
  const data = error?.response?.data
  if (data?.code === 'ACCOUNTING_ENTRY_24H_LOCKED' || error?.code === 'ACCOUNTING_ENTRY_24H_LOCKED') {
    return data?.message || error?.message || fallback
  }
  return null
}

export function isAccountingEntry24hLockedError(error) {
  return Boolean(getAccountingEntry24hLockedMessage(error))
}

export function getAccountingEntryLockMessage(error) {
  return getAccountingEntry24hLockedMessage(error) || getAccountingPeriodClosedMessage(error)
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

export function isPast24HourWindow(createdAt, nowMs = Date.now()) {
  const created = toDate(createdAt)
  if (!created) return false
  return nowMs >= created.getTime() + MS_24H
}

export function editableUntilFromCreatedAt(createdAt) {
  const created = toDate(createdAt)
  if (!created) return null
  return new Date(created.getTime() + MS_24H)
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

export function createdAtFromEntry(entry) {
  if (!entry) return null
  return toDate(entry.createdAt || entry.created_at || null)
}
