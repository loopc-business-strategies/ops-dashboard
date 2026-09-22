import { formatGrams, formatShiftClock } from './formatters'
import {
  IconEmployees,
  IconManager,
  IconShift,
  IconVault,
  IconProduction,
  IconUnderProduction,
  IconOutput,
  IconTrendUp,
} from './PdIcons'

/** Reference-style KPI strip when there is no live production data. */
const DEMO_COMPACT_KPIS = {
  employees: '24',
  employeesHint: '28 Total',
  floorManager: 'Mr. Suresh',
  floorManagerHint: '● Online',
  vaultDisplay: '12,450 g',
  vaultHint: 'Gold in Stock',
  currentShift: 'Morning',
  shiftHint: '6:00 AM – 6:00 PM',
  totalProductionToday: '8,320 g',
  productionHint: '↑ +12%',
  underProduction: '5 Batches',
  totalOutput: '7,980 g',
  yesterdayVsToday: '↑ +18%',
  yesterdayHint: '7,980 g vs 6,750 g',
}

function CompactKpi({ icon, label, value, hint, hintLines, className = '', iconTone = '' }) {
  return (
    <article className={`pd-kpi-compact${className ? ` ${className}` : ''}`}>
      <div className={`pd-kpi-compact-icon${iconTone ? ` pd-kpi-compact-icon--${iconTone}` : ''}`} aria-hidden>
        {icon}
      </div>
      <div className="pd-kpi-compact-body">
        <span className="pd-kpi-compact-label">{label}</span>
        <strong className="pd-kpi-compact-value">{value}</strong>
        {hint ? <span className="pd-kpi-compact-hint">{hint}</span> : null}
        {Array.isArray(hintLines) && hintLines.length > 0 ? (
          <ul className="pd-kpi-compact-lines">
            {hintLines.map((line) => (
              <li key={line.key}>{line.text}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </article>
  )
}

function formatPurity(purity) {
  const raw = String(purity || '').trim()
  if (!raw) return ''
  const n = Number(raw)
  if (Number.isFinite(n) && n > 0 && n <= 1) return n.toFixed(3).replace(/0+$/, '').replace(/\.$/, '')
  return raw
}

function vaultProductLine(row) {
  const grams = row.availableWeight > 0 ? row.availableWeight : row.totalWeight
  const purity = formatPurity(row.purity)
  const parts = [row.product, row.metalType]
  if (purity) parts.push(purity)
  return `${parts.join(' · ')} — ${formatGrams(grams)}`
}

function deltaLabel(n) {
  if (n == null || !Number.isFinite(Number(n))) return { text: '—', tone: 'muted' }
  const v = Number(n)
  if (Math.abs(v) < 0.05) return { text: 'No change', tone: 'muted' }
  if (v > 0) return { text: `↑ +${v.toFixed(0)}%`, tone: 'up' }
  return { text: `↓ ${Math.abs(v).toFixed(0)}%`, tone: 'down' }
}

export default function KpiRow({ model }) {
  if (!model) return null

  if (!model.hasLiveProduction) {
    const d = DEMO_COMPACT_KPIS
    return (
      <section className="pd-kpi-strip" aria-label="Production KPIs">
        <CompactKpi
          icon={<IconEmployees />}
          iconTone="blue"
          label="Employees"
          value={d.employees}
          hint={d.employeesHint}
        />
        <CompactKpi
          icon={<IconManager />}
          iconTone="blue"
          label="Floor Manager"
          value={d.floorManager}
          hint={d.floorManagerHint}
        />
        <CompactKpi
          icon={<IconVault />}
          iconTone="green"
          label="Vault Available"
          value={d.vaultDisplay}
          hint={d.vaultHint}
          className="pd-kpi-compact--vault"
        />
        <CompactKpi
          icon={<IconShift />}
          iconTone="blue"
          label="Current Shift"
          value={d.currentShift}
          hint={d.shiftHint}
        />
        <CompactKpi
          icon={<IconProduction />}
          iconTone="green"
          label="Total Production Today"
          value={d.totalProductionToday}
          hint={d.productionHint}
        />
        <CompactKpi
          icon={<IconUnderProduction />}
          iconTone="green"
          label="Under Production"
          value={d.underProduction}
        />
        <CompactKpi
          icon={<IconOutput />}
          iconTone="green"
          label="Total Output"
          value={d.totalOutput}
        />
        <CompactKpi
          icon={<IconTrendUp />}
          iconTone="green"
          label="Yesterday vs Today"
          value={<span className="pd-delta pd-delta--up">{d.yesterdayVsToday}</span>}
          hint={d.yesterdayHint}
        />
      </section>
    )
  }

  const k = model.compactKpis || {}
  const vault = model.vaultKpi || {}
  const emp = model.employeeKpi || {}
  const shift = model.shiftKpi || {}
  const under = model.underProductionKpi || {}
  const day = deltaLabel(k.yesterdayVsToday)
  const dayCmp = model.comparisons?.day

  const availableWeight = vault.availableWeight ?? k.vaultAvailable
  const vaultDisplay = availableWeight != null ? formatGrams(Number(availableWeight) || 0) : '—'
  const vaultLines = (Array.isArray(vault.products) ? vault.products : [])
    .slice(0, 2)
    .map((row, idx) => ({
      key: row.inventoryItemId || `${row.product}-${row.metalType}-${idx}`,
      text: vaultProductLine(row),
    }))

  const onDuty = emp.active ?? k.employees
  const totalEmp = emp.total
  const empValue = onDuty != null ? String(onDuty) : '—'
  const empHint = totalEmp != null
    ? `${totalEmp} Total`
    : (onDuty != null ? `${onDuty} On Duty` : null)

  const manager = k.floorManager || emp.floorManager || '—'
  const managerOnline = Boolean(manager !== '—')
  const shiftName = k.currentShift || shift.name || '—'
  const shiftHint = shift.startTime || shift.endTime
    ? `${formatShiftClock(shift.startTime)} – ${formatShiftClock(shift.endTime)}`
    : null

  const activeBatches = under.activeBatches ?? model.header?.activeBatches
  const underValue = activeBatches != null
    ? `${activeBatches} Batch${Number(activeBatches) === 1 ? '' : 'es'}`
    : '—'

  const out = k.totalOutput
  const prod = k.totalProductionToday

  let yesterdayHint = null
  if (dayCmp?.available && Array.isArray(dayCmp.metrics)) {
    const outMetric = dayCmp.metrics.find((m) => m.key === 'output')
    if (outMetric && outMetric.current != null && outMetric.previous != null) {
      yesterdayHint = `${formatGrams(outMetric.current)} vs ${formatGrams(outMetric.previous)}`
    }
  }
  if (!yesterdayHint && out != null) {
    yesterdayHint = `${formatGrams(out)} vs prior`
  }

  return (
    <section className="pd-kpi-strip" aria-label="Production KPIs">
      <CompactKpi
        icon={<IconEmployees />}
        iconTone="blue"
        label="Employees"
        value={empValue}
        hint={empHint}
      />
      <CompactKpi
        icon={<IconManager />}
        iconTone="blue"
        label="Floor Manager"
        value={manager}
        hint={managerOnline ? '● Online' : null}
      />
      <CompactKpi
        icon={<IconVault />}
        iconTone="green"
        label="Vault Available"
        value={vaultDisplay}
        hint={vaultDisplay !== '—' ? 'Gold in Stock' : null}
        hintLines={vaultLines}
        className="pd-kpi-compact--vault"
      />
      <CompactKpi
        icon={<IconShift />}
        iconTone="blue"
        label="Current Shift"
        value={shiftName}
        hint={shiftHint}
      />
      <CompactKpi
        icon={<IconProduction />}
        iconTone="green"
        label="Total Production Today"
        value={prod != null ? formatGrams(prod) : '—'}
        hint={day.tone !== 'muted' ? day.text : null}
      />
      <CompactKpi
        icon={<IconUnderProduction />}
        iconTone="green"
        label="Under Production"
        value={underValue}
      />
      <CompactKpi
        icon={<IconOutput />}
        iconTone="green"
        label="Total Output"
        value={out != null ? formatGrams(out) : '—'}
      />
      <CompactKpi
        icon={<IconTrendUp />}
        iconTone="green"
        label="Yesterday vs Today"
        value={<span className={`pd-delta pd-delta--${day.tone}`}>{day.text}</span>}
        hint={yesterdayHint}
      />
    </section>
  )
}
