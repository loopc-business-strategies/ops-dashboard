import { formatGrams } from './formatters'
import { resolveDeptCardDisplay } from './deptCardDisplay'
import {
  DeptIcon,
  IconEmployees,
  IconManager,
  IconBriefcase,
  IconMetalIn,
  IconMetalOut,
  IconLossWarn,
  IconPlay,
  IconFlag,
} from './PdIcons'

function statusClass(status) {
  return String(status || 'Idle').toLowerCase().replace(/\s+/g, '-')
}

function toneClass(key) {
  return `pd-dept-card--tone-${String(key || '').replace(/_/g, '-')}`
}

function formatLoss(v) {
  if (v == null || !Number.isFinite(Number(v))) return '—'
  return Number(v).toFixed(2)
}

function displayOrDash(value) {
  if (value == null || value === '') return '—'
  return value
}

function BatchProgressBar({ startedLabel, overLabel, percent }) {
  const hasPct = percent != null && Number.isFinite(Number(percent))
  const pct = hasPct ? Math.max(0, Math.min(100, Number(percent) || 0)) : 0
  return (
    <div className="pd-batch-progress" aria-label={hasPct ? `Batch progress ${pct}%` : 'Batch progress'}>
      <div className="pd-batch-progress-end pd-batch-progress-end--start">
        <span className="pd-batch-progress-ico pd-batch-progress-ico--play" aria-hidden>
          <IconPlay size={12} />
        </span>
        <div className="pd-batch-progress-meta">
          <span className="pd-batch-progress-caption">Batch Started</span>
          <strong className="pd-batch-progress-time">{displayOrDash(startedLabel)}</strong>
        </div>
      </div>

      <div className="pd-batch-progress-track-wrap">
        <div className="pd-batch-progress-track">
          <div className="pd-batch-progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <span className="pd-batch-progress-pct">{hasPct ? `${pct}%` : '—'}</span>
      </div>

      <div className="pd-batch-progress-end pd-batch-progress-end--over">
        <span className="pd-batch-progress-ico pd-batch-progress-ico--flag" aria-hidden>
          <IconFlag size={14} />
        </span>
        <div className="pd-batch-progress-meta pd-batch-progress-meta--end">
          <span className="pd-batch-progress-caption">Batch Over</span>
          <strong className="pd-batch-progress-time">{displayOrDash(overLabel)}</strong>
        </div>
      </div>
    </div>
  )
}

function DeptCard({
  card,
  batchMonitorRows,
  employeeRatings,
  selected,
  onSelect,
  suppressDemo = false,
}) {
  const ui = resolveDeptCardDisplay(card, batchMonitorRows, employeeRatings, { suppressDemo })
  const tone = statusClass(ui.status)
  const employeeLabel = ui.employeeCount != null && ui.employeeCount > 0
    ? `EMPLOYEES (${ui.employeeCount})`
    : (suppressDemo ? 'EMPLOYEES (—)' : 'EMPLOYEES')

  return (
    <article
      className={`pd-dept-card ${toneClass(ui.key)} pd-dept-card--${tone}${ui.isAssembly ? ' pd-dept-card--assembly' : ''}${selected ? ' pd-dept-card--selected' : ''}`}
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

      <div className="pd-dept-people">
        <div className="pd-dept-people-side">
          <span className="pd-dept-people-ico" aria-hidden>
            <IconEmployees size={14} />
          </span>
          <span className="pd-dept-people-label">{employeeLabel}</span>
        </div>
        <div className="pd-dept-people-divider" aria-hidden />
        <div className="pd-dept-people-side pd-dept-people-side--manager">
          <span className="pd-dept-people-ico" aria-hidden>
            <IconManager size={14} />
          </span>
          <span className="pd-dept-people-manager">{displayOrDash(ui.managerName)}</span>
        </div>
      </div>

      <div className="pd-dept-metrics">
        <div className="pd-dept-metric pd-dept-metric--in">
          <div className="pd-dept-metric-head">
            <span className="pd-dept-metric-ico" aria-hidden>
              <IconMetalIn size={16} />
            </span>
            <span className="pd-dept-metric-label">Metal IN</span>
          </div>
          <strong className="pd-dept-metric-value">
            {ui.metalIn == null ? '—' : formatGrams(ui.metalIn)}
          </strong>
        </div>
        <div className="pd-dept-metric pd-dept-metric--out">
          <div className="pd-dept-metric-head">
            <span className="pd-dept-metric-ico" aria-hidden>
              <IconMetalOut size={16} />
            </span>
            <span className="pd-dept-metric-label">Metal OUT</span>
          </div>
          <strong className="pd-dept-metric-value">
            {ui.metalOut == null ? '—' : formatGrams(ui.metalOut)}
          </strong>
        </div>
        <div className="pd-dept-metric pd-dept-metric--batches">
          <div className="pd-dept-batches-head">
            <span className="pd-dept-stat-icon pd-dept-stat-icon--batches" aria-hidden>
              <IconBriefcase size={14} />
            </span>
            <span className="pd-dept-metric-label">Batches</span>
            <strong className="pd-dept-batches-count">{displayOrDash(ui.batches)}</strong>
          </div>
          <div className="pd-dept-batches-row">
            <span>Time / Batch</span>
            <strong>{displayOrDash(ui.timePerBatchLabel)}</strong>
          </div>
          <div className="pd-dept-batches-row">
            <span>Avg. Time</span>
            <strong>{displayOrDash(ui.avgTimeLabel)}</strong>
          </div>
        </div>
      </div>

      <div className="pd-dept-loss-block">
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

      <BatchProgressBar
        startedLabel={ui.batchStartedLabel}
        overLabel={ui.batchOverLabel}
        percent={ui.progressPercent}
      />
    </article>
  )
}

export default function DepartmentOverview({
  cards,
  assemblyTables: _assemblyTables,
  batchMonitorRows,
  employeeRatings,
  selectedDeptKey,
  onSelectDept,
  onMetalInOut: _onMetalInOut,
  onOperatorInOut: _onOperatorInOut,
  onViewDepartment: _onViewDepartment,
  onViewAll: _onViewAll,
  permissions: _permissions,
  suppressDemo = false,
}) {
  const list = cards || []

  return (
    <section className="pd-dept-row" aria-label="Department status">
      <div className="pd-panel pd-dept-status">
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
                suppressDemo={suppressDemo}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  )
}
