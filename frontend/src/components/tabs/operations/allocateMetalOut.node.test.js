import { describe, expect, test } from 'vitest'
import {
  buildMetalOutPayload,
  finishedMetalOutLineFromJob,
  hasActiveMetalOut,
  isAlloyMixBatchCode,
  linesFromJobInputComponents,
  prepareMetalOutLines,
} from './allocateMetalOut'

describe('allocateMetalOut', () => {
  test('linesFromJobInputComponents drops alloyed finished and keeps input metals', () => {
    expect(linesFromJobInputComponents([
      { name: 'Gold Bar', gross: 506.038 },
      { name: 'pure copper', gross: 45.791 },
      { name: '22k alloyed gold', gross: 551.6 },
    ])).toEqual([
      { metal: 'Gold Bar', qty: '506.038', purity: '', time: '' },
      { metal: 'pure copper', qty: '45.791', purity: '', time: '' },
    ])
  })

  test('finishedMetalOutLineFromJob shows View-mix purity/share fractions', () => {
    expect(isAlloyMixBatchCode('BMG-0001')).toBe(true)
    expect(finishedMetalOutLineFromJob({
      finishedProductName: '18K Alloyed Gold',
      karat: 18,
      purity: 76,
      targetGross: 99.6,
      inputComponents: [
        { name: 'Gold 24K Bar', gross: 89.6 },
        { name: 'Fine Copper', gross: 10 },
      ],
    }, { time: '11:59' })).toEqual({
      metal: '18K Alloyed Gold',
      qty: '',
      purity: 'finished 0.76 · Gold 0.899598 · Copper 0.100402',
      purityValue: 76,
      compositionParts: [
        { label: 'finished', share: 0.76, shareText: '0.76' },
        { label: 'Gold', share: 0.899598, shareText: '0.899598' },
        { label: 'Copper', share: 0.100402, shareText: '0.100402' },
      ],
      time: '11:59',
      lockedMetal: true,
      lockedPurity: true,
    })
  })

  test('finishedMetalOutLineFromJob scales share after Update metal loss (target < input sum)', () => {
    const line = finishedMetalOutLineFromJob({
      finishedProductName: '18K Alloyed Gold',
      karat: 18,
      purity: 76,
      targetGross: 99,
      inputComponents: [
        { name: 'Gold 24K Bar', gross: 89.6 },
        { name: 'Fine Copper', gross: 10 },
      ],
    })
    expect(line.compositionParts).toEqual([
      { label: 'finished', share: 0.76, shareText: '0.76' },
      { label: 'Gold', share: 0.899596, shareText: '0.899596' },
      { label: 'Copper', share: 0.100404, shareText: '0.100404' },
    ])
    // Qty change must not rescale locked composition (caller keeps compositionParts).
    expect(line.lockedPurity).toBe(true)
  })

  test('prepareMetalOutLines uses purityValue when purity shows composition text', () => {
    const { lines, error } = prepareMetalOutLines([{
      metal: '18K Alloyed Gold',
      qty: '97',
      purity: 'finished 0.76 · Gold 0.9 · Copper 0.1',
      purityValue: 76,
      time: '12:00',
    }])
    expect(error).toBeNull()
    expect(lines).toEqual([{ metal: '18K Alloyed Gold', qty: 97, purity: 76, time: '12:00' }])
  })

  test('prepareMetalOutLines requires qty and rejects Alloy', () => {
    expect(prepareMetalOutLines([{ metal: 'Gold Bar', qty: '', purity: '', time: '' }]).error)
      .toMatch(/Qty for Gold Bar/)
    expect(prepareMetalOutLines([{ metal: 'Alloy', qty: '10', purity: '', time: '10:00' }]).error)
      .toMatch(/Alloy is not allowed/)
  })

  test('buildMetalOutPayload builds OUT body for finished alloy mix job', () => {
    const { error, body } = buildMetalOutPayload({
      job: { mixCode: 'BMG-0003', currentDepartment: 'melting' },
      lines: [
        { metal: '22k alloyed gold', qty: '550', purity: '92', time: '14:30' },
      ],
      entryDate: '2026-11-20',
      now: new Date('2026-11-20T10:00:00Z'),
    })
    expect(error).toBeNull()
    expect(body.direction).toBe('OUT')
    expect(body.batchLabel).toBe('BMG-0003')
    expect(body.department).toBe('melting')
    expect(body.entryDate).toBe('2026-11-20')
    expect(body.lines).toEqual([
      { metal: '22k alloyed gold', qty: 550, purity: 92, time: '14:30' },
    ])
    expect(body.entryId).toMatch(/^amxout[A-Za-z0-9_-]{8,}/)
  })

  test('hasActiveMetalOut detects pending OUT for same batch', () => {
    expect(hasActiveMetalOut(
      [{ direction: 'OUT', status: 'PENDING', batchLabel: 'BMG-0003', entryDate: '2026-11-20', department: 'melting' }],
      { batchLabel: 'BMG-0003', entryDate: '2026-11-20', department: 'melting' },
    )).toBe(true)
    expect(hasActiveMetalOut(
      [{ direction: 'OUT', status: 'REJECTED', batchLabel: 'BMG-0003', entryDate: '2026-11-20', department: 'melting' }],
      { batchLabel: 'BMG-0003', entryDate: '2026-11-20', department: 'melting' },
    )).toBe(false)
  })
})
