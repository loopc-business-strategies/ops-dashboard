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
    /** Created stock type value (`XAU::<id>::sku`) — scopes Trial Balance metal grams. Empty = all. */
    metalType: '',
    calculateClosingStock: false,
    showClosedAccounts: false,
    excludeHedging: false,
    selectedGroup: '',
  }
}

export function buildClosingStockTrialRow(revaluation) {
  if (!revaluation || revaluation.omitted) return null
  const marketValue = Math.round(Number(revaluation.marketValue || 0) * 100) / 100
  const gold = (revaluation.metals || []).find((row) => row.metal === 'gold')
  const silver = (revaluation.metals || []).find((row) => row.metal === 'silver')
  return {
    accountCode: '',
    accountName: 'Closing stock (open metal at live price)',
    accountType: 'Asset',
    debit: 0,
    credit: 0,
    net: marketValue,
    goldDebit: 0,
    goldCredit: 0,
    goldNet: Number(gold?.netGrams || 0),
    silverDebit: 0,
    silverCredit: 0,
    silverNet: Number(silver?.netGrams || 0),
    unposted: true,
  }
}

const GRAMS_PER_TROY_OZ = 31.1034768

const CLOSING_STOCK_GRAM_KEYS = {
  XAU: 'gold',
  GOLD: 'gold',
  XAG: 'silver',
  SILVER: 'silver',
  XPT: 'platinum',
  PLAT: 'platinum',
  PLATINUM: 'platinum',
  ALLOY: 'alloy',
  ALLO: 'alloy',
}

function metalGrams(revaluation, metal) {
  const row = (revaluation?.metals || []).find((item) => item.metal === metal)
  return Number(row?.netGrams || 0)
}

/** Unposted closing-stock line for one created stock at a typed USD price per troy ounce. */
export function buildManualClosingStockRow(revaluation, { metalCode = 'XAU', price, label = '' } = {}) {
  const pricePerOz = Number(price)
  if (!revaluation || revaluation.omitted || !Number.isFinite(pricePerOz) || pricePerOz <= 0) return null
  const code = String(metalCode || '').trim().toUpperCase()
  const key = CLOSING_STOCK_GRAM_KEYS[code] || String(metalCode || 'gold').trim().toLowerCase()
  const grams = metalGrams(revaluation, key)
  const stockName = String(label || key).trim().toLowerCase() || key
  return {
    accountCode: '',
    accountName: `Closing stock (open ${stockName} at entered price)`,
    accountType: 'Asset',
    debit: 0,
    credit: 0,
    net: Math.round((grams / GRAMS_PER_TROY_OZ) * pricePerOz * 100) / 100,
    goldDebit: 0,
    goldCredit: 0,
    goldNet: key === 'gold' ? grams : 0,
    silverDebit: 0,
    silverCredit: 0,
    silverNet: key === 'silver' ? grams : 0,
    alloyNet: key === 'alloy' ? grams : 0,
    platinumNet: key === 'platinum' ? grams : 0,
    unposted: true,
    closingStockMetalCode: code,
    manualPricePerOz: pricePerOz,
  }
}

/** Unposted gold closing-stock line at a typed USD price per troy ounce. Silver is left out. */
export function buildManualGoldClosingStockRow(revaluation, pricePerOz) {
  return buildManualClosingStockRow(revaluation, { metalCode: 'XAU', price: pricePerOz, label: 'gold' })
}

export function reportAccountGroup(row = {}) {
  if (row?.unposted) return ''
  const name = String(row?.accountName || '')
  if (/\(debtor\)|\bdebtor\b/i.test(name)) return 'debtor'
  if (/\(creditor\)|\bcreditor\b/i.test(name)) return 'creditor'
  const type = String(row?.accountType || '').trim().toLowerCase()
  if (type === 'income' || type === 'expense') return ''
  const lower = name.toLowerCase()
  if (lower.includes('bank')) return 'bank'
  if (lower.includes('cash')) return 'cash'
  return ''
}

export function filterTrialRowsByGroup(rows = [], group = '') {
  const selected = String(group || '').trim().toLowerCase()
  if (!selected) return rows
  return rows.filter((row) => reportAccountGroup(row) === selected)
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

export function reportSelectableCurrencies(currencies = [], baseCurrency = 'USD') {
  const base = String(baseCurrency || 'USD').trim().toUpperCase() || 'USD'
  const allowed = new Set(['USD', 'UZS'])
  const picked = reportCurrencyChoices(currencies, base).filter((code) => allowed.has(code))
  if (!picked.includes(base) && allowed.has(base)) picked.unshift(base)
  return picked.length ? picked : [base]
}

export function reportMoneyHeaderLabels(currencyCode = '') {
  const code = String(currencyCode || '').trim().toUpperCase()
  const suffix = code ? ` (${code})` : ''
  return {
    debit: `Debit${suffix}`,
    credit: `Credit${suffix}`,
    net: `Net${suffix}`,
  }
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

/** Trial Balance / Summary only show gold + silver gram columns. */
const TRIAL_METAL_GRAM_CODES = new Set(['XAU', 'XAG'])

/** Stock-type options that can affect Trial/Summary metal gram columns. */
export function filterTrialMetalGramOptions(stockTypeOptions = []) {
  return (Array.isArray(stockTypeOptions) ? stockTypeOptions : []).filter((option) => (
    TRIAL_METAL_GRAM_CODES.has(String(option?.metalCode || '').trim().toUpperCase())
  ))
}

/** Clear metalType when it is not gold/silver (e.g. leftover Alloy/Platinum). */
export function sanitizeTrialMetalType(metalType, stockTypeOptions = []) {
  const value = String(metalType || '').trim()
  if (!value) return ''
  const allowed = filterTrialMetalGramOptions(stockTypeOptions)
  return allowed.some((option) => option.value === value) ? value : ''
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
  if (columns.debit !== false) values.push(row?.unposted ? '' : format(row?.debit))
  if (columns.credit !== false) values.push(row?.unposted ? '' : format(row?.credit))
  if (columns.net !== false) values.push(format(row?.net))
  return values
}
