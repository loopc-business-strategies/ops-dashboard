import { formatGrams } from './formatters'
import { DeptIcon } from './PdIcons'

export default function ShopFloorTerminal({
  department,
  permissions,
  onFaceScan,
  onOperatorIn,
  onOperatorOut,
  onMetalIn,
  onMetalOut,
}) {
  const dept = department || null
  const title = dept?.name || 'Select Department'

  return (
    <section className="pd-panel pd-shop-terminal" aria-label="Shop floor terminal">
      <div className="pd-panel-head">
        <h2 className="pd-panel-title">
          {dept ? `${dept.name} — Shop Floor Terminal` : 'Shop Floor Terminal'}
        </h2>
      </div>

      {!dept ? (
        <p className="pd-empty">Select a department card to open its terminal</p>
      ) : (
        <>
          <div className="pd-terminal-summary">
            <span className="pd-dept-icon-wrap" aria-hidden>
              <DeptIcon deptKey={dept.key} />
            </span>
            <div>
              <strong>{title}</strong>
              <p className="pd-muted">
                Balance {dept.metalBalance != null ? formatGrams(dept.metalBalance) : '—'}
                {' · '}
                Batch {dept.batchNumber || '—'}
              </p>
            </div>
          </div>

          <div className="pd-terminal-grid">
            <button
              type="button"
              className="pd-terminal-btn pd-terminal-btn--scan"
              onClick={() => onFaceScan?.()}
              disabled={!permissions?.canFloorSession}
              title="Employee picker (biometric not configured)"
            >
              FACE SCAN
            </button>
            <button
              type="button"
              className="pd-terminal-btn pd-terminal-btn--in"
              onClick={() => onOperatorIn?.()}
              disabled={!permissions?.canFloorSession}
            >
              OPERATOR IN
            </button>
            <button
              type="button"
              className="pd-terminal-btn pd-terminal-btn--out"
              onClick={() => onOperatorOut?.()}
              disabled={!permissions?.canFloorSession}
            >
              OPERATOR OUT
            </button>
            <button
              type="button"
              className="pd-terminal-btn pd-terminal-btn--metal-in"
              onClick={() => onMetalIn?.()}
              disabled={!permissions?.canReceive && !permissions?.canCreatePass}
            >
              METAL IN
            </button>
            <button
              type="button"
              className="pd-terminal-btn pd-terminal-btn--metal-out"
              onClick={() => onMetalOut?.()}
              disabled={!permissions?.canIssue && !permissions?.canCreatePass}
            >
              METAL OUT
            </button>
          </div>
        </>
      )}
    </section>
  )
}
