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
      marginLiveRecalc: true,
      goldPriceUSD: 20,
      silverPriceUSD: 1,
    })
    const high = mapErpLiveMarginRow(row, 'customerName', {
      marginLiveRecalc: true,
      goldPriceUSD: 25,
      silverPriceUSD: 1,
    })
    expect(low.equity).toBe(1200)
    expect(high.equity).toBe(1250)
    expect(high.marginPercent).toBeCloseTo(25000, 1)
    expect(high.marginFmt).toBe('25000.00 %')
  })

  test('values open unfixed purchase grams in the customer favour while showing them as Cr', () => {
    const mapped = mapErpLiveMarginRow({
      customerName: 'Unfixed Seller',
      equity: 1000,
      marginRevaluation: 1000,
      goldPosition: -10,
      goldValuationPosition: 10,
      silverPosition: 0,
      marginAmount: 20,
    }, 'customerName', {
      marginLiveRecalc: true,
      goldPriceUSD: 120,
      silverPriceUSD: 1,
    })
    expect(mapped.goldPosition).toBe(-10)
    expect(mapped.equity).toBe(1200)
  })

  test('hides Margin % when the metal position is too small for it to mean anything', () => {
    const mapped = mapErpLiveMarginRow({ customerName: 'Tiny', equity: -320, marginAmount: 0.053, marginPercent: -603358 }, 'customerName')
    expect(mapped.marginPercent).toBe(-603358)
    expect(mapped.marginFmt).toBe('—')
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
      marginLiveRecalc: true,
      goldPriceUSD: 10,
      silverPriceUSD: 1,
    })
    const high = mapErpLiveMarginRow(row, 'customerName', {
      marginLiveRecalc: true,
      goldPriceUSD: 100,
      silverPriceUSD: 1,
    })
    expect(low.equity).toBe(800)
    expect(high.equity).toBe(800)
  })

  test('customer credit equity stays signed negative (no favorableCredit abs)', () => {
    const mapped = mapErpLiveMarginRow(
      {
        customerName: 'MODERN CAPITAL',
        equity: -162131,
        marginAmount: 0,
        marginExcess: -162131,
        goldPosition: 0,
        silverPosition: 0,
      },
      'customerName',
    )
    expect(mapped.equity).toBe(-162131)
    expect(mapped.equityFmt).toBe('-162,131.00')
    expect(mapped.status).toBe('NEGATIVE')
  })

  test('customer receivable equity from API stays negative exposure', () => {
    const mapped = mapErpLiveMarginRow(
      {
        customerName: 'Aneesh',
        equity: -3411.76,
        marginAmount: 0,
        marginExcess: -3411.76,
        goldPosition: 0,
        silverPosition: 0,
      },
      'customerName',
    )
    expect(mapped.equity).toBe(-3411.76)
    expect(mapped.equityFmt).toBe('-3,411.76')
    expect(mapped.status).toBe('NEGATIVE')
  })

  test('supplier payable equity stays negative', () => {
    const mapped = mapErpLiveMarginRow(
      {
        supplierName: 'FINMASTER MCHJ',
        equity: -495.87,
        marginAmount: 0,
        marginExcess: -495.87,
        goldPosition: 0,
        silverPosition: 0,
        suppressMetalSpotMtm: true,
      },
      'supplierName',
      { suppressMetalSpotMtm: true },
    )
    expect(mapped.equity).toBe(-495.87)
    expect(mapped.equityFmt).toBe('-495.87')
    expect(mapped.status).toBe('NEGATIVE')
  })
})
