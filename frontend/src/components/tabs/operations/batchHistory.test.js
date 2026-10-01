import { describe, expect, it } from 'vitest'
import { countByStatus, eventText, historyPresets, sideStatusText } from './batchHistory'

describe('batch history helpers', () => {
  it('builds date presets from today', () => {
    expect(historyPresets(new Date(2026, 2, 1)).map((p) => [p.id, p.from, p.to])).toEqual([
      ['today', '2026-03-01', '2026-03-01'],
      ['yesterday', '2026-02-28', '2026-02-28'],
      ['last_7', '2026-02-23', '2026-03-01'],
      ['last_30', '2026-01-31', '2026-03-01'],
    ])
  })

  it('names each side status', () => {
    expect(sideStatusText(null)).toBe('Not sent')
    expect(sideStatusText({ status: 'APPROVED' })).toBe('Approved')
    expect(sideStatusText({ status: 'PENDING' })).toBe('Waiting for F.M')
    expect(sideStatusText({ status: 'REJECTED', undone: true })).toBe('Approval undone')
    expect(sideStatusText({ status: 'REJECTED' })).toBe('Rejected')
  })

  it('describes timeline events', () => {
    expect(eventText({ type: 'sent', direction: 'IN', by: 'Op One', lines: [{ metal: 'Gold', qty: 1000, purity: 99.5, time: '08:00' }, { metal: 'Alloy', qty: 5 }] }))
      .toEqual({ tone: 'sent', title: 'Metal In sent by Op One', detail: 'Gold · 1000 g · 99.5% · 08:00  |  Alloy · 5 g' })
    expect(eventText({ type: 'undone', direction: 'OUT', by: 'FM', reason: 'Out was 909' }))
      .toEqual({ tone: 'undone', title: 'Metal Out approval undone by FM', detail: 'Reason: Out was 909' })
    expect(eventText({ type: 'rejected', direction: 'IN', by: 'FM', reason: '' }).detail).toBe('')
  })

  it('counts batches per status', () => {
    expect(countByStatus([{ status: 'finished' }, { status: 'finished' }, { status: 'waiting' }, { status: 'odd' }]))
      .toEqual({ waiting: 1, sent_back: 0, running: 0, finished: 2 })
  })
})
