import { describe, expect, test } from 'vitest'
import { formatAlloyMetalLossLabel, indexAlloyMixJobsByCode } from './alloyMetalLossDisplay'

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
