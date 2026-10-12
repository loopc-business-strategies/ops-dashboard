import { backendRateToDisplayRate } from './voucherUtils'

export const DEFAULT_REPORT_MONEY_COLUMNS = { debit: true, credit: true, net: true }

export function defaultReportDisplayOptions(baseCurrencyCode = 'USD') {
  return {
    displayCurrency: String(baseCurrencyCode || 'USD').trim().toUpperCase() || 'USD',
    showNetOnly: false,
    hideNet: false,
    suppressSummary: false,
    reportTo: 'screen',
    showMetal: true,
  }
}

export function reportDisplayPerUsd(displayCurrency, currencies = [], baseCurrency = 'USD') {
  const code = String(displayCurrency || baseCurrency).trim().toUpperCase()
  const base = String(baseCurrency || 'USD').trim().toUpperCase()
  if (!code || code === base) return 1
  const row = (currencies || []).find((currency) => (
    String(currency?.code || '').trim().toUpperCase() === code && currency?.isActive !== false
  ))
  const backend = Number(row?.exchangeRate)
  if (!Number.isFinite(backend) || backend <= 0) return null
  return backendRateToDisplayRate(backend, code, true)
}

export function convertReportUsd(amount, displayCurrency, currencies = [], baseCurrency = 'USD') {
  const perUsd = reportDisplayPerUsd(displayCurrency, currencies, baseCurrency)
  const value = Number(amount || 0)
  if (!Number.isFinite(value)) return 0
  if (perUsd == null) return value
  return value * perUsd
}

export function reportCurrencyChoices(currencies = [], baseCurrency = 'USD') {
  const base = String(baseCurrency || 'USD').trim().toUpperCase() || 'USD'
  const codes = [base]
  ;(currencies || []).forEach((currency) => {
    if (currency?.isActive === false) return
    const code = String(currency?.code || '').trim().toUpperCase()
    if (!code || codes.includes(code)) return
    if (code !== base && reportDisplayPerUsd(code, currencies, base) == null) return
    codes.push(code)
  })
  return codes
}

export function reportMoneyColumns({ showNetOnly = false, hideNet = false } = {}) {
  if (showNetOnly) return { debit: false, credit: false, net: true }
  return {
    debit: true,
    credit: true,
    net: !hideNet,
  }
}

export function trialMoneyHeaders(columns = DEFAULT_REPORT_MONEY_COLUMNS, labels = {}) {
  const names = { debit: 'Debit', credit: 'Credit', net: 'Net', ...labels }
  const headers = []
  if (columns.debit !== false) headers.push(names.debit)
  if (columns.credit !== false) headers.push(names.credit)
  if (columns.net !== false) headers.push(names.net)
  return headers
}

export function formatReportGrams(net) {
  const value = Number(net || 0)
  if (!Number.isFinite(value) || Math.abs(value) < 0.0005) return ''
  const abs = Math.abs(value).toLocaleString(undefined, { minimumFractionDigits: 3, maximumFractionDigits: 3 })
  return `${abs} ${value < 0 ? 'Cr' : 'Dr'}`
}

export function trialMetalHeaders(showMetal = false) {
  return showMetal ? ['Gold g', 'Silver g'] : []
}

export function trialMetalValues(row, showMetal = false) {
  if (!showMetal) return []
  return [formatReportGrams(row?.goldNet), formatReportGrams(row?.silverNet)]
}

export function trialMoneyValues(row, columns = DEFAULT_REPORT_MONEY_COLUMNS, format = (value) => value) {
  const values = []
  if (columns.debit !== false) values.push(format(row?.debit))
  if (columns.credit !== false) values.push(format(row?.credit))
  if (columns.net !== false) values.push(format(row?.net))
  return values
}
