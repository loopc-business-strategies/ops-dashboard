import { describe, expect, test } from 'vitest'
import { mapErpLiveMarginRow } from './mapErpLiveMarginRow'

describe('mapErpLiveMarginRow', () => {
  test('recomputes customer equity when live spot rises', () => {
    const row = {
      customerName: 'Acme',
      equity: 1200,
      marginRevaluation: 200,
      goldPosition: 10,
      silverPosition: 0,
      marginAmount: 4,
    }
    const low = mapErpLiveMarginRow(row, 'customerName', {
      favorableCredit: true,
      marginLiveRecalc: true,
      goldPriceUSD: 20,
      silverPriceUSD: 1,
    })
    const high = mapErpLiveMarginRow(row, 'customerName', {
      favorableCredit: true,
      marginLiveRecalc: true,
      goldPriceUSD: 25,
      silverPriceUSD: 1,
    })
    expect(low.equity).toBe(1200)
    expect(high.equity).toBe(1250)
    expect(high.marginPercent).toBeCloseTo(20000, 1)
  })

  test('supplier suppression keeps equity frozen when spot rises', () => {
    const row = {
      supplierName: 'Vendor',
      equity: -500,
      marginRevaluation: -12.5,
      goldPosition: 100,
      silverPosition: 0,
      marginAmount: 0.25,
      suppressMetalSpotMtm: true,
    }
    const low = mapErpLiveMarginRow(row, 'supplierName', {
      marginLiveRecalc: true,
      goldPriceUSD: 50,
      silverPriceUSD: 1,
      suppressMetalSpotMtm: true,
    })
    const high = mapErpLiveMarginRow(row, 'supplierName', {
      marginLiveRecalc: true,
      goldPriceUSD: 200,
      silverPriceUSD: 1,
      suppressMetalSpotMtm: true,
    })
    expect(low.equity).toBe(-500)
    expect(high.equity).toBe(-500)
    expect(high.marginPercent).toBe(low.marginPercent)
  })

  test('liability customer suppresses live spot via row flag', () => {
    const row = {
      customerName: 'Creditor Co',
      equity: 800,
      marginRevaluation: 50,
      goldPosition: 20,
      silverPosition: 0,
      marginAmount: 1,
      suppressMetalSpotMtm: true,
    }
    const low = mapErpLiveMarginRow(row, 'customerName', {
      favorableCredit: true,
      marginLiveRecalc: true,
      goldPriceUSD: 10,
      silverPriceUSD: 1,
    })
    const high = mapErpLiveMarginRow(row, 'customerName', {
      favorableCredit: true,
      marginLiveRecalc: true,
      goldPriceUSD: 100,
      silverPriceUSD: 1,
    })
    expect(low.equity).toBe(800)
    expect(high.equity).toBe(800)
  })
})
