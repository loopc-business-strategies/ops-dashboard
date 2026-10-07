const {
  computeVoucherFixingAmount,
  summarizeVoucherFixingState,
  resolveOpenUnfixedVoucherAmount,
  assertVoucherFixable,
  createVoucherFixingService,
} = require('../services/erpAccounting/voucherFixingService')

const OZ = 31.1034768

function buildUnfixedPurchase(overrides = {}) {
  const fixings = overrides.fixings || []
  const tx = {
    _id: '6ac605b8dffb0a7e2d41a840',
    type: 'purchase',
    status: 'posted',
    currency: 'USD',
    exchangeRate: 1,
    debitAccountId: '6ac605b8dffb0a7e2d41a801',
    creditAccountId: '6ac605b8dffb0a7e2d41a802',
    voucherMeta: {
      vocNo: 'Pur/2026/0001',
      fixingType: 'non-fixing',
      lineItems: [{ stockCode: 'GOLD', pureWeight: 199.98, rateType: 'OZ' }],
      fixings,
    },
    auditTrail: [],
    ...overrides,
  }
  tx.voucherMeta.fixings.id = (id) => tx.voucherMeta.fixings.find((row) => String(row._id) === String(id))
  tx.save = jest.fn(async () => tx)
  return tx
}

describe('voucherFixingService helpers', () => {
  test('fixing amount follows the rate unit', () => {
    expect(computeVoucherFixingAmount({ pureWeight: OZ, rate: 4000, rateType: 'OZ', currency: 'USD' })).toBe(4000)
    expect(computeVoucherFixingAmount({ pureWeight: 10, rate: 130, rateType: 'GRAM', currency: 'USD' })).toBe(1300)
    expect(computeVoucherFixingAmount({ pureWeight: 500, rate: 128000, rateType: 'KG', currency: 'USD' })).toBe(64000)
  })

  test('summary counts only active fixings', () => {
    const state = summarizeVoucherFixingState(buildUnfixedPurchase({
      fixings: [
        { _id: 'f1', pureWeight: 100 },
        { _id: 'f2', pureWeight: 50, isDeleted: true },
      ],
    }))
    expect(state.totalWeight).toBeCloseTo(199.98, 6)
    expect(state.fixedWeight).toBeCloseTo(100, 6)
    expect(state.openWeight).toBeCloseTo(99.98, 6)
    expect(state.metalCode).toBe('XAU')
    expect(state.isUnfixed).toBe(true)
  })

  test('open unfixed amount keeps the premium and shrinks the metal part', () => {
    expect(resolveOpenUnfixedVoucherAmount({ voucherAmount: 1100, premiumAmount: 100, totalWeight: 200, openWeight: 200 })).toBe(1100)
    expect(resolveOpenUnfixedVoucherAmount({ voucherAmount: 1100, premiumAmount: 100, totalWeight: 200, openWeight: 50 })).toBe(350)
    expect(resolveOpenUnfixedVoucherAmount({ voucherAmount: 1100, premiumAmount: 100, totalWeight: 200, openWeight: 0 })).toBe(0)
  })

  test('rejects fixed, unposted and fully fixed vouchers', () => {
    const fixed = buildUnfixedPurchase()
    fixed.voucherMeta.fixingType = 'fixing'
    expect(() => assertVoucherFixable(fixed, summarizeVoucherFixingState(fixed))).toThrow('already fixed')

    const draft = buildUnfixedPurchase({ status: 'draft' })
    expect(() => assertVoucherFixable(draft, summarizeVoucherFixingState(draft))).toThrow('Only posted')

    const closed = buildUnfixedPurchase({ fixings: [{ _id: 'f1', pureWeight: 199.98 }] })
    expect(() => assertVoucherFixable(closed, summarizeVoucherFixingState(closed))).toThrow('no unfixed grams left')
  })
})

describe('createVoucherFixingService', () => {
  function buildService(tx) {
    const ledgerRows = []
    const Ledger = {
      create: jest.fn(async (rows) => rows.map((row) => {
        const created = { ...row, _id: `ledger-${ledgerRows.length + 1}` }
        ledgerRows.push(created)
        return created
      })),
      updateMany: jest.fn(async () => ({ modifiedCount: 1 })),
    }
    const Transaction = { findById: jest.fn(() => Promise.resolve(tx)) }
    const Currency = {
      findOne: jest.fn(() => ({ select: () => ({ lean: () => Promise.resolve({ code: 'USD' }) }) })),
    }
    const assertAccountingPeriodOpen = jest.fn(async () => {})
    const service = createVoucherFixingService({
      Transaction,
      Ledger,
      Currency,
      BASE_CURRENCY_CODE: 'USD',
      assertAccountingPeriodOpen,
      appendTransactionAudit: (target, user, action) => target.auditTrail.push({ action }),
    })
    return { service, Ledger, ledgerRows, assertAccountingPeriodOpen }
  }

  const user = { _id: '6ac605b8dffb0a7e2d41a899', department: 'Finance' }

  test('posts the metal value with the voucher accounts and records the fixed grams', async () => {
    const tx = buildUnfixedPurchase()
    const { service, ledgerRows, assertAccountingPeriodOpen } = buildService(tx)

    const result = await service.addVoucherFixing({
      transactionId: tx._id,
      user,
      tenant: 'mg',
      date: '2026-10-07',
      rate: 4126.13,
      rateType: 'OZ',
    })

    expect(ledgerRows).toHaveLength(1)
    expect(ledgerRows[0]).toMatchObject({
      referenceType: 'voucher_fixing',
      debitAccountId: tx.debitAccountId,
      creditAccountId: tx.creditAccountId,
      currency: 'USD',
      exchangeRate: 1,
    })
    expect(ledgerRows[0].amount).toBeCloseTo((199.98 / OZ) * 4126.13, 2)
    expect(String(ledgerRows[0].referenceId)).toBe(String(tx.voucherMeta.fixings[0]._id))
    expect(tx.voucherMeta.fixings[0]).toMatchObject({ pureWeight: 199.98, metalCode: 'XAU', rateType: 'OZ' })
    expect(result.state.openWeight).toBe(0)
    expect(assertAccountingPeriodOpen).toHaveBeenCalledWith(expect.objectContaining({ tenant: 'mg' }))
    expect(assertAccountingPeriodOpen.mock.calls[0][0].createdAt).toBeUndefined()
    expect(tx.auditTrail.map((row) => row.action)).toContain('fixing_added')
  })

  test('refuses to fix more grams than are still open', async () => {
    const tx = buildUnfixedPurchase({ fixings: [{ _id: 'f1', pureWeight: 150 }] })
    const { service, Ledger } = buildService(tx)
    await expect(service.addVoucherFixing({
      transactionId: tx._id,
      user,
      pureWeight: 60,
      rate: 4000,
    })).rejects.toMatchObject({ status: 400 })
    expect(Ledger.create).not.toHaveBeenCalled()
  })

  test('removing a fixing soft-deletes its ledger entry and reopens the grams', async () => {
    const tx = buildUnfixedPurchase({
      fixings: [{ _id: '6ac605b8dffb0a7e2d41a8f1', pureWeight: 199.98, date: new Date('2026-10-07'), createdAt: new Date('2026-10-07T09:00:00Z') }],
    })
    const { service, Ledger, assertAccountingPeriodOpen } = buildService(tx)

    const result = await service.removeVoucherFixing({
      transactionId: tx._id,
      fixingId: '6ac605b8dffb0a7e2d41a8f1',
      user,
      tenant: 'mg',
      reason: 'wrong rate',
    })

    expect(Ledger.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ referenceType: 'voucher_fixing', referenceId: '6ac605b8dffb0a7e2d41a8f1' }),
      expect.any(Object),
      expect.any(Object),
    )
    expect(tx.voucherMeta.fixings[0].isDeleted).toBe(true)
    expect(result.state.openWeight).toBeCloseTo(199.98, 6)
    expect(assertAccountingPeriodOpen.mock.calls[0][0].createdAt).toEqual(new Date('2026-10-07T09:00:00Z'))
  })
})
