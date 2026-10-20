const { createTransactionAccountResolutionService } = require('../../services/erpAccounting/transactionAccountResolutionService')

function buildSvc(overrides = {}) {
  const cashAccount = { _id: 'cash-1000', accountCode: '1000', isActive: true, accountType: 'Asset' }
  const findOneChain = {
    sort: () => Promise.resolve(cashAccount),
  }
  return createTransactionAccountResolutionService({
    ChartOfAccount: {
      findOne: jest.fn(() => findOneChain),
      findById: jest.fn(async () => cashAccount),
      find: jest.fn(() => ({ sort: async () => [cashAccount] })),
      create: jest.fn(async () => [cashAccount]),
    },
    AccountMapping: { findOne: async () => null, findById: async () => null },
    Customer: { findById: () => ({ populate: async () => null }) },
    Vendor: { findById: () => ({ populate: async () => null }) },
    InventoryItem: {},
    Currency: {},
    Ledger: {},
    BASE_CURRENCY_CODE: 'USD',
    normalizeExchangeRateValue: (n) => Number(n || 1),
    normalizeMoneyValue: (n) => Number(n || 0),
    toMoney: (n) => n,
    ensureAccountByCode: async ({ code }) => ({ _id: `acc-${code}`, accountCode: code }),
    ensureChildAccountByName: async ({ accountName, codePrefix }) => ({
      _id: `child-${codePrefix}-${accountName}`,
      accountName,
    }),
    resolveVoucherNetLineAmount: () => 0,
    resolveVoucherVatAmount: () => 0,
    resolveReferenceExchangeRate: () => 0,
    resolvePrimaryVoucherFxLine: () => null,
    resolveVoucherFxMetrics: () => ({}),
    resolveExchangeAdjustmentAccounts: async () => ({ debitAccountId: 'a', creditAccountId: 'b' }),
    FX_REVALUATION_EPSILON: 0.01,
    ...overrides,
  })
}

describe('transactionAccountResolutionService', () => {
  test('normalizeCurrencyCode uppercases and falls back', () => {
    const svc = buildSvc()
    expect(svc.normalizeCurrencyCode('  aed ', 'USD')).toBe('AED')
  })

  test('metal sale credits Gold Sales Fixing instead of parent 4000', async () => {
    const customerLedgerId = 'cust-ar'
    const svc = buildSvc({
      Customer: {
        findById: () => ({
          populate: async () => ({
            ledgerAccountId: { _id: customerLedgerId },
          }),
        }),
      },
    })

    const accounts = await svc.resolveTransactionAccounts({
      user: { _id: 'u1' },
      tx: {
        type: 'sale',
        currency: 'USD',
        customerId: 'c1',
        voucherMeta: {
          lineItems: [{ stockCode: 'GOLD', productType: 'Gold Bar', pureWeight: 100 }],
        },
      },
      mappingOverride: {},
      preparedVoucherImpact: {},
    })

    expect(String(accounts.debitAccountId)).toBe(customerLedgerId)
    expect(String(accounts.creditAccountId)).toContain('Gold Sales Fixing')
  })
})
