import { useMemo, useState } from 'react'
import { formatGrams } from './formatters'
import { resolveDeptCardDisplay } from './deptCardDisplay'
import { minutesDown } from './useUnfixedBreakdowns'
import { DASHBOARD_DEPARTMENTS } from './departmentConfig'
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

/** One batch's loss in grams; above the department's loss limit it turns red and shows its %. */
function LossRow({ row }) {
  return (
    <li className={row.overLimit ? 'pd-dept-loss-row--over' : undefined}>
      <span>{row.label}</span>
      <strong title={row.lossPct != null ? `${row.lossPct}% of Metal In` : undefined}>
        {formatLoss(row.loss)}
        {row.overLimit ? <small className="pd-dept-loss-pct">{row.lossPct}%</small> : null}
      </strong>
    </li>
  )
}

function LossLimitChip({ card }) {
  if (card.lossLimitPct == null) return null
  const over = card.lossOverLimitCount || 0
  return (
    <span
      className={`pd-dept-loss-limit${over ? ' pd-dept-loss-limit--over' : ''}`}
      role={over ? 'alert' : undefined}
      title={`Loss limit ${card.lossLimitPct}% of Metal In`}
    >
      {over ? `${over} over ${card.lossLimitPct}%` : `Limit ${card.lossLimitPct}%`}
    </span>
  )
}

function displayOrDash(value) {
  if (value == null || value === '') return '—'
  return value
}

function formatMinutes(minutes) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h ? `${h}h ${m}m` : `${m}m`
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

function VaultBalanceStrip() {
  return (
    <div className="pd-vault-balance">
      {['Metal Out', 'Metal Process', 'Balance'].map((label) => (
        <div key={label} className="pd-vault-balance-item">
          <span>{label}</span>
          <strong>—</strong>
        </div>
      ))}
    </div>
  )
}

function formatStockQty(value) {
  return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 6 })
}

function VaultStock({ inventory }) {
  if (!inventory || inventory.loading) {
    return <p className="pd-vault-stock-note">Loading stock…</p>
  }
  if (inventory.error) {
    return <p className="pd-vault-stock-note" role="alert">{inventory.error}</p>
  }
  if (!inventory.groups?.length) {
    return <p className="pd-vault-stock-note">No stock on hand</p>
  }
  return (
    <div className="pd-vault-stock">
      {inventory.groups.map((group) => (
        <section key={group.category}>
          <h4 className="pd-vault-stock-cat">{group.category}</h4>
          <div className="pd-vault-stock-head" aria-hidden>
            <span>Item</span>
            <span>Gross</span>
            <span>Pure</span>
            <span>Unit</span>
          </div>
          <div className="pd-vault-stock-list">
            {group.items.map((item) => (
              <div key={item.id} className="pd-vault-stock-row">
                <span>{item.name}</span>
                <span>{formatStockQty(item.grossQty)}</span>
                <span>{formatStockQty(item.pureQty)}</span>
                <span>{item.unit}</span>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  )
}

function AlloyMixChip({ jobs = [] }) {
  if (!jobs.length) return null
  const grams = jobs.reduce((sum, j) => sum + (Number(j.targetGross) || 0), 0)
  const title = jobs
    .map((j) => `${j.mixCode || 'MIX'} · ${j.karat || '?'}K · ${j.targetGross ?? '—'} g`)
    .join('\n')
  return (
    <span
      className="pd-status-pill pd-status-pill--alloy"
      title={title}
    >
      MIX ×{jobs.length}
      {grams > 0 ? ` · ${Number(grams).toLocaleString(undefined, { maximumFractionDigits: 1 })}g` : ''}
    </span>
  )
}

function AlloyMixList({
  jobs = [],
  departmentKey = '',
  onAllocateMix = null,
}) {
  const [allocating, setAllocating] = useState(null)
  const [weight, setWeight] = useState('')
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const destOptions = useMemo(
    () => DASHBOARD_DEPARTMENTS.filter((d) => d.key !== departmentKey),
    [departmentKey],
  )

  if (!jobs.length && !success && !error) return null

  const openAllocate = (job, event) => {
    event?.stopPropagation?.()
    setAllocating(job)
    setWeight(String(job.targetGross ?? ''))
    setError('')
    setSuccess('')
  }

  const closeAllocate = (event) => {
    event?.stopPropagation?.()
    if (busyId) return
    setAllocating(null)
    setWeight('')
    setError('')
  }

  const submitAllocate = async (toDepartment, event) => {
    event?.stopPropagation?.()
    if (!allocating || !onAllocateMix || !toDepartment) return
    const available = Number(allocating.targetGross) || 0
    const typed = Number(weight)
    const moveWeight = Number.isFinite(typed) && typed > 0 ? typed : available
    if (moveWeight > available + 0.0005) {
      setError(`Only ${available} g available`)
      return
    }
    const fromCode = allocating.mixCode || 'MIX'
    const destLabel = destOptions.find((d) => d.key === toDepartment)?.label || toDepartment
    setBusyId(allocating.id)
    setError('')
    try {
      const result = await onAllocateMix(allocating.id, {
        toDepartment,
        ...(moveWeight + 0.0005 < available ? { weight: moveWeight } : {}),
      })
      setAllocating(null)
      setWeight('')
      if (result?.partial && result?.childJob) {
        setSuccess(
          `Split ${moveWeight} g → ${destLabel} as ${result.childJob.mixCode}`
          + ` · ${fromCode} keeps ${result.parentJob?.targetGross ?? '—'} g`,
        )
      } else {
        setSuccess(`Allocated ${fromCode} (${moveWeight} g) → ${destLabel}`)
      }
    } catch (err) {
      setError(err?.response?.data?.message || err?.message || 'Allocate failed')
    } finally {
      setBusyId('')
    }
  }

  return (
    <div className="pd-alloy-mix-panel" onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()}>
      {jobs.length ? (
        <ul className="pd-alloy-mix-list" aria-label="Open alloy mixes">
          {jobs.map((job) => (
            <li key={job.id || job.mixCode}>
              <span>
                {job.mixCode || 'MIX'}
                {job.hasOpenFloorDescendants ? ' · split on floor' : ''}
              </span>
              <strong>
                {job.karat ? `${job.karat}K ` : ''}
                {Number(job.targetGross || 0).toLocaleString(undefined, { maximumFractionDigits: 3 })} g
              </strong>
              {typeof onAllocateMix === 'function' ? (
                <button
                  type="button"
                  className="pd-btn pd-btn--sm pd-alloy-mix-alloc"
                  disabled={Boolean(busyId)}
                  onClick={(e) => openAllocate(job, e)}
                >
                  Allocate
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
      {success ? <p className="pd-alloy-mix-toast pd-alloy-mix-toast--ok" role="status">{success}</p> : null}
      {error && !allocating ? <p className="pd-alloy-mix-toast pd-alloy-mix-toast--err" role="alert">{error}</p> : null}
      {allocating ? (
        <div className="pd-alloy-mix-alloc-modal" role="dialog" aria-label={`Allocate ${allocating.mixCode || 'mix'}`}>
          <div className="pd-alloy-mix-alloc-head">
            <strong>{allocating.mixCode || 'MIX'}</strong>
            <button type="button" className="pd-btn pd-btn--ghost pd-btn--sm" onClick={closeAllocate} disabled={Boolean(busyId)}>
              Close
            </button>
          </div>
          <label className="pd-alloy-mix-alloc-weight">
            <span>Weight (g)</span>
            <input
              type="number"
              min="0"
              step="0.001"
              value={weight}
              disabled={Boolean(busyId)}
              onChange={(e) => setWeight(e.target.value)}
            />
          </label>
          {error ? <p className="pd-alloy-mix-toast pd-alloy-mix-toast--err" role="alert">{error}</p> : null}
          <div className="pd-alloy-mix-dests">
            {destOptions.map((dest) => (
              <button
                key={dest.key}
                type="button"
                className="pd-btn pd-btn--sm"
                disabled={Boolean(busyId)}
                onClick={(e) => submitAllocate(dest.key, e)}
              >
                {busyId === allocating.id ? '…' : dest.label}
              </button>
            ))}
          </div>
        </div>
      ) : null}
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
  loopcMode = false,
  currentBatchTimes = false,
  callCount = 0,
  breakdown = false,
  down = null,
  onMarkFixed,
  vaultInventory = null,
  alloyMixJobs = [],
  onAllocateMix = null,
}) {
  const calling = !breakdown && callCount > 0
  const machineDown = !breakdown && !calling && Boolean(down)
  const downMinutes = down ? minutesDown(down) : null
  const downFor = downMinutes != null ? formatMinutes(downMinutes) : ''
  const ui = resolveDeptCardDisplay(card, batchMonitorRows, employeeRatings, { suppressDemo, loopcMode, currentBatchTimes })
  const isVault = ui.key === 'vault_room'
  const tone = statusClass(ui.status)
  const employeeLabel = ui.employeeCount != null && ui.employeeCount > 0
    ? `EMPLOYEES (${ui.employeeCount})`
    : (suppressDemo ? 'EMPLOYEES (—)' : 'EMPLOYEES')
  const mixes = Array.isArray(alloyMixJobs) ? alloyMixJobs : []

  return (
    <article
      className={`pd-dept-card ${toneClass(ui.key)} pd-dept-card--${tone}${ui.isAssembly ? ' pd-dept-card--assembly' : ''}${isVault ? ' pd-dept-card--vault-stock' : ''}${selected ? ' pd-dept-card--selected' : ''}${calling ? ' pd-dept-card--calling' : ''}${breakdown ? ' pd-dept-card--breakdown' : ''}`}
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
        {breakdown ? (
          <span
            className="pd-status-pill pd-status-pill--breakdown"
            role="alert"
            title="Breakdown reported from the tablet — acknowledge from BREAKDOWN at the top"
          >
            <span className="pd-status-dot" aria-hidden />
            BREAKDOWN
          </span>
        ) : calling ? (
          <span
            className="pd-status-pill pd-status-pill--calling"
            role="alert"
            title="Operator is calling the Floor Manager — acknowledge from CALL F.M at the top"
          >
            <span className="pd-status-dot" aria-hidden />
            CALL F.M{callCount > 1 ? ` ×${callCount}` : ''}
          </span>
        ) : machineDown ? (
          <span className="pd-status-pill pd-status-pill--down" title="Breakdown acknowledged — machine not fixed yet">
            <span className="pd-status-dot" aria-hidden />
            MACHINE DOWN
          </span>
        ) : (
          <span className={`pd-status-pill pd-status-pill--${tone}`}>
            <span className="pd-status-dot" aria-hidden />
            {ui.status || 'Idle'}
          </span>
        )}
        <AlloyMixChip jobs={mixes} />
      </div>

      {down ? (
        <div className="pd-dept-down">
          <span>
            Down {downFor}
            {down.acknowledgedByName ? ` · seen by ${down.acknowledgedByName}` : ''}
          </span>
          {onMarkFixed ? (
            <button
              type="button"
              className="pd-btn pd-btn--sm pd-dept-down-fix"
              onClick={(e) => { e.stopPropagation(); onMarkFixed(down) }}
              onKeyDown={(e) => e.stopPropagation()}
            >
              Mark fixed
            </button>
          ) : null}
        </div>
      ) : null}

      {/* Scrollable mid section — keeps footer (batch / vault balance) from being clipped */}
      <div className="pd-dept-card-body">
      <AlloyMixList
        jobs={mixes}
        departmentKey={ui.key}
        onAllocateMix={onAllocateMix}
      />
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

      {isVault ? <VaultStock inventory={vaultInventory} /> : (
      <>
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
          {loopcMode && ui.timeRows?.length ? (
            ui.timeRows.map((r) => (
              <div key={`${ui.key}-time-${r.index}`} className="pd-dept-batches-row">
                <span>{r.label}</span>
                <strong>{displayOrDash(r.timeLabel)}</strong>
              </div>
            ))
          ) : (
            <div className="pd-dept-batches-row">
              <span>Time / Batch</span>
              <strong>{displayOrDash(ui.timePerBatchLabel)}</strong>
            </div>
          )}
          <div className="pd-dept-batches-row">
            <span>Avg. Time</span>
            <strong>{displayOrDash(ui.avgTimeLabel)}</strong>
          </div>
          {loopcMode ? (
            <div className="pd-dept-batches-row">
              <span>Total Avg Time</span>
              <strong>{displayOrDash(ui.timeTotalAvgLabel)}</strong>
            </div>
          ) : null}
        </div>
      </div>

      <div className="pd-dept-loss-block">
        <div className="pd-dept-loss-head">
          <span className="pd-dept-loss-icon" aria-hidden>
            <IconLossWarn size={14} />
          </span>
          <span>Metal Loss (g)</span>
          <LossLimitChip card={card} />
        </div>
        <ul className="pd-dept-loss-list">
          {loopcMode ? (
            ui.lossRows.length || ui.lossTodayAvg != null || ui.lossTotalAvg != null ? (
              <>
                {ui.lossRows.map((r) => <LossRow key={`${ui.key}-loss-${r.index}`} row={r} />)}
                <li className="pd-dept-loss-avg">
                  <span>Today Avg</span>
                  <strong>{formatLoss(ui.lossTodayAvg)}</strong>
                </li>
                <li className="pd-dept-loss-avg">
                  <span>Total Avg</span>
                  <strong>{formatLoss(ui.lossTotalAvg)}</strong>
                </li>
              </>
            ) : (
              <li>
                <span>—</span>
                <strong>—</strong>
              </li>
            )
          ) : ui.lossRows.length ? (
            <>
              {ui.lossRows.map((r) => <LossRow key={`${ui.key}-loss-${r.index}`} row={r} />)}
              <li className={`pd-dept-loss-avg${card.lossTodayOverLimit ? ' pd-dept-loss-row--over' : ''}`}>
                <span>Avg</span>
                <strong>
                  {formatLoss(ui.lossAvg)}
                  {card.lossTodayOverLimit ? <small className="pd-dept-loss-pct">{card.lossTodayPct}%</small> : null}
                </strong>
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
      </>
      )}

      {card.longRunning ? (
        <p className="pd-dept-long-batch" role="status">
          Batch {card.longRunning.batchNumber} running long · {formatMinutes(card.longRunning.elapsedMin)}
          {' '}(usual {formatMinutes(card.longRunning.usualMin)})
        </p>
      ) : null}
      </div>

      {isVault ? <VaultBalanceStrip /> : (
        <BatchProgressBar
          startedLabel={card.currentBatchCarriedOver && ui.batchStartedLabel ? `${ui.batchStartedLabel} (yesterday)` : ui.batchStartedLabel}
          overLabel={ui.batchOverLabel}
          percent={ui.progressPercent}
        />
      )}
    </article>
  )
}

function renderDeptCard(card, props) {
  const {
    batchMonitorRows,
    employeeRatings,
    selectedDeptKey,
    onSelectDept,
    suppressDemo,
    loopcMode,
    currentBatchTimes,
    callingDepts,
    breakdownDepts,
    downDepts,
    onMarkFixed,
    vaultInventory,
    alloyMixByDept,
    onAllocateMix,
  } = props
  return (
    <DeptCard
      key={card.key}
      card={card}
      batchMonitorRows={batchMonitorRows}
      employeeRatings={employeeRatings}
      selected={selectedDeptKey === card.key}
      onSelect={onSelectDept}
      suppressDemo={suppressDemo}
      loopcMode={loopcMode}
      currentBatchTimes={currentBatchTimes}
      callCount={callingDepts[card.key] || 0}
      breakdown={Boolean(breakdownDepts[card.key])}
      down={downDepts[card.key] || null}
      onMarkFixed={onMarkFixed}
      vaultInventory={card.key === 'vault_room' ? vaultInventory : null}
      alloyMixJobs={alloyMixByDept?.[card.key] || []}
      onAllocateMix={onAllocateMix}
    />
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
  loopcMode = false,
  currentBatchTimes = false,
  callingDepts = {},
  breakdownDepts = {},
  downDepts = {},
  onMarkFixed,
  vaultInventory = null,
  alloyMixByDept = {},
  onAllocateMix = null,
  kpi = null,
}) {
  const list = cards || []
  const cardProps = {
    batchMonitorRows,
    employeeRatings,
    selectedDeptKey,
    onSelectDept,
    suppressDemo,
    loopcMode,
    currentBatchTimes,
    callingDepts,
    breakdownDepts,
    downDepts,
    onMarkFixed,
    vaultInventory,
    alloyMixByDept,
    onAllocateMix,
  }
  const vaultCard = list.find((card) => card.key === 'vault_room') || null
  const stampingCard = list.find((card) => card.key === 'stamping') || null
  const productionCards = list.filter(
    (card) => card.key !== 'vault_room' && card.key !== 'stamping',
  )
  const topProduction = productionCards.slice(0, 3)
  const bottomProduction = productionCards.slice(3)

  if (!list.length) {
    return (
      <section className="pd-dept-row" aria-label="Department status">
        <div className="pd-panel pd-dept-status">
          <p className="pd-empty">No departments configured</p>
        </div>
      </section>
    )
  }

  if (vaultCard) {
    return (
      <section className="pd-dept-row pd-dept-row--vault-board" aria-label="Department status">
        <div className="pd-vault-board">
          <div className="pd-vault-slot">
            {renderDeptCard(vaultCard, cardProps)}
          </div>
          <div className="pd-vault-board-kpi">
            {kpi}
          </div>
          <div className="pd-dept-grid pd-dept-grid--top3">
            {topProduction.map((card) => renderDeptCard(card, cardProps))}
          </div>
          <div className="pd-stamp-slot">
            {stampingCard ? renderDeptCard(stampingCard, cardProps) : null}
          </div>
          <div className="pd-dept-grid pd-dept-grid--bottom3">
            {bottomProduction.map((card) => renderDeptCard(card, cardProps))}
          </div>
        </div>
      </section>
    )
  }

  return (
    <section className="pd-dept-row" aria-label="Department status">
      <div className="pd-panel pd-dept-status">
        {kpi}
        <div className="pd-dept-grid">
          {list.map((card) => renderDeptCard(card, cardProps))}
        </div>
      </div>
    </section>
  )
}
