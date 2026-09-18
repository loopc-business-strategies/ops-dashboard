import { formatGrams } from './formatters'
import { FlowIcon } from './PdIcons'

function stageTone(status) {
  const s = String(status || '').toUpperCase()
  if (s === 'ACTIVE' || s === 'RUNNING') return 'active'
  if (s === 'STABLE' || s === 'READY' || s === 'COMPLETED') return 'stable'
  return 'idle'
}

export default function LiveMetalControl({ materialFlow, onStageClick, activeStageKey }) {
  const stages = materialFlow || []

  return (
    <section className="pd-panel pd-live-metal" aria-label="Live metal control">
      <div className="pd-panel-head">
        <h2 className="pd-panel-title">Live Metal Control</h2>
        <span className="pd-panel-hint">Vault → Finished · click a stage to filter</span>
      </div>
      <div className="pd-flow-rail pd-flow-rail--live">
        {stages.map((stage, idx) => {
          const tone = stageTone(stage.status)
          const selected = activeStageKey === stage.key
          return (
            <div key={stage.key} className="pd-flow-stage">
              {idx > 0 ? <span className="pd-flow-arrow" aria-hidden>→</span> : null}
              <button
                type="button"
                className={`pd-flow-node pd-flow-node--${tone}${selected ? ' pd-flow-node--selected' : ''}`}
                onClick={() => onStageClick?.(stage)}
              >
                <span className="pd-flow-node-icon" aria-hidden>
                  <FlowIcon stageKey={stage.key} />
                </span>
                <strong>{stage.label}</strong>
                <span className="pd-flow-weight">{stage.weight != null ? formatGrams(stage.weight) : '—'}</span>
                <span className="pd-flow-io">
                  <em>IN {stage.metalIn != null ? formatGrams(stage.metalIn) : '—'}</em>
                  <em>OUT {stage.metalOut != null ? formatGrams(stage.metalOut) : '—'}</em>
                </span>
                <em className={`pd-flow-status pd-flow-status--${tone}`}>{stage.status || 'Idle'}</em>
              </button>
            </div>
          )
        })}
      </div>
    </section>
  )
}
