import { describe, expect, test } from 'vitest'
import { mapMarginRow } from '@/src/utils/marginWidgetHelpers'

describe('mapMarginRow live recalc', () => {
  test('recomputes equity and margin percent from live spot prices', () => {
    const baseRow = {
      customerName: 'Acme',
      equity: 1200,
      marginRevaluation: 200,
      goldPosition: 10,
      silverPosition: 0,
      marginAmount: 4,
      marginPercent: 15000,
    }

    const unchanged = mapMarginRow(baseRow, 'customerName', {
      favorableCredit: true,
      liveRecalcEnabled: true,
      goldPriceUSD: 20,
      silverPriceUSD: 1,
    })

    const repriced = mapMarginRow(baseRow, 'customerName', {
      favorableCredit: true,
      liveRecalcEnabled: true,
      goldPriceUSD: 25,
      silverPriceUSD: 1,
    })

    expect(unchanged.equity).toBe(1200)
    expect(repriced.equity).toBe(1250)
    expect(repriced.marginPercent).toBeCloseTo(20000, 1)
  })

  test('supplier suppression keeps equity stable when spot rises', () => {
    const baseRow = {
      supplierName: 'Vendor',
      equity: -400,
      marginRevaluation: -10,
      goldPosition: 80,
      silverPosition: 0,
      marginAmount: 0.2,
      suppressMetalSpotMtm: true,
    }
    const low = mapMarginRow(baseRow, 'supplierName', {
      liveRecalcEnabled: true,
      goldPriceUSD: 40,
      silverPriceUSD: 1,
      suppressMetalSpotMtm: true,
    })
    const high = mapMarginRow(baseRow, 'supplierName', {
      liveRecalcEnabled: true,
      goldPriceUSD: 120,
      silverPriceUSD: 1,
      suppressMetalSpotMtm: true,
    })
    expect(low.equity).toBe(-400)
    expect(high.equity).toBe(-400)
  })

  test('liability customer suppresses live spot via row flag', () => {
    const baseRow = {
      customerName: 'Creditor Co',
      equity: 800,
      marginRevaluation: 50,
      goldPosition: 20,
      silverPosition: 0,
      marginAmount: 1,
      suppressMetalSpotMtm: true,
    }
    const low = mapMarginRow(baseRow, 'customerName', {
      favorableCredit: true,
      liveRecalcEnabled: true,
      goldPriceUSD: 10,
      silverPriceUSD: 1,
    })
    const high = mapMarginRow(baseRow, 'customerName', {
      favorableCredit: true,
      liveRecalcEnabled: true,
      goldPriceUSD: 100,
      silverPriceUSD: 1,
    })
    expect(low.equity).toBe(800)
    expect(high.equity).toBe(800)
  })
})
