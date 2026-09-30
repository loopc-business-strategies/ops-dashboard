import { describe, expect, it } from 'vitest'
import { batchTotals, checkMetalOut, purityPercent } from './batchLoss'

const metalIn = [
  { metal: 'Gold', qty: 500, purity: 99.5 },
  { metal: 'Alloy', qty: 20, purity: null },
]

describe('batchTotals', () => {
  it('adds every weight and only purity lines to fine gold, like the workbook', () => {
    expect(batchTotals(metalIn)).toEqual({ weight: 520, fineGold: 497.5 })
  })

  it('reads typed text, per-mille purity and skips empty rows', () => {
    expect(batchTotals([{ qty: '517', purity: '995' }, { qty: '', purity: '' }])).toEqual({ weight: 517, fineGold: 514.415 })
    expect(batchTotals([{ qty: '12,5', purity: null }])).toEqual({ weight: 12.5, fineGold: null })
    expect(batchTotals([{ qty: '', purity: '99.5' }])).toEqual({ weight: null, fineGold: null })
  })

  it('treats purity above 100 as per-mille', () => {
    expect(purityPercent(995)).toBe(99.5)
    expect(purityPercent('91.6')).toBe(91.6)
    expect(purityPercent(0)).toBeNull()
  })
})

describe('checkMetalOut', () => {
  it('gives the loss and flags it above the department limit', () => {
    const check = checkMetalOut(metalIn, [{ qty: '517', purity: '' }], 0.5)
    expect(check).toMatchObject({ inWeight: 520, outWeight: 517, loss: 3, lossPct: 0.58, overLimit: true, outMoreThanIn: false })
    expect(checkMetalOut(metalIn, [{ qty: '518', purity: '' }], 0.5)?.overLimit).toBe(false)
    expect(checkMetalOut(metalIn, [{ qty: '517', purity: '' }], null)?.overLimit).toBe(false)
  })

  it('flags Metal Out heavier than Metal In', () => {
    expect(checkMetalOut(metalIn, [{ qty: '514517', purity: '' }], 0.5)).toMatchObject({ outMoreThanIn: true, overLimit: false })
  })

  it('flags a purity that makes fine gold out more than fine gold in and gives the highest possible purity', () => {
    const check = checkMetalOut(metalIn, [{ qty: '517', purity: '99.5' }], 0.5)
    expect(check).toMatchObject({ fineIn: 497.5, fineOut: 514.415, purityTooHigh: true, maxPurity: 96.22 })
    expect(checkMetalOut(metalIn, [{ qty: '517', purity: '96.22' }], 0.5)?.purityTooHigh).toBe(false)
  })

  it('has no loss until Metal Out is typed, and nothing to check without a Metal In weight', () => {
    expect(checkMetalOut(metalIn, [{ qty: '', purity: '' }], 0.5)).toMatchObject({ outWeight: null, loss: null, overLimit: false, maxPurity: null })
    expect(checkMetalOut([{ qty: null, purity: null }], [{ qty: '5', purity: '' }], 0.5)).toBeNull()
  })

  it('skips the purity check when Metal In has no purity', () => {
    const check = checkMetalOut([{ qty: 100, purity: null }], [{ qty: '99', purity: '99.9' }], null)
    expect(check).toMatchObject({ fineIn: null, purityTooHigh: false, maxPurity: null })
  })
})
