import { useEffect } from 'react'

export default function ActionModal({
  open,
  title,
  onClose,
  onSubmit,
  submitLabel = 'Confirm',
  busy = false,
  error = null,
  disabled = false,
  children,
  tone = 'primary',
}) {
  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape' && !busy) onClose?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, busy, onClose])

  if (!open) return null

  return (
    <div className="pd-modal-backdrop" role="presentation" onClick={() => !busy && onClose?.()}>
      <div
        className="pd-modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="pd-modal-head">
          <h3 className="pd-modal-title">{title}</h3>
          <button type="button" className="pd-btn pd-btn--ghost" onClick={onClose} disabled={busy} aria-label="Close">
            ×
          </button>
        </div>
        <div className="pd-modal-body">{children}</div>
        {error ? <p className="pd-modal-error" role="alert">{error}</p> : null}
        <div className="pd-modal-foot">
          <button type="button" className="pd-btn pd-btn--ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button
            type="button"
            className={`pd-btn pd-btn--${tone === 'danger' ? 'danger' : 'primary'}`}
            onClick={onSubmit}
            disabled={busy || disabled}
          >
            {busy ? 'Working…' : submitLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
