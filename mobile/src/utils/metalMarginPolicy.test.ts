import { describe, expect, test } from 'vitest'
import { computeMarginMetricsRaw } from '@/src/utils/metalMarginPolicy'

describe('metalMarginPolicy', () => {
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

  test('spot revaluation updates equity and margin percent', () => {
    const raw = computeMarginMetricsRaw({
      totalFunds: 100,
      goldPosition: 2,
      silverPosition: 0,
      goldPrice: 50,
      silverPrice: 1,
      fundsMode: 'customerAbsIfNegative',
    })
    expect(raw.revaluation).toBe(100)
    expect(raw.margin).toBe(2)
    expect(raw.equity).toBe(200)
    expect(raw.marginPercent).toBe(5000)
  })
})
