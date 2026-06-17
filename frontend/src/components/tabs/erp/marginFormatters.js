export function formatCustomerMarginEquity(row) {
  const amount = Number(Math.abs(row?.equity || 0)).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
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

export function formatCustomerMarginAmount(value) {
  const amount = Number(value || 0)
  if (!Number.isFinite(amount)) return '-'
  return amount.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export function formatCustomerMarginExcessShort(row) {
  const amount = Number(Math.abs(row?.excess ?? row?.balanceAbs ?? 0)).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
  if (Number(row?.excess || 0) > 0) return `Excess ${amount}`
  if (Number(row?.excess || 0) < 0) return `Short ${amount}`
  return '-'
}
