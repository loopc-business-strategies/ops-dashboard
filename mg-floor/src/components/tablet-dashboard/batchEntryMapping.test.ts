import { describe, expect, it } from 'vitest'
import type { BatchEntryRow } from '@/src/api/batchEntries'
import {
  batchKey,
  batchStatusView,
  carriedOverEntries,
  dayTag,
  editableBatch,
  latestEntries,
  localDateKey,
  metalOptionsFor,
  metalOutChoices,
  nextBatchLabel,
  prepareBatchLines,
  previousDateKey,
  sentBatchesFor,
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

  it('starts the popup with Gold and Alloy, or the lines of the batch being fixed', () => {
    expect(editableBatch({ entryDate: D1, batchLabel: '4' })).toEqual({
      batchLabel: '4',
      entryDate: D1,
      lines: [
        { metal: 'Gold', qty: '', purity: '', time: '' },
        { metal: 'Alloy', qty: '', purity: '', time: '' },
      ],
    })
    expect(editableBatch({ entryDate: D1, batchLabel: '2' }, [{ metal: 'Silver', qty: 12.5, purity: null, time: '09:10' }]).lines).toEqual([
      { metal: 'Gold', qty: '', purity: '', time: '' },
      { metal: 'Alloy', qty: '', purity: '', time: '' },
      { metal: 'Silver', qty: '12.5', purity: '', time: '09:10' },
    ])
  })

  it('Metal Out starts with Gold only and never offers Alloy', () => {
    expect(editableBatch({ entryDate: D1, batchLabel: '4' }, undefined, 'OUT').lines).toEqual([
      { metal: 'Gold', qty: '', purity: '', time: '' },
    ])
    expect(metalOptionsFor('OUT')).not.toContain('Alloy')
    expect(metalOptionsFor('IN')).toContain('Alloy')
    const copper = { metal: 'Copper', qty: 5, purity: null, time: '00:03' }
    expect(withDefaultMetals([copper], 'OUT')).toEqual([{ metal: 'Gold', qty: null, purity: null, time: '' }, copper])
  })

  it('always lists Gold and Alloy first, keeping sent values and extra metals', () => {
    const gold = { metal: 'Gold', qty: 480, purity: null, time: '00:03' }
    const copper = { metal: 'Copper', qty: 5, purity: null, time: '00:03' }
    expect(withDefaultMetals([copper, gold])).toEqual([
      gold,
      { metal: 'Alloy', qty: null, purity: null, time: '' },
      copper,
    ])
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
