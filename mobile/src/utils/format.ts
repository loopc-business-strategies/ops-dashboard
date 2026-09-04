import { formatAmount, formatMoney } from '@/src/utils/money'

export function fmtMoney(value: unknown, currency = 'USD') {
  const num = Number(value || 0)
  if (!Number.isFinite(num)) return formatMoney(0, currency)
  return formatMoney(num, currency)
}

export function fmtCompact(value: unknown) {
  const num = Number(value || 0)
  if (!Number.isFinite(num)) return '0'
  if (Math.abs(num) >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`
  if (Math.abs(num) >= 1_000) return `${(num / 1_000).toFixed(1)}K`
  return num.toFixed(0)
}

export function monthStartISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

export function todayISO() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

export function fmtSigned(value: unknown, currencyCode = 'USD') {
  const n = Number(value || 0)
  if (!Number.isFinite(n)) return formatAmount(0, { currencyCode })
  const formatted = formatAmount(Math.abs(n), { currencyCode })
  if (n > 0) return `+${formatted}`
  if (n < 0) return `-${formatted}`
  return formatted
}

export function fmtPosition(value: unknown) {
  const n = Number(value || 0)
  if (!Number.isFinite(n)) return '0.000'
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 6 })
}

export function fmtCompactCurrency(value: unknown, currencyCode = 'USD') {
  const code = String(currencyCode || 'USD').trim().toUpperCase() || 'USD'
  const n = Number(value || 0)
  if (!Number.isFinite(n)) return formatMoney(0, code)
  if (Math.abs(n) >= 1_000_000) return `${code} ${(n / 1_000_000).toFixed(1)}m`
  if (Math.abs(n) >= 1_000) return `${code} ${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}k`
  return formatMoney(n, code)
}

export function fmtTime(value?: string) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
