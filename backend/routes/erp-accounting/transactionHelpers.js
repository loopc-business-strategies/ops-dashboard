/**
 * Pure utility helpers for ERP transaction processing.
 * No DB access, no side effects — safe to import anywhere.
 */

const {
  isSuperAdmin,
  isFinance,
  isSales,
  isOperations,
  isProduction,
  isHR,
} = require('../../services/erpAccounting/accessPolicy')

// ==========================================
// TRANSACTION DOMAIN CONSTANTS
// ==========================================

const TRANSACTION_TYPES = ['expense', 'sale', 'purchase', 'receipt', 'payment', 'payroll']
const TRANSACTION_STATUSES = ['draft', 'submitted', 'approved', 'posted', 'returned', 'rejected']
const BASE_CURRENCY_CODE = 'USD'
const MAX_TRANSACTION_AMOUNT = Number(process.env.MAX_TRANSACTION_AMOUNT || 1_000_000_000)
const MAX_EXCHANGE_RATE = Number(process.env.MAX_EXCHANGE_RATE || 1_000_000)

// ==========================================
// NUMERIC UTILITIES
// ==========================================

const toMoney = (value) => Number(Number(value || 0).toFixed(2))
const toQty = (value) => Number(Number(value || 0).toFixed(6))

const parseNumber = (value, fallback = 0) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

// ==========================================
// NORMALIZATION HELPERS
// ==========================================

const sanitizeOptionalRef = (value) => (value ? value : null)

const normalizeMetalFixStatus = (value) => {
  const normalized = String(value || '').trim().toLowerCase()
  if (['fixed', 'fixing'].includes(normalized)) return 'fixed'
  if (['unfixed', 'unfix', 'non-fixing', 'non_fixing', 'nonfixing'].includes(normalized)) return 'unfixed'
  return ''
}

const normalizeMoneyValue = (value, field = 'amount') => {
  const num = Number(value)
  if (!Number.isFinite(num) || num <= 0) throw new Error(`Invalid ${field}`)
  if (num > MAX_TRANSACTION_AMOUNT) throw new Error(`${field} exceeds allowed maximum`)
  return num
}

const normalizeExchangeRateValue = (value, field = 'exchange rate') => {
  const num = Number(value)
  if (!Number.isFinite(num) || num <= 0) throw new Error(`Invalid ${field}`)
  if (num > MAX_EXCHANGE_RATE) throw new Error(`${field} exceeds allowed maximum`)
  return num
}

// ==========================================
// ROLE-BASED TRANSACTION ACCESS
// ==========================================

const getRoleTransactionTypes = (user) => {
  if (isSuperAdmin(user) || isFinance(user)) return TRANSACTION_TYPES
  if (isSales(user)) return ['sale', 'receipt']
  if (isOperations(user) || isProduction(user)) return ['purchase', 'expense']
  if (isHR(user)) return ['payroll']
  return []
}

// ==========================================
// TRANSACTION PAYLOAD VALIDATION
// ==========================================

const validateTransactionPayload = (payload) => {
  const hasDirectPartyAccount = Boolean(
    payload.partyAccountId
    || payload.voucherMeta?.partyAccountId
    || String(payload.voucherMeta?.partyCode || '').trim()
  )

  if (!TRANSACTION_TYPES.includes(String(payload.type || ''))) {
    return 'Invalid transaction type'
  }

  const amount = Number(payload.amount)
  if (!Number.isFinite(amount) || amount <= 0) {
    return 'Amount must be greater than zero'
  }

  if (payload.type === 'receipt' && !payload.customerId && !hasDirectPartyAccount) {
    return 'Customer is required for receipts'
  }

  if (payload.type === 'sale' && !payload.customerId && !payload.vendorId && !hasDirectPartyAccount) {
    return 'Customer or vendor is required for sales'
  }

  if (payload.type === 'purchase' && !payload.vendorId && !payload.customerId && !hasDirectPartyAccount) {
    return 'Vendor or customer is required for purchases'
  }

  if (payload.type === 'payment' && !payload.vendorId && !payload.customerId && !hasDirectPartyAccount) {
    return 'Vendor or customer is required for payments'
  }

  return ''
}

module.exports = {
  TRANSACTION_TYPES,
  TRANSACTION_STATUSES,
  BASE_CURRENCY_CODE,
  MAX_TRANSACTION_AMOUNT,
  MAX_EXCHANGE_RATE,
  toMoney,
  toQty,
  parseNumber,
  sanitizeOptionalRef,
  normalizeMetalFixStatus,
  normalizeMoneyValue,
  normalizeExchangeRateValue,
  getRoleTransactionTypes,
  validateTransactionPayload,
}
