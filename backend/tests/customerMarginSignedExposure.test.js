/**
 * Customer Margin funds = -ledgerNet (credit balance → positive exposure).
 * Does not touch Supplier Margin (-abs) or Account Enquiry balance formulas.
 */
const { computeMarginMetricsRaw } = require('../services/erpAccounting/metalMarginPolicy')

function customerMarginFromLedgerNet(net, { goldPosition = 0, silverPosition = 0, goldPrice = 0, silverPrice = 0 } = {}) {
  // Mirrors customerRoutes / reportRoutes customerMargins: totalFunds = -net.
  return computeMarginMetricsRaw({
    totalFunds: -net,
    goldPosition,
    silverPosition,
    goldPrice,
    silverPrice,
    fundsMode: 'asIs',
  })
}

function supplierMarginFromOutstanding(outstanding) {
  return computeMarginMetricsRaw({
    totalFunds: -Math.abs(outstanding),
    goldPosition: 0,
    silverPosition: 0,
    goldPrice: 0,
    silverPrice: 0,
    suppressMetalSpotMtm: true,
    fundsMode: 'asIs',
  })
}

describe('customer margin negated ledger exposure', () => {
  test('credit accounting net yields positive equity (Modern Capital–style)', () => {
    const accountingNet = -162131
    const raw = customerMarginFromLedgerNet(accountingNet)
    expect(raw.equity).toBe(162131)
    expect(raw.status).toBe('POSITIVE')
  })

  test('debit accounting nets yield negative equity for listed MG-style fixtures', () => {
    const fixtures = [
      ['CEO CURRENT A/C', 276.58],
      ['Aneesh', 3411.76],
      ['BIJU', 2764.71],
      ['Sudheesh', 411.76],
      ['Anil Kumar', 176.47],
      ['Chandran', 529.41],
    ]
    for (const [label, debitNet] of fixtures) {
      const raw = customerMarginFromLedgerNet(debitNet)
      expect(raw.equity).toBeCloseTo(-debitNet, 2)
      expect(raw.status).toBe('NEGATIVE')
      expect(label).toBeTruthy()
    }
  })

  test('zero net yields zero equity', () => {
    const raw = customerMarginFromLedgerNet(0)
    expect(raw.equity).toBe(0)
    expect(raw.status).toBe('NEUTRAL')
  })

  test('metal revaluation still adds to negated funds', () => {
    const raw = customerMarginFromLedgerNet(-1000, {
      goldPosition: 2,
      goldPrice: 50,
    })
    // funds = -(-1000) = 1000; reval = 100; equity = 1100
    expect(raw.funds).toBe(1000)
    expect(raw.revaluation).toBe(100)
    expect(raw.equity).toBe(1100)
  })

  test('test-account style debit net plus large gold MTM is not blindly sign-flipped', () => {
    const debitNet = 1000
    const raw = customerMarginFromLedgerNet(debitNet, {
      goldPosition: 1990,
      goldPrice: 128,
    })
    // funds = -1000; reval = 1990*128; equity can remain positive from metals
    expect(raw.funds).toBe(-1000)
    expect(raw.revaluation).toBe(1990 * 128)
    expect(raw.equity).toBe(-1000 + 1990 * 128)
    expect(raw.equity).toBeGreaterThan(0)
  })

  test('supplier margin still forces non-positive funds via -abs', () => {
    expect(supplierMarginFromOutstanding(250).equity).toBe(-250)
    expect(supplierMarginFromOutstanding(-250).equity).toBe(-250)
  })

  test('raw net and -abs both fail the Modern Capital credit case; -net succeeds', () => {
    const creditNet = -162131
    const asIs = computeMarginMetricsRaw({
      totalFunds: creditNet,
      goldPosition: 0,
      silverPosition: 0,
      goldPrice: 0,
      silverPrice: 0,
      fundsMode: 'asIs',
    })
    const forcedAbs = computeMarginMetricsRaw({
      totalFunds: -Math.abs(creditNet),
      goldPosition: 0,
      silverPosition: 0,
      goldPrice: 0,
      silverPrice: 0,
      fundsMode: 'asIs',
    })
    const fixed = customerMarginFromLedgerNet(creditNet)
    expect(asIs.equity).toBe(-162131)
    expect(forcedAbs.equity).toBe(-162131)
    expect(fixed.equity).toBe(162131)
  })
})
