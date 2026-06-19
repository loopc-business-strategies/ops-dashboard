import { describe, expect, test } from 'vitest'
import {
  convertLivePriceUnit,
  fmtMoveRow,
  fmtSpot,
  isMt4BridgeRates,
  MT4_BRIDGE_SOURCE,
  resolveEffectiveSpotPrices,
} from '@/src/utils/liveMetalRates'

describe('liveMetalRates helpers', () => {
  test('formats spot prices', () => {
    expect(fmtSpot(4527.39)).toBe('4,527.39')
    expect(fmtSpot(0)).toBe('—')
  })

  test('formats move row with percent change', () => {
    const move = fmtMoveRow(1.25, 4527.39)
    expect(move?.up).toBe(true)
    expect(move?.arrow).toBe('▲')
    expect(move?.rest).toContain('+0.03%')
  })

  test('prefers live gram prices for margin recalc', () => {
    const prices = resolveEffectiveSpotPrices({
      liveSnapshot: { gold: 4500, silver: 30, unit: 'TOZ' },
    })
    expect(prices.goldPriceUSD).toBeCloseTo(4500 / 31.1034768, 4)
    expect(prices.silverPriceUSD).toBeCloseTo(30 / 31.1034768, 4)
  })

  test('falls back to enquiry and saved prices when live snapshot is empty', () => {
    const prices = resolveEffectiveSpotPrices({
      liveSnapshot: { gold: 0, silver: 0, unit: 'TOZ' },
      enquiryGold: 144,
      enquirySilver: 2.4,
      fallbackGold: 285,
      fallbackSilver: 3.5,
    })
    expect(prices.goldPriceUSD).toBe(144)
    expect(prices.silverPriceUSD).toBe(2.4)
  })

  test('converts live TOZ price to gram', () => {
    expect(convertLivePriceUnit(4500, 'TOZ', 'G')).toBeCloseTo(4500 / 31.1034768, 4)
  })

  test('detects MT4 bridge source', () => {
    expect(isMt4BridgeRates({ source: MT4_BRIDGE_SOURCE })).toBe(true)
    expect(isMt4BridgeRates({ source: 'metals.dev' })).toBe(false)
  })
})
