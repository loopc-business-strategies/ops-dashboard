import { useEffect, useId, useRef } from 'react'
import { formatGrams, statusTone } from './shared'

export function PccStatusBadge({ status, label }) {
  const tone = statusTone(status)
  return (
    <span className={`pcc-pill pcc-pill-${tone}`} title={String(status || '')}>
      {label || status || '—'}
    </span>
  )
}

export function PccKpiCard({ label, value, unit, hint }) {
  return (
    <div className="pcc-kpi" title={hint || ''}>
      <div className="pcc-kpi-value">
        {value}
        {unit ? <span className="pcc-kpi-unit">{unit}</span> : null}
      </div>
      <div className="pcc-kpi-label">{label}</div>
    </div>
  )
}

export function PccEmptyState({ message, action }) {
  return (
    <div className="pcc-empty">
      <p>{message || 'No records'}</p>
      {action || null}
    </div>
  )
}

export function PccSkeleton({ rows = 4 }) {
  return (
    <div className="pcc-skeleton" aria-hidden="true">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="pcc-skeleton-row" />
      ))}
    </div>
  )
}

export function PccWeightDisplay({ grams, className = '' }) {
  return <span className={`pcc-weight ${className}`.trim()}>{formatGrams(grams)}</span>
}

export function PccConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  danger = false,
  details,
  onConfirm,
  onCancel,
}) {
  const titleId = useId()
  const cancelRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    cancelRef.current?.focus?.()
    const onKey = (e) => {
      if (e.key === 'Escape') onCancel?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div className="pcc-modal-backdrop" onClick={onCancel} role="presentation">
      <div
        className="pcc-modal pcc-confirm"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pcc-panel-head">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="pcc-btn-ghost" ref={cancelRef} onClick={onCancel}>
            {cancelLabel}
          </button>
        </div>
        {message ? <p className="pcc-confirm-msg">{message}</p> : null}
        {details ? <div className="pcc-confirm-details">{details}</div> : null}
        <div className="pcc-confirm-actions">
          <button type="button" className="pcc-btn-ghost" onClick={onCancel}>{cancelLabel}</button>
          <button
            type="button"
            className={danger ? 'pcc-btn pcc-btn-danger' : 'pcc-btn'}
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
