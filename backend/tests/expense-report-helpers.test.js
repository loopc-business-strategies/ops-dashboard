const {
  classifyPaymentSource,
  buildExpensePaymentRoute,
  paymentSourceToMethodLabel,
  buildExpenseRegisterFromLedger,
} = require('../utils/expenseReportHelpers')

describe('expenseReportHelpers', () => {
  const accountMetaMap = new Map([
    ['debit1', { accountCode: '6100', accountName: 'Operating Expenses', accountType: 'Expense' }],
    ['credit-bank', { accountCode: '1010', accountName: 'HSBC Current', accountType: 'Asset' }],
    ['credit-cash', { accountCode: '1020', accountName: 'Petty Cash', accountType: 'Asset' }],
  ])

  it('classifies bank payment from credit account name', () => {
    expect(classifyPaymentSource(
      { accountCode: '1010', accountName: 'HSBC Current' },
      {},
    )).toBe('bank')
  })

  it('classifies cash payment from credit account name', () => {
    expect(classifyPaymentSource(
      { accountCode: '1020', accountName: 'Petty Cash' },
      {},
    )).toBe('cash')
  })

  it('classifies transfer from paymentType', () => {
    expect(classifyPaymentSource({}, { paymentType: 'transfer' })).toBe('transfer')
  })

  it('classifies bank from referenceType', () => {
    expect(classifyPaymentSource({}, { referenceType: 'bank_jv' })).toBe('bank')
  })

  it('builds payment route from credit to debit accounts', () => {
    const route = buildExpensePaymentRoute(
      { debitAccountId: 'debit1', creditAccountId: 'credit-bank' },
      accountMetaMap,
    )
    expect(route).toBe('HSBC Current (1010) → Operating Expenses (6100)')
  })

  it('maps payment source to method label', () => {
    expect(paymentSourceToMethodLabel('bank')).toBe('Bank')
    expect(paymentSourceToMethodLabel('cash')).toBe('Cash')
  })

  it('builds expense register sorted newest first with filters', () => {
    const toMoney = (n) => Math.round(Number(n) * 100) / 100
    const ledgerEntries = [
      {
        _id: 'e1',
        date: new Date('2026-03-01'),
        amount: 100,
        exchangeRate: 1,
        debitAccountId: 'debit1',
        creditAccountId: 'credit-bank',
        description: 'Office rent',
        referenceType: 'expense',
        currency: 'USD',
      },
      {
        _id: 'e2',
        date: new Date('2026-02-15'),
        amount: 50,
        exchangeRate: 1,
        debitAccountId: 'debit1',
        creditAccountId: 'credit-cash',
        description: 'Supplies',
        referenceType: 'expense',
        currency: 'USD',
      },
    ]

    const periodStart = new Date('2026-01-01')
    const periodEnd = new Date('2026-12-31T23:59:59')

    const all = buildExpenseRegisterFromLedger({
      ledgerEntries,
      accountMetaMap,
      periodStart,
      periodEnd,
      toMoney,
    })
    expect(all.total).toBe(2)
    expect(all.items[0].description).toBe('Office rent')
    expect(all.items[0].paymentSource).toBe('bank')
    expect(all.categories).toContain('Operating Expenses')

    const bankOnly = buildExpenseRegisterFromLedger({
      ledgerEntries,
      accountMetaMap,
      periodStart,
      periodEnd,
      paymentSourceFilter: 'bank',
      toMoney,
    })
    expect(bankOnly.total).toBe(1)
    expect(bankOnly.items[0].paymentRoute).toContain('HSBC Current')
  })
})
