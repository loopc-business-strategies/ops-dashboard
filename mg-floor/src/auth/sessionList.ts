import { floorDepartmentLabel, normalizeFloorDepartment } from '@/src/config/floorDepartments'
import type { LoginMethod } from '@/src/api/auth'

export type FloorUser = {
  id: string
  name: string
  role: string
  department?: string
  floorDepartment?: string
  productionRole?: string | null
  employeeCode?: string
  hasFloorPin?: boolean
}

/** One employee logged in on this tablet. */
export type FloorSession = {
  token: string
  user: FloorUser
  permissions: Record<string, boolean>
  shift: unknown
  loginAt: string
  loginMethod: LoginMethod
}

/** An employee who logged out of this tablet today (kept so the table shows their logout time). */
export type LoggedOutEntry = {
  userId: string
  name: string
  loginAt: string
  logoutAt: string
}

export type EmployeeListRow = {
  userId: string
  name: string
  loginAt: string | null
  logoutAt: string | null
  active: boolean
}

export const isManagerSession = (s: FloorSession) => Boolean(s.permissions?.approveBatches)

/** Adds a login; logging in again as someone already on the tablet refreshes their token but keeps the first login time. */
export function upsertSession(list: FloorSession[], next: FloorSession): FloorSession[] {
  const existing = list.find((s) => s.user.id === next.user.id)
  if (!existing) return [...list, next]
  return list.map((s) => (s.user.id === next.user.id ? { ...next, loginAt: existing.loginAt } : s))
}

export function removeSession(list: FloorSession[], userId: string): FloorSession[] {
  return list.filter((s) => s.user.id !== userId)
}

/** The session that drives the dashboard: a manager when one is logged in, otherwise the first employee. */
export function primarySession(list: FloorSession[]): FloorSession | null {
  return list.find(isManagerSession) || list[0] || null
}

/**
 * Operators may only join a tablet already working for their own department.
 * Returns an error message, or null when the login is allowed.
 */
export function departmentMismatch(candidate: FloorSession, tabletDepartment: string): string | null {
  if (isManagerSession(candidate)) return null
  const tablet = normalizeFloorDepartment(tabletDepartment)
  const own = normalizeFloorDepartment(candidate.user.floorDepartment)
  if (!tablet || !own || tablet === own) return null
  return `${candidate.user.name} works in ${floorDepartmentLabel(own)}, but this tablet is on ${floorDepartmentLabel(tablet)}.`
}

export function sameLocalDay(a: string | Date, b: string | Date = new Date()) {
  const x = new Date(a)
  const y = new Date(b)
  return x.getFullYear() === y.getFullYear() && x.getMonth() === y.getMonth() && x.getDate() === y.getDate()
}

export function recordLogout(log: LoggedOutEntry[], session: FloorSession, at = new Date()): LoggedOutEntry[] {
  const entry: LoggedOutEntry = {
    userId: session.user.id,
    name: session.user.name,
    loginAt: session.loginAt,
    logoutAt: at.toISOString(),
  }
  return [...log.filter((e) => sameLocalDay(e.logoutAt, at)), entry].slice(-50)
}

/** Logged-in employees first (by login time), then today's logouts (latest first) for people not logged back in. */
export function employeeRows(sessions: FloorSession[], log: LoggedOutEntry[], now = new Date()): EmployeeListRow[] {
  const active = [...sessions]
    .sort((a, b) => a.loginAt.localeCompare(b.loginAt))
    .map((s) => ({ userId: s.user.id, name: s.user.name, loginAt: s.loginAt, logoutAt: null, active: true }))
  const activeIds = new Set(sessions.map((s) => s.user.id))
  const seen = new Set<string>()
  const out = [...log]
    .filter((e) => sameLocalDay(e.logoutAt, now) && !activeIds.has(e.userId))
    .sort((a, b) => b.logoutAt.localeCompare(a.logoutAt))
    .filter((e) => (seen.has(e.userId) ? false : (seen.add(e.userId), true)))
    .map((e) => ({ userId: e.userId, name: e.name, loginAt: e.loginAt, logoutAt: e.logoutAt, active: false }))
  return [...active, ...out]
}
