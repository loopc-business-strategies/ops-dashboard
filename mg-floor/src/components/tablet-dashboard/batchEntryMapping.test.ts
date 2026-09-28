import { describe, expect, it } from 'vitest'
import type { BatchEntryRow } from '@/src/api/batchEntries'
import {
  applyEntryLines,
  batchKey,
  batchStatusView,
  isBatchLocked,
  latestEntries,
  localDateKey,
  prepareBatchLines,
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
    expect(prepareBatchLines(batch([['Gold', '12,5', '', '']]), at).error).toMatch(/must be a number/)
    expect(prepareBatchLines(batch([['Gold', '-3', '', '']]), at).error).toMatch(/above 0/)
    expect(prepareBatchLines(batch([['Gold', '10', '1200', '']]), at).error).toMatch(/Purity/)
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

describe('latestEntries / applyEntryLines', () => {
  it('picks the newest entry per direction and batch', () => {
    const latest = latestEntries([
      row({ entryId: 'old', status: 'REJECTED', submittedAt: '2026-09-28T04:00:00.000Z' }),
      row({ entryId: 'new', status: 'PENDING', submittedAt: '2026-09-28T05:00:00.000Z' }),
      row({ entryId: 'out', direction: 'OUT' }),
    ])
    expect(latest.get(batchKey('IN', '1'))?.entryId).toBe('new')
    expect(latest.get(batchKey('OUT', '1'))?.entryId).toBe('out')
  })

  it('writes sent values back into the matching batch only', () => {
    const batches: MetalBatchEdit[] = [
      batch([['Gold', '', '', ''], ['Alloy', '5', '', '']]),
      { ...batch([['Gold', '7', '', '']]), batchLabel: '2' },
    ]
    const sent = new Map([[batchKey('IN', '1'), { lines: [{ metal: 'Gold', qty: 1250.2, purity: null, time: '08:40' }] }]])
    const next = applyEntryLines(batches, 'IN', sent)
    expect(next[0].lines).toEqual([
      { metal: 'Gold', qty: '1250.2', purity: '', time: '08:40' },
      { metal: 'Alloy', qty: '', purity: '', time: '' },
    ])
    expect(next[1]).toBe(batches[1])
  })
})

describe('status', () => {
  it('locks pending, queued and approved batches; rejected can be edited', () => {
    expect(isBatchLocked(undefined)).toBe(false)
    expect(isBatchLocked({ status: 'PENDING', entryId: 'a' })).toBe(true)
    expect(isBatchLocked({ status: 'QUEUED', entryId: 'a' })).toBe(true)
    expect(isBatchLocked({ status: 'APPROVED', entryId: 'a' })).toBe(true)
    expect(isBatchLocked({ status: 'REJECTED', entryId: 'a' })).toBe(false)
  })

  it('shows the reject reason and who decided', () => {
    const v = batchStatusView({ status: 'REJECTED', entryId: 'a', rejectReason: 'Gold qty wrong', decidedByName: 'Ravi' })
    expect(v?.label).toBe('REJECTED')
    expect(v?.note).toContain('Gold qty wrong — Ravi')
  })

  it('localDateKey uses the tablet day', () => {
    expect(localDateKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
  })
})
