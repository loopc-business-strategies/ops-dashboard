const {
  planSettlementSplit,
  planPurchaseInventorySplit,
  applyVoucherLedgerSplit,
} = require('../../services/erpAccounting/voucherLedgerSplit')

describe('voucherLedgerSplit', () => {
  test('splits a payment across cash and bank for each line amount', () => {
    const plan = planSettlementSplit({
      type: 'payment',
      exchangeRate: 1,
      mainAmount: 750,
      lines: [
        { type: 'Cash', acCode: 'CASH1000', amountFC: 500, amountLC: 500 },
        { type: 'TT', acCode: 'BANK1010', amountFC: 250, amountLC: 250 },
      ],
    })

    expect(plan.slices).toEqual([
      { accountCode: 'CASH1000', amount: 500 },
      { accountCode: 'BANK1010', amount: 250 },
    ])
  })

  test('splits a receipt across cash and bank', () => {
    const plan = planSettlementSplit({
      type: 'receipt',
      exchangeRate: 1,
      mainAmount: 480,
      lines: [
        { acCode: 'CASH1000', amountLC: 300 },
        { acCode: 'BANK1010', amountLC: 180 },
      ],
    })

    expect(plan.slices.map((slice) => slice.amount)).toEqual([300, 180])
  })

  test('keeps one row when every line uses the same account', () => {
    expect(planSettlementSplit({
      type: 'receipt',
      exchangeRate: 1.2,
      mainAmount: 240,
      lines: [
        { acCode: 'CASH1000', amountFC: 100, currRate: 1.2 },
        { acCode: 'CASH1000', amountFC: 100, currRate: 1.2 },
      ],
    })).toBeNull()
  })

  test('does not split when line amounts do not add up to the posted total', () => {
    expect(planSettlementSplit({
      type: 'payment',
      exchangeRate: 1,
      mainAmount: 100,
      lines: [
        { acCode: 'CASH1000', amountLC: 40 },
        { acCode: 'BANK1010', amountLC: 40 },
      ],
    })).toBeNull()
  })

  test('splits a purchase by stock account', () => {
    const plan = planPurchaseInventorySplit({
      mainAmount: 2112.58,
      plans: [
        { inventoryAccountId: 'stock24', lineAmount: 1543.85 },
        { inventoryAccountId: 'stock22', lineAmount: 568.73 },
      ],
    })

    expect(plan.slices).toEqual([
      { accountId: 'stock24', amount: 1543.85 },
      { accountId: 'stock22', amount: 568.73 },
    ])
  })

  test('keeps one purchase row when both lines use the same stock account', () => {
    expect(planPurchaseInventorySplit({
      mainAmount: 100,
      plans: [
        { inventoryAccountId: 'stock', lineAmount: 40 },
        { inventoryAccountId: 'stock', lineAmount: 60 },
      ],
    })).toBeNull()
  })

  test('writes the extra bank credit and reduces the cash row to its own amount', async () => {
    const created = []
    const ledgerEntry = {
      amount: 750,
      debitAccountId: 'vendor',
      creditAccountId: 'cash',
      date: new Date('2026-10-09'),
      description: 'Payment two lines',
      referenceType: 'payment',
      referenceId: 'tx1',
      currency: 'USD',
      exchangeRate: 1,
      save: async function save() { this.saved = true },
    }

    const applied = await applyVoucherLedgerSplit({
      tx: {
        type: 'payment',
        exchangeRate: 1,
        voucherMeta: {
          lineItems: [
            { acCode: 'CASH1000', amountLC: 500 },
            { acCode: 'BANK1010', amountLC: 250 },
          ],
        },
      },
      ledgerEntry,
      resolveAccountId: async (code) => (code === 'CASH1000' ? 'cash' : 'bank'),
      Ledger: { create: async (docs) => { created.push(...docs); return docs } },
    })

    expect(applied).toBe(true)
    expect(ledgerEntry.amount).toBe(500)
    expect(ledgerEntry.saved).toBe(true)
    expect(created).toEqual([
      expect.objectContaining({
        debitAccountId: 'vendor',
        creditAccountId: 'bank',
        amount: 250,
        referenceType: 'payment',
        referenceId: 'tx1',
      }),
    ])
  })

  test('writes a second purchase debit for the second stock account', async () => {
    const created = []
    const ledgerEntry = {
      amount: 2112.58,
      debitAccountId: 'stock24',
      creditAccountId: 'vendor',
      description: 'Gold purchase',
      referenceType: 'purchase',
      referenceId: 'tx2',
      currency: 'USD',
      exchangeRate: 1,
      save: async function save() { this.saved = true },
    }

    const applied = await applyVoucherLedgerSplit({
      tx: { type: 'purchase' },
      ledgerEntry,
      inventoryPlans: [
        { inventoryAccountId: 'stock24', lineAmount: 1543.85 },
        { inventoryAccountId: 'stock22', lineAmount: 568.73 },
      ],
      Ledger: { create: async (docs) => { created.push(...docs); return docs } },
    })

    expect(applied).toBe(true)
    expect(ledgerEntry.amount).toBe(1543.85)
    expect(created[0]).toEqual(expect.objectContaining({
      debitAccountId: 'stock22',
      creditAccountId: 'vendor',
      amount: 568.73,
      referenceType: 'purchase',
    }))
  })
})
