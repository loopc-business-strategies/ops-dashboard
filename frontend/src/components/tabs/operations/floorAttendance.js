/** Same as the backend: a tablet login left open longer than this was forgotten. */
export const FORGOT_LOGOUT_HOURS = 16
const FORGOT_MS = FORGOT_LOGOUT_HOURS * 60 * 60 * 1000

const pad = (n) => String(n).padStart(2, '0')

/** Today's date in the browser's time zone, YYYY-MM-DD. */
export function localDayKey(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Start and end of a local day as ISO timestamps, for the attendance API. */
export function localDayRange(dayKey) {
  const [y, m, d] = String(dayKey).split('-').map(Number)
  const from = new Date(y, m - 1, d)
  const to = new Date(y, m - 1, d + 1)
  return { from: from.toISOString(), to: to.toISOString() }
}

const time = (value) => {
  const t = value ? new Date(value).getTime() : NaN
  return Number.isFinite(t) ? t : null
}

/** ON_FLOOR (logged in now), OUT (logged out), or FORGOT (never logged out). */
export function attendanceState(row, now = Date.now()) {
  if (row?.status === 'OPEN') {
    const login = time(row.loginAt)
    return login != null && now - login >= FORGOT_MS ? 'FORGOT' : 'ON_FLOOR'
  }
  return row?.closedBy === 'auto' ? 'FORGOT' : 'OUT'
}

/**
 * Minutes of this login that fall inside the day window. A forgotten login counts only up to its
 * last activity, so it does not run on for days.
 */
export function minutesInWindow(row, { from, to }, now = Date.now()) {
  const login = time(row?.loginAt)
  if (login == null) return 0
  const state = attendanceState(row, now)
  let end
  if (row.status === 'OPEN') end = state === 'FORGOT' ? (time(row.lastActivityAt) ?? login) : now
  else end = time(row.logoutAt) ?? time(row.lastActivityAt) ?? login
  const start = Math.max(login, time(from))
  const stop = Math.min(end, time(to))
  return stop > start ? Math.round((stop - start) / 60000) : 0
}

/** Headline numbers and per-employee totals for one day. */
export function summarizeAttendance(rows, range, now = Date.now()) {
  const byPerson = new Map()
  let totalMinutes = 0
  let forgotten = 0
  ;(rows || []).forEach((row) => {
    const key = String(row.userId || row.name)
    const minutes = minutesInWindow(row, range, now)
    const state = attendanceState(row, now)
    totalMinutes += minutes
    if (state === 'FORGOT') forgotten += 1
    const person = byPerson.get(key) || {
      key,
      name: row.name,
      employeeCode: row.employeeCode || '',
      department: row.floorDepartment || '',
      minutes: 0,
      sessions: 0,
      firstLoginAt: row.loginAt,
      onFloor: false,
    }
    person.minutes += minutes
    person.sessions += 1
    if (time(row.loginAt) < time(person.firstLoginAt)) person.firstLoginAt = row.loginAt
    if (state === 'ON_FLOOR') person.onFloor = true
    byPerson.set(key, person)
  })
  const people = [...byPerson.values()].sort((a, b) => a.name.localeCompare(b.name))
  return {
    people,
    peopleCount: people.length,
    onFloorCount: people.filter((p) => p.onFloor).length,
    totalMinutes,
    forgotten,
  }
}

/** 425 -> "7h 05m", 40 -> "40m". */
export function formatMinutes(minutes) {
  const m = Math.max(0, Math.round(Number(minutes) || 0))
  const h = Math.floor(m / 60)
  return h ? `${h}h ${pad(m % 60)}m` : `${m}m`
}

export function departmentLabel(key) {
  const text = String(key || '').replace(/_/g, ' ').trim()
  return text ? text.replace(/\b\w/g, (c) => c.toUpperCase()) : '—'
}
