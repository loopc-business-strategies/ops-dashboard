import { describe, expect, it } from 'vitest'
import { formatDelay, shortDevice, syncItemKind, syncStatusPill } from './syncLog'

describe('offline sync helpers', () => {
  it('formats delays from minutes to days', () => {
    expect(formatDelay(null)).toBe('—')
    expect(formatDelay(0)).toBe('under 1 min')
    expect(formatDelay(45)).toBe('45m')
    expect(formatDelay(60)).toBe('1h')
    expect(formatDelay(95)).toBe('1h 35m')
    expect(formatDelay(1440)).toBe('1d')
    expect(formatDelay(3000)).toBe('2d 2h')
  })

  it('shows the batch approval status once received, and what went wrong otherwise', () => {
    expect(syncStatusPill({ status: 'SYNCED', batchStatus: 'PENDING' }).label).toBe('Waiting for F.M')
    expect(syncStatusPill({ status: 'SYNCED', batchStatus: 'APPROVED' }).label).toBe('Approved')
    expect(syncStatusPill({ status: 'SYNCED', batchStatus: '' }).label).toBe('Received')
    const failed = syncStatusPill({ status: 'FAILED' })
    expect(failed).toMatchObject({ label: 'Failed — not received', problem: true })
    expect(syncStatusPill({ status: 'SYNCING' }).label).toBe('Stuck while sending')
  })

  it('names the item and shortens the tablet id', () => {
    expect(syncItemKind({ type: 'batch_entry', direction: 'IN' })).toBe('Metal In')
    expect(syncItemKind({ type: 'batch_entry', direction: 'OUT' })).toBe('Metal Out')
    expect(syncItemKind({ type: 'weight_adjust' })).toBe('weight adjust')
    expect(shortDevice('device-abc123456')).toBe('…123456')
    expect(shortDevice('')).toBe('—')
  })
})
