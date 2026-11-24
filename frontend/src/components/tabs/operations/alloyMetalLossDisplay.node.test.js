import { describe, expect, test } from 'vitest'
import {
  enrichAlloyCurrentHereLoss,
  formatAlloyMetalLossLabel,
  formatAlloyMetalLossParts,
  indexAlloyMixJobsByCode,
} from './alloyMetalLossDisplay'

describe('formatAlloyMetalLossLabel', () => {
  test('formats Au/Cu AML breakdown with total', () => {
    expect(formatAlloyMetalLossLabel({
      metalLossGross: 0.703,
      metalLossByMetal: [
        { stockCode: 'XAU', name: 'Gold Bar', lossGross: 0.644 },
        { stockCode: 'XCU', name: 'pure copper', lossGross: 0.059 },
      ],
    })).toBe('Alloy loss 0.703 g · Au 0.644 · Cu 0.059')
  })

  test('parts split head and metals for stacked Ops cell', () => {
    expect(formatAlloyMetalLossParts({
      metalLossGross: 0.794,
      metalLossByMetal: [
        { stockCode: 'XAU', lossGross: 0.728 },
        { stockCode: 'XCU', lossGross: 0.066 },
      ],
    })).toEqual({
      total: 0.794,
      head: 'Alloy loss 0.794 g',
      metalsLine: 'Au 0.728  Cu 0.066',
      metals: ['Au 0.728', 'Cu 0.066'],
    })
  })

  test('falls back to total only', () => {
    expect(formatAlloyMetalLossLabel({ metalLossGross: 0.7 })).toBe('Alloy loss 0.7 g')
  })

  test('returns null when empty', () => {
    expect(formatAlloyMetalLossLabel({})).toBeNull()
    expect(formatAlloyMetalLossLabel({ metalLossGross: 0, metalLossByMetal: [] })).toBeNull()
  })
})

describe('indexAlloyMixJobsByCode', () => {
  test('skips archived __REV__ codes and prefers open job', () => {
    const map = indexAlloyMixJobsByCode([
      { mixCode: 'BMG-0001__REV__1', status: 'closed', metalLossGross: 0 },
      { mixCode: 'BMG-0001', status: 'closed', metalLossGross: 0.1 },
      { mixCode: 'BMG-0001', status: 'in_vault', metalLossGross: 0.703 },
    ])
    expect(map['BMG-0001'].metalLossGross).toBe(0.703)
    expect(map['BMG-0001__REV__1']).toBeUndefined()
  })
})

describe('enrichAlloyCurrentHereLoss', () => {
  test('Now here row shows path total + Au/Cu addons without writing metalLoss', () => {
    const melting = {
      fromGoldAlloy: true,
      alloyMixCode: 'BMG-0001',
      batch: 'BMG-0001',
      metalIn: 552.304,
      metalLoss: 0.694,
      fineLoss: 0.636,
      batchStartedRaw: '2026-11-24T04:00:00.000Z',
      purity: 91.67,
    }
    const rolling = {
      fromGoldAlloy: true,
      alloyMixCode: 'BMG-0001',
      batch: 'BMG-0001',
      metalIn: 551.61,
      metalLoss: 0.1,
      fineLoss: 0.092,
      batchStartedRaw: '2026-11-24T04:10:00.000Z',
      purity: 91.67,
    }
    const here = {
      fromGoldAlloy: true,
      alloyMixCode: 'BMG-0001',
      batch: 'BMG-0001',
      alloyCurrentHere: true,
      metalIn: 551.51,
      metalOut: null,
      metalLoss: null,
      purity: 91.67,
      fineGold: 505.47,
      batchStartedRaw: '2026-11-24T04:20:00.000Z',
    }
    const job = {
      mixCode: 'BMG-0001',
      metalLossGross: 0.794,
      metalLossByMetal: [
        { stockCode: 'XAU', name: 'Gold Bar', lossGross: 0.728 },
        { stockCode: 'XCU', name: 'pure copper', lossGross: 0.066 },
      ],
    }
    enrichAlloyCurrentHereLoss([melting, rolling, here], { 'BMG-0001': job })
    expect(here.metalLoss).toBeNull()
    expect(here.alloyLossCumulative).toBe(true)
    expect(here.metalLossDisplay).toBe('0.794 g')
    expect(here.alloyLossLabel).toBe('Alloy loss 0.794 g · Au 0.728 · Cu 0.066')
    expect(here.alloyLossHead).toBe('Alloy loss 0.794 g')
    expect(here.alloyLossMetals).toBe('Au 0.728  Cu 0.066')
    expect(here.lossPct).toBe(0.14)
    expect(here.fineLoss).toBe(0.728)
  })
})
