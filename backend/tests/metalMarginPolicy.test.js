const {
  computeMarginMetricsRaw,
  computeBookedUnfixedRevaluationFromTransactions,
  shouldSuppressSpotMetalMtmForAccountEnquiry,
  shouldSuppressSpotMetalMtmForCustomerDashboard,
  shouldSuppressSpotMetalMtmForSupplierDashboard,
} = require('../services/erpAccounting/metalMarginPolicy')

describe('metalMarginPolicy', () => {
  test('supplier margin: suppress spot — large grams do not inflate revaluation', () => {
    const raw = computeMarginMetricsRaw({
      totalFunds: -100,
      goldPosition: 200,
      silverPosition: 0,
      goldPrice: 100,
      silverPrice: 1,
      suppressMetalSpotMtm: shouldSuppressSpotMetalMtmForSupplierDashboard(),
      fundsMode: 'asIs',
    })
    expect(raw.revaluation).toBe(0)
    expect(raw.margin).toBe(0)
    expect(raw.equity).toBe(-100)
  })

  test('customer list margin: liability ledger suppresses spot MTM', () => {
    const raw = computeMarginMetricsRaw({
      totalFunds: 50,
      goldPosition: 10,
      silverPosition: 0,
      goldPrice: 2000,
      silverPrice: 25,
      suppressMetalSpotMtm: shouldSuppressSpotMetalMtmForCustomerDashboard('Liability'),
      fundsMode: 'customerAbsIfNegative',
    })
    expect(raw.revaluation).toBe(0)
    expect(raw.equity).toBe(50)
  })

  test('customer list margin: asset ledger uses spot revaluation', () => {
    const raw = computeMarginMetricsRaw({
      totalFunds: 100,
      goldPosition: 2,
      silverPosition: 0,
      goldPrice: 50,
      silverPrice: 1,
      suppressMetalSpotMtm: shouldSuppressSpotMetalMtmForCustomerDashboard('Asset'),
      fundsMode: 'customerAbsIfNegative',
    })
    expect(raw.revaluation).toBe(100)
    expect(raw.margin).toBe(2)
    expect(raw.equity).toBe(200)
  })

  test('customerAbsIfNegative uses abs(funds) when totalFunds negative', () => {
    const raw = computeMarginMetricsRaw({
      totalFunds: -80,
      goldPosition: 0,
      silverPosition: 0,
      goldPrice: 100,
      silverPrice: 1,
      suppressMetalSpotMtm: true,
      fundsMode: 'customerAbsIfNegative',
    })
    expect(raw.funds).toBe(80)
    expect(raw.equity).toBe(80)
  })

  test('report supplier row: revaluationOverride wins over suppress + spot', () => {
    const raw = computeMarginMetricsRaw({
      totalFunds: -200,
      goldPosition: 50,
      silverPosition: 0,
      goldPrice: 999,
      silverPrice: 1,
      suppressMetalSpotMtm: true,
      revaluationOverride: -12.5,
      fundsMode: 'asIs',
    })
    expect(raw.revaluation).toBe(-12.5)
    expect(raw.equity).toBe(-212.5)
    expect(raw.margin).toBeCloseTo(0.25, 5)
  })

  test('account enquiry: STAFF ACCOMODATION (Creditor) suppresses spot MTM view', () => {
    expect(shouldSuppressSpotMetalMtmForAccountEnquiry({
      accountType: 'Liability',
      accountName: '2305 STAFF ACCOMODATION (Creditor)',
      description: 'Payable account for vendor',
    })).toBe(true)
  })

  test('account enquiry: ordinary liability without creditor cues — no suppress', () => {
    expect(shouldSuppressSpotMetalMtmForAccountEnquiry({
      accountType: 'Liability',
      accountName: '2100 Accrued expenses',
      description: 'Accruals',
    })).toBe(false)
  })

  test('booked unfixed revaluation uses voucher currency for creditor AP', () => {
    const booked = computeBookedUnfixedRevaluationFromTransactions([{
      type: 'purchase',
      amount: 234.21,
      exchangeRate: 1,
      voucherMeta: {
        fixingType: 'unfixed',
        lineItems: [{ stockCode: 'XAU', pureWeight: 999.9 }],
      },
    }])
    expect(booked.gold).toBe(234.21)
    expect(booked.total).toBe(234.21)
  })
})
