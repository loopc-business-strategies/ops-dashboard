const {
  lineCountsAsFineGold,
  summarizeLines,
} = require('../services/mgFloor/workbookLink')

describe('workbookLineFineGold', () => {
  test('non-gold metals do not count as fine gold', () => {
    expect(lineCountsAsFineGold('pure cadmium')).toBe(false)
    expect(lineCountsAsFineGold('pure copper')).toBe(false)
    expect(lineCountsAsFineGold('Fine Silver')).toBe(false)
    expect(lineCountsAsFineGold('Alloy')).toBe(false)
    expect(lineCountsAsFineGold('22k alloyed gold')).toBe(true)
    expect(lineCountsAsFineGold('Gold Bar')).toBe(true)
    expect(lineCountsAsFineGold('')).toBe(true)
  })

  test('summarizeLines adds cadmium to gross but not fine gold', () => {
    const sums = summarizeLines([
      { metal: '22k alloyed gold', qty: 551.51, purity: 91.67 },
      { metal: 'pure cadmium', qty: 5, purity: 100 },
    ])
    expect(sums.weight).toBe(556.51)
    expect(sums.fineGold).toBe(505.5692)
    // Blended % of gold FG ÷ overall gross (cadmium dilutes display purity before job stamp).
    expect(sums.purity).toBe(90.85)
  })
})
