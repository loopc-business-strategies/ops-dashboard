/**
 * Customer Margin funds = ledger net (same signed balance as Account Summary).
 * equity = funds − revaluation. Supplier Margin still uses -abs.
 */
const { computeMarginMetricsRaw } = require('../services/erpAccounting/metalMarginPolicy')

function customerMarginFromLedgerNet(net, { goldPosition = 0, silverPosition = 0, goldPrice = 0, silverPrice = 0 } = {}) {
  // Mirrors customerRoutes / reportRoutes customerMargins: totalFunds = net.
  return computeMarginMetricsRaw({
    totalFunds: net,
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

describe('customer margin ledger-as-funds exposure', () => {
  test('credit accounting net yields negative equity (matches Account Summary Cr)', () => {
    const accountingNet = -162131
    const raw = customerMarginFromLedgerNet(accountingNet)
    expect(raw.equity).toBe(-162131)
    expect(raw.status).toBe('NEGATIVE')
  })

  test('debit accounting nets yield positive equity when Current Value is 0', () => {
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
      expect(raw.equity).toBeCloseTo(debitNet, 2)
      expect(raw.status).toBe('POSITIVE')
      expect(label).toBeTruthy()
    }
  })

  test('zero net yields zero equity', () => {
    const raw = customerMarginFromLedgerNet(0)
    expect(raw.equity).toBe(0)
    expect(raw.status).toBe('NEUTRAL')
  })

  test('metal revaluation subtracts from ledger funds', () => {
    const raw = customerMarginFromLedgerNet(-1000, {
      goldPosition: 2,
      goldPrice: 50,
    })
    // funds = -1000; reval = 100; equity = -1100
    expect(raw.funds).toBe(-1000)
    expect(raw.revaluation).toBe(100)
    expect(raw.equity).toBe(-1100)
  })

  test('1313-style debit net minus large gold MTM matches Account Summary short', () => {
    const debitNet = 250000
    const revaluation = 281362.22
    const raw = customerMarginFromLedgerNet(debitNet, {
      goldPosition: 1,
      goldPrice: revaluation,
    })
    expect(raw.funds).toBe(250000)
    expect(raw.revaluation).toBeCloseTo(281362.22, 2)
    expect(raw.equity).toBeCloseTo(250000 - 281362.22, 2)
    expect(raw.equity).toBeLessThan(0)
  })

  test('supplier margin still forces non-positive funds via -abs', () => {
    expect(supplierMarginFromOutstanding(250).equity).toBe(-250)
    expect(supplierMarginFromOutstanding(-250).equity).toBe(-250)
  })

  test('ledger-as-funds matches asIs credit net (no -net flip)', () => {
    const creditNet = -162131
    const asIs = computeMarginMetricsRaw({
      totalFunds: creditNet,
      goldPosition: 0,
      silverPosition: 0,
      goldPrice: 0,
      silverPrice: 0,
      fundsMode: 'asIs',
    })
    const fixed = customerMarginFromLedgerNet(creditNet)
    expect(asIs.equity).toBe(-162131)
    expect(fixed.equity).toBe(-162131)
  })
})
