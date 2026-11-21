import { describe, expect, it } from 'vitest'
import type { BatchEntryRow } from '@/src/api/batchEntries'
import {
  batchKey,
  batchStatusView,
  carriedOverEntries,
  dayTag,
  editableBatch,
  finishedMetalOutLineFromJob,
  formatBatchTotalLabel,
  isAlloyMixBatchCode,
  latestEntries,
  localDateKey,
  metalInChoices,
  metalOptionsFor,
  metalOutChoices,
  nextBatchLabel,
  prepareBatchLines,
  previousDateKey,
  sentBatchesFor,
  sumBatchLineQty,
  withDefaultMetals,
} from './batchEntryMapping'
import type { MetalBatchEdit } from './MetalProcessPanel'

const batch = (lines: Array<[string, string, string, string]>): MetalBatchEdit => ({
  batchLabel: '1',
  lines: lines.map(([metal, qty, purity, time]) => ({ metal, qty, purity, time })),
})

const at = new Date(2026, 8, 28, 8, 5)

describe('prepareBatchLines', () => {
  it('keeps filled rows, skips empty ones, fills a missing time', () => {
    const r = prepareBatchLines(batch([['Gold', '1250.20', '99.5', ''], ['Alloy', '', '', '']]), at)
    expect(r.error).toBeNull()
    expect(r.lines).toEqual([{ metal: 'Gold', qty: 1250.2, purity: 99.5, time: '08:05' }])
  })

  it('needs at least one quantity', () => {
    expect(prepareBatchLines(batch([['Gold', '', '', ''], ['Alloy', '', '', '']]), at).error).toBe('Enter Qty for Batch 1 first')
  })

  it('rejects purity or time without a quantity, and bad numbers', () => {
    expect(prepareBatchLines(batch([['Gold', '', '99.5', '']]), at).error).toBe('Enter Qty for Gold')
    expect(prepareBatchLines(batch([['Gold', '1.2kg', '', '']]), at).error).toMatch(/must be a number/)
    expect(prepareBatchLines(batch([['Gold', '-3', '', '']]), at).error).toMatch(/above 0/)
    expect(prepareBatchLines(batch([['Gold', '10', '1200', '']]), at).error).toMatch(/Purity/)
  })

  it('reads a comma as the decimal point', () => {
    expect(prepareBatchLines(batch([['Gold', '12,5', '99,5', '']]), at).lines[0]).toMatchObject({ qty: 12.5, purity: 99.5 })
    expect(prepareBatchLines(batch([['Gold', '1,2,3', '', '']]), at).error).toMatch(/must be a number/)
  })

  it('sends typed times as HH:MM and rejects times that are not real', () => {
    const time = (t: string) => prepareBatchLines(batch([['Gold', '10', '', t]]), at)
    expect(time('14.30').lines[0].time).toBe('14:30')
    expect(time('9:30').lines[0].time).toBe('09:30')
    expect(time('25:10').error).toBe('Time for Gold must be like 14:30 (00:00 to 23:59)')
  })
})

const row = (over: Partial<BatchEntryRow>): BatchEntryRow => ({
  _id: 'x',
  entryId: 'e1',
  direction: 'IN',
  department: 'melting',
  batchLabel: '1',
  entryDate: '2026-09-28',
  lines: [],
  status: 'PENDING',
  submittedAt: '2026-09-28T04:00:00.000Z',
  ...over,
})

const D1 = '2026-09-28'
const D2 = '2026-09-29'

describe('latestEntries / sentBatchesFor', () => {
  it('picks the newest entry per day, direction and batch', () => {
    const latest = latestEntries([
      row({ entryId: 'old', status: 'REJECTED', submittedAt: '2026-09-28T04:00:00.000Z' }),
      row({ entryId: 'new', status: 'PENDING', submittedAt: '2026-09-28T05:00:00.000Z' }),
      row({ entryId: 'out', direction: 'OUT' }),
      row({ entryId: 'next-day', entryDate: D2 }),
    ])
    expect(latest.get(batchKey(D1, 'IN', '1'))?.entryId).toBe('new')
    expect(latest.get(batchKey(D1, 'OUT', '1'))?.entryId).toBe('out')
    expect(latest.get(batchKey(D2, 'IN', '1'))?.entryId).toBe('next-day')
  })

  it('lists one direction, older days first then batch number, with its sent lines', () => {
    const gold = { metal: 'Gold', qty: 1250.2, purity: 99.5, time: '08:40' }
    const states = {
      [batchKey(D2, 'IN', '10')]: { status: 'PENDING' as const, entryId: 'a' },
      [batchKey(D2, 'IN', '2')]: { status: 'APPROVED' as const, entryId: 'b' },
      [batchKey(D1, 'IN', '5')]: { status: 'APPROVED' as const, entryId: 'd' },
      [batchKey(D2, 'OUT', '2')]: { status: 'PENDING' as const, entryId: 'c' },
    }
    const sent = new Map([[batchKey(D2, 'IN', '2'), { lines: [gold] }]])
    const rows = sentBatchesFor('IN', states, sent)
    expect(rows.map((r) => `${r.entryDate} ${r.batchLabel}`)).toEqual([`${D1} 5`, `${D2} 2`, `${D2} 10`])
    expect(rows[1].lines).toEqual([gold])
    expect(rows[2].lines).toEqual([])
  })
})

describe('night shift carry-over', () => {
  const sentAt = (d: number, h: number) => new Date(2026, 8, d, h, 0).toISOString()

  it('keeps yesterday batches whose Metal In was open at midnight', () => {
    const kept = carriedOverEntries(
      [
        row({ entryId: 'in1', batchLabel: '1', status: 'APPROVED' }),
        row({ entryId: 'out1', batchLabel: '1', direction: 'OUT', submittedAt: sentAt(28, 18) }),
        row({ entryId: 'in2', batchLabel: '2', status: 'APPROVED' }),
        row({ entryId: 'in3', batchLabel: '3', status: 'APPROVED' }),
        row({ entryId: 'out3', batchLabel: '3', direction: 'OUT', submittedAt: sentAt(29, 2) }),
        row({ entryId: 'in4', batchLabel: '4', status: 'APPROVED' }),
        row({ entryId: 'out4', batchLabel: '4', direction: 'OUT', status: 'REJECTED', submittedAt: sentAt(28, 23) }),
      ],
      D2,
    )
    // 1 was closed yesterday; 2 is still open; 3 was closed after midnight; 4's Metal Out was rejected.
    expect(kept.map((e) => e.entryId).sort()).toEqual(['in2', 'in3', 'in4', 'out3', 'out4'])
  })

  it('Metal Out offers yesterday open batches first, then today; else today next number', () => {
    const b = (entryDate: string, batchLabel: string) => ({ entryDate, batchLabel })
    expect(metalOutChoices([b(D2, '1'), b(D1, '7'), b(D2, '2')], [b(D2, '1')], D2)).toEqual([b(D1, '7'), b(D2, '2')])
    expect(metalOutChoices([b(D1, '7')], [b(D1, '7')], D2)).toEqual([b(D2, '1')])
    expect(metalOutChoices([b(D2, '1'), b(D1, '7')], [b(D2, '1'), b(D1, '7')], D2)).toEqual([b(D2, '2')])
    expect(metalOutChoices([], [], D2)).toEqual([b(D2, '1')])
  })

  it('tags batches from earlier days', () => {
    const now = new Date(2026, 8, 29, 1, 30)
    expect(previousDateKey(now)).toBe(D1)
    expect(previousDateKey(new Date(2026, 2, 1))).toBe('2026-02-28')
    expect(dayTag(D2, now)).toBe('')
    expect(dayTag(D1, now)).toBe('Yesterday')
    expect(dayTag('2026-09-20', now)).toBe('2026-09-20')
  })
})

describe('batch numbers', () => {
  it('numbers the next Metal In batch after the highest one', () => {
    expect(nextBatchLabel([])).toBe('1')
    expect(nextBatchLabel(['1', '3', '2'])).toBe('4')
    expect(nextBatchLabel(['A', '2'])).toBe('3')
  })

  it('starts the popup with Gold, Alloy, Silver, Copper, or the lines of the batch being fixed', () => {
    expect(editableBatch({ entryDate: D1, batchLabel: '4' })).toEqual({
      batchLabel: '4',
      entryDate: D1,
      lines: [
        { metal: 'Gold', qty: '', purity: '', time: '' },
        { metal: 'Alloy', qty: '', purity: '', time: '' },
        { metal: 'Silver', qty: '', purity: '', time: '' },
        { metal: 'Copper', qty: '', purity: '', time: '' },
      ],
    })
    expect(editableBatch({ entryDate: D1, batchLabel: '2' }, [{ metal: 'Silver', qty: 12.5, purity: null, time: '09:10' }]).lines).toEqual([
      { metal: 'Gold', qty: '', purity: '', time: '' },
      { metal: 'Alloy', qty: '', purity: '', time: '' },
      { metal: 'Silver', qty: '12.5', purity: '', time: '09:10' },
      { metal: 'Copper', qty: '', purity: '', time: '' },
    ])
  })

  it('Metal Out starts with Gold, Silver, Copper and never offers Alloy', () => {
    expect(editableBatch({ entryDate: D1, batchLabel: '4' }, undefined, 'OUT').lines).toEqual([
      { metal: 'Gold', qty: '', purity: '', time: '' },
      { metal: 'Silver', qty: '', purity: '', time: '' },
      { metal: 'Copper', qty: '', purity: '', time: '' },
    ])
    expect(metalOptionsFor('OUT')).not.toContain('Alloy')
    expect(metalOptionsFor('IN')).toContain('Alloy')
    const copper = { metal: 'Copper', qty: 5, purity: null, time: '00:03' }
    expect(withDefaultMetals([copper], 'OUT')).toEqual([
      { metal: 'Gold', qty: null, purity: null, time: '' },
      { metal: 'Silver', qty: null, purity: null, time: '' },
      copper,
    ])
  })

  it('always lists Gold, Alloy, Silver, Copper first, keeping sent values and extra metals', () => {
    const gold = { metal: 'Gold', qty: 480, purity: null, time: '00:03' }
    const copper = { metal: 'Copper', qty: 5, purity: null, time: '00:03' }
    expect(withDefaultMetals([copper, gold])).toEqual([
      gold,
      { metal: 'Alloy', qty: null, purity: null, time: '' },
      { metal: 'Silver', qty: null, purity: null, time: '' },
      copper,
    ])
  })

  it('prefers alloy mix product lines as-is when seeding Metal In', () => {
    const mixLines = [
      { metal: 'Gold 24K Bar', qty: 199.05, purity: null, time: '' },
      { metal: 'silver pure', qty: 47.12, purity: null, time: '' },
      { metal: 'pure copper', qty: 19.23, purity: null, time: '' },
    ]
    expect(editableBatch({ entryDate: D1, batchLabel: 'AMX-1' }, mixLines, 'IN', { preferSeedOnly: true }).lines).toEqual([
      { metal: 'Gold 24K Bar', qty: '199.05', purity: '', time: '' },
      { metal: 'silver pure', qty: '47.12', purity: '', time: '' },
      { metal: 'pure copper', qty: '19.23', purity: '', time: '' },
    ])
  })

  it('finishedMetalOutLineFromJob shows View-mix purity/share fractions', () => {
    expect(isAlloyMixBatchCode('BMG-0001')).toBe(true)
    const seeded = finishedMetalOutLineFromJob({
      finishedProductName: '18K Alloyed Gold',
      karat: 18,
      purity: 76,
      targetGross: 99.6,
      inputComponents: [
        { name: 'Gold 24K Bar', gross: 89.6 },
        { name: 'Fine Copper', gross: 10 },
      ],
    })
    expect(seeded).toEqual([{
      metal: '18K Alloyed Gold',
      qty: null,
      purity: 76,
      time: '',
      purityDisplay: 'finished 0.76 · Gold 0.899598 · Copper 0.100402',
      compositionParts: [
        { label: 'finished', share: 0.76, shareText: '0.76' },
        { label: 'Gold', share: 0.899598, shareText: '0.899598' },
        { label: 'Copper', share: 0.100402, shareText: '0.100402' },
      ],
    }])
    expect(editableBatch(
      { entryDate: D1, batchLabel: 'BMG-0001' },
      seeded,
      'OUT',
      { preferSeedOnly: true },
    ).lines).toEqual([
      {
        metal: '18K Alloyed Gold',
        qty: '',
        purity: 'finished 0.76 · Gold 0.899598 · Copper 0.100402',
        time: '',
        purityValue: '76',
        compositionParts: [
          { label: 'finished', share: 0.76, shareText: '0.76' },
          { label: 'Gold', share: 0.899598, shareText: '0.899598' },
          { label: 'Copper', share: 0.100402, shareText: '0.100402' },
        ],
      },
    ])
  })

  it('finishedMetalOutLineFromJob scales share after Update metal loss', () => {
    const seeded = finishedMetalOutLineFromJob({
      finishedProductName: '18K Alloyed Gold',
      karat: 18,
      purity: 76,
      targetGross: 99,
      inputComponents: [
        { name: 'Gold 24K Bar', gross: 89.6 },
        { name: 'Fine Copper', gross: 10 },
      ],
    })
    expect(seeded[0].compositionParts).toEqual([
      { label: 'finished', share: 0.76, shareText: '0.76' },
      { label: 'Gold', share: 0.899596, shareText: '0.899596' },
      { label: 'Copper', share: 0.100404, shareText: '0.100404' },
    ])
  })

  it('sums line qty into a total label under the batch', () => {
    expect(sumBatchLineQty([
      { qty: 199.05 },
      { qty: 47.12 },
      { qty: 19.23 },
    ])).toBe(265.4)
    expect(formatBatchTotalLabel(265.4)).toBe('265.4 g total')
  })
})

describe('metalInChoices', () => {
  it('offers each open alloy mix as its own batch before numeric fallback', () => {
    expect(metalInChoices(['AMX-261116-0001', 'AMX-261116-0002'], [], D1)).toEqual([
      { entryDate: D1, batchLabel: 'AMX-261116-0001' },
      { entryDate: D1, batchLabel: 'AMX-261116-0002' },
    ])
  })

  it('skips mixes that already have a Metal In and falls back to next number', () => {
    expect(
      metalInChoices(
        ['AMX-261116-0001'],
        [{ entryDate: D1, batchLabel: 'AMX-261116-0001' }],
        D1,
      ),
    ).toEqual([{ entryDate: D1, batchLabel: '1' }])
    expect(nextBatchLabel(['AMX-261116-0001', '2'])).toBe('3')
  })
})

describe('status', () => {
  it('shows the reject reason and who decided', () => {
    const v = batchStatusView({ status: 'REJECTED', entryId: 'a', rejectReason: 'Gold qty wrong', decidedByName: 'Ravi' })
    expect(v?.label).toBe('REJECTED')
    expect(v?.note).toContain('Gold qty wrong — Ravi')
  })

  it('localDateKey uses the tablet day', () => {
    expect(localDateKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
  })
})
