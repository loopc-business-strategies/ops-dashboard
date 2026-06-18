import { describe, expect, test } from 'vitest'
import {
  computeMarginMetricsRaw,
  shouldSuppressSpotMetalMtmForAccountEnquiry,
  shouldSuppressSpotMetalMtmForCustomerDashboard,
} from './metalMarginPolicy'

describe('frontend metal margin policy', () => {
  test('suppresses spot MTM for creditor/vendor liability accounts', () => {
    expect(shouldSuppressSpotMetalMtmForAccountEnquiry({
      accountType: 'Liability',
      accountName: 'STAFF ACCOMODATION (Creditor)',
      description: 'Auto-created payable account for vendor STAFF ACCOMODATION',
    })).toBe(true)
  })

  test('does not suppress ordinary liability accounts without creditor cues', () => {
    expect(shouldSuppressSpotMetalMtmForAccountEnquiry({
      accountType: 'Liability',
      accountName: 'Accrued Expenses',
      description: 'Month-end accruals',
    })).toBe(false)
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
})
