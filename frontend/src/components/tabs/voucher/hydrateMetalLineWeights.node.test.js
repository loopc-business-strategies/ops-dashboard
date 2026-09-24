import { describe, expect, test } from 'vitest'
import { hydrateMetalLineWeights } from './hydrateMetalLineWeights'

describe('hydrateMetalLineWeights', () => {
  test('fills 14k purity and pureWeight from productType when saved fields are empty', () => {
    const next = hydrateMetalLineWeights({
      productType: '14k alloy',
      grossWeight: 1000,
      purity: '',
      pureWeight: '',
      metalRate: 4281.97,
      metalAmount: 80308.35,
      rateType: 'OZ',
    })
    expect(Number(next.purity)).toBeCloseTo(0.583333, 5)
    expect(Number(next.pureWeight)).toBeCloseTo(583.333, 2)
  })

  test('reverse-engineers purity from metalAmount when productType has no karat', () => {
    const next = hydrateMetalLineWeights({
      productType: 'Gold scrap',
      grossWeight: 1000,
      purity: 0,
      pureWeight: 0,
      metalRate: 4281.97,
      metalAmount: 80308.35,
      rateType: 'OZ',
    })
    expect(Number(next.purity)).toBeCloseTo(0.583333, 4)
    expect(Number(next.pureWeight)).toBeCloseTo(583.333, 1)
  })

  test('preserves fine-gold line with purity 1', () => {
    const next = hydrateMetalLineWeights({
      productType: 'Gold Bar',
      grossWeight: 1000,
      purity: 1,
      pureWeight: 1000,
      metalRate: 4290.46,
      metalAmount: 137942.58,
      rateType: 'OZ',
    })
    expect(Number(next.purity)).toBe(1)
    expect(Number(next.pureWeight)).toBe(1000)
  })

  test('leaves non-metal empty lines unchanged', () => {
    const line = { acCode: '1000', amountLC: 50 }
    expect(hydrateMetalLineWeights(line)).toEqual(line)
  })
})
