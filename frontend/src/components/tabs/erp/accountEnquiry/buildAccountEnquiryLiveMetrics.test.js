import { describe, expect, test } from 'vitest'
import { calculateAccountSummaryMetrics } from '../statementHelpers'
import {
  buildAccountEnquiryLiveMetrics,
  hasAccountEnquiryMetalExposure,
  resolveAccountEnquiryBookedRevaluation,
} from './buildAccountEnquiryLiveMetrics'

describe('buildAccountEnquiryLiveMetrics', () => {
  test('metal exposure: revaluation and net equity rise when spot rises', () => {
    const base = {
      totalFunds: 1000,
      goldPosition: 50,
      silverPosition: 0,
      liveRecalcEnabled: true,
    }
    const low = buildAccountEnquiryLiveMetrics({ ...base, goldPriceUSD: 128.4, silverPriceUSD: 1.85 })
    const high = buildAccountEnquiryLiveMetrics({ ...base, goldPriceUSD: 129.2, silverPriceUSD: 1.85 })
    expect(low).not.toBeNull()
    expect(high).not.toBeNull()
    if (!low || !high) throw new Error('expected metrics')

    expect(high.revaluation).toBeGreaterThan(low.revaluation)

    const lowSummary = calculateAccountSummaryMetrics({
      totalFunds: base.totalFunds,
      revaluation: low.revaluation,
      marginAmount: low.margin,
    })
    const highSummary = calculateAccountSummaryMetrics({
      totalFunds: base.totalFunds,
      revaluation: high.revaluation,
      marginAmount: high.margin,
    })
    expect(highSummary.netEquity).toBeGreaterThan(lowSummary.netEquity)
    expect(highSummary.excess).toBeGreaterThan(lowSummary.excess)
    expect(highSummary.marginPercent).toBeLessThan(lowSummary.marginPercent)
  })

  test('cash-only: spot change leaves MTM fields at zero', () => {
    const low = buildAccountEnquiryLiveMetrics({
      totalFunds: 146.28,
      goldPosition: 0,
      silverPosition: 0,
      goldPriceUSD: 50,
      silverPriceUSD: 1,
      liveRecalcEnabled: true,
    })
    const high = buildAccountEnquiryLiveMetrics({
      totalFunds: 146.28,
      goldPosition: 0,
      silverPosition: 0,
      goldPriceUSD: 200,
      silverPriceUSD: 1,
      liveRecalcEnabled: true,
    })
    expect(low?.revaluation).toBe(0)
    expect(high?.revaluation).toBe(0)
    expect(high?.equity).toBe(146.28)
  })

  test('suppress + booked override: revaluation frozen when spot rises', () => {
    const booked = -234.21
    const low = buildAccountEnquiryLiveMetrics({
      totalFunds: -500,
      goldPosition: 80,
      silverPosition: 0,
      goldPriceUSD: 40,
      silverPriceUSD: 1,
      suppressMetalSpotMtm: true,
      bookedRevaluation: booked,
      liveRecalcEnabled: true,
    })
    const high = buildAccountEnquiryLiveMetrics({
      totalFunds: -500,
      goldPosition: 80,
      silverPosition: 0,
      goldPriceUSD: 120,
      silverPriceUSD: 1,
      suppressMetalSpotMtm: true,
      bookedRevaluation: booked,
      liveRecalcEnabled: true,
    })
    expect(low?.revaluation).toBe(booked)
    expect(high?.revaluation).toBe(booked)
    expect(high?.equity).toBe(low?.equity)
  })

  test('suppress without booked falls back to live spot on grams', () => {
    const low = buildAccountEnquiryLiveMetrics({
      totalFunds: -100,
      goldPosition: 10,
      silverPosition: 0,
      goldPriceUSD: 50,
      silverPriceUSD: 1,
      suppressMetalSpotMtm: true,
      bookedRevaluation: null,
      liveRecalcEnabled: true,
    })
    const high = buildAccountEnquiryLiveMetrics({
      totalFunds: -100,
      goldPosition: 10,
      silverPosition: 0,
      goldPriceUSD: 60,
      silverPriceUSD: 1,
      suppressMetalSpotMtm: true,
      bookedRevaluation: null,
      liveRecalcEnabled: true,
    })
    expect(high?.revaluation).toBeGreaterThan(low?.revaluation ?? 0)
  })

  test('returns null when live recalc disabled', () => {
    expect(buildAccountEnquiryLiveMetrics({
      totalFunds: 100,
      goldPosition: 5,
      goldPriceUSD: 50,
      liveRecalcEnabled: false,
    })).toBeNull()
  })
})

describe('hasAccountEnquiryMetalExposure', () => {
  test('detects non-zero gold or silver grams', () => {
    expect(hasAccountEnquiryMetalExposure(0, 0)).toBe(false)
    expect(hasAccountEnquiryMetalExposure(0.5, 0)).toBe(true)
    expect(hasAccountEnquiryMetalExposure(0, -2)).toBe(true)
  })
})

describe('resolveAccountEnquiryBookedRevaluation', () => {
  test('prefers API booked total over statement fallback', () => {
    expect(resolveAccountEnquiryBookedRevaluation(
      { bookedUnfixedRevaluation: { total: -12.5 } },
      -99,
    )).toBe(-12.5)
    expect(resolveAccountEnquiryBookedRevaluation({}, -8)).toBe(-8)
    expect(resolveAccountEnquiryBookedRevaluation({}, 0)).toBeNull()
  })
})
