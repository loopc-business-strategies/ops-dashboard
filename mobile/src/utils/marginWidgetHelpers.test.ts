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
})
