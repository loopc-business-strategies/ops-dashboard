const { createTransactionAccountResolutionService } = require('../../services/erpAccounting/transactionAccountResolutionService')

describe('transactionAccountResolutionService', () => {
  test('normalizeCurrencyCode uppercases and falls back', () => {
    const svc = createTransactionAccountResolutionService({
      ChartOfAccount: {},
      AccountMapping: {},
      Customer: {},
      Vendor: {},
      InventoryItem: {},
      Currency: {},
      Ledger: {},
      BASE_CURRENCY_CODE: 'USD',
      normalizeExchangeRateValue: (n) => Number(n || 1),
      normalizeMoneyValue: (n) => Number(n || 0),
      toMoney: (n) => n,
      ensureAccountByCode: async () => ({ _id: 'x' }),
      resolveVoucherNetLineAmount: () => 0,
      resolveVoucherVatAmount: () => 0,
      resolveReferenceExchangeRate: () => 0,
      resolvePrimaryVoucherFxLine: () => null,
      resolveVoucherFxMetrics: () => ({}),
      resolveExchangeAdjustmentAccounts: async () => ({ debitAccountId: 'a', creditAccountId: 'b' }),
      FX_REVALUATION_EPSILON: 0.01,
    })
    expect(svc.normalizeCurrencyCode('  aed ', 'USD')).toBe('AED')
  })
})
