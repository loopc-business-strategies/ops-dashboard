/**
 * Central monetary helpers for ERP accounting.
 *
 * DATA SAFETY — field map (do not migrate / rewrite historical rows):
 * - Transaction.amount / Ledger.amount: Number (major units, not cents)
 * - Transaction.currency / Ledger.currency: separate String code
 * - exchangeRate: Number — stored as base units per 1 FC (amount * rate = base)
 * - voucherMeta.lineItems.amountFC / amountLC: Number (FC vs local/base-ish)
 * - Currency master: per-tenant code/symbol/exchangeRate/baseCurrency (no decimalPlaces field)
 *
 * Formatting is presentation-only. parseAmount never scales by digit count.
 * Prefer NO DB migration; historical values stay untouched.
 *
 * toMoney(value) stays 2dp for backend base-equivalent posting/report contracts.
 * Use roundMoney(value, currencyCode) for document/FC currency-aware rounding.
 */

'use strict'

/** ISO-4217-style fraction digits (code-level; no DB field). Unknown codes → 2. */
const DISPLAY_PRECISION_BY_CODE = {
  BHD: 3,
  IQD: 3,
  JOD: 3,
  KWD: 3,
  LYD: 3,
  OMR: 3,
  TND: 3,
  CLF: 4,
  UYI: 0,
  UYW: 4,
  ISK: 0,
  JPY: 0,
  KRW: 0,
  VND: 0,
  VUV: 0,
  XAF: 0,
  XOF: 0,
  XPF: 0,
  UGX: 0,
  RWF: 0,
  DJF: 0,
  GNF: 0,
  KMF: 0,
  PYG: 0,
  BIF: 0,
  UZS: 0,
}

const SUBUNIT_LABEL_BY_CODE = {
  USD: 'Cents',
  EUR: 'Cents',
  GBP: 'Pence',
  AED: 'Fils',
  SAR: 'Halalas',
  QAR: 'Dirhams',
  KWD: 'Fils',
  INR: 'Paise',
  CNY: 'Fen',
  JPY: 'Sen',
  KZT: 'Tiyn',
  RUB: 'Kopeks',
  TRY: 'Kurus',
  UZS: 'Tiyin',
}

const MAJOR_UNIT_LABEL_BY_CODE = {
  USD: 'Dollars',
  EUR: 'Euros',
  GBP: 'Pounds',
  AED: 'Dirhams',
  SAR: 'Riyals',
  QAR: 'Riyals',
  KWD: 'Dinars',
  INR: 'Rupees',
  CNY: 'Yuan',
  JPY: 'Yen',
  KZT: 'Tenge',
  RUB: 'Rubles',
  TRY: 'Lira',
  UZS: 'Som',
}

const DEFAULT_SYMBOL_BY_CODE = {
  USD: '$',
  EUR: '€',
  GBP: '£',
  JPY: '¥',
  CNY: '¥',
  INR: '₹',
}

/** Backend base-equivalent / report rounding — intentionally always 2dp. */
function toMoney(value) {
  return Number(Number(value || 0).toFixed(2))
}

function parseNumber(value, fallback = 0) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

/**
 * Safe amount parser. Digit length never implies scale.
 * Accepts plain numbers, optional currency symbols/codes, and en-US grouping commas.
 * Rejects ambiguous EU-style "1.234,56" / "1234,56" (returns null).
 *
 * @param {unknown} raw
 * @returns {number|null}
 */
function parseAmount(raw) {
  if (raw === null || raw === undefined) return null
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? raw : null
  }

  let s = String(raw).trim()
  if (!s) return null
  if (s === '.' || s === '-' || s === '-.' || s === '+') return null

  // Strip currency symbols / code suffixes commonly pasted from UI
  s = s.replace(/^[\$€£¥₹]\s*/u, '')
  s = s.replace(/\s*(USD|EUR|GBP|AED|UZS|INR|CNY|JPY|KZT|RUB|TRY|SAR|QAR|KWD)\s*$/iu, '')
  s = s.trim()
  if (!s) return null

  // Reject EU decimal forms: "1.234,56" or "1234,56"
  if (/^-?\d{1,3}(\.\d{3})+,\d+$/.test(s)) return null
  if (/^-?\d+,\d{1,2}$/.test(s)) return null

  const usGrouped = /^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)
  const plain = /^-?\d+(\.\d+)?$/.test(s)
  const leadingDot = /^-?\.\d+$/.test(s)
  // Integer thousands without decimal part: "300,000"
  const usIntGroups = /^-?\d{1,3}(,\d{3})+$/.test(s)

  if (!usGrouped && !plain && !leadingDot && !usIntGroups) return null

  const normalized = s.replace(/,/g, '')
  const num = Number.parseFloat(normalized)
  return Number.isFinite(num) ? num : null
}

/**
 * Currency fraction digits from ISO map or optional in-memory currencyRow override.
 * Never rewrites stored DB values.
 */
function getCurrencyDisplayPrecision(code, currencyRow) {
  const fromRow = currencyRow?.decimalPlaces ?? currencyRow?.fractionDigits
  if (fromRow != null && Number.isFinite(Number(fromRow))) {
    return Math.max(0, Math.min(6, Number(fromRow)))
  }
  const key = String(code || '').trim().toUpperCase()
  if (Object.prototype.hasOwnProperty.call(DISPLAY_PRECISION_BY_CODE, key)) {
    return DISPLAY_PRECISION_BY_CODE[key]
  }
  return 2
}

/** Alias — preferred name for calc/display precision. */
function getCurrencyPrecision(code, currencyRow) {
  return getCurrencyDisplayPrecision(code, currencyRow)
}

/**
 * Round a numeric amount to the currency's precision (UI / document FC calc).
 * Does not infer currency from digit count.
 */
function roundMoney(value, currencyCode, currencyRow) {
  const n = typeof value === 'number' ? value : parseAmount(value)
  if (n == null || !Number.isFinite(n)) return 0
  const digits = getCurrencyPrecision(currencyCode, currencyRow)
  return Number(n.toFixed(digits))
}

function formatAmount(value, options = {}) {
  const num = typeof value === 'number' ? value : parseAmount(value)
  const n = num == null || !Number.isFinite(num) ? 0 : num
  const digits = options.fractionDigits != null
    ? options.fractionDigits
    : getCurrencyPrecision(options.currencyCode, options.currencyRow)
  const min = options.minimumFractionDigits != null ? options.minimumFractionDigits : digits
  const max = options.maximumFractionDigits != null ? options.maximumFractionDigits : digits
  return n.toLocaleString('en-US', {
    minimumFractionDigits: min,
    maximumFractionDigits: max,
  })
}

/**
 * Presentation helper: amount + currency (symbol or code).
 * Prefer formatMoney(value, currencyCode) for call sites.
 */
function formatCurrency(value, options = {}) {
  const code = String(options.code || options.currencyCode || '').trim().toUpperCase()
  let symbol = options.symbol != null ? String(options.symbol) : ''
  if (!symbol && options.useDefaultSymbol && code && DEFAULT_SYMBOL_BY_CODE[code]) {
    symbol = DEFAULT_SYMBOL_BY_CODE[code]
  }
  const formatted = formatAmount(value, {
    currencyCode: code,
    currencyRow: options.currencyRow,
    fractionDigits: options.fractionDigits,
    minimumFractionDigits: options.minimumFractionDigits,
    maximumFractionDigits: options.maximumFractionDigits,
  })
  if (symbol) return `${symbol}${formatted}`
  if (code) {
    // Zero-decimal currencies often read better as "2,000 UZS"
    const precision = getCurrencyPrecision(code, options.currencyRow)
    if (precision === 0) return `${formatted} ${code}`
    return `${code} ${formatted}`
  }
  return formatted
}

/**
 * Authoritative frontend money formatter: formatMoney(amount, currencyCode, options?).
 */
function formatMoney(value, currencyCode, options = {}) {
  if (currencyCode && typeof currencyCode === 'object' && !Array.isArray(currencyCode)) {
    // Allow formatMoney(value, { currencyCode, ... })
    return formatCurrency(value, currencyCode)
  }
  return formatCurrency(value, {
    ...options,
    currencyCode: currencyCode || options.currencyCode || options.code,
    code: currencyCode || options.code || options.currencyCode,
  })
}

function getSubunitLabel(currencyCode) {
  const key = String(currencyCode || '').trim().toUpperCase()
  return SUBUNIT_LABEL_BY_CODE[key] || 'Cents'
}

function getMajorUnitLabel(currencyCode) {
  const key = String(currencyCode || '').trim().toUpperCase()
  if (Object.prototype.hasOwnProperty.call(MAJOR_UNIT_LABEL_BY_CODE, key)) {
    return MAJOR_UNIT_LABEL_BY_CODE[key]
  }
  return key || ''
}

function amountToWords(amount, options = {}) {
  if (amount == null || amount === '' || Number.isNaN(Number(amount))) return ''
  const n = typeof amount === 'number' ? amount : parseAmount(amount)
  if (n == null || !Number.isFinite(n) || n === 0) return n === 0 ? '' : ''

  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen',
    'Seventeen', 'Eighteen', 'Nineteen']
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety']
  const numToWord = (x) => {
    if (x === 0) return ''
    if (x < 20) return `${ones[x]} `
    if (x < 100) return `${tens[Math.floor(x / 10)]} ${ones[x % 10]} `
    if (x < 1000) return `${ones[Math.floor(x / 100)]} Hundred ${numToWord(x % 100)}`
    if (x < 1000000) return `${numToWord(Math.floor(x / 1000))}Thousand ${numToWord(x % 1000)}`
    if (x < 1000000000) return `${numToWord(Math.floor(x / 1000000))}Million ${numToWord(x % 1000000)}`
    return `${numToWord(Math.floor(x / 1000000000))}Billion ${numToWord(x % 1000000000)}`
  }

  const abs = Math.abs(n)
  const intPart = Math.floor(abs)
  const precision = getCurrencyPrecision(options.currencyCode, options.currencyRow)
  const scale = 10 ** Math.min(precision, 4)
  const decPart = precision > 0 ? Math.round((abs - intPart) * scale) : 0
  let words = numToWord(intPart).trim()

  if (options.includeMajorUnit === true && options.currencyCode) {
    const major = options.majorUnitLabel || getMajorUnitLabel(options.currencyCode)
    if (major) words = `${words} ${major}`.trim()
  }

  if (decPart > 0) {
    const subunit = options.subunitLabel || getSubunitLabel(options.currencyCode)
    words += ` and ${numToWord(decPart).trim()} ${subunit}`
  }
  if (n < 0 && words) words = `Minus ${words}`
  return words.trim()
}

const api = {
  toMoney,
  roundMoney,
  parseNumber,
  parseAmount,
  formatAmount,
  formatCurrency,
  formatMoney,
  getCurrencyDisplayPrecision,
  getCurrencyPrecision,
  getSubunitLabel,
  getMajorUnitLabel,
  amountToWords,
  DISPLAY_PRECISION_BY_CODE,
  MAJOR_UNIT_LABEL_BY_CODE,
  DEFAULT_SYMBOL_BY_CODE,
}

module.exports = api
module.exports.default = api
