import { describe, expect, test } from 'vitest'
import {
  convertLivePriceUnit,
  fmtMoveRow,
  fmtSpot,
  isMt4BridgeRates,
  MT4_LIVE_POLL_MS,
  LIVE_METAL_POLL_STREAM_MS,
  metalStatusSubline,
  MT4_BRIDGE_SOURCE,
  resolveEffectiveSpotPrices,
  resolveInventoryValuationUnitCost,
  resolveLiveMetalKey,
  resolveLiveMetalPollIntervalMs,
  resolveLiveVoucherMetalRate,
} from '../utils/liveMetalRates'

describe('liveMetalRates helpers', () => {
  test('maps stock type names to live metal keys', () => {
    expect(resolveLiveMetalKey('Gold')).toBe('gold')
    expect(resolveLiveMetalKey('Silver')).toBe('silver')
    expect(resolveLiveMetalKey('Platinum')).toBe('platinum')
    expect(resolveLiveMetalKey('Copper')).toBeNull()
  })

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

  test('converts live TOZ price to gram and inventory OZ units', () => {
    expect(convertLivePriceUnit(4500, 'TOZ', 'G')).toBeCloseTo(4500 / 31.1034768, 4)
    expect(convertLivePriceUnit(4500, 'TOZ', 'OZ')).toBe(4500)
  })

  test('values inventory with live snapshot when metal matches', () => {
    const snapshot = { gold: 4500, silver: 30, platinum: 1000, unit: 'TOZ', currency: 'USD' }
    const liveCost = resolveInventoryValuationUnitCost(100, 'Gold', snapshot, 'OZ')
    expect(liveCost).toBe(4500)
    expect(resolveInventoryValuationUnitCost(100, 'Copper', snapshot, 'OZ')).toBe(100)
  })

  test('prefers live gram prices for account enquiry spot', () => {
    const prices = resolveEffectiveSpotPrices({
      liveSnapshot: { gold: 4500, silver: 30, unit: 'TOZ' },
      enquiryGold: 144,
      enquirySilver: 2.4,
      fallbackGold: 285,
      fallbackSilver: 3.5,
    })
    expect(prices.goldPriceUSD).toBeCloseTo(4500 / 31.1034768, 4)
    expect(prices.silverPriceUSD).toBeCloseTo(30 / 31.1034768, 4)
  })

  test('resolves voucher metal rate in requested unit', () => {
    const liveRates = {
      sourceGoldPrice: 4500,
      sourceUnit: 'TOZ',
      goldPrice: 144.7,
      priceUnit: 'G',
    }
    expect(resolveLiveVoucherMetalRate('XAU', 'Gold', liveRates, 'OZ')).toBe(4500)
    expect(resolveLiveVoucherMetalRate('XAU', 'Gold', liveRates, 'GRAM')).toBeCloseTo(4500 / 31.1034768, 4)
  })

  test('resolveLiveMetalPollIntervalMs keeps MT4 on fast poll', () => {
    expect(resolveLiveMetalPollIntervalMs(true, 'mt4-bridge')).toBe(MT4_LIVE_POLL_MS)
    expect(resolveLiveMetalPollIntervalMs(true, 'metals.dev')).toBe(LIVE_METAL_POLL_STREAM_MS)
    expect(resolveLiveMetalPollIntervalMs(true, '')).toBe(MT4_LIVE_POLL_MS)
    expect(resolveLiveMetalPollIntervalMs(false, '')).toBe(MT4_LIVE_POLL_MS)
    expect(MT4_LIVE_POLL_MS).toBe(1000)
  })

  test('detects MT4 bridge source and status subline', () => {
    expect(isMt4BridgeRates({ source: MT4_BRIDGE_SOURCE })).toBe(true)
    expect(isMt4BridgeRates({ source: 'metals.dev' })).toBe(false)
    expect(metalStatusSubline(
      { currency: 'USD', unit: 'TOZ', source: MT4_BRIDGE_SOURCE },
      4500,
      null,
    )).toBe('USD/OZ · MT4')
    expect(metalStatusSubline(
      { currency: 'USD', unit: 'TOZ', source: 'metals.dev' },
      4500,
      null,
    )).toBe('USD/OZ · live')
    expect(metalStatusSubline(
      { currency: 'USD', unit: 'TOZ', source: '' },
      0,
      null,
    )).toBe('loading…')
  })
})
