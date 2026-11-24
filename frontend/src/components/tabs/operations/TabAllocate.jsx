import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../../../context/AuthContext'
import { inventoryApi } from '../../../api/erp-accounting/inventory'
import { useAlloyMixJobs } from '../../production-dashboard/useAlloyMixJobs'
import { DASHBOARD_DEPARTMENTS } from '../../production-dashboard/departmentConfig'
import { mgFloorAlloyMixApi } from '../../../api/mgFloorAlloyMix'
import { mgFloorBatchEntriesApi } from '../../../api/mgFloorBatchEntries'
import { OPS_C as C } from './operationsTabTokens'
import { B, Badge } from './operationsTabUI'
import {
  blankMetalOutLine,
  buildMetalOutPayload,
  clockNow,
  finishedMetalOutLineFromJob,
  hasActiveMetalOut,
  isAlloyMixBatchCode,
  localDateKey,
  groupMetalOutSelectOptions,
  metalOutProductOptions,
} from './allocateMetalOut'

/**
 * Operations › Allocate (MG): same alloy-mix custody controls as the Floor tablet —
 * allocate to another department, Approve / Reject incoming receives, and Metal Out
 * (typed OUT batch for Floor Manager approval) per department.
 */
export default function TabAllocate({ showToast, tenantKey = 'mg' }) {
  const { token } = useAuth()
  const { jobs, byDepartment, loading, error, refresh, allocate } = useAlloyMixJobs({
    enabled: true,
    tenantKey,
  })
  const [deptFilter, setDeptFilter] = useState('all')
  const [busyId, setBusyId] = useState('')
  const [allocating, setAllocating] = useState(null)
  const [allocWeight, setAllocWeight] = useState('')
  const [metalOutJob, setMetalOutJob] = useState(null)
  const [metalOutLines, setMetalOutLines] = useState([])
  const [outEntries, setOutEntries] = useState([])
  const [inventoryProducts, setInventoryProducts] = useState([])
  const [localError, setLocalError] = useState('')

  const pendingIncoming = useMemo(
    () => (jobs || []).filter((j) => j.status === 'pending_receive' || j.pendingReceive),
    [jobs],
  )

  const metalCatalog = useMemo(
    () => metalOutProductOptions(inventoryProducts),
    [inventoryProducts],
  )

  const departments = useMemo(() => {
    if (deptFilter === 'all') return DASHBOARD_DEPARTMENTS
    return DASHBOARD_DEPARTMENTS.filter((d) => d.key === deptFilter)
  }, [deptFilter])

  const destOptionsFor = (fromKey) => DASHBOARD_DEPARTMENTS.filter((d) => d.key !== fromKey)

  const loadOutEntries = useCallback(async () => {
    try {
      const today = localDateKey()
      const res = await mgFloorBatchEntriesApi.list({
        direction: 'OUT',
        entryDate: today,
        limit: 200,
      })
      setOutEntries(Array.isArray(res?.entries) ? res.entries : [])
    } catch {
      setOutEntries([])
    }
  }, [])

  useEffect(() => {
    loadOutEntries()
  }, [loadOutEntries, jobs])

  useEffect(() => {
    if (!token) {
      setInventoryProducts([])
      return undefined
    }
    let cancelled = false
    inventoryApi.getInventoryProducts(token, { limit: 500 })
      .then((data) => {
        if (!cancelled) setInventoryProducts(Array.isArray(data?.products) ? data.products : [])
      })
      .catch(() => {
        if (!cancelled) setInventoryProducts([])
      })
    return () => { cancelled = true }
  }, [token])

  const openAllocate = (job) => {
    setMetalOutJob(null)
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

  const openMetalOut = (job) => {
    setAllocating(null)
    const now = clockNow()
    const alloyOut = isAlloyMixBatchCode(job?.mixCode)
    const withTime = alloyOut
      ? [finishedMetalOutLineFromJob(job, { time: now })]
      : [blankMetalOutLine('Gold Bar'), blankMetalOutLine('pure copper')]
        .map((row) => ({ ...row, time: row.time || now }))
    setMetalOutJob(job)
    setMetalOutLines(withTime)
    setLocalError('')
  }

  const closeMetalOut = () => {
    if (busyId) return
    setMetalOutJob(null)
    setMetalOutLines([])
    setLocalError('')
  }

  const updateMetalOutLine = (index, patch) => {
    setMetalOutLines((rows) => rows.map((row, i) => (i === index ? { ...row, ...patch } : row)))
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

  const submitMetalOut = async () => {
    if (!metalOutJob) return
    const { error: prepError, body } = buildMetalOutPayload({
      job: metalOutJob,
      lines: metalOutLines,
    })
    if (prepError || !body) {
      setLocalError(prepError || 'Invalid Metal Out')
      return
    }
    setBusyId(metalOutJob.id)
    setLocalError('')
    try {
      await mgFloorBatchEntriesApi.submit(body)
      setMetalOutJob(null)
      setMetalOutLines([])
      await loadOutEntries()
      showToast?.(
        'Metal Out sent',
        `${body.batchLabel} · ${body.department} — waiting for Floor Manager approval`,
      )
    } catch (err) {
      const msg = err?.response?.data?.message || err?.message || 'Metal Out failed'
      setLocalError(msg)
      showToast?.('Metal Out failed', msg)
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

  const today = localDateKey()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.t1 }}>Allocate</div>
          <div style={{ fontSize: 12.5, color: C.t4, marginTop: 2, maxWidth: 720 }}>
            After Post Mix, allocate batches department-wise, Approve / Reject incoming receives,
            and send Metal Out (same as MG Floor tablet) for Floor Manager approval.
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
          <button
            type="button"
            onClick={() => { refresh(); loadOutEntries() }}
            className={B.ghost}
            disabled={loading}
          >
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

      <section style={{
        background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 14,
      }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <div style={{ fontSize: 13.5, fontWeight: 800, color: C.t1 }}>Incoming requests</div>
          <Badge s={pendingIncoming.length ? `Pending · ${pendingIncoming.length}` : 'None pending'} />
        </div>
        {!pendingIncoming.length ? (
          <div style={{ fontSize: 12.5, color: C.t4 }}>
            No incoming receives right now. After you Allocate to a department, Approve / Reject appear here.
          </div>
        ) : (
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
        )}
      </section>

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
                  const outSent = hasActiveMetalOut(outEntries, {
                    batchLabel: job.mixCode,
                    entryDate: today,
                    department: job.currentDepartment || dept.key,
                  })
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
                          {outSent ? (
                            <span style={{ fontWeight: 600, color: C.orange, marginLeft: 6 }}>· Metal Out pending</span>
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
                      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className={B.sec}
                          disabled={Boolean(busyId) || outSent}
                          title={outSent ? 'Metal Out already sent for FM approval today' : 'Send Metal Out like MG Floor tablet'}
                          onClick={() => openMetalOut(job)}
                        >
                          Metal Out
                        </button>
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

      {metalOutJob ? (
        <div
          role="dialog"
          aria-label={`Metal Out ${metalOutJob.mixCode || 'mix'}`}
          style={{
            position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(15,23,42,.45)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
          }}
          onClick={closeMetalOut}
          onKeyDown={(e) => { if (e.key === 'Escape') closeMetalOut() }}
        >
          <div
            style={{
              width: 'min(640px, 100%)', background: '#fff', borderRadius: 14, padding: 16,
              border: `1px solid ${C.border}`, boxShadow: '0 18px 40px rgba(15,23,42,.2)',
              maxHeight: '90vh', overflow: 'auto',
            }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div>
                <strong style={{ color: C.t1 }}>Metal Out · {metalOutJob.mixCode || 'MIX'}</strong>
                <div style={{ fontSize: 12, color: C.t4, marginTop: 2 }}>
                  {DASHBOARD_DEPARTMENTS.find((d) => d.key === metalOutJob.currentDepartment)?.label
                    || metalOutJob.currentDepartment}
                  {' · '}
                  {isAlloyMixBatchCode(metalOutJob.mixCode)
                    ? 'Finished product from Post Mix — Gross (g) + Time; purity/share matches View mix. Use + Add metal for extra lines (summed into overall Gross).'
                    : 'Sends for Floor Manager approval (same as MG Floor tablet)'}
                </div>
              </div>
              <button type="button" className={B.ghost} disabled={Boolean(busyId)} onClick={closeMetalOut}>Close</button>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: '1.35fr 1fr 1fr 0.9fr auto',
              gap: 8,
              alignItems: 'center',
              padding: '8px 10px',
              marginBottom: 8,
              borderRadius: 8,
              background: '#FFF7ED',
              border: '1px solid #FED7AA',
            }}
            >
              {[
                ['Metal', 'left'],
                ['Quantity (g)', 'center'],
                ['Purity', 'center'],
                ['Time', 'center'],
              ].map(([label, align]) => (
                <span
                  key={label}
                  style={{
                    fontSize: 12,
                    fontWeight: 800,
                    letterSpacing: '0.04em',
                    textTransform: 'uppercase',
                    color: '#9A3412',
                    textAlign: align,
                  }}
                >
                  {label}
                </span>
              ))}
              <span />
            </div>
            {metalOutLines.map((row, index) => {
              // Only the Post Mix finished row stays locked; additional metals are editable.
              const alloyLocked = Boolean(row.lockedMetal || row.lockedPurity)
              const usedNames = metalOutLines
                .map((r, i) => (i === index ? '' : String(r.metal || '').trim()))
                .filter(Boolean)
              const selectOptions = metalOutProductOptions(inventoryProducts, { excludeNames: usedNames })
              const metalGroups = groupMetalOutSelectOptions(selectOptions)
              const fieldStyle = {
                width: '100%',
                minHeight: 44,
                borderRadius: 8,
                border: '1px solid #CBD5E1',
                padding: '0 10px',
                background: '#FFFFFF',
                color: C.t1,
                fontSize: 15,
                fontWeight: 700,
                textAlign: 'center',
                boxSizing: 'border-box',
              }
              const lockedStyle = {
                ...fieldStyle,
                background: '#F8FAFC',
                borderColor: '#E2E8F0',
                color: C.t2,
              }
              return (
                <div
                  key={`out-line-${index}`}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1.35fr 1fr 1fr 0.9fr auto',
                    gap: 8,
                    marginBottom: 8,
                    alignItems: 'center',
                    paddingBottom: 8,
                    borderBottom: `1px solid ${C.border}`,
                  }}
                >
                  {alloyLocked ? (
                    <input
                      value={row.metal}
                      disabled
                      readOnly
                      aria-label={`Metal row ${index + 1}`}
                      style={{ ...lockedStyle, textAlign: 'left', fontSize: 14 }}
                    />
                  ) : (
                    <select
                      value={row.metal || ''}
                      disabled={Boolean(busyId)}
                      onChange={(e) => {
                        const name = e.target.value
                        const opt = selectOptions.find((p) => p.name === name)
                          || metalCatalog.find((p) => p.name === name)
                        updateMetalOutLine(index, {
                          metal: name,
                          purity: opt?.purity != null ? opt.purity : '',
                          ...(!String(row.time || '').trim() ? { time: clockNow() } : {}),
                        })
                      }}
                      aria-label={`Metal row ${index + 1}`}
                      style={{ ...fieldStyle, textAlign: 'left', fontSize: 14 }}
                    >
                      <option value="">Select metal…</option>
                      {row.metal && !selectOptions.some((p) => p.name === row.metal) ? (
                        <option value={row.metal}>{row.metal}</option>
                      ) : null}
                      {metalGroups.map((group) => (
                        <optgroup key={group.key} label={group.label}>
                          {group.items.map((opt) => (
                            <option key={opt.id} value={opt.name}>{opt.name}</option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  )}
                  <input
                    type="number"
                    min="0"
                    step="0.001"
                    value={row.qty}
                    disabled={Boolean(busyId)}
                    onChange={(e) => updateMetalOutLine(index, { qty: e.target.value })}
                    placeholder="0.000"
                    aria-label={`Quantity (g) row ${index + 1}`}
                    style={fieldStyle}
                  />
                  {alloyLocked && Array.isArray(row.compositionParts) && row.compositionParts.length ? (
                    <div
                      aria-label={`Purity row ${index + 1}`}
                      title={row.purityValue != null
                        ? `Post Mix share (finished fine gold ${row.purityValue}%)`
                        : 'Post Mix Gold / Copper share'}
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                        alignItems: 'stretch',
                        minWidth: 0,
                      }}
                    >
                      {row.compositionParts.map((part) => (
                        <span
                          key={`${part.label}-${part.shareText || part.share}`}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'flex-end',
                            padding: '3px 8px',
                            borderRadius: 6,
                            border: '1px solid #E2E8F0',
                            background: part.label === 'finished' ? '#FFFBEB' : '#F8FAFC',
                            color: C.t2,
                            lineHeight: 1.15,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <span style={{ fontSize: 12, fontWeight: 800, color: C.t1, fontVariantNumeric: 'tabular-nums' }}>
                            {part.shareText != null ? part.shareText : part.share}
                          </span>
                          <span style={{ fontSize: 9, fontWeight: 700, color: '#94A3B8', textTransform: 'lowercase' }}>
                            {part.label}
                          </span>
                        </span>
                      ))}
                    </div>
                  ) : (
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={row.purity}
                      disabled={Boolean(busyId) || alloyLocked}
                      readOnly={alloyLocked}
                      onChange={(e) => updateMetalOutLine(index, { purity: e.target.value })}
                      placeholder="e.g. 91.6"
                      aria-label={`Purity row ${index + 1}`}
                      style={alloyLocked ? lockedStyle : fieldStyle}
                    />
                  )}
                  <input
                    value={row.time}
                    disabled={Boolean(busyId)}
                    onChange={(e) => updateMetalOutLine(index, { time: e.target.value })}
                    placeholder="HH:MM"
                    aria-label={`Time row ${index + 1}`}
                    style={{
                      ...fieldStyle,
                      background: '#F3F4F6',
                      borderColor: '#E5E7EB',
                      color: C.t2,
                    }}
                  />
                  {alloyLocked ? (
                    <span aria-hidden style={{ width: 36 }} />
                  ) : (
                    <button
                      type="button"
                      className={B.ghost}
                      disabled={Boolean(busyId) || metalOutLines.length <= 1}
                      onClick={() => setMetalOutLines((rows) => rows.filter((_, i) => i !== index))}
                      aria-label="Remove line"
                    >
                      ✕
                    </button>
                  )}
                </div>
              )
            })}

            {(() => {
              const overallGross = metalOutLines.reduce((sum, row) => sum + (Number(row.qty) || 0), 0)
              return overallGross > 0 ? (
                <div style={{
                  marginTop: 4,
                  marginBottom: 4,
                  fontSize: 13,
                  fontWeight: 800,
                  color: C.t1,
                  textAlign: 'right',
                  fontVariantNumeric: 'tabular-nums',
                }}
                >
                  Overall Gross: {overallGross.toLocaleString(undefined, { maximumFractionDigits: 3 })} g
                </div>
              ) : null
            })()}

            <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className={B.ghost}
                disabled={Boolean(busyId) || metalOutLines.length >= 8 || !metalCatalog.length}
                title={!metalCatalog.length ? 'No inventory products loaded' : 'Add another created metal'}
                onClick={() => setMetalOutLines((rows) => [...rows, { ...blankMetalOutLine(), time: clockNow() }])}
              >
                + Add metal
              </button>
              <button
                type="button"
                className={B.pri}
                disabled={Boolean(busyId)}
                onClick={submitMetalOut}
              >
                {busyId === metalOutJob.id ? 'Sending…' : 'Send Metal Out'}
              </button>
            </div>
            {localError ? (
              <p role="alert" style={{ color: C.red, fontSize: 12, fontWeight: 600, marginTop: 8 }}>{localError}</p>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
