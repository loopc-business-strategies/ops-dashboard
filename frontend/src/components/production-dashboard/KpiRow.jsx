import { formatGrams, formatPct } from './formatters'
import {
  IconEmployees,
  IconManager,
  IconShift,
  IconVault,
  IconProduction,
  IconUnderProduction,
  IconOutput,
  IconTrendUp,
  IconWeekly,
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
  const day = deltaLabel(k.yesterdayVsToday)
  const week = deltaLabel(k.weeklyComparison)

  const newStockWeight = vault.newStockWeight ?? k.vaultNewStock
  const availableWeight = vault.availableWeight ?? k.vaultAvailable
  const newW = Number(newStockWeight) || 0
  const availW = Number(availableWeight) || 0
  const vaultDisplay = availableWeight != null || newStockWeight != null
    ? formatGrams(availW)
    : '—'
  const vaultHint = newW > 0 ? `New ${formatGrams(newW)}` : null
  const vaultLines = (Array.isArray(vault.products) ? vault.products : [])
    .slice(0, 2)
    .map((row, idx) => ({
      key: row.inventoryItemId || `${row.product}-${row.metalType}-${idx}`,
      text: vaultProductLine(row),
    }))

  return (
    <section className="pd-kpi-strip" aria-label="Production KPIs">
      <CompactKpi icon={<IconEmployees />} label="Employees" value={k.employees != null ? k.employees : '—'} />
      <CompactKpi icon={<IconManager />} label="Floor Manager" value={k.floorManager || 'Not assigned'} />
      <CompactKpi
        icon={<IconVault />}
        label="Vault Available"
        value={vaultDisplay}
        hint={vaultHint}
        hintLines={vaultLines}
        className="pd-kpi-compact--vault"
      />
      <CompactKpi icon={<IconShift />} label="Current Shift" value={k.currentShift || '—'} />
      <CompactKpi
        icon={<IconProduction />}
        label="Total Production Today"
        value={k.totalProductionToday != null ? formatGrams(k.totalProductionToday) : '—'}
      />
      <CompactKpi
        icon={<IconUnderProduction />}
        label="Under Production"
        value={k.underProduction != null ? formatGrams(k.underProduction) : '—'}
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
      <CompactKpi
        icon={<IconWeekly />}
        label="Weekly Comparison"
        value={<span className={`pd-delta pd-delta--${week.tone}`}>{week.text}</span>}
        hint={week.tone !== 'muted' && k.weeklyComparison != null ? formatPct(Math.abs(Number(k.weeklyComparison))) : undefined}
      />
    </section>
  )
}
