import { describe, expect, test } from 'vitest'
import {
  buildMetalOutPayload,
  finishedMetalOutLineFromJob,
  hasActiveMetalOut,
  isAlloyMixBatchCode,
  linesFromJobInputComponents,
  groupMetalOutSelectOptions,
  metalOutProductOptions,
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

  test('finishedMetalOutLineFromJob keeps Post Mix shares after extras bump targetGross', () => {
    const line = finishedMetalOutLineFromJob({
      finishedProductName: '22k alloyed gold',
      karat: 22,
      purity: 91.67,
      // Vault return bumped Overall Gross (551.51 + 5 Cd) onto the job.
      targetGross: 556.51,
      inputComponents: [
        { name: 'Gold Bar', gross: 505.182 },
        { name: 'pure copper', gross: 46.328 },
      ],
    })
    expect(line.compositionParts).toEqual([
      { label: 'finished', share: 0.92, shareText: '0.92' },
      { label: 'Gold', share: 0.915998, shareText: '0.915998' },
      { label: 'Copper', share: 0.084002, shareText: '0.084002' },
    ])
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

  test('buildMetalOutPayload keeps finished purityValue and includes additional metals in overall lines', () => {
    const finished = finishedMetalOutLineFromJob({
      finishedProductName: '22k alloyed gold',
      karat: 22,
      purity: 91.6,
      targetGross: 551.51,
      inputComponents: [
        { name: 'Gold Bar', gross: 505.182 },
        { name: 'pure copper', gross: 46.328 },
      ],
    }, { time: '14:40' })
    const { error, body } = buildMetalOutPayload({
      job: { mixCode: 'BMG-0001', currentDepartment: 'bangle' },
      lines: [
        { ...finished, qty: '551.51' },
        { metal: 'cadmium', qty: '2.5', purity: '100', time: '14:40' },
      ],
      entryDate: '2026-11-24',
      now: new Date('2026-11-24T10:00:00Z'),
    })
    expect(error).toBeNull()
    expect(body.lines).toHaveLength(2)
    expect(body.lines[0]).toMatchObject({ metal: '22k alloyed gold', qty: 551.51, purity: 91.6 })
    expect(body.lines[1]).toEqual({ metal: 'cadmium', qty: 2.5, purity: 100, time: '14:40' })
    expect(body.lines.reduce((sum, row) => sum + row.qty, 0)).toBeCloseTo(554.01, 3)
  })

  test('metalOutProductOptions groups created products under Gold / Silver / Copper', () => {
    const options = metalOutProductOptions([
      { _id: '1', name: 'Gold Bar', category: 'mainStock=gold;recordType=product;productPurity=1', quantity: 10 },
      { _id: '2', name: 'pure copper', category: 'mainStock=copper;recordType=product;productPurity=1', quantity: 5 },
      { _id: '3', name: 'Gold', category: 'mainStock=gold', quantity: 0 },
      { _id: '4', name: 'Fine Silver', category: 'mainStock=silver;recordType=product;productPurity=1', quantity: 3 },
      { _id: '5', name: '14k gold chain', category: 'mainStock=gold;recordType=product;productPurity=0.585', quantity: 2 },
    ], { excludeNames: [] })
    expect(options.map((row) => `${row.metalGroup}:${row.name}`)).toEqual([
      'Gold:14k gold chain',
      'Gold:Gold Bar',
      'Silver:Fine Silver',
      'Copper:pure copper',
    ])
    expect(options.find((row) => row.name === '14k gold chain').purity).toBe('58.5')
    expect(groupMetalOutSelectOptions(options).map((g) => ({
      label: g.label,
      names: g.items.map((i) => i.name),
    }))).toEqual([
      { label: 'Gold', names: ['14k gold chain', 'Gold Bar'] },
      { label: 'Silver', names: ['Fine Silver'] },
      { label: 'Copper', names: ['pure copper'] },
    ])
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
    // Approved earlier visit must not block a second Metal Out after return-to-vault.
    expect(hasActiveMetalOut(
      [{ direction: 'OUT', status: 'APPROVED', batchLabel: 'BMG-0003', entryDate: '2026-11-20', department: 'melting' }],
      { batchLabel: 'BMG-0003', entryDate: '2026-11-20', department: 'melting' },
    )).toBe(false)
  })
})
