const { resolveStatementRowOriginalAmount } = require('../../services/erpAccounting/statementOriginalAmount')

describe('resolveStatementRowOriginalAmount', () => {
  const uzsPayment = {
    _id: 'tx1',
    type: 'payment',
    journalEntryId: 'led1',
    amount: 145990130,
    currency: 'UZS',
    exchangeRate: 1 / 11000,
  }

  test('recovers the voucher UZS amount from a base-currency main posting', () => {
    const result = resolveStatementRowOriginalAmount({
      entry: { _id: 'led1', referenceType: 'payment', referenceId: 'tx1', amount: 13271.83, currency: 'USD', exchangeRate: 1 },
      transaction: uzsPayment,
      baseCurrencyCode: 'USD',
    })
    expect(result).toEqual({ originalCurrency: 'UZS', originalAmount: 145990130 })
  })

  test('matches by reference when journalEntryId is missing', () => {
    const result = resolveStatementRowOriginalAmount({
      entry: { _id: 'led9', referenceType: 'payment', referenceId: 'tx1', amount: 13271.83, currency: 'USD', exchangeRate: 1 },
      transaction: { ...uzsPayment, journalEntryId: null },
      baseCurrencyCode: 'USD',
    })
    expect(result).toEqual({ originalCurrency: 'UZS', originalAmount: 145990130 })
  })

  test('keeps FX gain/loss rows linked to the same voucher in base currency', () => {
    const result = resolveStatementRowOriginalAmount({
      entry: { _id: 'led2', referenceType: 'expense', referenceId: 'tx1', amount: 120.5, currency: 'USD', exchangeRate: 1 },
      transaction: uzsPayment,
      baseCurrencyCode: 'USD',
    })
    expect(result).toEqual({ originalCurrency: 'USD', originalAmount: 120.5 })
  })

  test('derives a partial (net) posting amount at the voucher rate', () => {
    const result = resolveStatementRowOriginalAmount({
      entry: { _id: 'led3', referenceType: 'sale', referenceId: 'tx3', amount: 100, currency: 'USD', exchangeRate: 1 },
      transaction: { _id: 'tx3', type: 'sale', amount: 1200000, currency: 'UZS', exchangeRate: 1 / 11000 },
      baseCurrencyCode: 'USD',
    })
    expect(result).toEqual({ originalCurrency: 'UZS', originalAmount: 1100000 })
  })

  test('falls back to base when the posting exceeds the voucher total', () => {
    const result = resolveStatementRowOriginalAmount({
      entry: { _id: 'led4', referenceType: 'payment', referenceId: 'tx4', amount: 500, currency: 'USD', exchangeRate: 1 },
      transaction: { _id: 'tx4', type: 'payment', amount: 1000, currency: 'UZS', exchangeRate: 1 / 11000 },
      baseCurrencyCode: 'USD',
    })
    expect(result).toEqual({ originalCurrency: 'USD', originalAmount: 500 })
  })

  test('uses the ledger row itself when it is stored in foreign currency', () => {
    const result = resolveStatementRowOriginalAmount({
      entry: { _id: 'led5', referenceType: 'journal', amount: 750, currency: 'AED', exchangeRate: 0.2723 },
      transaction: null,
      baseCurrencyCode: 'USD',
    })
    expect(result).toEqual({ originalCurrency: 'AED', originalAmount: 750 })
  })

  test('base-currency voucher stays in base', () => {
    const result = resolveStatementRowOriginalAmount({
      entry: { _id: 'led6', referenceType: 'receipt', referenceId: 'tx6', amount: 250, currency: 'USD', exchangeRate: 1 },
      transaction: { _id: 'tx6', type: 'receipt', amount: 250, currency: 'USD', exchangeRate: 1 },
      baseCurrencyCode: 'USD',
    })
    expect(result).toEqual({ originalCurrency: 'USD', originalAmount: 250 })
  })
})
