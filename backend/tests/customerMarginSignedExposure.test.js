/**
 * Customer Margin must pass signed ledger net into margin math.
 * Does not touch Supplier Margin (-abs) or Account Enquiry balance formulas.
 */
const { computeMarginMetricsRaw } = require('../services/erpAccounting/metalMarginPolicy')

function customerMarginFromLedgerNet(net, { goldPosition = 0, silverPosition = 0, goldPrice = 0, silverPrice = 0 } = {}) {
  // Mirrors customerRoutes / reportRoutes customerMargins after signed-exposure fix.
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
  // Supplier path intentionally unchanged.
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

describe('customer margin signed ledger exposure', () => {
  test('positive accounting net yields positive equity (Modern Capital–style)', () => {
    const raw = customerMarginFromLedgerNet(162131)
    expect(raw.equity).toBe(162131)
    expect(raw.status).toBe('POSITIVE')
  })

  test('negative accounting nets stay negative for listed MG-style fixtures', () => {
    const fixtures = [
      ['CEO CURRENT A/C', -276.58],
      ['Aneesh', -3411.76],
      ['BIJU', -2764.71],
      ['Sudheesh', -411.76],
      ['Anil Kumar', -176.47],
      ['Chandran', -529.41],
    ]
    for (const [label, net] of fixtures) {
      const raw = customerMarginFromLedgerNet(net)
      expect(raw.equity).toBeCloseTo(net, 2)
      expect(raw.status).toBe('NEGATIVE')
      expect(label).toBeTruthy()
    }
  })

  test('zero net yields zero equity', () => {
    const raw = customerMarginFromLedgerNet(0)
    expect(raw.equity).toBe(0)
    expect(raw.status).toBe('NEUTRAL')
  })

  test('metal revaluation still works with positive funds', () => {
    const raw = customerMarginFromLedgerNet(1000, {
      goldPosition: 2,
      goldPrice: 50,
    })
    expect(raw.revaluation).toBe(100)
    expect(raw.equity).toBe(1100)
  })

  test('supplier margin still forces non-positive funds via -abs', () => {
    expect(supplierMarginFromOutstanding(250).equity).toBe(-250)
    expect(supplierMarginFromOutstanding(-250).equity).toBe(-250)
  })

  test('forcing -abs would incorrectly flip a positive customer net (regression guard)', () => {
    const net = 162131
    const broken = computeMarginMetricsRaw({
      totalFunds: -Math.abs(net),
      goldPosition: 0,
      silverPosition: 0,
      goldPrice: 0,
      silverPrice: 0,
      fundsMode: 'asIs',
    })
    const fixed = customerMarginFromLedgerNet(net)
    expect(broken.equity).toBe(-162131)
    expect(fixed.equity).toBe(162131)
  })
})
