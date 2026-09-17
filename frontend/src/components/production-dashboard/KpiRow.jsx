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

function CompactKpi({ icon, label, value, hint }) {
  return (
    <article className="pd-kpi-compact">
      <div className="pd-kpi-compact-icon" aria-hidden>{icon}</div>
      <div className="pd-kpi-compact-body">
        <span className="pd-kpi-compact-label">{label}</span>
        <strong className="pd-kpi-compact-value">{value}</strong>
        {hint ? <span className="pd-kpi-compact-hint">{hint}</span> : null}
      </div>
    </article>
  )
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
  const vaultDisplay = (newW + availW) > 0
    ? formatGrams(newW > 0 ? newW : availW)
    : (newStockWeight != null || availableWeight != null ? formatGrams(0) : '—')
  const vaultHint = `Available ${formatGrams(availW)}`

  return (
    <section className="pd-kpi-strip" aria-label="Production KPIs">
      <CompactKpi icon={<IconEmployees />} label="Employees" value={k.employees != null ? k.employees : '—'} />
      <CompactKpi icon={<IconManager />} label="Floor Manager" value={k.floorManager || 'Not assigned'} />
      <CompactKpi
        icon={<IconVault />}
        label="Vault New Stock"
        value={vaultDisplay}
        hint={vaultHint}
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
