'use strict'
/**
 * Contract tests for erp-accounting/transactionHelpers.js
 * Verifies the exported constants and pure functions stay stable.
 */

// Isolate from real env vars for deterministic results
process.env.MAX_TRANSACTION_AMOUNT = '1000000000'
process.env.MAX_EXCHANGE_RATE = '1000000'

// Mock the accessPolicy module – we only need role predicates
jest.mock('../services/erpAccounting/accessPolicy', () => ({
  isSuperAdmin: (u) => u?.role === 'super_admin',
  isFinance: (u) => u?.role === 'finance',
  isSales: (u) => u?.role === 'sales',
  isOperations: (u) => u?.role === 'operations',
  isProduction: (u) => u?.role === 'production',
  isHR: (u) => u?.role === 'hr',
}))

const {
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
} = require('../routes/erp-accounting/transactionHelpers')

describe('transactionHelpers – constants', () => {
  test('TRANSACTION_TYPES includes all 6 standard types', () => {
    expect(TRANSACTION_TYPES).toEqual(
      expect.arrayContaining(['expense', 'sale', 'purchase', 'receipt', 'payment', 'payroll'])
    )
    expect(TRANSACTION_TYPES).toHaveLength(6)
  })

  test('TRANSACTION_STATUSES includes all lifecycle states', () => {
    expect(TRANSACTION_STATUSES).toEqual(
      expect.arrayContaining(['draft', 'submitted', 'approved', 'posted', 'returned', 'rejected'])
    )
  })

  test('BASE_CURRENCY_CODE is USD', () => {
    expect(BASE_CURRENCY_CODE).toBe('USD')
  })

  test('MAX_TRANSACTION_AMOUNT and MAX_EXCHANGE_RATE are positive numbers', () => {
    expect(MAX_TRANSACTION_AMOUNT).toBeGreaterThan(0)
    expect(MAX_EXCHANGE_RATE).toBeGreaterThan(0)
  })
})

describe('transactionHelpers – numeric utilities', () => {
  test('toMoney rounds to 2 decimal places', () => {
    expect(toMoney(1.005)).toBe(1)           // JS floating point floor
    expect(toMoney(1.006)).toBe(1.01)        // unambiguous round-up
    expect(toMoney(1.004)).toBe(1)           // unambiguous round-down
    expect(toMoney(0)).toBe(0)
    expect(toMoney(null)).toBe(0)
  })

  test('toQty rounds to 6 decimal places', () => {
    expect(toQty(1.1234567)).toBe(1.123457)
    expect(toQty(undefined)).toBe(0)
  })

  test('parseNumber returns finite numeric or fallback', () => {
    expect(parseNumber('42')).toBe(42)
    expect(parseNumber(NaN, 99)).toBe(99)
    expect(parseNumber('abc', -1)).toBe(-1)
    expect(parseNumber(undefined)).toBe(0)
  })
})

describe('transactionHelpers – normalization', () => {
  test('sanitizeOptionalRef returns null for falsy values', () => {
    expect(sanitizeOptionalRef('')).toBeNull()
    expect(sanitizeOptionalRef(null)).toBeNull()
    expect(sanitizeOptionalRef('abc123')).toBe('abc123')
  })

  test('normalizeMetalFixStatus maps variants correctly', () => {
    expect(normalizeMetalFixStatus('fixed')).toBe('fixed')
    expect(normalizeMetalFixStatus('fixing')).toBe('fixed')
    expect(normalizeMetalFixStatus('unfixed')).toBe('unfixed')
    expect(normalizeMetalFixStatus('non-fixing')).toBe('unfixed')
    expect(normalizeMetalFixStatus('nonfixing')).toBe('unfixed')
    expect(normalizeMetalFixStatus('random')).toBe('')
    expect(normalizeMetalFixStatus('')).toBe('')
  })

  test('normalizeMoneyValue accepts valid positive amounts', () => {
    expect(normalizeMoneyValue(100)).toBe(100)
    expect(normalizeMoneyValue('250.50')).toBe(250.5)
  })

  test('normalizeMoneyValue rejects zero, negative and non-finite', () => {
    expect(() => normalizeMoneyValue(0)).toThrow('Invalid amount')
    expect(() => normalizeMoneyValue(-5)).toThrow('Invalid amount')
    expect(() => normalizeMoneyValue(NaN)).toThrow('Invalid amount')
  })

  test('normalizeMoneyValue rejects values exceeding MAX_TRANSACTION_AMOUNT', () => {
    expect(() => normalizeMoneyValue(MAX_TRANSACTION_AMOUNT + 1)).toThrow('exceeds allowed maximum')
  })

  test('normalizeExchangeRateValue accepts valid rates', () => {
    expect(normalizeExchangeRateValue(1.08)).toBe(1.08)
    expect(normalizeExchangeRateValue('3.67')).toBe(3.67)
  })

  test('normalizeExchangeRateValue rejects non-positive and non-finite values', () => {
    expect(() => normalizeExchangeRateValue(0)).toThrow('Invalid exchange rate')
    expect(() => normalizeExchangeRateValue(-1)).toThrow('Invalid exchange rate')
  })
})

describe('transactionHelpers – getRoleTransactionTypes', () => {
  test('super_admin gets all types', () => {
    expect(getRoleTransactionTypes({ role: 'super_admin' })).toEqual(TRANSACTION_TYPES)
  })

  test('finance gets all types', () => {
    expect(getRoleTransactionTypes({ role: 'finance' })).toEqual(TRANSACTION_TYPES)
  })

  test('sales gets sale and receipt only', () => {
    expect(getRoleTransactionTypes({ role: 'sales' })).toEqual(['sale', 'receipt'])
  })

  test('operations gets purchase and expense only', () => {
    expect(getRoleTransactionTypes({ role: 'operations' })).toEqual(['purchase', 'expense'])
  })

  test('hr gets payroll only', () => {
    expect(getRoleTransactionTypes({ role: 'hr' })).toEqual(['payroll'])
  })

  test('unknown role gets empty array', () => {
    expect(getRoleTransactionTypes({ role: 'viewer' })).toEqual([])
  })
})

describe('transactionHelpers – validateTransactionPayload', () => {
  test('returns empty string for valid expense', () => {
    expect(validateTransactionPayload({ type: 'expense', amount: 100 })).toBe('')
  })

  test('returns error for invalid transaction type', () => {
    expect(validateTransactionPayload({ type: 'refund', amount: 100 })).toMatch(/Invalid transaction type/)
  })

  test('returns error for zero or negative amount', () => {
    expect(validateTransactionPayload({ type: 'expense', amount: 0 })).toMatch(/greater than zero/)
    expect(validateTransactionPayload({ type: 'expense', amount: -5 })).toMatch(/greater than zero/)
  })

  test('receipt without customerId or partyAccount returns error', () => {
    expect(validateTransactionPayload({ type: 'receipt', amount: 100 })).toMatch(/Customer is required/)
  })

  test('receipt with customerId passes', () => {
    expect(validateTransactionPayload({ type: 'receipt', amount: 100, customerId: 'cust1' })).toBe('')
  })

  test('payment without vendor or customer returns error', () => {
    expect(validateTransactionPayload({ type: 'payment', amount: 100 })).toMatch(/Vendor or customer/)
  })
})
