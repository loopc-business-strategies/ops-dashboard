import { describe, expect, it } from 'vitest'
import {
  attendanceState,
  formatMinutes,
  localDayRange,
  minutesInWindow,
  summarizeAttendance,
} from './floorAttendance'

const range = { from: '2026-09-30T20:00:00.000Z', to: '2026-10-01T20:00:00.000Z' }
const now = Date.parse('2026-10-01T10:00:00.000Z')
const closed = (over) => ({ status: 'CLOSED', closedBy: 'user', ...over })

describe('localDayRange', () => {
  it('covers one full local day', () => {
    const { from, to } = localDayRange('2026-10-01')
    expect(Date.parse(to) - Date.parse(from)).toBe(24 * 60 * 60 * 1000)
    expect(new Date(from).getDate()).toBe(1)
  })
})

describe('attendanceState', () => {
  it('tells on-floor, logged-out and forgotten logins apart', () => {
    expect(attendanceState({ status: 'OPEN', loginAt: '2026-10-01T05:00:00Z' }, now)).toBe('ON_FLOOR')
    expect(attendanceState({ status: 'OPEN', loginAt: '2026-09-30T16:00:00Z' }, now)).toBe('FORGOT')
    expect(attendanceState(closed({}), now)).toBe('OUT')
    expect(attendanceState(closed({ closedBy: 'auto' }), now)).toBe('FORGOT')
  })
})

describe('minutesInWindow', () => {
  it('counts only the part of a night shift inside the day', () => {
    const row = closed({ loginAt: '2026-09-30T18:00:00Z', logoutAt: '2026-09-30T23:30:00Z' })
    expect(minutesInWindow(row, range, now)).toBe(210)
  })

  it('runs an open login up to now, and a forgotten one only to its last activity', () => {
    expect(minutesInWindow({ status: 'OPEN', loginAt: '2026-10-01T05:00:00Z' }, range, now)).toBe(300)
    const forgot = { status: 'OPEN', loginAt: '2026-09-30T16:00:00Z', lastActivityAt: '2026-09-30T21:00:00Z' }
    expect(minutesInWindow(forgot, range, now)).toBe(60)
  })
})

describe('summarizeAttendance', () => {
  it('adds up each employee and the day', () => {
    const rows = [
      closed({ userId: 'a', name: 'Op Melting', loginAt: '2026-10-01T04:00:00Z', logoutAt: '2026-10-01T06:00:00Z' }),
      { userId: 'a', name: 'Op Melting', status: 'OPEN', loginAt: '2026-10-01T07:00:00Z' },
      closed({ userId: 'b', name: 'Bilal', loginAt: '2026-10-01T05:00:00Z', logoutAt: '2026-10-01T05:30:00Z', closedBy: 'auto' }),
    ]
    const s = summarizeAttendance(rows, range, now)
    expect(s).toMatchObject({ peopleCount: 2, onFloorCount: 1, totalMinutes: 330, forgotten: 1 })
    expect(s.people.map((p) => [p.name, p.minutes, p.sessions, p.onFloor])).toEqual([
      ['Bilal', 30, 1, false],
      ['Op Melting', 300, 2, true],
    ])
  })
})

describe('formatMinutes', () => {
  it('formats hours and minutes', () => {
    expect(formatMinutes(425)).toBe('7h 05m')
    expect(formatMinutes(40)).toBe('40m')
  })
})
