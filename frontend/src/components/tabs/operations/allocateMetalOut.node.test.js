import { describe, expect, test } from 'vitest'
import {
  buildMetalOutPayload,
  hasActiveMetalOut,
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

  test('prepareMetalOutLines requires qty and rejects Alloy', () => {
    expect(prepareMetalOutLines([{ metal: 'Gold Bar', qty: '', purity: '', time: '' }]).error)
      .toMatch(/Qty for Gold Bar/)
    expect(prepareMetalOutLines([{ metal: 'Alloy', qty: '10', purity: '', time: '10:00' }]).error)
      .toMatch(/Alloy is not allowed/)
  })

  test('buildMetalOutPayload builds OUT body for mix job', () => {
    const { error, body } = buildMetalOutPayload({
      job: { mixCode: 'BMG-0003', currentDepartment: 'melting' },
      lines: [
        { metal: 'Gold Bar', qty: '500', purity: '', time: '14:30' },
        { metal: 'pure copper', qty: '40', purity: '1', time: '14:30' },
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
      { metal: 'Gold Bar', qty: 500, purity: null, time: '14:30' },
      { metal: 'pure copper', qty: 40, purity: 1, time: '14:30' },
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
