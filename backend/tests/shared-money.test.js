const {
  toMoney,
  roundMoney,
  parseAmount,
  formatAmount,
  formatCurrency,
  formatMoney,
  getCurrencyDisplayPrecision,
  getCurrencyPrecision,
  amountToWords,
  getMajorUnitLabel,
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

describe('shared/money currency precision + roundMoney', () => {
  test('getCurrencyPrecision ISO map', () => {
    expect(getCurrencyPrecision('USD')).toBe(2)
    expect(getCurrencyPrecision('EUR')).toBe(2)
    expect(getCurrencyPrecision('GBP')).toBe(2)
    expect(getCurrencyPrecision('AED')).toBe(2)
    expect(getCurrencyPrecision('UZS')).toBe(0)
    expect(getCurrencyPrecision('JPY')).toBe(0)
    expect(getCurrencyPrecision('KWD')).toBe(3)
    expect(getCurrencyPrecision('UNKNOWN')).toBe(2)
    expect(getCurrencyPrecision('UZS')).toBe(getCurrencyDisplayPrecision('UZS'))
  })

  test('roundMoney respects currency digits', () => {
    expect(roundMoney(2000.125, 'USD')).toBe(2000.13)
    expect(roundMoney(2000.125, 'KWD')).toBe(2000.125)
    expect(roundMoney(2000.75, 'JPY')).toBe(2001)
    expect(roundMoney(2000.75, 'UZS')).toBe(2001)
    expect(roundMoney(123456789.1234, 'KWD')).toBe(123456789.123)
  })

  test('identity values survive roundMoney for USD', () => {
    const cases = [1, 10, 100, 1000, 2000, 300000, 3000000, 123456789, 2000.5, 300000.75, 123456789.99]
    for (const n of cases) {
      expect(roundMoney(n, 'USD')).toBe(n)
    }
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

  test('respects display precision for JPY (0) vs USD (2) vs KWD (3) vs UZS (0)', () => {
    expect(formatAmount(300000, { currencyCode: 'JPY' })).toBe('300,000')
    expect(formatAmount(300000, { currencyCode: 'UZS' })).toBe('300,000')
    expect(formatAmount(300000, { currencyCode: 'USD' })).toBe('300,000.00')
    expect(formatAmount(2000.125, { currencyCode: 'KWD' })).toBe('2,000.125')
  })

  test('formatCurrency / formatMoney keep code separate from amount', () => {
    expect(formatCurrency(300000, { code: 'USD' })).toBe('USD 300,000.00')
    expect(formatCurrency(300000, { code: 'EUR' })).toBe('EUR 300,000.00')
    expect(formatCurrency(300000, { code: 'JPY' })).toBe('300,000 JPY')
    expect(formatMoney(300000, 'AED')).toBe('AED 300,000.00')
    expect(formatMoney(300000, 'UZS')).toBe('300,000 UZS')
  })
})

describe('shared/money toMoney + amountToWords', () => {
  test('toMoney matches existing toFixed(2) semantics for base posting', () => {
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

  test('amountToWords optional major unit never forces Dollars for unknown codes', () => {
    expect(getMajorUnitLabel('USD')).toBe('Dollars')
    expect(getMajorUnitLabel('XYZ')).toBe('XYZ')
    expect(amountToWords(2000, { currencyCode: 'USD', includeMajorUnit: true })).toMatch(/Dollars/i)
    expect(amountToWords(2000, { currencyCode: 'XYZ', includeMajorUnit: true })).toMatch(/XYZ/)
    expect(amountToWords(2000, { currencyCode: 'USD' })).not.toMatch(/Dollars/i)
  })
})

describe('shared/money zero data-loss guarantees', () => {
  test('module load does not pull mongoose or run migrations', () => {
    expect(() => require('../../shared/money')).not.toThrow()
    const loaded = require.cache[require.resolve('../../shared/money')]
    expect(loaded).toBeTruthy()
    const moneyPath = require.resolve('../../backend/shared/money')
    expect(moneyPath).toMatch(/backend[\\/]shared[\\/]money\.js$/)
  })
})
