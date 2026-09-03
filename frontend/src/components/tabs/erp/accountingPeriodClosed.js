/**
 * Normalize ACCOUNTING_PERIOD_CLOSED API errors for UI toasts.
 */
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
