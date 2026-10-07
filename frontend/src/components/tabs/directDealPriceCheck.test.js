import { describe, expect, test } from 'vitest'
import {
  checkDirectDealPriceAgainstSpot,
  describeDirectDealPriceDeviation,
  resolveSpotPricePerOz,
} from './directDealPriceCheck'

const snapshot = { gold: 4133.91, silver: 60.6, currency: 'USD', unit: 'TOZ' }

describe('directDealPriceCheck', () => {
  test('flags a per-gram price typed into the per-oz field', () => {
    const result = checkDirectDealPriceAgainstSpot({ price: 134.32, metal: 'XAU', currency: 'USD', snapshot })
    expect(result).not.toBeNull()
    expect(result.deviation).toBeLessThan(-0.9)
    expect(describeDirectDealPriceDeviation(result, (v) => v.toFixed(2))).toBe('97% below live 4133.91 / oz')
  })

  test('accepts a price within 10% of spot', () => {
    expect(checkDirectDealPriceAgainstSpot({ price: 4177.82, metal: 'XAU', currency: 'USD', snapshot })).toBeNull()
  })

  test('uses silver spot for XAG and flags prices far above it', () => {
    const result = checkDirectDealPriceAgainstSpot({ price: 80, metal: 'XAG', currency: 'USD', snapshot })
    expect(result?.deviation).toBeGreaterThan(0.1)
  })

  test('converts per-gram spot snapshots to per oz', () => {
    expect(resolveSpotPricePerOz({ gold: 133, unit: 'G' }, 'XAU')).toBeCloseTo(133 * 31.1034768, 6)
  })

  test('skips the check when currencies differ or spot is missing', () => {
    expect(checkDirectDealPriceAgainstSpot({ price: 134.32, metal: 'XAU', currency: 'UZS', snapshot })).toBeNull()
    expect(checkDirectDealPriceAgainstSpot({ price: 134.32, metal: 'XAU', currency: 'USD', snapshot: { gold: 0 } })).toBeNull()
  })
})
