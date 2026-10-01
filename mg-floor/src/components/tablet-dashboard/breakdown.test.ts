import { describe, expect, it } from 'vitest'
import type { BreakdownStatus } from '@/src/api/floor'
import { breakdownButtonStatus, breakdownPhaseFor, cleanFixNote, formatDowntime, isMachineDown } from './breakdown'

const alert = (status: BreakdownStatus['status']): BreakdownStatus => ({
  _id: 'b1',
  status,
  department: 'melting',
  createdAt: '2026-10-01T06:00:00Z',
  acknowledgedByName: '',
  acknowledgedAt: null,
})

describe('breakdown', () => {
  it('follows the server status: ringing, acknowledged (machine still down), fixed', () => {
    expect(breakdownPhaseFor(alert('OPEN'))).toBe('waiting')
    expect(breakdownPhaseFor(alert('ACKNOWLEDGED'))).toBe('acknowledged')
    expect(breakdownPhaseFor(alert('RESOLVED'))).toBe('fixed')
  })

  it('keeps the machine down until fixed, so BREAKDOWN does not report it twice', () => {
    expect(['sending', 'waiting', 'acknowledged', 'fixing'].every((p) => isMachineDown(p as never))).toBe(true)
    expect(['idle', 'fixed', 'error'].some((p) => isMachineDown(p as never))).toBe(false)
    expect(breakdownButtonStatus('waiting')).toBe('Waiting for F.M…')
    expect(breakdownButtonStatus('acknowledged')).toBe('Machine down · tap when fixed')
    expect(breakdownButtonStatus('fixed')).toBeUndefined()
  })

  it('formats downtime and trims the note', () => {
    expect(formatDowntime(0)).toBe('less than a minute')
    expect(formatDowntime(40)).toBe('40 min')
    expect(formatDowntime(120)).toBe('2 h')
    expect(formatDowntime(135)).toBe('2 h 15 min')
    expect(formatDowntime(null)).toBe('')
    expect(cleanFixNote(`  ${'x'.repeat(400)} `)).toHaveLength(300)
  })
})
