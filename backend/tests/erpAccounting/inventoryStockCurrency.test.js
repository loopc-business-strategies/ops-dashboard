const { pickStockMovementCurrencyCandidate } = require('../../routes/erp-accounting/inventoryRoutes')

describe('pickStockMovementCurrencyCandidate', () => {
  test('prefers body currency, then item, then ledger, then base', () => {
    expect(pickStockMovementCurrencyCandidate({
      requestedCurrency: 'EUR',
      itemCurrency: 'GBP',
      ledgerCurrency: 'AED',
      baseCurrencyCode: 'UZS',
    })).toBe('EUR')

    expect(pickStockMovementCurrencyCandidate({
      requestedCurrency: '',
      itemCurrency: 'GBP',
      ledgerCurrency: 'AED',
      baseCurrencyCode: 'UZS',
    })).toBe('GBP')

    expect(pickStockMovementCurrencyCandidate({
      requestedCurrency: '',
      itemCurrency: '',
      ledgerCurrency: 'AED',
      baseCurrencyCode: 'UZS',
    })).toBe('AED')

    expect(pickStockMovementCurrencyCandidate({
      requestedCurrency: '',
      itemCurrency: '',
      ledgerCurrency: '',
      baseCurrencyCode: 'UZS',
    })).toBe('UZS')
  })

  test('falls through to USD when base missing', () => {
    expect(pickStockMovementCurrencyCandidate({
      requestedCurrency: '',
      itemCurrency: '',
      ledgerCurrency: '',
      baseCurrencyCode: '',
      fallbackBase: 'USD',
    })).toBe('USD')
  })
})
