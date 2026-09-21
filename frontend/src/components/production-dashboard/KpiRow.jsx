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

function CompactKpi({ icon, label, value, hint, hintLines, className = '' }) {
  return (
    <article className={`pd-kpi-compact${className ? ` ${className}` : ''}`}>
      <div className="pd-kpi-compact-icon" aria-hidden>{icon}</div>
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
  if (v > 0) return { text: `+${v.toFixed(0)}%`, tone: 'up' }
  return { text: `${v.toFixed(0)}%`, tone: 'down' }
}

export default function KpiRow({ model }) {
  if (!model) return null
  const k = model.compactKpis || {}
  const vault = model.vaultKpi || {}
  const emp = model.employeeKpi || {}
  const shift = model.shiftKpi || {}
  const under = model.underProductionKpi || {}
  const day = deltaLabel(k.yesterdayVsToday)

  const newStockWeight = vault.newStockWeight ?? k.vaultNewStock
  const availableWeight = vault.availableWeight ?? k.vaultAvailable
  const newW = Number(newStockWeight) || 0
  const availW = Number(availableWeight) || 0
  const vaultDisplay = availableWeight != null || newStockWeight != null
    ? formatGrams(availW)
    : '—'
  const vaultHint = newW > 0 ? `New ${formatGrams(newW)}` : 'Gold in Stock'
  const vaultLines = (Array.isArray(vault.products) ? vault.products : [])
    .slice(0, 2)
    .map((row, idx) => ({
      key: row.inventoryItemId || `${row.product}-${row.metalType}-${idx}`,
      text: vaultProductLine(row),
    }))

  const onDuty = emp.active ?? k.employees
  const totalEmp = emp.total
  const empValue = onDuty != null ? String(onDuty) : '—'
  const empHint = totalEmp != null ? `${totalEmp} Total` : (onDuty != null ? 'On Duty' : null)

  const manager = k.floorManager || emp.floorManager
  const managerHint = manager ? 'Online' : null

  const shiftName = k.currentShift || shift.name || '—'
  const shiftHint = shift.startTime || shift.endTime
    ? `${formatShiftClock(shift.startTime)} – ${formatShiftClock(shift.endTime)}`
    : null

  const activeBatches = under.activeBatches ?? model.header?.activeBatches
  const underValue = activeBatches != null
    ? `${activeBatches} Batch${Number(activeBatches) === 1 ? '' : 'es'}`
    : '—'

  return (
    <section className="pd-kpi-strip" aria-label="Production KPIs">
      <CompactKpi
        icon={<IconEmployees />}
        label="Employees"
        value={empValue}
        hint={empHint}
      />
      <CompactKpi
        icon={<IconManager />}
        label="Floor Manager"
        value={manager || 'Not assigned'}
        hint={managerHint}
      />
      <CompactKpi
        icon={<IconVault />}
        label="Vault Available"
        value={vaultDisplay}
        hint={vaultHint}
        hintLines={vaultLines}
        className="pd-kpi-compact--vault"
      />
      <CompactKpi
        icon={<IconShift />}
        label="Current Shift"
        value={shiftName}
        hint={shiftHint}
      />
      <CompactKpi
        icon={<IconProduction />}
        label="Total Production Today"
        value={k.totalProductionToday != null ? formatGrams(k.totalProductionToday) : '—'}
        hint={day.tone !== 'muted' ? day.text : undefined}
      />
      <CompactKpi
        icon={<IconUnderProduction />}
        label="Under Production"
        value={underValue}
      />
      <CompactKpi
        icon={<IconOutput />}
        label="Total Output"
        value={k.totalOutput != null ? formatGrams(k.totalOutput) : '—'}
      />
      <CompactKpi
        icon={<IconTrendUp />}
        label="Yesterday vs Today"
        value={<span className={`pd-delta pd-delta--${day.tone}`}>{day.text}</span>}
      />
    </section>
  )
}
