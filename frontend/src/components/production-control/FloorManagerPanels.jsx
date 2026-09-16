import { useCallback, useEffect, useState } from 'react'
import { usePccApi } from './demo/usePccApi'
import { useDemoMode } from './demo/DemoModeContext'
import { DEMO_WRITE_MSG } from './demo/pccApiAdapter'
import { formatGrams, formatMinutes, formatTime, na, rowsToCsv, downloadCsv } from './shared'
import { PccEmptyState, PccKpiCard, PccSkeleton, PccStatusBadge } from './primitives'

export function FloorManagerPanel({ summary, onToast, onNavigate }) {
  const pccApi = usePccApi()
  const { isDemo } = useDemoMode()
  const [session, setSession] = useState(null)
  const [shift, setShift] = useState(null)

  const refreshSession = useCallback(async () => {
    try {
      const [sessions, shiftData] = await Promise.all([
        pccApi.listFloorSessions({ status: 'OPEN', limit: 20 }),
        pccApi.getCurrentShift(),
      ])
      setShift(shiftData.current || shiftData)
      const mine = (sessions.sessions || [])[0] || null
      setSession(mine)
    } catch {
      /* ignore */
    }
  }, [pccApi])

  useEffect(() => { refreshSession() }, [refreshSession])

  const login = async () => {
    try {
      const res = await pccApi.floorLogin({})
      onToast?.(isDemo ? DEMO_WRITE_MSG : 'Floor session started')
      setSession(res.session)
      refreshSession()
    } catch (err) {
      onToast?.(err?.response?.data?.message || 'Login failed')
    }
  }

  const logout = async () => {
    try {
      await pccApi.floorLogout({})
      onToast?.(isDemo ? DEMO_WRITE_MSG : 'Floor session ended')
      setSession(null)
      refreshSession()
    } catch (err) {
      onToast?.(err?.response?.data?.message || 'Logout failed')
    }
  }

  const kpis = summary?.kpis || {}
  const stock = summary?.stock || {}
  const currentShift = summary?.currentShift || shift

  return (
    <div className="pcc-stack">
      <div className="pcc-panel">
        <div className="pcc-panel-head">
          <h2>FLOOR MANAGER</h2>
          <div className="pcc-row-actions">
            {!session ? (
              <button type="button" className="pcc-btn" onClick={login}>Floor Login</button>
            ) : (
              <button type="button" className="pcc-btn-ghost" onClick={logout}>Floor Logout</button>
            )}
          </div>
        </div>
        {currentShift && (
          <div className="pcc-shift-card">
            <div><strong>CURRENT SHIFT</strong> · {currentShift.name}</div>
            <div>{currentShift.startLabel || currentShift.startTime} → {currentShift.endLabel || currentShift.endTime}</div>
            <div>Elapsed {formatMinutes(currentShift.timeElapsedMinutes)} · Remaining {formatMinutes(currentShift.timeRemainingMinutes)}</div>
          </div>
        )}
        {session && (
          <p className="pcc-muted">
            Logged in {formatTime(session.loginAt)} · Shift {session.shiftName} · <PccStatusBadge status={session.status} />
          </p>
        )}
      </div>

      <div className="pcc-kpi-row">
        <PccKpiCard label="Active jobs" value={kpis.activeBatches ?? 0} />
        <PccKpiCard label="Pending" value={kpis.waiting ?? 0} />
        <PccKpiCard label="Completed today" value={kpis.completedToday ?? 0} />
        <PccKpiCard label="QC pending" value={kpis.qcPending ?? 0} />
        <PccKpiCard label="QC failed" value={kpis.qcFailed ?? 0} />
        <PccKpiCard label="Holds" value={kpis.onHold ?? 0} />
        <PccKpiCard label="Alerts" value={kpis.activeAlerts ?? 0} />
        <PccKpiCard label="Metal WIP" value={formatGrams(kpis.metalInProduction)} />
        <PccKpiCard label="Available stock" value={stock.available?.count ?? 0} />
        <PccKpiCard label="Under processing" value={stock.underProcessing?.count ?? 0} />
      </div>

      <div className="pcc-panel">
        <div className="pcc-panel-head"><h2>EXCEPTIONS FIRST</h2></div>
        <div className="pcc-split">
          <div>
            <h3 className="pcc-muted">CRITICAL</h3>
            <ul className="pcc-list">
              {(summary?.openAlerts || []).filter((a) => a.severity === 'critical').slice(0, 8).map((a) => (
                <li key={a._id}>
                  <strong>{a.title}</strong>
                  <span>{a.message || a.code}</span>
                </li>
              ))}
              {(kpis.qcFailed || 0) > 0 && (
                <li><strong>QC failures</strong><span>{kpis.qcFailed} batch(es)</span>
                  <button type="button" className="pcc-btn-ghost" onClick={() => onNavigate?.('qc')}>Open QC</button>
                </li>
              )}
              {(summary?.openAlerts || []).filter((a) => a.severity === 'critical').length === 0 && !(kpis.qcFailed > 0) && (
                <li className="pcc-muted">No critical exceptions</li>
              )}
            </ul>
          </div>
          <div>
            <h3 className="pcc-muted">ATTENTION</h3>
            <ul className="pcc-list">
              {(summary?.attention || []).slice(0, 8).map((item, i) => (
                <li key={item.id || item.batchNumber || i}>
                  <strong>{item.title || item.batchNumber || item.type || 'Attention'}</strong>
                  <span>{item.message || item.reason || item.status || ''}</span>
                </li>
              ))}
              {(kpis.waiting || 0) > 0 && (
                <li><strong>Waiting jobs</strong><span>{kpis.waiting}</span></li>
              )}
              {(summary?.attention || []).length === 0 && !(kpis.waiting > 0) && (
                <li className="pcc-muted">No attention items</li>
              )}
            </ul>
          </div>
          <div>
            <h3 className="pcc-muted">NORMAL</h3>
            <ul className="pcc-list">
              <li><strong>Active production</strong><span>{kpis.activeBatches ?? 0} batches</span>
                <button type="button" className="pcc-btn-ghost" onClick={() => onNavigate?.('live')}>Live Floor</button>
              </li>
              <li><strong>In transit</strong><span>{formatGrams(kpis.metalInTransit) || 'N/A'}</span></li>
            </ul>
          </div>
        </div>
      </div>

      <div className="pcc-panel">
        <div className="pcc-panel-head"><h2>QUICK ACTIONS</h2></div>
        <div className="pcc-row-actions">
          <button type="button" className="pcc-btn-ghost" onClick={() => onNavigate?.('stock-overview')}>View stock</button>
          <button type="button" className="pcc-btn-ghost" onClick={() => onNavigate?.('stock-selection')}>Select stock</button>
          <button type="button" className="pcc-btn-ghost" onClick={() => onNavigate?.('batches')}>Batches</button>
          <button type="button" className="pcc-btn-ghost" onClick={() => onNavigate?.('qc')}>QC</button>
          <button type="button" className="pcc-btn-ghost" onClick={() => onNavigate?.('dept-packing')}>Packaging</button>
          <button type="button" className="pcc-btn-ghost" onClick={() => onNavigate?.('reports')}>Reports</button>
        </div>
      </div>

      <div className="pcc-panel">
        <div className="pcc-panel-head"><h2>DEPARTMENTS</h2></div>
        <div className="pcc-dept-grid">
          {(summary?.departments || []).map((d) => (
            <button
              key={d.key}
              type="button"
              className="pcc-dept-tile"
              onClick={() => onNavigate?.(`dept-${d.key}`)}
            >
              <strong>{d.label}</strong>
              <PccStatusBadge status={d.status} />
              <span>{d.active} active · {d.waiting} waiting</span>
            </button>
          ))}
          {!summary?.departments?.length && <PccEmptyState message="No department status yet" />}
        </div>
      </div>
    </div>
  )
}

export function FloorAttendancePanel({ onToast }) {
  const pccApi = usePccApi()
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await pccApi.listFloorSessions({ limit: 100 })
        if (!cancelled) setSessions(data.sessions || [])
      } catch (err) {
        onToast?.(err?.response?.data?.message || 'Failed to load attendance')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [pccApi, onToast])

  return (
    <div className="pcc-panel">
      <div className="pcc-panel-head"><h2>FLOOR MANAGER ATTENDANCE / ACTIVITY</h2></div>
      {loading ? <PccSkeleton rows={4} /> : !sessions.length ? (
        <PccEmptyState message="No floor sessions recorded" />
      ) : (
        <div className="pcc-table-wrap">
          <table className="pcc-table">
            <thead>
              <tr>
                <th>Date</th><th>Manager</th><th>Shift</th><th>Login</th><th>Logout</th><th>Duration</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s._id}>
                  <td>{s.loginAt ? new Date(s.loginAt).toLocaleDateString() : '—'}</td>
                  <td>{s.name}</td>
                  <td>{s.shiftName || '—'}</td>
                  <td>{formatTime(s.loginAt)}</td>
                  <td>{formatTime(s.logoutAt)}</td>
                  <td>{s.durationMinutes != null ? formatMinutes(s.durationMinutes) : (s.status === 'OPEN' ? '—' : '—')}</td>
                  <td><PccStatusBadge status={s.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export function ReportsPanel({ onToast }) {
  const pccApi = usePccApi()
  const [tab, setTab] = useState('daily')
  const [report, setReport] = useState(null)
  const [traceQuery, setTraceQuery] = useState('')
  const [loading, setLoading] = useState(false)

  const KPI_LABELS = {
    daily: [
      ['jobs', 'Jobs'],
      ['completed', 'Completed'],
      ['pending', 'Pending'],
      ['weightIn', 'Weight In'],
      ['weightOut', 'Weight Out'],
      ['scrap', 'Scrap'],
      ['loss', 'Loss'],
    ],
    stock: [
      ['movements', 'Movements'],
    ],
    dept: [
      ['departments', 'Departments'],
    ],
    qc: [
      ['PASS', 'Pass'],
      ['FAIL', 'Fail'],
      ['HOLD', 'Hold'],
      ['REWORK', 'Rework'],
    ],
    shift: [
      ['processRuns', 'Process Runs'],
      ['completed', 'Completed'],
      ['weight', 'Weight'],
      ['holds', 'Holds'],
    ],
    custody: [
      ['vaultCount', 'Vault Batches'],
      ['vaultWeight', 'Vault Weight'],
      ['wipCount', 'WIP Batches'],
      ['transitCount', 'In Transit'],
      ['totalBatches', 'Total Batches'],
    ],
    variance: [
      ['batchesReviewed', 'Batches Reviewed'],
      ['overToleranceCount', 'Over Tolerance'],
      ['avgVariancePct', 'Avg Variance %'],
      ['tolerancePct', 'Tolerance %'],
      ['totalDifference', 'Total Diff (g)'],
    ],
    machines: [
      ['machinesActive', 'Active Machines'],
      ['machinesFaultOrMaintenance', 'Fault / Maint'],
      ['totalJobs', 'Jobs'],
      ['totalCompleted', 'Completed'],
      ['totalWeightOut', 'Weight Out'],
      ['totalRunMinutes', 'Run Minutes'],
    ],
  }

  const load = useCallback(async (type) => {
    setLoading(true)
    setReport(null)
    try {
      let data
      if (type === 'daily') data = await pccApi.reportDaily({})
      else if (type === 'stock') data = await pccApi.reportStockMovement({ limit: 100 })
      else if (type === 'dept') data = await pccApi.reportDepartmentPerformance({})
      else if (type === 'qc') data = await pccApi.reportQc({})
      else if (type === 'shift') data = await pccApi.reportShift({})
      else if (type === 'custody') data = await pccApi.reportMetalCustody({})
      else if (type === 'variance') data = await pccApi.reportWeightVariance({})
      else if (type === 'machines') data = await pccApi.reportMachinePerformance({})
      setReport(data.report || data)
    } catch (err) {
      onToast?.(err?.response?.data?.message || 'Report failed')
    } finally {
      setLoading(false)
    }
  }, [pccApi, onToast])

  useEffect(() => { load(tab) }, [tab, load])

  const runTrace = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const q = String(traceQuery).trim()
      const params = q.toUpperCase().startsWith('STK-')
        ? { stockCode: q }
        : { batchNumber: q }
      const data = await pccApi.getTraceability(params)
      setReport(data.report || data)
      setTab('trace')
    } catch (err) {
      onToast?.(err?.response?.data?.message || 'Traceability lookup failed')
    } finally {
      setLoading(false)
    }
  }

  const r = report || {}
  const summary = r.summary || r.kpis || r.totals || r.production || {}
  const rows =
    r.rows || r.movements || r.departments || r.inspections || r.batches || r.items || r.byDepartment || []

  const curated = KPI_LABELS[tab]
  const kpiCards = curated
    ? curated.map(([key, label]) => {
      let value = summary[key]
      if (value == null && tab === 'stock') value = Array.isArray(rows) ? rows.length : null
      if (value == null && tab === 'dept') value = Array.isArray(rows) ? rows.length : null
      if (value == null && tab === 'shift' && r.production) value = r.production[key]
      if (value == null && tab === 'shift' && key === 'holds') value = r.holds
      return { key, label, value: value == null || value === '' ? 'N/A' : value }
    })
    : Object.entries(summary)
      .filter(([, v]) => v == null || typeof v !== 'object')
      .slice(0, 12)
      .map(([k, v]) => ({ key: k, label: k, value: v == null ? 'N/A' : v }))

  const exportCsv = () => {
    if (!Array.isArray(rows) || rows.length === 0) {
      onToast?.('No tabular rows to export')
      return
    }
    const keys = Object.keys(rows[0] || {}).slice(0, 12)
    const columns = keys.map((k) => ({ key: k, label: k, value: (row) => row[k] }))
    downloadCsv(`pcc-report-${tab}.csv`, rowsToCsv(rows, columns))
  }

  const REPORT_GROUPS = [
    {
      id: 'production',
      label: 'Production',
      items: [
        ['daily', 'Daily Production'],
        ['dept', 'Department'],
        ['shift', 'Shift'],
      ],
    },
    {
      id: 'quality',
      label: 'Quality',
      items: [
        ['qc', 'QC'],
        ['variance', 'Weight Variance'],
      ],
    },
    {
      id: 'material',
      label: 'Material',
      items: [
        ['stock', 'Stock Movement'],
        ['custody', 'Metal Custody'],
      ],
    },
    {
      id: 'machines',
      label: 'Machines',
      items: [
        ['machines', 'Machine Performance'],
      ],
    },
  ]

  return (
    <div className="pcc-stack">
      <div className="pcc-panel">
        <div className="pcc-panel-head"><h2>PRODUCTION REPORTS</h2></div>
        <div className="pcc-report-groups">
          {REPORT_GROUPS.map((group) => (
            <div key={group.id} className="pcc-report-group">
              <div className="pcc-report-group-label">{group.label}</div>
              <div className="pcc-row-actions">
                {group.items.map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    className={tab === id ? 'pcc-btn' : 'pcc-btn-ghost'}
                    onClick={() => setTab(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="pcc-row-actions" style={{ marginTop: 12 }}>
          <button type="button" className="pcc-btn-ghost" onClick={exportCsv}>Export CSV</button>
        </div>
        <form className="pcc-form-inline" onSubmit={runTrace} style={{ marginTop: 12 }}>
          <input className="pcc-input" placeholder="Trace STK-… or batch number" value={traceQuery}
            onChange={(e) => setTraceQuery(e.target.value)} />
          <button type="submit" className="pcc-btn">Traceability</button>
        </form>
      </div>

      {loading ? <PccSkeleton rows={6} /> : (
        <>
          <div className="pcc-kpi-row">
            {kpiCards.length === 0 ? (
              <PccKpiCard label="Status" value="N/A" />
            ) : kpiCards.map((c) => (
              <PccKpiCard key={c.key} label={c.label} value={typeof c.value === 'number' ? c.value : na(c.value, 'N/A')} />
            ))}
          </div>

          <div className="pcc-panel">
            <div className="pcc-panel-head"><h2>{String(tab).toUpperCase()} DETAIL</h2></div>
            {!Array.isArray(rows) || rows.length === 0 ? (
              <PccEmptyState message="No report rows for this period" />
            ) : (
              <div className="pcc-table-wrap">
                <table className="pcc-table">
                  <thead>
                    <tr>
                      {Object.keys(rows[0]).slice(0, 8).map((k) => <th key={k}>{k}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.slice(0, 100).map((row, i) => (
                      <tr key={row._id || row.id || i}>
                        {Object.keys(rows[0]).slice(0, 8).map((k) => (
                          <td key={k}>{typeof row[k] === 'object' && row[k] !== null ? JSON.stringify(row[k]) : na(row[k], '—')}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export function SettingsPanel({ onToast }) {
  const pccApi = usePccApi()
  const { isDemo } = useDemoMode()
  const [shifts, setShifts] = useState([])
  const [flow, setFlow] = useState(null)
  const [shiftForm, setShiftForm] = useState({
    name: 'Shift 1',
    startTime: '09:00',
    endTime: '21:00',
    breakMinutes: 0,
    isActive: true,
  })

  const load = useCallback(async () => {
    try {
      const [s, f] = await Promise.all([pccApi.listShifts(), pccApi.getFlow()])
      setShifts(s.shifts || [])
      setFlow(f.flow)
      if (s.shifts?.[0]) {
        setShiftForm({
          id: s.shifts[0]._id,
          name: s.shifts[0].name,
          startTime: s.shifts[0].startTime,
          endTime: s.shifts[0].endTime,
          breakMinutes: s.shifts[0].breakMinutes || 0,
          isActive: s.shifts[0].isActive !== false,
        })
      }
    } catch (err) {
      onToast?.(err?.response?.data?.message || 'Failed to load settings')
    }
  }, [pccApi, onToast])

  useEffect(() => { load() }, [load])

  const saveShift = async (e) => {
    e.preventDefault()
    try {
      await pccApi.upsertShift(shiftForm)
      onToast?.(isDemo ? DEMO_WRITE_MSG : 'Shift saved')
      load()
    } catch (err) {
      onToast?.(err?.response?.data?.message || 'Shift save failed')
    }
  }

  const saveThresholds = async (e) => {
    e.preventDefault()
    try {
      await pccApi.updateFlow({
        alertThresholds: flow?.alertThresholds || {},
        weightTolerancePct: flow?.weightTolerancePct,
        autoHoldOnVariance: flow?.autoHoldOnVariance,
      })
      onToast?.(isDemo ? DEMO_WRITE_MSG : 'Settings saved')
    } catch (err) {
      onToast?.(err?.response?.data?.message || 'Settings save failed')
    }
  }

  return (
    <div className="pcc-stack">
      <div className="pcc-panel">
        <div className="pcc-panel-head"><h2>SHIFT SETTINGS</h2></div>
        <p className="pcc-muted">Default Shift 1 is 09:00–21:00. Admin can change without code deploys.</p>
        <form className="pcc-form" onSubmit={saveShift}>
          <label>Name<input className="pcc-input" value={shiftForm.name}
            onChange={(e) => setShiftForm((f) => ({ ...f, name: e.target.value }))} /></label>
          <label>Start<input className="pcc-input" type="time" value={shiftForm.startTime}
            onChange={(e) => setShiftForm((f) => ({ ...f, startTime: e.target.value }))} /></label>
          <label>End<input className="pcc-input" type="time" value={shiftForm.endTime}
            onChange={(e) => setShiftForm((f) => ({ ...f, endTime: e.target.value }))} /></label>
          <label>Break (min)<input className="pcc-input" type="number" value={shiftForm.breakMinutes}
            onChange={(e) => setShiftForm((f) => ({ ...f, breakMinutes: Number(e.target.value) || 0 }))} /></label>
          <button type="submit" className="pcc-btn">Save Shift</button>
        </form>
        {shifts.length > 0 && (
          <ul className="pcc-list">
            {shifts.map((s) => (
              <li key={s._id}>{s.name}: {s.startTime}–{s.endTime} {s.isActive ? '' : '(inactive)'}</li>
            ))}
          </ul>
        )}
      </div>

      <div className="pcc-panel">
        <div className="pcc-panel-head"><h2>ALERT THRESHOLDS & FLOW</h2></div>
        {flow && (
          <form className="pcc-form" onSubmit={saveThresholds}>
            <label>Weight tolerance %
              <input className="pcc-input" type="number" step="0.1" value={flow.weightTolerancePct ?? 0.5}
                onChange={(e) => setFlow((f) => ({ ...f, weightTolerancePct: Number(e.target.value) }))} />
            </label>
            <label>Stock waiting hours
              <input className="pcc-input" type="number" value={flow.alertThresholds?.stockWaitingHours ?? 48}
                onChange={(e) => setFlow((f) => ({
                  ...f,
                  alertThresholds: { ...f.alertThresholds, stockWaitingHours: Number(e.target.value) },
                }))} />
            </label>
            <label>Batch delayed hours
              <input className="pcc-input" type="number" value={flow.alertThresholds?.batchDelayedHours ?? 24}
                onChange={(e) => setFlow((f) => ({
                  ...f,
                  alertThresholds: { ...f.alertThresholds, batchDelayedHours: Number(e.target.value) },
                }))} />
            </label>
            <label>Dept overload jobs
              <input className="pcc-input" type="number" value={flow.alertThresholds?.departmentOverloadJobs ?? 20}
                onChange={(e) => setFlow((f) => ({
                  ...f,
                  alertThresholds: { ...f.alertThresholds, departmentOverloadJobs: Number(e.target.value) },
                }))} />
            </label>
            <label>Process overdue hours
              <input className="pcc-input" type="number" value={flow.alertThresholds?.processOverdueHours ?? 8}
                onChange={(e) => setFlow((f) => ({
                  ...f,
                  alertThresholds: { ...f.alertThresholds, processOverdueHours: Number(e.target.value) },
                }))} />
            </label>
            <label>Shift ending minutes
              <input className="pcc-input" type="number" value={flow.alertThresholds?.shiftEndingMinutes ?? 30}
                onChange={(e) => setFlow((f) => ({
                  ...f,
                  alertThresholds: { ...f.alertThresholds, shiftEndingMinutes: Number(e.target.value) },
                }))} />
            </label>
            <button type="submit" className="pcc-btn">Save Settings</button>
          </form>
        )}
      </div>
    </div>
  )
}
