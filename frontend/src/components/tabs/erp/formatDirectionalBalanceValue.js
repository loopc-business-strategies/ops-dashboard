/**
 * Format a signed Dr/Cr balance for statement / reports.
 * Money mode uses currency formatting; weight mode is plain grams (no USD prefix).
 */
export function formatDirectionalBalanceValue(value, options = {}, formatMoney) {
  const amount = Number(value || 0)
  const preferredRaw = String(options.preferredDirection || '').trim().toLowerCase()
  const preferredDirection = preferredRaw === 'debit' || preferredRaw === 'dr'
    ? 'Dr'
    : (preferredRaw === 'credit' || preferredRaw === 'cr' ? 'Cr' : '')
  const direction = preferredDirection || (amount < 0 ? 'Cr' : 'Dr')
  const absAmount = Math.abs(amount)
  const asWeight = Boolean(options.asWeight)
    || ['g', 'gram', 'grams'].includes(String(options.unit || '').trim().toLowerCase())

  let formatted
  if (asWeight) {
    const minDigits = Number.isFinite(Number(options.minDigits)) ? Number(options.minDigits) : 2
    const maxDigits = Number.isFinite(Number(options.maxDigits)) ? Number(options.maxDigits) : minDigits
    formatted = absAmount.toLocaleString(undefined, {
      minimumFractionDigits: minDigits,
      maximumFractionDigits: maxDigits,
    })
  } else if (typeof formatMoney === 'function') {
    formatted = formatMoney(absAmount, options.currencyCode)
  } else {
    formatted = absAmount.toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }

  if (absAmount === 0) return formatted
  return `${formatted} ${direction}`
}
