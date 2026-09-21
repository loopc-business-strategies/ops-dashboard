import { useState } from 'react'
import { formatGrams } from './formatters'
import { DeptIcon } from './PdIcons'

function statusClass(status) {
  return String(status || 'Idle').toLowerCase().replace(/\s+/g, '-')
}

function DeptCard({ card, selected, onSelect, expanded, onToggle, tables }) {
  const tone = statusClass(card.status)
  return (
    <article
      className={`pd-dept-card pd-dept-card--${tone}${card.isAssembly ? ' pd-dept-card--assembly' : ''}${expanded ? ' pd-dept-card--expanded' : ''}${selected ? ' pd-dept-card--selected' : ''}`}
      role="button"
      tabIndex={0}
      onClick={() => onSelect?.(card.key)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onSelect?.(card.key)
        }
      }}
      aria-pressed={selected}
    >
      <div className="pd-dept-card-head">
        <span className="pd-dept-icon-wrap" aria-hidden>
          <DeptIcon deptKey={card.key} />
        </span>
        <h3 className="pd-dept-name">{card.name}</h3>
        <span className={`pd-status-pill pd-status-pill--${tone}`}>
          <span className="pd-status-dot" aria-hidden />
          {card.status || 'Idle'}
        </span>
      </div>
      <dl className="pd-dept-meta pd-dept-meta--ref">
        <div>
          <dt>Metal Balance</dt>
          <dd>{card.metalBalance != null ? formatGrams(card.metalBalance) : '—'}</dd>
        </div>
        <div>
          <dt>Metal IN</dt>
          <dd>{card.metalIn != null ? formatGrams(card.metalIn) : '—'}</dd>
        </div>
        <div>
          <dt>Metal OUT</dt>
          <dd>{card.metalOut != null ? formatGrams(card.metalOut) : '—'}</dd>
        </div>
        <div>
          <dt>Active Batch</dt>
          <dd>{card.batchNumber || '—'}</dd>
        </div>
        <div>
          <dt>Employees</dt>
          <dd>{card.employeeCount != null ? card.employeeCount : '—'}</dd>
        </div>
      </dl>
      {card.isAssembly ? (
        <button
          type="button"
          className="pd-btn pd-btn--ghost pd-dept-expand"
          onClick={(e) => {
            e.stopPropagation()
            onToggle?.()
          }}
        >
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

export default function DepartmentOverview({
  cards,
  assemblyTables,
  selectedDeptKey,
  onSelectDept,
  onMetalInOut: _onMetalInOut,
  onOperatorInOut: _onOperatorInOut,
  onViewDepartment: _onViewDepartment,
  onViewAll: _onViewAll,
  permissions: _permissions,
}) {
  const list = cards || []
  const [assemblyOpen, setAssemblyOpen] = useState(false)
  const selected = list.find((c) => c.key === selectedDeptKey) || null

  return (
    <section className="pd-dept-row" aria-label="Department status">
      <div className="pd-panel pd-dept-status">
        <div className="pd-panel-head">
          <h2 className="pd-panel-title">Department Status</h2>
          {selected ? (
            <span className="pd-panel-hint">Selected: {selected.name}</span>
          ) : (
            <span className="pd-panel-hint">Click a department to control</span>
          )}
        </div>
        {!list.length ? (
          <p className="pd-empty">No departments configured</p>
        ) : (
          <div className="pd-dept-grid">
            {list.map((card) => (
              <DeptCard
                key={card.key}
                card={card}
                selected={selectedDeptKey === card.key}
                onSelect={onSelectDept}
                expanded={card.isAssembly && assemblyOpen}
                onToggle={() => setAssemblyOpen((v) => !v)}
                tables={assemblyTables}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
