import { useCallback, useEffect, useState } from 'react'
import { usePccApi } from '../demo/usePccApi'
import { formatTime } from '../shared'
import {
  PccEmptyState,
  PccErrorState,
  PccSkeleton,
  PccStatusBadge,
  PccWeightDisplay,
} from '../primitives'

/**
 * Batch-centered Production Journey explorer (section `journey`).
 * Uses existing batch list + detail APIs — no fake stages.
 */
export default function JourneyPanel({ onToast, onSelectBatch, onNavigate }) {
  const pccApi = usePccApi()
  const [batches, setBatches] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [detail, setDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await pccApi.listBatches({ limit: 50 })
      const list = data.batches || []
      setBatches(list)
      setSelectedId((prev) => prev || list[0]?._id || null)
    } catch (err) {
      setError(err?.response?.data?.message || 'Failed to load batches')
      onToast?.(err?.response?.data?.message || 'Failed to load journey')
    } finally {
      setLoading(false)
    }
  }, [onToast, pccApi])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    if (!selectedId) {
      setDetail(null)
      return undefined
    }
    let cancelled = false
    setDetailLoading(true)
    pccApi.getBatch(selectedId)
      .then((d) => { if (!cancelled) setDetail(d) })
      .catch((err) => {
        if (!cancelled) {
          setDetail(null)
          onToast?.(err?.response?.data?.message || 'Failed to load batch journey')
        }
      })
      .finally(() => { if (!cancelled) setDetailLoading(false) })
    return () => { cancelled = true }
  }, [selectedId, pccApi, onToast])

  const timeline = Array.isArray(detail?.timeline) ? detail.timeline : []
  const batch = detail?.batch

  if (loading && !batches.length) {
    return (
      <div className="pcc-panel"><PccSkeleton rows={6} /></div>
    )
  }

  if (error && !batches.length) {
    return (
      <div className="pcc-panel">
        <PccErrorState message={error} onRetry={load} />
      </div>
    )
  }

  return (
    <div className="pcc-stack">
      <div className="pcc-panel">
        <div className="pcc-panel-head">
          <h2>PRODUCTION JOURNEY</h2>
          <div className="pcc-actions">
            <button type="button" className="pcc-btn-ghost" onClick={() => onNavigate?.('dept-flow')}>
              Department Flow
            </button>
            <button type="button" className="pcc-btn-ghost" onClick={load}>Refresh</button>
          </div>
        </div>
        <p className="pcc-muted">
          Select a batch to see its real lifecycle from vault/stock through process, custody, QC, and completion.
        </p>
      </div>

      <div className="pcc-split pcc-journey-layout">
        <div className="pcc-panel">
          <div className="pcc-panel-head"><h3>Batches</h3></div>
          {batches.length === 0 ? (
            <PccEmptyState
              message="No batches to show"
              hint="Create a batch from Batches, then return here to follow its journey."
              action={(
                <button type="button" className="pcc-btn" onClick={() => onNavigate?.('batches')}>
                  Open Batches
                </button>
              )}
            />
          ) : (
            <ul className="pcc-list pcc-journey-batch-list">
              {batches.map((b) => (
                <li key={b._id}>
                  <button
                    type="button"
                    className={selectedId === b._id ? 'pcc-link active' : 'pcc-link'}
                    onClick={() => setSelectedId(b._id)}
                  >
                    <strong>{b.batchNumber}</strong>
                  </button>
                  <span>{b.product || b.metalType || '—'} · <PccStatusBadge status={b.status} /></span>
                  <span>{b.currentDepartment || '—'} · <PccWeightDisplay grams={b.currentWeight} /></span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="pcc-panel">
          <div className="pcc-panel-head">
            <h3>{batch?.batchNumber || 'Journey'}</h3>
            {selectedId ? (
              <button type="button" className="pcc-btn" onClick={() => onSelectBatch?.(selectedId)}>
                Open Batch Detail
              </button>
            ) : null}
          </div>
          {detailLoading ? <PccSkeleton rows={5} /> : !batch ? (
            <PccEmptyState message="Select a batch to view its journey" />
          ) : (
            <div className="pcc-stack">
              <div className="pcc-meta-grid">
                <div><span>Status</span><strong><PccStatusBadge status={batch.status} /></strong></div>
                <div><span>Location</span><strong>{batch.currentLocation || batch.currentDepartment || '—'}</strong></div>
                <div><span>Holder</span><strong>{batch.currentHolderName || '—'}</strong></div>
                <div><span>Weight</span><strong><PccWeightDisplay grams={batch.currentWeight} /></strong></div>
                <div><span>Process</span><strong>{batch.currentProcess || '—'}</strong></div>
                <div><span>Machine</span><strong>{batch.currentMachineName || '—'}</strong></div>
              </div>
              {timeline.length === 0 ? (
                <PccEmptyState
                  message="No timeline events yet"
                  hint="Events appear as metal is issued, processes run, and handovers complete."
                />
              ) : (
                <ol className="pcc-timeline">
                  {timeline.map((t, i) => (
                    <li key={`${t.type}-${t.at}-${i}`} className="pcc-timeline-item">
                      <div className="pcc-timeline-body">
                        <div className="pcc-timeline-meta">
                          <PccStatusBadge status={String(t.type || 'event').replace(/_/g, ' ')} />
                          <strong>{formatTime(t.at)}</strong>
                        </div>
                        <div className="pcc-timeline-label">{t.label || t.type}</div>
                        {t.detail ? <div className="pcc-muted">{t.detail}</div> : null}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
