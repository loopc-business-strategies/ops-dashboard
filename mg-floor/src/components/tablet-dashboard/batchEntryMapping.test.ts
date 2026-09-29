import { describe, expect, it } from 'vitest'
import type { BatchEntryRow } from '@/src/api/batchEntries'
import {
  batchKey,
  batchStatusView,
  editableBatch,
  latestEntries,
  localDateKey,
  metalOutChoices,
  nextBatchLabel,
  prepareBatchLines,
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

describe('latestEntries / sentBatchesFor', () => {
  it('picks the newest entry per direction and batch', () => {
    const latest = latestEntries([
      row({ entryId: 'old', status: 'REJECTED', submittedAt: '2026-09-28T04:00:00.000Z' }),
      row({ entryId: 'new', status: 'PENDING', submittedAt: '2026-09-28T05:00:00.000Z' }),
      row({ entryId: 'out', direction: 'OUT' }),
    ])
    expect(latest.get(batchKey('IN', '1'))?.entryId).toBe('new')
    expect(latest.get(batchKey('OUT', '1'))?.entryId).toBe('out')
  })

  it('lists one direction in batch number order with its sent lines', () => {
    const gold = { metal: 'Gold', qty: 1250.2, purity: 99.5, time: '08:40' }
    const states = {
      [batchKey('IN', '10')]: { status: 'PENDING' as const, entryId: 'a' },
      [batchKey('IN', '2')]: { status: 'APPROVED' as const, entryId: 'b' },
      [batchKey('OUT', '2')]: { status: 'PENDING' as const, entryId: 'c' },
    }
    const sent = new Map([[batchKey('IN', '2'), { lines: [gold] }]])
    const rows = sentBatchesFor('IN', states, sent)
    expect(rows.map((r) => r.batchLabel)).toEqual(['2', '10'])
    expect(rows[0].lines).toEqual([gold])
    expect(rows[1].lines).toEqual([])
  })
})

describe('batch numbers', () => {
  it('numbers the next Metal In batch after the highest one', () => {
    expect(nextBatchLabel([])).toBe('1')
    expect(nextBatchLabel(['1', '3', '2'])).toBe('4')
    expect(nextBatchLabel(['A', '2'])).toBe('3')
  })

  it('offers Metal In batches without a Metal Out, else the next unused number', () => {
    expect(metalOutChoices(['3', '1', '2'], ['1'])).toEqual(['2', '3'])
    expect(metalOutChoices(['1'], ['1'])).toEqual(['2'])
    expect(metalOutChoices([], [])).toEqual(['1'])
  })

  it('starts the popup with Gold and Alloy, or the lines of the batch being fixed', () => {
    expect(editableBatch('4')).toEqual({
      batchLabel: '4',
      lines: [
        { metal: 'Gold', qty: '', purity: '', time: '' },
        { metal: 'Alloy', qty: '', purity: '', time: '' },
      ],
    })
    expect(editableBatch('2', [{ metal: 'Silver', qty: 12.5, purity: null, time: '09:10' }]).lines).toEqual([
      { metal: 'Gold', qty: '', purity: '', time: '' },
      { metal: 'Alloy', qty: '', purity: '', time: '' },
      { metal: 'Silver', qty: '12.5', purity: '', time: '09:10' },
    ])
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
