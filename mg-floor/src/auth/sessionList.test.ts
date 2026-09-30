import { describe, expect, test } from 'vitest'
import {
  departmentMismatch,
  employeeRows,
  primarySession,
  recordLogout,
  removeSession,
  upsertSession,
  type FloorSession,
} from './sessionList'

const session = (id: string, over: Partial<FloorSession> & { dept?: string; manager?: boolean } = {}): FloorSession => ({
  token: `tok-${id}`,
  loginAt: over.loginAt || '2026-09-30T08:00:00.000Z',
  loginMethod: 'password',
  shift: null,
  permissions: { approveBatches: Boolean(over.manager) },
  user: { id, name: `Emp ${id}`, role: 'department_user', floorDepartment: over.dept ?? 'melting' },
})

describe('multi-employee session list', () => {
  test('adds employees and re-login refreshes the token but keeps the first login time', () => {
    let list = upsertSession([], session('a', { loginAt: '2026-09-30T08:00:00.000Z' }))
    list = upsertSession(list, session('b'))
    list = upsertSession(list, { ...session('a', { loginAt: '2026-09-30T10:00:00.000Z' }), token: 'tok-a2' })
    expect(list.map((s) => s.user.id)).toEqual(['a', 'b'])
    expect(list[0].token).toBe('tok-a2')
    expect(list[0].loginAt).toBe('2026-09-30T08:00:00.000Z')
    expect(removeSession(list, 'a').map((s) => s.user.id)).toEqual(['b'])
  })

  test('primary session is a manager when one is logged in, otherwise the first employee', () => {
    expect(primarySession([])).toBeNull()
    const ops = [session('a'), session('b')]
    expect(primarySession(ops)?.user.id).toBe('a')
    expect(primarySession([...ops, session('fm', { manager: true, dept: '' })])?.user.id).toBe('fm')
  })

  test('operators from another department cannot join; managers always can', () => {
    expect(departmentMismatch(session('a', { dept: 'melting' }), 'melting')).toBeNull()
    expect(departmentMismatch(session('a', { dept: 'rolling' }), 'melting')).toMatch(/Rolling.*Melting/)
    expect(departmentMismatch(session('fm', { dept: 'rolling', manager: true }), 'melting')).toBeNull()
    expect(departmentMismatch(session('a', { dept: 'rolling' }), '')).toBeNull()
    expect(departmentMismatch(session('a', { dept: '' }), 'melting')).toBeNull()
  })

  test('employee table lists logged-in employees then today\'s logouts, without duplicates', () => {
    const now = new Date('2026-09-30T12:00:00')
    const a = session('a', { loginAt: '2026-09-30T09:00:00.000Z' })
    const b = session('b', { loginAt: '2026-09-30T07:00:00.000Z' })
    const c = session('c')
    let log = recordLogout([], c, new Date('2026-09-30T10:00:00'))
    log = recordLogout(log, a, new Date('2026-09-30T10:30:00'))
    log = recordLogout(log, c, new Date('2026-09-30T11:00:00'))
    const yesterday = { userId: 'z', name: 'Old', loginAt: '2026-09-29T08:00:00.000Z', logoutAt: '2026-09-29T17:00:00' }

    const rows = employeeRows([a, b], [yesterday, ...log], now)
    expect(rows.map((r) => [r.userId, r.active])).toEqual([
      ['b', true],
      ['a', true],
      ['c', false],
    ])
    expect(rows[2].logoutAt).toBe(new Date('2026-09-30T11:00:00').toISOString())
  })

  test('the logout log only keeps today\'s entries', () => {
    const old = { userId: 'z', name: 'Old', loginAt: '2026-09-29T08:00:00.000Z', logoutAt: new Date('2026-09-29T17:00:00').toISOString() }
    const log = recordLogout([old], session('a'), new Date('2026-09-30T09:00:00'))
    expect(log.map((e) => e.userId)).toEqual(['a'])
  })
})
