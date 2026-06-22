import { describe, expect, it } from 'vitest'
import { METAL_RATES_LIVE_PATH, METAL_RATES_SAVED_PATH } from './metalRates.paths'

describe('metalRates API paths', () => {
  it('uses backend erp-accounting metal-rates routes (not /currencies/)', () => {
    expect(METAL_RATES_LIVE_PATH).toBe('/api/erp-accounting/metal-rates/live')
    expect(METAL_RATES_SAVED_PATH).toBe('/api/erp-accounting/metal-rates')
    expect(METAL_RATES_LIVE_PATH).not.toContain('/currencies/')
    expect(METAL_RATES_SAVED_PATH).not.toContain('/currencies/')
  })
})
