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
 */

'use strict'

/** ISO-4217-style display fraction digits (presentation only). Unknown codes → 2. */
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
 * Display precision only — never rewrite stored accounting values.
 * Optional currencyRow.decimalPlaces / fractionDigits overrides ISO defaults.
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

function formatAmount(value, options = {}) {
  const num = typeof value === 'number' ? value : parseAmount(value)
  const n = num == null || !Number.isFinite(num) ? 0 : num
  const digits = options.fractionDigits != null
    ? options.fractionDigits
    : getCurrencyDisplayPrecision(options.currencyCode, options.currencyRow)
  const min = options.minimumFractionDigits != null ? options.minimumFractionDigits : digits
  const max = options.maximumFractionDigits != null ? options.maximumFractionDigits : digits
  return n.toLocaleString('en-US', {
    minimumFractionDigits: min,
    maximumFractionDigits: max,
  })
}

function formatCurrency(value, options = {}) {
  const code = String(options.code || options.currencyCode || '').trim().toUpperCase()
  const symbol = options.symbol != null ? String(options.symbol) : ''
  const formatted = formatAmount(value, {
    currencyCode: code,
    currencyRow: options.currencyRow,
    fractionDigits: options.fractionDigits,
    minimumFractionDigits: options.minimumFractionDigits,
    maximumFractionDigits: options.maximumFractionDigits,
  })
  if (symbol) return `${symbol}${formatted}`
  if (code) return `${code} ${formatted}`
  return formatted
}

function getSubunitLabel(currencyCode) {
  const key = String(currencyCode || '').trim().toUpperCase()
  return SUBUNIT_LABEL_BY_CODE[key] || 'Cents'
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
  const precision = getCurrencyDisplayPrecision(options.currencyCode, options.currencyRow)
  const scale = 10 ** Math.min(precision, 4)
  const decPart = precision > 0 ? Math.round((abs - intPart) * scale) : 0
  let words = numToWord(intPart).trim()
  if (decPart > 0) {
    const subunit = options.subunitLabel || getSubunitLabel(options.currencyCode)
    words += ` and ${numToWord(decPart).trim()} ${subunit}`
  }
  if (n < 0 && words) words = `Minus ${words}`
  return words.trim()
}

const api = {
  toMoney,
  parseNumber,
  parseAmount,
  formatAmount,
  formatCurrency,
  getCurrencyDisplayPrecision,
  getSubunitLabel,
  amountToWords,
  DISPLAY_PRECISION_BY_CODE,
}

module.exports = api
module.exports.default = api
