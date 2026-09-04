const {
  toMoney,
  parseAmount,
  formatAmount,
  formatCurrency,
  getCurrencyDisplayPrecision,
  amountToWords,
} = require('../../shared/money')

describe('shared/money parseAmount', () => {
  const cases = [
    1, 10, 100, 1000, 2000, 300000, 3000000, 123456789,
    2000.5, 300000.75, 123456789.99,
  ]

  test.each(cases)('preserves exact value %p', (n) => {
    expect(parseAmount(n)).toBe(n)
    expect(parseAmount(String(n))).toBe(n)
  })

  test('parses en-US grouped and currency-prefixed strings', () => {
    expect(parseAmount('300,000')).toBe(300000)
    expect(parseAmount('300,000.00')).toBe(300000)
    expect(parseAmount('3,000,000.75')).toBe(3000000.75)
    expect(parseAmount('$300,000.00')).toBe(300000)
    expect(parseAmount('300000 USD')).toBe(300000)
  })

  test('rejects ambiguous EU-style decimals', () => {
    expect(parseAmount('1.234,56')).toBeNull()
    expect(parseAmount('1234,56')).toBeNull()
  })

  test('does not scale by digit count', () => {
    expect(parseAmount('2000')).toBe(2000)
    expect(parseAmount('300000')).toBe(300000)
    expect(parseAmount('3000000')).toBe(3000000)
  })
})

describe('shared/money formatAmount presentation-only', () => {
  test('formats without changing underlying parse round-trip', () => {
    const values = [2000, 300000, 3000000, 300000.75]
    for (const v of values) {
      const shown = formatAmount(v, { currencyCode: 'USD' })
      expect(parseAmount(shown)).toBe(v)
    }
  })

  test('respects display precision for JPY (0) vs USD (2) vs KWD (3)', () => {
    expect(getCurrencyDisplayPrecision('JPY')).toBe(0)
    expect(getCurrencyDisplayPrecision('USD')).toBe(2)
    expect(getCurrencyDisplayPrecision('KWD')).toBe(3)
    expect(formatAmount(300000, { currencyCode: 'JPY' })).toBe('300,000')
    expect(formatAmount(300000, { currencyCode: 'USD' })).toBe('300,000.00')
  })

  test('formatCurrency keeps code separate from amount', () => {
    expect(formatCurrency(300000, { code: 'USD' })).toBe('USD 300,000.00')
    expect(formatCurrency(300000, { code: 'EUR' })).toBe('EUR 300,000.00')
    expect(formatCurrency(300000, { code: 'JPY' })).toBe('JPY 300,000')
  })
})

describe('shared/money toMoney + amountToWords', () => {
  test('toMoney matches existing toFixed(2) semantics', () => {
    expect(toMoney(300000.756)).toBe(300000.76)
    expect(toMoney('2000.5')).toBe(2000.5)
  })

  test('amountToWords uses actual amount and currency subunit', () => {
    expect(amountToWords(2000)).toMatch(/Two Thousand/i)
    expect(amountToWords(300000)).toMatch(/Three Hundred Thousand/i)
    expect(amountToWords(3000000)).toMatch(/Three Million/i)
    expect(amountToWords(2000.5, { currencyCode: 'USD' })).toMatch(/Cents/i)
    expect(amountToWords(2000.5, { currencyCode: 'AED' })).toMatch(/Fils/i)
  })
})
