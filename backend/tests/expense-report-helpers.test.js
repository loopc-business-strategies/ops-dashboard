const {
  classifyPaymentSource,
  buildExpensePaymentRoute,
  paymentSourceToMethodLabel,
  mapExpenseLedgerEntry,
  resolveLedgerRef,
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

  it('resolves ledger reference from voucher fields', () => {
    expect(resolveLedgerRef({ autoTxNo: 'JV-1024', txRefNo: 'REF-1', chequeNo: 'CHQ-9' })).toBe('JV-1024')
    expect(resolveLedgerRef({ txRefNo: 'REF-1', chequeNo: 'CHQ-9' })).toBe('REF-1')
    expect(resolveLedgerRef({ chequeNo: 'CHQ-9' })).toBe('CHQ-9')
    expect(resolveLedgerRef({})).toBe('')
  })

  it('maps expense ledger entry with account labels and ledger ref', () => {
    const toMoney = (n) => Math.round(Number(n) * 100) / 100
    const getType = (accountId) => accountMetaMap.get(String(accountId))?.accountType || ''
    const mapped = mapExpenseLedgerEntry(
      {
        _id: 'e1',
        date: new Date('2026-03-01'),
        amount: 100,
        exchangeRate: 1,
        debitAccountId: 'debit1',
        creditAccountId: 'credit-bank',
        description: 'Office rent',
        referenceType: 'expense',
        autoTxNo: 'JV-1024',
      },
      accountMetaMap,
      getType,
      toMoney,
    )
    expect(mapped.paymentRoute).toBe('HSBC Current (1010) → Operating Expenses (6100)')
    expect(mapped.fundingAccount).toBe('HSBC Current (1010)')
    expect(mapped.expenseAccount).toBe('Operating Expenses (6100)')
    expect(mapped.ledgerRef).toBe('JV-1024')
  })

  it('maps credit-to-expense reversals as negative register rows', () => {
    const toMoney = (n) => Math.round(Number(n) * 100) / 100
    const getType = (accountId) => accountMetaMap.get(String(accountId))?.accountType || ''
    const mapped = mapExpenseLedgerEntry(
      {
        _id: 'e3',
        date: new Date('2026-03-10'),
        amount: 40,
        exchangeRate: 1,
        debitAccountId: 'credit-bank',
        creditAccountId: 'debit1',
        description: 'Advance applied',
        referenceType: 'journal',
      },
      accountMetaMap,
      getType,
      toMoney,
    )
    expect(mapped.amount).toBe(-40)
    expect(mapped.category).toBe('Operating Expenses')
    expect(mapped.paymentRoute).toBe('Operating Expenses (6100) → HSBC Current (1010)')
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

  it('includes credit-to-expense rows in register output', () => {
    const toMoney = (n) => Math.round(Number(n) * 100) / 100
    const payrollId = 'payroll-620001'
    const bankId = 'credit-bank'
    const payrollMetaMap = new Map([
      [payrollId, { accountCode: '620001', accountName: 'advance payment- payroll', accountType: 'Expense' }],
      [bankId, { accountCode: '1010', accountName: 'HSBC Current', accountType: 'Asset' }],
    ])
    const ledgerEntries = [
      {
        _id: 'debit-row',
        date: new Date('2026-03-01'),
        amount: 6544,
        exchangeRate: 1,
        debitAccountId: payrollId,
        creditAccountId: bankId,
        description: 'Advance paid',
        referenceType: 'expense',
      },
      {
        _id: 'credit-row',
        date: new Date('2026-03-10'),
        amount: 4000,
        exchangeRate: 1,
        debitAccountId: bankId,
        creditAccountId: payrollId,
        description: 'Advance applied',
        referenceType: 'journal',
      },
    ]

    const register = buildExpenseRegisterFromLedger({
      ledgerEntries,
      accountMetaMap: payrollMetaMap,
      periodStart: new Date('2026-01-01'),
      periodEnd: new Date('2026-12-31T23:59:59'),
      toMoney,
    })

    expect(register.total).toBe(2)
    expect(register.items.some((row) => row.amount === -4000)).toBe(true)
    const net = register.items.reduce((sum, row) => sum + Number(row.amount || 0), 0)
    expect(net).toBe(2544)
  })
})
