import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { mgFloorAttendanceApi } from '../../../api/mgFloorAttendance'
import {
  FORGOT_LOGOUT_HOURS,
  attendanceState,
  departmentLabel,
  formatMinutes,
  localDayKey,
  localDayRange,
  minutesInWindow,
  summarizeAttendance,
} from './floorAttendance'
import { OPS_C as C } from './operationsTabTokens'
import { B, SH, StatCard, TableHead, TableWrap, TD, TH } from './operationsTabUI'

const POLL_MS = 60000

const STATE_PILL = {
  ON_FLOOR: { label: 'On floor', bg: 'rgba(0,200,150,.12)', color: '#065f46' },
  OUT: { label: 'Logged out', bg: '#f1f5f9', color: '#475569' },
  FORGOT: { label: 'Forgot to log out', bg: '#fff7ed', color: '#9a3412' },
}

const errorMessage = (err, fallback) => err?.response?.data?.message || err?.message || fallback

function formatClock(value, dayKey) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return '—'
  const clock = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  return localDayKey(d) === dayKey ? clock : `${d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} ${clock}`
}

function StatePill({ state }) {
  const p = STATE_PILL[state] || STATE_PILL.OUT
  return (
    <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20, background: p.bg, color: p.color, whiteSpace: 'nowrap' }}>
      {p.label}
    </span>
  )
}

/** Operations › Attendance: who logged in and out on the MG Floor tablets, per local day. */
export default function TabFloorAttendance() {
  const [dayKey, setDayKey] = useState(localDayKey)
  const [department, setDepartment] = useState('')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [now, setNow] = useState(Date.now)
  const requestRef = useRef(0)
  const range = useMemo(() => localDayRange(dayKey), [dayKey])

  const load = useCallback(async () => {
    const request = ++requestRef.current
    try {
      const res = await mgFloorAttendanceApi.list(range)
      if (request !== requestRef.current) return
      setRows(Array.isArray(res?.attendance) ? res.attendance : [])
      setNow(Date.now())
      setLoadError('')
    } catch (err) {
      if (request !== requestRef.current) return
      setLoadError(errorMessage(err, 'Could not load attendance'))
    } finally {
      if (request === requestRef.current) setLoading(false)
    }
  }, [range])

  useEffect(() => {
    setLoading(true)
    load()
    const timer = setInterval(load, POLL_MS)
    return () => {
      clearInterval(timer)
      requestRef.current += 1
    }
  }, [load])

  const departments = useMemo(
    () => [...new Set(rows.map((r) => r.floorDepartment).filter(Boolean))].sort(),
    [rows],
  )
  const shown = useMemo(
    () => (department ? rows.filter((r) => r.floorDepartment === department) : rows),
    [rows, department],
  )
  const summary = useMemo(() => summarizeAttendance(shown, range, now), [shown, range, now])
  const isToday = dayKey === localDayKey()

  const select = {
    padding: '7px 10px',
    borderRadius: 8,
    border: `1px solid ${C.border}`,
    fontSize: 13,
    fontFamily: 'inherit',
    color: C.t1,
    background: '#fff',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <SH
        title="Floor attendance"
        sub="Every login and logout on the MG Floor tablets. Hours count only the part of each login that falls on the chosen day."
      >
        <button type="button" className={B.sec} onClick={() => { setLoading(true); load() }}>Refresh</button>
      </SH>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, color: C.t2, fontWeight: 600 }}>
          Day
          <input
            type="date"
            value={dayKey}
            max={localDayKey()}
            onChange={(e) => { if (e.target.value) setDayKey(e.target.value) }}
            style={select}
          />
        </label>
        {!isToday ? (
          <button type="button" className={`${B.sec} ${B.sm}`} onClick={() => setDayKey(localDayKey())}>Today</button>
        ) : null}
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13, color: C.t2, fontWeight: 600 }}>
          Department
          <select value={department} onChange={(e) => setDepartment(e.target.value)} style={select}>
            <option value="">All departments</option>
            {departments.map((d) => <option key={d} value={d}>{departmentLabel(d)}</option>)}
          </select>
        </label>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 11 }}>
        <StatCard label="On the floor now" value={isToday ? summary.onFloorCount : '—'} sub={isToday ? 'Logged in right now' : 'Only shown for today'} />
        <StatCard label="People this day" value={summary.peopleCount} sub="Logged in at least once" />
        <StatCard label="Total hours" value={formatMinutes(summary.totalMinutes)} sub="All logins on this day" />
        <StatCard
          label="Forgot to log out"
          value={summary.forgotten}
          sub={`Open more than ${FORGOT_LOGOUT_HOURS} hours`}
          dot={summary.forgotten ? '#f59e0b' : undefined}
        />
      </div>

      {loadError ? <div role="alert" style={{ color: C.red, fontSize: 13 }}>{loadError}</div> : null}

      <TableWrap>
        <TableHead title="Hours per employee" subtitle={loading ? 'Loading…' : `${summary.peopleCount} employees`} />
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 640 }}>
            <thead>
              <tr>{['Employee', 'Department', 'First login', 'Logins', 'Hours', 'Now'].map((h) => <th key={h} style={TH}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {!loading && !summary.people.length ? (
                <tr><td colSpan={6} style={{ ...TD, textAlign: 'center', color: C.t4, padding: 28 }}>No one logged in on the tablets this day.</td></tr>
              ) : null}
              {summary.people.map((p) => (
                <tr key={p.key}>
                  <td style={TD}>
                    <div style={{ fontWeight: 700, color: C.t1 }}>{p.name}</div>
                    {p.employeeCode ? <div style={{ fontSize: 11, color: C.t4 }}>{p.employeeCode}</div> : null}
                  </td>
                  <td style={TD}>{departmentLabel(p.department)}</td>
                  <td style={TD}>{formatClock(p.firstLoginAt, dayKey)}</td>
                  <td style={TD}>{p.sessions}</td>
                  <td style={{ ...TD, fontWeight: 800, color: C.t1 }}>{formatMinutes(p.minutes)}</td>
                  <td style={TD}>{p.onFloor ? <StatePill state="ON_FLOOR" /> : <span style={{ color: C.t4 }}>—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </TableWrap>

      <TableWrap>
        <TableHead title="All logins" subtitle={loading ? 'Loading…' : `${shown.length} logins · refreshes every minute`} />
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 760 }}>
            <thead>
              <tr>{['Employee', 'Department', 'Role', 'Login', 'Logout', 'Hours this day', 'Status'].map((h) => <th key={h} style={TH}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {!loading && !shown.length ? (
                <tr><td colSpan={7} style={{ ...TD, textAlign: 'center', color: C.t4, padding: 28 }}>No logins this day.</td></tr>
              ) : null}
              {shown.map((row) => {
                const state = attendanceState(row, now)
                return (
                  <tr key={row._id} style={state === 'FORGOT' ? { background: '#fff7ed' } : undefined}>
                    <td style={TD}>
                      <div style={{ fontWeight: 700, color: C.t1 }}>{row.name}</div>
                      {row.employeeCode ? <div style={{ fontSize: 11, color: C.t4 }}>{row.employeeCode}</div> : null}
                    </td>
                    <td style={TD}>{departmentLabel(row.floorDepartment)}</td>
                    <td style={{ ...TD, textTransform: 'capitalize' }}>{departmentLabel(row.productionRole)}</td>
                    <td style={{ ...TD, whiteSpace: 'nowrap' }}>{formatClock(row.loginAt, dayKey)}</td>
                    <td style={{ ...TD, whiteSpace: 'nowrap' }}>
                      {row.status === 'OPEN' ? <span style={{ color: C.t4 }}>Still logged in</span> : formatClock(row.logoutAt, dayKey)}
                      {row.closedBy === 'auto' ? <div style={{ fontSize: 11, color: C.orange }}>Closed automatically</div> : null}
                    </td>
                    <td style={{ ...TD, fontWeight: 700 }}>{formatMinutes(minutesInWindow(row, range, now))}</td>
                    <td style={TD}><StatePill state={state} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </TableWrap>
    </div>
  )
}
