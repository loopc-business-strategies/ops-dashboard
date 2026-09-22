import { useState } from 'react'
import { formatGrams } from './formatters'
import { resolveDeptCardDisplay } from './deptCardDisplay'
import {
  DeptIcon,
  IconStar,
  IconBriefcase,
  IconClock,
  IconBarChart,
  IconMetalIn,
  IconMetalOut,
  IconLossWarn,
} from './PdIcons'

function statusClass(status) {
  return String(status || 'Idle').toLowerCase().replace(/\s+/g, '-')
}

function toneClass(key) {
  return `pd-dept-card--tone-${String(key || '').replace(/_/g, '-')}`
}

function RatingStars({ rating }) {
  const n = Number(rating)
  if (!Number.isFinite(n)) return <span className="pd-dept-rating-na">—</span>
  return (
    <span className="pd-dept-rating" title={`${n.toFixed(1)}`}>
      <IconStar size={12} className="pd-dept-rating-star" />
      <span>{n.toFixed(1)}</span>
    </span>
  )
}

function formatLoss(v) {
  if (v == null || !Number.isFinite(Number(v))) return '—'
  return Number(v).toFixed(2)
}

function DeptCard({
  card,
  batchMonitorRows,
  employeeRatings,
  selected,
  onSelect,
  expanded,
  onToggle,
  tables,
}) {
  const ui = resolveDeptCardDisplay(card, batchMonitorRows, employeeRatings)
  const tone = statusClass(ui.status)

  return (
    <article
      className={`pd-dept-card ${toneClass(ui.key)} pd-dept-card--${tone}${ui.isAssembly ? ' pd-dept-card--assembly' : ''}${expanded ? ' pd-dept-card--expanded' : ''}${selected ? ' pd-dept-card--selected' : ''}`}
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
          <DeptIcon deptKey={ui.key} size={22} />
        </span>
        <div className="pd-dept-title-block">
          <h3 className="pd-dept-name">{ui.name}</h3>
          {ui.subtitle ? <p className="pd-dept-subtitle">{ui.subtitle}</p> : null}
        </div>
        <span className={`pd-status-pill pd-status-pill--${tone}`}>
          <span className="pd-status-dot" aria-hidden />
          {ui.status || 'Idle'}
        </span>
      </div>

      <div className="pd-dept-mid">
        <div className="pd-dept-emp-block">
          <div className="pd-dept-section-label">
            {ui.employeeCount > 0 ? `Employees (${ui.employeeCount})` : 'Employees'}
          </div>
          <table className="pd-dept-emp-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Rating</th>
              </tr>
            </thead>
            <tbody>
              {ui.employees.length ? (
                ui.employees.map((emp) => (
                  <tr key={`${ui.key}-${emp.name}`}>
                    <td>{emp.name}</td>
                    <td><RatingStars rating={emp.rating} /></td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={2} className="pd-dept-rating-na">—</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <ul className="pd-dept-batch-stats">
          <li>
            <span className="pd-dept-stat-icon pd-dept-stat-icon--batches" aria-hidden>
              <IconBriefcase size={16} />
            </span>
            <span className="pd-dept-stat-label">Batches</span>
            <strong className="pd-dept-stat-value">{ui.batches}</strong>
          </li>
          <li>
            <span className="pd-dept-stat-icon pd-dept-stat-icon--time" aria-hidden>
              <IconClock size={16} />
            </span>
            <span className="pd-dept-stat-label">Time / Batch</span>
            <strong className="pd-dept-stat-value">{ui.timePerBatchLabel}</strong>
          </li>
          <li>
            <span className="pd-dept-stat-icon pd-dept-stat-icon--avg" aria-hidden>
              <IconBarChart size={16} />
            </span>
            <span className="pd-dept-stat-label">Avg. Time</span>
            <strong className="pd-dept-stat-value">{ui.avgTimeLabel}</strong>
          </li>
        </ul>
      </div>

      <div className="pd-dept-bottom">
        <div className="pd-dept-metal-cell pd-dept-metal-cell--in">
          <span className="pd-dept-metal-ico" aria-hidden>
            <IconMetalIn size={16} />
          </span>
          <span className="pd-dept-metal-label">Metal IN</span>
          <strong className="pd-dept-metal-value">{formatGrams(ui.metalIn)}</strong>
        </div>
        <div className="pd-dept-metal-cell pd-dept-metal-cell--out">
          <span className="pd-dept-metal-ico" aria-hidden>
            <IconMetalOut size={16} />
          </span>
          <span className="pd-dept-metal-label">Metal OUT</span>
          <strong className="pd-dept-metal-value">{formatGrams(ui.metalOut)}</strong>
        </div>
        <div className="pd-dept-loss">
          <div className="pd-dept-loss-head">
            <span className="pd-dept-loss-icon" aria-hidden>
              <IconLossWarn size={14} />
            </span>
            <span>Metal Loss (g)</span>
          </div>
          <ul className="pd-dept-loss-list">
            {ui.lossRows.length ? (
              <>
                {ui.lossRows.map((r) => (
                  <li key={`${ui.key}-loss-${r.index}`}>
                    <span>{r.label}</span>
                    <strong>{formatLoss(r.loss)}</strong>
                  </li>
                ))}
                <li className="pd-dept-loss-avg">
                  <span>Avg</span>
                  <strong>{formatLoss(ui.lossAvg)}</strong>
                </li>
              </>
            ) : (
              <li>
                <span>—</span>
                <strong>—</strong>
              </li>
            )}
          </ul>
        </div>
      </div>

      {ui.isAssembly ? (
        <button
          type="button"
          className="pd-btn pd-btn--ghost pd-dept-expand"
          onClick={(e) => {
            e.stopPropagation()
            onToggle?.()
          }}
        >
          {expanded ? 'Hide tables' : `Show ${ui.tableCount || 15} tables`}
        </button>
      ) : null}
      {ui.isAssembly && expanded ? (
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
  batchMonitorRows,
  employeeRatings,
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

  return (
    <section className="pd-dept-row" aria-label="Department status">
      <div className="pd-panel pd-dept-status">
        <div className="pd-panel-head pd-panel-head--slim">
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
                batchMonitorRows={batchMonitorRows}
                employeeRatings={employeeRatings}
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
