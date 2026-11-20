import { useMemo, useState } from 'react'
import { useAlloyMixJobs } from '../../production-dashboard/useAlloyMixJobs'
import { DASHBOARD_DEPARTMENTS } from '../../production-dashboard/departmentConfig'
import { mgFloorAlloyMixApi } from '../../../api/mgFloorAlloyMix'
import { OPS_C as C } from './operationsTabTokens'
import { B, Badge } from './operationsTabUI'

/**
 * Operations › Allocate (MG): same alloy-mix custody controls as the Floor tablet —
 * allocate to another department, and Approve / Reject incoming receive requests.
 */
export default function TabAllocate({ showToast, tenantKey = 'mg' }) {
  const { jobs, byDepartment, loading, error, refresh, allocate } = useAlloyMixJobs({
    enabled: true,
    tenantKey,
  })
  const [deptFilter, setDeptFilter] = useState('all')
  const [busyId, setBusyId] = useState('')
  const [allocating, setAllocating] = useState(null)
  const [allocWeight, setAllocWeight] = useState('')
  const [localError, setLocalError] = useState('')

  const pendingIncoming = useMemo(
    () => (jobs || []).filter((j) => j.status === 'pending_receive' || j.pendingReceive),
    [jobs],
  )

  const departments = useMemo(() => {
    if (deptFilter === 'all') return DASHBOARD_DEPARTMENTS
    return DASHBOARD_DEPARTMENTS.filter((d) => d.key === deptFilter)
  }, [deptFilter])

  const destOptionsFor = (fromKey) => DASHBOARD_DEPARTMENTS.filter((d) => d.key !== fromKey)

  const openAllocate = (job) => {
    setAllocating(job)
    setAllocWeight(String(job.targetGross ?? ''))
    setLocalError('')
  }

  const closeAllocate = () => {
    if (busyId) return
    setAllocating(null)
    setAllocWeight('')
    setLocalError('')
  }

  const submitAllocate = async (toDepartment) => {
    if (!allocating || !toDepartment) return
    const available = Number(allocating.targetGross) || 0
    const typed = Number(allocWeight)
    const moveWeight = Number.isFinite(typed) && typed > 0 ? typed : available
    if (moveWeight > available + 0.0005) {
      setLocalError(`Only ${available} g available`)
      return
    }
    const fromCode = allocating.mixCode || 'MIX'
    const destLabel = DASHBOARD_DEPARTMENTS.find((d) => d.key === toDepartment)?.label || toDepartment
    setBusyId(allocating.id)
    setLocalError('')
    try {
      const result = await allocate(allocating.id, {
        toDepartment,
        ...(moveWeight + 0.0005 < available ? { weight: moveWeight } : {}),
      })
      setAllocating(null)
      setAllocWeight('')
      const wait = result?.pendingReceive ? ' — waiting for receive Approve' : ''
      if (result?.partial && result?.childJob) {
        showToast?.(
          'Allocated',
          `Split ${moveWeight} g → ${destLabel} as ${result.childJob.mixCode}`
          + ` · ${fromCode} keeps ${result.parentJob?.targetGross ?? '—'} g${wait}`,
        )
      } else {
        showToast?.('Allocated', `${fromCode} (${moveWeight} g) → ${destLabel}${wait}`)
      }
    } catch (err) {
      setLocalError(err?.response?.data?.message || err?.message || 'Allocate failed')
    } finally {
      setBusyId('')
    }
  }

  const onReceive = async (job, decision) => {
    setBusyId(job.id)
    setLocalError('')
    try {
      await mgFloorAlloyMixApi.receive(job.id, { decision })
      await refresh({ soft: true })
      showToast?.(
        decision === 'APPROVED' ? 'Receive approved' : 'Receive rejected',
        job.mixCode || 'MIX',
      )
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Receive failed'
      setLocalError(msg)
      showToast?.('Receive failed', msg)
    } finally {
      setBusyId('')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.t1 }}>Allocate</div>
          <div style={{ fontSize: 12.5, color: C.t4, marginTop: 2, maxWidth: 640 }}>
            After Post Mix, allocate batches department-wise and Approve / Reject incoming receives
            (same controls as the MG Floor tablet).
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            style={{
              height: 34, borderRadius: 8, border: `1px solid ${C.border}`, padding: '0 10px',
              background: C.inp, color: C.t1, fontWeight: 600, fontSize: 12.5,
            }}
            aria-label="Filter department"
          >
            <option value="all">All departments</option>
            {DASHBOARD_DEPARTMENTS.map((d) => (
              <option key={d.key} value={d.key}>{d.label}</option>
            ))}
          </select>
          <button type="button" onClick={() => refresh()} className={B.ghost} disabled={loading}>
            {loading ? 'Loading…' : 'Refresh'}
          </button>
        </div>
      </div>

      {error || localError ? (
        <div role="alert" style={{
          padding: '10px 12px', borderRadius: 8, background: 'rgba(255,71,87,.08)',
          border: '1px solid rgba(255,71,87,.25)', color: C.red, fontSize: 12.5, fontWeight: 600,
        }}
        >
          {localError || error}
        </div>
      ) : null}

      {pendingIncoming.length ? (
        <section style={{
          background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14,
        }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: C.t1 }}>Incoming requests</div>
            <Badge s={`Pending · ${pendingIncoming.length}`} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {pendingIncoming.map((job) => {
              const from = job.pendingFromDepartment
                || DASHBOARD_DEPARTMENTS.find((d) => d.key !== job.currentDepartment)?.key
              const fromLabel = DASHBOARD_DEPARTMENTS.find((d) => d.key === from)?.label || from || '—'
              const toLabel = DASHBOARD_DEPARTMENTS.find((d) => d.key === job.currentDepartment)?.label
                || job.currentDepartment
              return (
                <div
                  key={job.id || job.mixCode}
                  style={{
                    display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center',
                    justifyContent: 'space-between', padding: '10px 12px', borderRadius: 10,
                    background: C.card2, border: `1px solid ${C.border2}`,
                  }}
                >
                  <div style={{ minWidth: 200 }}>
                    <div style={{ fontWeight: 800, color: C.t1 }}>
                      {job.mixCode || 'MIX'}
                      {job.karat ? ` · ${job.karat}K` : ''}
                    </div>
                    <div style={{ fontSize: 12, color: C.t4, marginTop: 2 }}>
                      {fromLabel} → {toLabel}
                      {' · '}
                      {Number(job.targetGross || 0).toLocaleString(undefined, { maximumFractionDigits: 3 })} g
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      className={B.pri}
                      disabled={Boolean(busyId)}
                      onClick={() => onReceive(job, 'APPROVED')}
                    >
                      {busyId === job.id ? '…' : 'Approve'}
                    </button>
                    <button
                      type="button"
                      className={B.ghost}
                      disabled={Boolean(busyId)}
                      onClick={() => onReceive(job, 'REJECTED')}
                    >
                      Reject
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      ) : null}

      {departments.map((dept) => {
        const deptJobs = (byDepartment[dept.key] || []).filter(
          (j) => j.status !== 'pending_receive' && !j.pendingReceive,
        )
        return (
          <section
            key={dept.key}
            style={{
              background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{ fontSize: 13.5, fontWeight: 800, color: C.t1 }}>{dept.label}</div>
              <Badge s={`${deptJobs.length} open`} />
            </div>
            {!deptJobs.length ? (
              <div style={{ fontSize: 12.5, color: C.t4 }}>No open mixes in this department.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {deptJobs.map((job) => {
                  const canAlloc = job.canAllocate !== false
                  return (
                    <div
                      key={job.id || job.mixCode}
                      style={{
                        display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center',
                        justifyContent: 'space-between', padding: '10px 12px', borderRadius: 10,
                        background: C.card2, border: `1px solid ${C.border2}`,
                      }}
                    >
                      <div style={{ minWidth: 220 }}>
                        <div style={{ fontWeight: 800, color: C.t1 }}>
                          {job.mixCode || 'MIX'}
                          {job.karat ? ` · ${job.karat}K` : ''}
                          {job.hasOpenFloorDescendants ? (
                            <span style={{ fontWeight: 600, color: C.t4, marginLeft: 6 }}>· split on floor</span>
                          ) : null}
                        </div>
                        <div style={{ fontSize: 12, color: C.t4, marginTop: 2 }}>
                          {Number(job.targetGross || 0).toLocaleString(undefined, { maximumFractionDigits: 3 })} g
                          {job.finishedProductName ? ` · ${job.finishedProductName}` : ''}
                        </div>
                        {Array.isArray(job.inputComponents) && job.inputComponents.length ? (
                          <div style={{ fontSize: 11.5, color: C.t4, marginTop: 4 }}>
                            {job.inputComponents
                              .map((c) => `${c.name || c.label}: ${Number(c.gross || 0)} g`)
                              .join(' · ')}
                          </div>
                        ) : null}
                      </div>
                      {canAlloc ? (
                        <button
                          type="button"
                          className={B.pri}
                          disabled={Boolean(busyId)}
                          onClick={() => openAllocate(job)}
                        >
                          Allocate
                        </button>
                      ) : null}
                    </div>
                  )
                })}
              </div>
            )}
          </section>
        )
      })}

      {allocating ? (
        <div
          role="dialog"
          aria-label={`Allocate ${allocating.mixCode || 'mix'}`}
          style={{
            position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(15,23,42,.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
          }}
          onClick={closeAllocate}
          onKeyDown={(e) => { if (e.key === 'Escape') closeAllocate() }}
        >
          <div
            style={{
              width: 'min(440px, 100%)', background: '#fff', borderRadius: 14, padding: 16,
              border: `1px solid ${C.border}`, boxShadow: '0 18px 40px rgba(15,23,42,.2)',
            }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <strong style={{ color: C.t1 }}>{allocating.mixCode || 'MIX'}</strong>
              <button type="button" className={B.ghost} disabled={Boolean(busyId)} onClick={closeAllocate}>Close</button>
            </div>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12, fontWeight: 700, color: C.t3 }}>
              Weight (g)
              <input
                type="number"
                min="0"
                step="0.001"
                value={allocWeight}
                disabled={Boolean(busyId)}
                onChange={(e) => setAllocWeight(e.target.value)}
                style={{
                  height: 36, borderRadius: 8, border: `1px solid ${C.border}`, padding: '0 10px',
                  background: C.inp, fontWeight: 600,
                }}
              />
            </label>
            {localError ? (
              <p role="alert" style={{ color: C.red, fontSize: 12, fontWeight: 600, marginTop: 8 }}>{localError}</p>
            ) : null}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              {destOptionsFor(allocating.currentDepartment).map((dest) => (
                <button
                  key={dest.key}
                  type="button"
                  className={B.sec}
                  disabled={Boolean(busyId)}
                  onClick={() => submitAllocate(dest.key)}
                >
                  {busyId === allocating.id ? '…' : dest.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
