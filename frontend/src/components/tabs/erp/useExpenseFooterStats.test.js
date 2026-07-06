import { describe, expect, it } from 'vitest'
import {
  computeExpenseDeltaPct,
  getTrendMonthPair,
  trendAmountForMonth,
} from './useExpenseFooterStats'

describe('trendAmountForMonth', () => {
  const trend = [
    { monthIndex: 4, amount: 0 },
    { monthIndex: 5, amount: 304000 },
    { monthIndex: 6, amount: 0 },
  ]

  it('returns amount for matching month index', () => {
    expect(trendAmountForMonth(trend, 5)).toBe(304000)
    expect(trendAmountForMonth(trend, 6)).toBe(0)
  })
})

describe('getTrendMonthPair', () => {
  const trend = [
    { monthIndex: 4, amount: 100 },
    { monthIndex: 5, amount: 304000 },
    { monthIndex: 6, amount: 50 },
  ]

  it('uses previous calendar month when all months selected', () => {
    const today = new Date()
    const pair = getTrendMonthPair(trend, '')
    const currentIdx = today.getMonth()
    expect(pair.currentMonthAmount).toBe(trendAmountForMonth(trend, currentIdx))
    expect(pair.lastMonthAmount).toBe(trendAmountForMonth(trend, currentIdx - 1))
  })

  it('uses selected month and its prior month', () => {
    const pair = getTrendMonthPair(trend, '5')
    expect(pair.currentMonthAmount).toBe(304000)
    expect(pair.lastMonthAmount).toBe(100)
  })
})

describe('computeExpenseDeltaPct', () => {
  it('computes month-over-month change', () => {
    expect(computeExpenseDeltaPct(50, 100)).toBe(-50)
    expect(computeExpenseDeltaPct(150, 100)).toBe(50)
  })
})
