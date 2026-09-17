import { useState } from 'react'
import { formatGrams, formatMinutes, pccHref } from './formatters'

function statusClass(status) {
  return String(status || 'Idle').toLowerCase().replace(/\s+/g, '-')
}

function DeptCard({ card, expanded, onToggle, tables }) {
  const tone = statusClass(card.status)
  return (
    <article className={`pd-dept-card pd-dept-card--${tone}${card.isAssembly ? ' pd-dept-card--assembly' : ''}${expanded ? ' pd-dept-card--expanded' : ''}`}>
      <div className="pd-dept-card-head">
        <span className="pd-dept-mark" aria-hidden />
        <h3 className="pd-dept-name">{card.name}</h3>
        <span className={`pd-status-pill pd-status-pill--${tone}`}>
          <span className="pd-status-dot" aria-hidden />
          {card.status || 'Idle'}
        </span>
      </div>
      <dl className="pd-dept-meta">
        <div>
          <dt>Batch</dt>
          <dd>
            {card.batchId ? (
              <a className="pd-link" href={pccHref('batches', { batch: card.batchId })}>{card.batchNumber}</a>
            ) : '—'}
          </dd>
        </div>
        <div>
          <dt>Qty</dt>
          <dd>{card.quantity != null ? formatGrams(card.quantity) : '—'}</dd>
        </div>
        <div>
          <dt>Employees</dt>
          <dd>{card.employeeCount != null ? card.employeeCount : '—'}</dd>
        </div>
        <div>
          <dt>Elapsed</dt>
          <dd>{card.elapsedMin != null ? formatMinutes(card.elapsedMin) : '—'}</dd>
        </div>
      </dl>
      {card.isAssembly ? (
        <button type="button" className="pd-btn pd-btn--ghost pd-dept-expand" onClick={onToggle}>
          {expanded ? 'Hide tables' : `Show ${card.tableCount || 15} tables`}
        </button>
      ) : null}
      {card.isAssembly && expanded ? (
        <div className="pd-assembly-grid" role="list" aria-label="Assembly tables">
          {(tables || []).map((t) => {
            const tTone = statusClass(t.status)
            return (
              <div key={t.tableNo} className={`pd-table-tile pd-table-tile--${tTone}`} role="listitem">
                <strong>{t.label}</strong>
                <span className={`pd-status-pill pd-status-pill--sm pd-status-pill--${tTone}`}>{t.status}</span>
                <span>{t.batchNumber || '—'}</span>
                <span>{t.quantity != null ? formatGrams(t.quantity) : '—'}</span>
              </div>
            )
          })}
        </div>
      ) : null}
    </article>
  )
}

export default function DepartmentOverview({ cards, assemblyTables }) {
  const list = cards || []
  const [assemblyOpen, setAssemblyOpen] = useState(false)

  return (
    <section className="pd-panel pd-dept-status" aria-label="Department status">
      <div className="pd-panel-head">
        <h2 className="pd-panel-title">Department Status</h2>
      </div>
      {!list.length ? (
        <p className="pd-empty">No departments configured</p>
      ) : (
        <div className="pd-dept-grid">
          {list.map((card) => (
            <DeptCard
              key={card.key}
              card={card}
              expanded={card.isAssembly && assemblyOpen}
              onToggle={() => setAssemblyOpen((v) => !v)}
              tables={assemblyTables}
            />
          ))}
        </div>
      )}
    </section>
  )
}
