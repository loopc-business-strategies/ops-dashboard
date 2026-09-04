import { formatAmount } from '../../../utils/money'

export function formatCustomerMarginEquity(row, currencyCode) {
  const amount = formatAmount(Math.abs(row?.equity || 0), { currencyCode })
  if (Number(row?.equity || 0) > 0) return `+${amount}`
  if (Number(row?.equity || 0) < 0) return `-${amount}`
  return amount
}

export function formatCustomerMarginPercent(value) {
  if (!Number.isFinite(Number(value))) return '-'
  return `${Number(value).toFixed(2)} %`
}

export function formatCustomerMarginPosition(value) {
  const amount = Number(value || 0)
  if (!Number.isFinite(amount)) return '-'
  return amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 6,
  })
}

export function formatCustomerMarginAmount(value, currencyCode) {
  const amount = Number(value || 0)
  if (!Number.isFinite(amount)) return '-'
  return formatAmount(amount, { currencyCode })
}

export function formatCustomerMarginExcessShort(row, currencyCode) {
  const amount = formatAmount(Math.abs(row?.excess ?? row?.balanceAbs ?? 0), { currencyCode })
  if (Number(row?.excess || 0) > 0) return `Excess ${amount}`
  if (Number(row?.excess || 0) < 0) return `Short ${amount}`
  return '-'
}
