import {
  computeConservedToGross,
  computePureWeight,
  purityToRatio,
  emptyMetalTransferLines,
  upsertTransferSideLine,
  getTransferSideLine,
} from './metalTransferCalc'

describe('metalTransferCalc', () => {
  test('purityToRatio handles ratio and millesimal', () => {
    expect(purityToRatio(0.585)).toBeCloseTo(0.585)
    expect(purityToRatio(585)).toBeCloseTo(0.585)
    expect(purityToRatio(1)).toBe(1)
  })

  test('conserves pure for 1000g 14k → fine gold', () => {
    const fromGross = 1000
    const fromPurity = 0.585
    const toPurity = 1
    const pure = computePureWeight(fromGross, fromPurity)
    const toGross = computeConservedToGross(fromGross, fromPurity, toPurity)
    expect(pure).toBe(585)
    expect(toGross).toBe(585)
    expect(computePureWeight(toGross, toPurity)).toBe(585)
  })

  test('upsert keeps from/to sides', () => {
    let lines = emptyMetalTransferLines()
    lines = upsertTransferSideLine(lines, 'from', {
      inventoryItemId: 'a',
      grossWeight: '1000',
      purity: '0.585',
      pureWeight: '585',
    })
    lines = upsertTransferSideLine(lines, 'to', {
      inventoryItemId: 'b',
      grossWeight: '585',
      purity: '1',
      pureWeight: '585',
    })
    expect(getTransferSideLine(lines, 'from').inventoryItemId).toBe('a')
    expect(getTransferSideLine(lines, 'to').grossWeight).toBe('585')
  })
})
