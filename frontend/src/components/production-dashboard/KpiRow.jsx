import { formatGrams, formatPct } from './formatters'

function CompactKpi({ label, value, hint }) {
  return (
    <article className="pd-kpi-compact">
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
  const day = deltaLabel(k.yesterdayVsToday)
  const week = deltaLabel(k.weeklyComparison)

  return (
    <section className="pd-kpi-strip" aria-label="Production KPIs">
      <CompactKpi label="Employees" value={k.employees != null ? k.employees : '—'} />
      <CompactKpi label="Floor Manager" value={k.floorManager || 'Not assigned'} />
      <CompactKpi label="Current Shift" value={k.currentShift || '—'} />
      <CompactKpi
        label="Total Production Today"
        value={k.totalProductionToday != null ? formatGrams(k.totalProductionToday) : '—'}
      />
      <CompactKpi
        label="Under Production"
        value={k.underProduction != null ? formatGrams(k.underProduction) : '—'}
      />
      <CompactKpi
        label="Total Output"
        value={k.totalOutput != null ? formatGrams(k.totalOutput) : '—'}
      />
      <CompactKpi
        label="Yesterday vs Today"
        value={<span className={`pd-delta pd-delta--${day.tone}`}>{day.text}</span>}
      />
      <CompactKpi
        label="Weekly Comparison"
        value={<span className={`pd-delta pd-delta--${week.tone}`}>{week.text}</span>}
        hint={week.tone !== 'muted' && k.weeklyComparison != null ? formatPct(Math.abs(Number(k.weeklyComparison))) : undefined}
      />
    </section>
  )
}
