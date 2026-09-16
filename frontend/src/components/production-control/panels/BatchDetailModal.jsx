import { useCallback, useEffect, useState } from 'react'
import { usePccApi } from '../demo/usePccApi'
import { useDemoMode } from '../demo/DemoModeContext'
import { DEMO_WRITE_MSG } from '../demo/pccApiAdapter'
import { formatGrams, formatTime } from '../shared'
import {
  PccConfirmDialog,
  PccEmptyState,
  PccSkeleton,
  PccStatusBadge,
  PccWeightDisplay,
} from '../primitives'
import { inventoryApi } from '../../../api/operations/inventory'
import { useDebounced, canIssueGate } from './panelHelpers'

function formatGap(ms) {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return null
  const mins = Math.round(ms / 60000)
  if (mins < 1) return '<1m'
  if (mins < 60) return `${mins}m`
  const h = Math.floor(mins / 60)
  const m = mins % 60
  return m ? `${h}h ${m}m` : `${h}h`
}

function timelineTone(type) {
  const t = String(type || '').toLowerCase()
  if (t.includes('fail') || t.includes('hold') || t.includes('cancel')) return 'bad'
  if (t.includes('qc') || t.includes('rework') || t.includes('wait')) return 'warn'
  if (t.includes('complete') || t.includes('pass') || t.includes('received') || t.includes('end')) return 'ok'
  if (t.includes('start') || t.includes('process') || t.includes('issued')) return 'active'
  return 'muted'
}

/** Prefer API timeline; fall back to composing from related collections. */
function enrichTimeline(detail) {
  const existing = Array.isArray(detail?.timeline) ? [...detail.timeline] : []
  if (existing.length > 0) {
    return existing
      .filter((e) => e?.at)
      .sort((a, b) => new Date(a.at) - new Date(b.at))
      .map((e) => ({
        ...e,
        detail: e.detail
          || (e.data?.department ? `Dept ${e.data.department}` : null)
          || (e.data?.fromDepartment && e.data?.toDepartment
            ? `${e.data.fromDepartment} → ${e.data.toDepartment}`
            : null)
          || null,
      }))
  }

  const events = []
  const batch = detail?.batch
  if (batch?.createdAt) {
    events.push({ at: batch.createdAt, type: 'created', label: `Batch ${batch.batchNumber || ''} created`.trim() })
  }
  for (const p of detail?.processes || []) {
    if (p.startTime) {
      events.push({
        at: p.startTime,
        type: 'process_start',
        label: `${p.process || 'Process'} started`,
        detail: p.department || null,
      })
    }
    if (p.endTime) {
      events.push({
        at: p.endTime,
        type: 'process_end',
        label: `${p.process || 'Process'} completed`,
        detail: p.department || null,
      })
    }
  }
  for (const p of detail?.passes || []) {
    if (p.createdAt) {
      events.push({
        at: p.createdAt,
        type: 'pass',
        label: `Pass ${p.passNumber || ''} ${p.status || ''}`.trim(),
        detail: p.fromDepartment && p.toDepartment ? `${p.fromDepartment} → ${p.toDepartment}` : null,
      })
    }
    if (p.issuedAt) {
      events.push({ at: p.issuedAt, type: 'pass_issued', label: `Pass ${p.passNumber || ''} issued`.trim() })
    }
    if (p.receivedAt) {
      events.push({ at: p.receivedAt, type: 'pass_received', label: `Pass ${p.passNumber || ''} received`.trim() })
    }
  }
  for (const m of detail?.movements || []) {
    if (m.createdAt) {
      events.push({
        at: m.createdAt,
        type: 'movement',
        label: `Movement ${m.movementNumber || m.type || ''}`.trim(),
      })
    }
  }
  for (const q of detail?.qc || []) {
    if (q.createdAt) {
      events.push({
        at: q.createdAt,
        type: 'qc',
        label: `QC ${q.result || q.status || ''}`.trim(),
      })
    }
  }
  for (const a of detail?.adjustments || []) {
    if (a.createdAt) {
      events.push({
        at: a.createdAt,
        type: 'weight',
        label: `Weight ${a.field || ''} adjusted`.trim(),
      })
    }
  }
  return events.sort((a, b) => new Date(a.at) - new Date(b.at))
}

export default function BatchDetailModal({ batchId, onClose, onToast, onRefreshFloor }) {
  const pccApi = usePccApi()
  const { isDemo } = useDemoMode()
  const [detail, setDetail] = useState(null)
  const [confirm, setConfirm] = useState(null)
  const [weightForm, setWeightForm] = useState({ adjustment: '', reason: '' })
  const [issueForm, setIssueForm] = useState({ inventoryItemId: '', weight: '', itemLabel: '' })
  const [invSearch, setInvSearch] = useState('')
  const debouncedInvSearch = useDebounced(invSearch, 300)
  const [invResults, setInvResults] = useState([])
  const [invLoading, setInvLoading] = useState(false)
  const [tab, setTab] = useState('summary')
  const [splitForm, setSplitForm] = useState({ w1: '', w2: '', reason: '' })

  const reload = useCallback(() => {
    if (!batchId) return
    pccApi.getBatch(batchId)
      .then((d) => {
        setDetail(d)
        const batch = d?.batch
        if (batch && ['CREATED', 'AWAITING_ISSUE'].includes(batch.status)) {
          setIssueForm({
            inventoryItemId: batch.inventoryItemId ? String(batch.inventoryItemId) : '',
            weight: String(batch.currentWeight || batch.initialWeight || ''),
            itemLabel: batch.inventoryItemId ? `Linked ${String(batch.inventoryItemId).slice(0, 8)}…` : '',
          })
        }
      })
      .catch((err) => onToast?.(err?.response?.data?.message || 'Failed to load batch'))
  }, [batchId, onToast, pccApi])

  useEffect(() => {
    setDetail(null)
    setTab('summary')
    setInvSearch('')
    setInvResults([])
    reload()
  }, [reload])

  useEffect(() => {
    let cancelled = false
    if (!canIssueGate(detail?.batch)) {
      setInvResults([])
      return undefined
    }
    const q = String(debouncedInvSearch || '').trim()
    setInvLoading(true)
    inventoryApi
      .getInventory({ search: q || undefined, limit: 20, page: 1 })
      .then((res) => {
        if (cancelled) return
        const items = res.items || res.data || []
        setInvResults(items)
        if (/^[a-f0-9]{24}$/i.test(q)) {
          const match = items.find((item) => String(item._id || item.id) === q)
          if (match) {
            const unit = match.unit || 'g'
            const qty = match.quantity ?? 0
            setIssueForm((prev) => ({
              ...prev,
              inventoryItemId: q,
              itemLabel: `${match.name || 'Item'}${match.sku ? ` · ${match.sku}` : ''} · ${qty} ${unit}`,
            }))
          } else if (items.length === 0) {
            setIssueForm((prev) => ({
              ...prev,
              inventoryItemId: q,
              itemLabel: `Item ${q.slice(0, 8)}…`,
            }))
          }
        }
      })
      .catch(() => {
        if (!cancelled) setInvResults([])
      })
      .finally(() => {
        if (!cancelled) setInvLoading(false)
      })
    return () => { cancelled = true }
  }, [debouncedInvSearch, detail?.batch])

  if (!batchId) return null
  const b = detail?.batch
  const wr = detail?.weightReconciliation
  const canIssue = b && ['CREATED', 'AWAITING_ISSUE'].includes(b.status)
  const canReturn = b && !['RETURNED_TO_VAULT', 'CANCELLED', 'COMPLETED', 'SPLIT', 'MERGED'].includes(b.status)
  const canSplit = b && ['CREATED', 'AWAITING_ISSUE', 'ISSUED', 'WAITING', 'RECEIVED', 'HOLD', 'RETURNED_TO_VAULT'].includes(b.status)

  const runAction = async () => {
    if (!confirm || !b) return
    const action = confirm.action
    setConfirm(null)
    try {
      if (action === 'hold') await pccApi.holdBatch(b._id, {})
      if (action === 'release') await pccApi.releaseBatch(b._id, {})
      if (action === 'return') await pccApi.returnToVault(b._id, {})
      if (action === 'split') {
        const w1 = Number(splitForm.w1)
        const w2 = Number(splitForm.w2)
        await pccApi.splitBatch(b._id, {
          parts: [{ weight: w1 }, { weight: w2 }],
          reason: splitForm.reason || 'Batch split',
        })
        onToast?.(isDemo ? DEMO_WRITE_MSG : 'Batch split')
        setSplitForm({ w1: '', w2: '', reason: '' })
      }
      if (action === 'issue') {
        await pccApi.issueFromVault(b._id, {
          inventoryItemId: issueForm.inventoryItemId || undefined,
          weight: Number(issueForm.weight),
          idempotencyKey: `issue-${b._id}-${Number(issueForm.weight)}`,
        })
        onToast?.(isDemo ? DEMO_WRITE_MSG : 'Issued from vault')
      }
      if (action === 'weight') {
        const adj = Number(weightForm.adjustment)
        const before = Number(b.currentWeight)
        const after = before + adj
        await pccApi.adjustWeight(b._id, {
          field: 'currentWeight',
          adjustment: adj,
          reason: weightForm.reason,
          idempotencyKey: `adj-${b._id}-${Date.now()}`,
        })
        onToast?.(isDemo ? DEMO_WRITE_MSG : `Weight adjusted ${before} → ${after} g`)
        setWeightForm({ adjustment: '', reason: '' })
      } else if (action !== 'issue' && action !== 'split') {
        onToast?.(isDemo ? DEMO_WRITE_MSG : (action === 'return' ? 'Returned to vault' : action === 'hold' ? 'Batch on hold' : 'Batch released'))
      }
      reload()
      onRefreshFloor?.()
    } catch (err) {
      onToast?.(err?.response?.data?.message || 'Action failed')
    }
  }

  const weightBefore = Number(b?.currentWeight || 0)
  const weightAdj = Number(weightForm.adjustment)
  const weightAfter = Number.isFinite(weightAdj) ? weightBefore + weightAdj : weightBefore

  const TABS = [
    ['summary', 'SUMMARY'],
    ['journey', 'JOURNEY'],
    ['metal', 'METAL & MOVEMENT'],
    ['quality', 'QUALITY'],
    ['history', 'HISTORY'],
  ]

  const nextAction = (() => {
    if (!b) return '—'
    if (['CREATED', 'AWAITING_ISSUE'].includes(b.status)) return 'Issue metal from vault'
    if (b.status === 'HOLD') return 'Release hold'
    if (b.status === 'QC' || b.status === 'QC_FAILED') return 'Complete QC / rework'
    if (b.status === 'REWORK') return 'Resume process after rework'
    if (['ISSUED', 'WAITING', 'RECEIVED'].includes(b.status)) return 'Start or continue process'
    if (b.status === 'IN_PROCESS') return 'Complete process or handover'
    if (b.status === 'COMPLETED') return 'Return to vault / finished stock'
    return 'Review batch actions'
  })()

  return (
    <div className="pcc-modal-backdrop pcc-drawer-wide" onClick={onClose} role="presentation">
      <div className="pcc-modal pcc-modal-wide" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={b?.batchNumber || 'Batch detail'}>
        <div className="pcc-panel-head">
          <h2>{b?.batchNumber || 'Batch'}</h2>
          <button type="button" className="pcc-btn-ghost" onClick={onClose} aria-label="Close batch detail">Close</button>
        </div>
        {!detail ? <PccSkeleton rows={5} /> : (
          <div className="pcc-stack">
            <div className="pcc-batch-context-header">
              <div className="pcc-meta-grid">
                <div><span>Status</span><strong><PccStatusBadge status={b.status} /></strong></div>
                <div><span>Location</span><strong>{b.currentLocation || b.currentDepartment || '—'}</strong></div>
                <div><span>Holder</span><strong>{b.currentHolderName || '—'}</strong></div>
                <div><span>Weight</span><strong><PccWeightDisplay grams={b.currentWeight} /></strong></div>
                <div><span>Process</span><strong>{b.currentProcess || '—'}</strong></div>
                <div><span>Department</span><strong>{b.currentDepartment || '—'}</strong></div>
                <div><span>Machine</span><strong>{b.currentMachineName || '—'}</strong></div>
                <div><span>Next action</span><strong>{nextAction}</strong></div>
              </div>
            </div>

            <div className="pcc-tabs" role="tablist">
              {TABS.map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  className={tab === id ? 'pcc-tab pcc-tab-active' : 'pcc-tab'}
                  onClick={() => setTab(id)}
                >
                  {label}
                </button>
              ))}
            </div>

            {tab === 'summary' && (
              <div className="pcc-stack">
                <div className="pcc-meta-grid">
                  <div><span>Metal</span><strong>{b.metalType} {b.purity}</strong></div>
                  <div><span>Product</span><strong>{b.product || '—'}</strong></div>
                  <div><span>Initial</span><strong><PccWeightDisplay grams={b.initialWeight} /></strong></div>
                  <div><span>Current</span><strong><PccWeightDisplay grams={b.currentWeight} /></strong></div>
                  <div><span>WO</span><strong>{b.workOrderNumber || '—'}</strong></div>
                  <div><span>QC</span><strong>{b.qcStatus || b.lastQcResult || '—'}</strong></div>
                  <div><span>Created</span><strong>{formatTime(b.createdAt)}</strong></div>
                  <div><span>Updated</span><strong>{formatTime(b.updatedAt)}</strong></div>
                </div>

                <div className="pcc-actions">
                  {canIssue && (
                    <button
                      type="button"
                      className="pcc-btn"
                      onClick={() => {
                        if (!issueForm.inventoryItemId || !(Number(issueForm.weight) > 0)) {
                          onToast?.('Select an inventory item and enter a positive weight')
                          return
                        }
                        setConfirm({ action: 'issue' })
                      }}
                    >
                      Issue from vault
                    </button>
                  )}
                  {b.status !== 'HOLD' && !['COMPLETED', 'RETURNED_TO_VAULT', 'CANCELLED'].includes(b.status) && (
                    <button type="button" className="pcc-btn-ghost" onClick={() => setConfirm({ action: 'hold' })}>Hold</button>
                  )}
                  {b.status === 'HOLD' && (
                    <button type="button" className="pcc-btn-ghost" onClick={() => setConfirm({ action: 'release' })}>Release</button>
                  )}
                  {canReturn && (
                    <button type="button" className="pcc-btn-ghost" onClick={() => setConfirm({ action: 'return' })}>Return to vault</button>
                  )}
                </div>

                {canSplit && (
                  <div className="pcc-panel pcc-form">
                    <div className="pcc-panel-head"><h3>Split batch</h3></div>
                    <p className="pcc-muted">Split into two child batches. Weights must equal current weight ({formatGrams(b.currentWeight)}).</p>
                    <div className="pcc-form-grid">
                      <label>
                        Part 1 (g)
                        <input
                          type="number"
                          step="0.001"
                          value={splitForm.w1}
                          onChange={(e) => setSplitForm((s) => ({ ...s, w1: e.target.value }))}
                        />
                      </label>
                      <label>
                        Part 2 (g)
                        <input
                          type="number"
                          step="0.001"
                          value={splitForm.w2}
                          onChange={(e) => setSplitForm((s) => ({ ...s, w2: e.target.value }))}
                        />
                      </label>
                      <label className="pcc-span-2">
                        Reason
                        <input
                          value={splitForm.reason}
                          onChange={(e) => setSplitForm((s) => ({ ...s, reason: e.target.value }))}
                          placeholder="Optional reason"
                        />
                      </label>
                    </div>
                    <button
                      type="button"
                      className="pcc-btn"
                      onClick={() => {
                        const w1 = Number(splitForm.w1)
                        const w2 = Number(splitForm.w2)
                        const total = Number(b.currentWeight || 0)
                        if (!(w1 > 0) || !(w2 > 0) || Math.abs(w1 + w2 - total) > 0.0001) {
                          onToast?.(`Split weights must be positive and sum to ${total}g`)
                          return
                        }
                        setConfirm({ action: 'split' })
                      }}
                    >
                      Split batch
                    </button>
                  </div>
                )}

                {canIssue && (
                  <div className="pcc-panel pcc-form">
                    <div className="pcc-panel-head"><h3>Issue from vault</h3></div>
                    <div className="pcc-form-grid">
                      <label style={{ gridColumn: '1 / -1' }}>
                        Inventory item
                        <input
                          value={invSearch}
                          onChange={(e) => setInvSearch(e.target.value)}
                          placeholder="Search by name, SKU, or paste Item ID"
                          autoComplete="off"
                        />
                        {issueForm.inventoryItemId ? (
                          <div style={{ marginTop: 6, fontSize: 12, opacity: 0.85 }}>
                            Selected: <strong>{issueForm.itemLabel || issueForm.inventoryItemId}</strong>
                            {' '}
                            <button
                              type="button"
                              className="pcc-btn-ghost"
                              style={{ marginLeft: 8, padding: '2px 8px', fontSize: 11 }}
                              onClick={() => setIssueForm({ ...issueForm, inventoryItemId: '', itemLabel: '' })}
                            >
                              Clear
                            </button>
                          </div>
                        ) : null}
                        <div style={{ marginTop: 8, maxHeight: 160, overflowY: 'auto', border: '1px solid var(--pcc-border, #ddd)', borderRadius: 8 }}>
                          {invLoading ? (
                            <div style={{ padding: 10, fontSize: 12 }}>Searching…</div>
                          ) : invResults.length === 0 ? (
                            <div style={{ padding: 10, fontSize: 12, opacity: 0.7 }}>No matching inventory items</div>
                          ) : (
                            invResults.map((item) => {
                              const id = String(item._id || item.id)
                              const unit = item.unit || 'g'
                              const qty = item.quantity ?? 0
                              const label = `${item.name || 'Item'}${item.sku ? ` · ${item.sku}` : ''} · ${qty} ${unit}`
                              const selected = issueForm.inventoryItemId === id
                              return (
                                <button
                                  key={id}
                                  type="button"
                                  onClick={() => {
                                    setIssueForm({
                                      ...issueForm,
                                      inventoryItemId: id,
                                      itemLabel: label,
                                    })
                                    setInvSearch(item.name || item.sku || id)
                                  }}
                                  style={{
                                    display: 'block',
                                    width: '100%',
                                    textAlign: 'left',
                                    padding: '8px 10px',
                                    border: 'none',
                                    borderBottom: '1px solid var(--pcc-border, #eee)',
                                    background: selected ? 'rgba(var(--orange-rgb, 234,88,12), 0.12)' : 'transparent',
                                    cursor: 'pointer',
                                    fontFamily: 'inherit',
                                    fontSize: 12,
                                  }}
                                >
                                  <div style={{ fontWeight: 700 }}>{item.name || 'Untitled'}</div>
                                  <div style={{ opacity: 0.75 }}>
                                    {item.sku ? `SKU ${item.sku} · ` : ''}
                                    Available {qty} {unit}
                                    {item.isMetalLinked ? ' · vault/metal' : ''}
                                  </div>
                                </button>
                              )
                            })
                          )}
                        </div>
                      </label>
                      <label>Weight (g)
                        <input
                          type="number"
                          step="0.001"
                          min="0"
                          value={issueForm.weight}
                          onChange={(e) => setIssueForm({ ...issueForm, weight: e.target.value })}
                        />
                      </label>
                    </div>
                  </div>
                )}

                <form
                  className="pcc-panel pcc-form"
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (!weightForm.reason.trim() || !Number.isFinite(Number(weightForm.adjustment)) || Number(weightForm.adjustment) === 0) {
                      onToast?.('Adjustment and reason are required')
                      return
                    }
                    setConfirm({ action: 'weight' })
                  }}
                >
                  <div className="pcc-panel-head"><h3>Weight adjustment</h3></div>
                  <div className="pcc-form-grid">
                    <label>Adjustment (g)
                      <input type="number" step="0.001" value={weightForm.adjustment} onChange={(e) => setWeightForm({ ...weightForm, adjustment: e.target.value })} />
                    </label>
                    <label>Reason
                      <input required minLength={3} value={weightForm.reason} onChange={(e) => setWeightForm({ ...weightForm, reason: e.target.value })} />
                    </label>
                  </div>
                  <button type="submit" className="pcc-btn">Adjust weight</button>
                </form>
              </div>
            )}

            {tab === 'journey' && (
              <div className="pcc-panel">
                <div className="pcc-panel-head"><h3>Production Journey</h3></div>
                {(() => {
                  const events = enrichTimeline(detail)
                  if (!events.length) return <PccEmptyState message="No timeline events" />
                  return (
                    <ol className="pcc-timeline">
                      {events.map((t, i) => {
                        const prev = events[i - 1]
                        const gapMs = prev?.at && t.at
                          ? new Date(t.at).getTime() - new Date(prev.at).getTime()
                          : null
                        const gapLabel = formatGap(gapMs)
                        const tone = timelineTone(t.type)
                        return (
                          <li key={`${t.type}-${t.at}-${i}`} className={`pcc-timeline-item tone-${tone}`}>
                            <div className="pcc-timeline-rail" aria-hidden>
                              <span className="pcc-timeline-dot" />
                              {i < events.length - 1 ? <span className="pcc-timeline-line" /> : null}
                            </div>
                            <div className="pcc-timeline-body">
                              <div className="pcc-timeline-meta">
                                <PccStatusBadge status={String(t.type || 'event').replace(/_/g, ' ')} />
                                <strong>{formatTime(t.at)}</strong>
                                {gapLabel ? <span className="pcc-muted">+{gapLabel}</span> : null}
                              </div>
                              <div className="pcc-timeline-label">{t.label}</div>
                              {t.detail ? <div className="pcc-muted">{t.detail}</div> : null}
                            </div>
                          </li>
                        )
                      })}
                    </ol>
                  )
                })()}
              </div>
            )}

            {tab === 'metal' && (
              <div className="pcc-stack">
                <div className="pcc-panel">
                  <div className="pcc-panel-head"><h3>Current custody</h3></div>
                  {detail.custody ? (
                    <div className="pcc-meta-grid">
                      <div><span>Where</span><strong>{detail.custody.where || 'N/A'}</strong></div>
                      <div><span>Who</span><strong>{detail.custody.holderName || 'N/A'}</strong></div>
                      <div><span>How much</span><strong><PccWeightDisplay grams={detail.custody.weight} /></strong></div>
                      <div><span>Available to transfer</span><strong><PccWeightDisplay grams={detail.custody.availableTransferableWeight} /></strong></div>
                      <div><span>Reserved</span><strong><PccWeightDisplay grams={detail.custody.reservedWeight} /></strong></div>
                      <div><span>Why</span><strong>{detail.custody.why || 'N/A'}</strong></div>
                      <div><span>Last issued by</span><strong>{detail.custody.lastIssuedBy || 'N/A'}</strong></div>
                      <div><span>Last received by</span><strong>{detail.custody.lastReceivedBy || 'N/A'}</strong></div>
                      <div><span>Pass</span><strong>{detail.custody.passNumber || 'N/A'}</strong></div>
                    </div>
                  ) : <PccEmptyState message="No custody snapshot" />}
                </div>

                <div className="pcc-panel">
                  <div className="pcc-panel-head"><h3>Processes</h3></div>
                  {!(detail.processes || []).length ? <PccEmptyState message="No process runs" /> : (
                    <div className="pcc-table-wrap">
                      <table className="pcc-table">
                        <thead>
                          <tr><th>Process</th><th>Dept</th><th>Status</th><th>In</th><th>Out</th><th>Start</th><th>End</th></tr>
                        </thead>
                        <tbody>
                          {detail.processes.map((p) => (
                            <tr key={p._id}>
                              <td>{p.process}</td>
                              <td>{p.department || '—'}</td>
                              <td><PccStatusBadge status={p.status} /></td>
                              <td><PccWeightDisplay grams={p.inputWeight} /></td>
                              <td><PccWeightDisplay grams={p.outputWeight} /></td>
                              <td>{formatTime(p.startTime)}</td>
                              <td>{formatTime(p.endTime)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="pcc-panel">
                  <div className="pcc-panel-head"><h3>Handovers / passes</h3></div>
                  {!(detail.passes || []).length ? <PccEmptyState message="No passes" /> : (
                    <div className="pcc-table-wrap">
                      <table className="pcc-table">
                        <thead>
                          <tr><th>Pass</th><th>From</th><th>To</th><th>Weight</th><th>Status</th></tr>
                        </thead>
                        <tbody>
                          {detail.passes.map((p) => (
                            <tr key={p._id}>
                              <td>{p.passNumber}</td>
                              <td>{p.fromDepartment || '—'}</td>
                              <td>{p.toDepartment || '—'}</td>
                              <td><PccWeightDisplay grams={p.weight} /></td>
                              <td><PccStatusBadge status={p.status} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="pcc-panel">
                  <div className="pcc-panel-head"><h3>Weight reconciliation</h3></div>
                  <div className="pcc-meta-grid">
                    <div><span>Expected</span><strong><PccWeightDisplay grams={wr?.expectedWeight} /></strong></div>
                    <div><span>Actual</span><strong><PccWeightDisplay grams={wr?.actualWeight} /></strong></div>
                    <div><span>Difference</span><strong><PccWeightDisplay grams={wr?.difference} /></strong></div>
                    <div><span>Variance %</span><strong>{Number(wr?.variancePct || 0).toFixed(2)}%</strong></div>
                    <div><span>Scrap</span><strong><PccWeightDisplay grams={wr?.scrap} /></strong></div>
                    <div><span>Loss</span><strong><PccWeightDisplay grams={wr?.loss} /></strong></div>
                  </div>
                  {(detail.adjustments || []).length > 0 && (
                    <>
                      <div className="pcc-panel-head" style={{ marginTop: 12 }}><h3>Adjustments</h3></div>
                      <ul className="pcc-list">
                        {detail.adjustments.map((a) => (
                          <li key={a._id}>
                            <strong>{formatTime(a.createdAt)}</strong>
                            <span>{a.field}: {a.adjustment} — {a.reason}</span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>

                {(detail.movements || []).length > 0 && (
                  <div className="pcc-panel">
                    <div className="pcc-panel-head"><h3>Movements</h3></div>
                    <ul className="pcc-list">
                      {detail.movements.map((m) => (
                        <li key={m._id}>
                          <strong>{m.movementNumber || m.type || 'Movement'}</strong>
                          <span>{m.fromDepartment} → {m.toDepartment} · <PccWeightDisplay grams={m.weight} /></span>
                          <span>{formatTime(m.createdAt)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}

            {tab === 'quality' && (
              <div className="pcc-panel">
                <div className="pcc-panel-head"><h3>QC</h3></div>
                {!(detail.qc || []).length ? <PccEmptyState message="No QC inspections" hint="QC results appear after inspections are submitted." /> : (
                  <div className="pcc-table-wrap">
                    <table className="pcc-table">
                      <thead>
                        <tr><th>Inspection</th><th>Result</th><th>Inspector</th><th>Reason</th><th>When</th></tr>
                      </thead>
                      <tbody>
                        {detail.qc.map((q) => (
                          <tr key={q._id}>
                            <td>{q.inspectionNumber || q._id}</td>
                            <td><PccStatusBadge status={q.result} /></td>
                            <td>{q.inspectorName || '—'}</td>
                            <td>{q.reworkReason || q.failureReason || q.remarks || '—'}</td>
                            <td>{formatTime(q.createdAt)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {tab === 'history' && (
              <div className="pcc-stack">
                <div className="pcc-panel">
                  <div className="pcc-panel-head"><h3>Alerts</h3></div>
                  {!(detail.alerts || []).length ? <PccEmptyState message="No alerts for this batch" /> : (
                    <ul className="pcc-list">
                      {detail.alerts.map((a) => (
                        <li key={a._id}>
                          <strong><PccStatusBadge status={a.status} /> {a.title}</strong>
                          <span>{a.message || a.alertNumber} · {formatTime(a.createdAt)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="pcc-panel">
                  <div className="pcc-panel-head"><h3>Audit</h3></div>
                  {!(detail.audits || []).length ? <PccEmptyState message="No audit entries" /> : (
                    <ul className="pcc-list">
                      {detail.audits.map((a) => (
                        <li key={a._id}>
                          <strong>{formatTime(a.createdAt)}</strong>
                          <span>{a.action || a.detail || a.message || '—'}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div className="pcc-panel">
                  <div className="pcc-panel-head"><h3>Documents</h3></div>
                  <PccEmptyState message="No documents" />
                </div>
              </div>
            )}
          </div>
        )}

        <PccConfirmDialog
          open={!!confirm}
          title={
            confirm?.action === 'hold' ? 'Put batch on hold?'
              : confirm?.action === 'release' ? 'Release batch?'
                : confirm?.action === 'return' ? 'Return to vault?'
                  : confirm?.action === 'issue' ? 'Issue from vault?'
                    : confirm?.action === 'split' ? 'Split batch?'
                      : 'Confirm weight adjustment?'
          }
          message={
            confirm?.action === 'weight'
              ? 'This writes an audited weight adjustment.'
              : confirm?.action === 'return'
                ? `Return ${b?.batchNumber} metal to vault inventory.`
                : confirm?.action === 'issue'
                  ? `Debit vault inventory and mark ${b?.batchNumber} as ISSUED.`
                  : `${b?.batchNumber || 'Batch'} will change status.`
          }
          details={
            confirm?.action === 'weight' ? (
              <>
                <div>Before: {formatGrams(weightBefore)}</div>
                <div>Adjustment: {formatGrams(weightAdj)}</div>
                <div>After: {formatGrams(weightAfter)}</div>
                <div>Reason: {weightForm.reason}</div>
              </>
            ) : confirm?.action === 'issue' ? (
              <>
                <div>Inventory item: {issueForm.inventoryItemId}</div>
                <div>Weight: {formatGrams(Number(issueForm.weight))}</div>
              </>
            ) : null
          }
          confirmLabel={confirm?.action === 'issue' ? 'Issue' : 'Confirm'}
          danger={confirm?.action === 'return' || confirm?.action === 'hold' || confirm?.action === 'weight'}
          onCancel={() => setConfirm(null)}
          onConfirm={runAction}
        />
      </div>
    </div>
  )
}

