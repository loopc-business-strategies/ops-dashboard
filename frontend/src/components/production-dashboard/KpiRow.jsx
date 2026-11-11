import { formatGrams, formatShiftClock } from './formatters'
import {
  IconShift,
  IconProduction,
  IconUnderProduction,
  IconOutput,
  IconTrendUp,
} from './PdIcons'

/** Reference-style KPI strip when there is no live production data. */
const DEMO_COMPACT_KPIS = {
  currentShift: 'Morning',
  shiftHint: '6:00 AM – 6:00 PM',
  totalProductionToday: '8,320 g',
  productionHint: '↑ +12%',
  underProduction: '5 Batches',
  totalOutput: '7,980 g',
  yesterdayVsToday: '↑ +18%',
  yesterdayHint: '7,980 g vs 6,750 g',
}

function CompactKpi({ icon, label, value, hint, className = '', iconTone = '' }) {
  return (
    <article className={`pd-kpi-compact${className ? ` ${className}` : ''}`}>
      <div className={`pd-kpi-compact-icon${iconTone ? ` pd-kpi-compact-icon--${iconTone}` : ''}`} aria-hidden>
        {icon}
      </div>
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
  if (v > 0) return { text: `↑ +${v.toFixed(0)}%`, tone: 'up' }
  return { text: `↓ ${Math.abs(v).toFixed(0)}%`, tone: 'down' }
}

export default function KpiRow({ model, hideDemoKpis = false }) {
  if (!model) return null

  if (!model.hasLiveProduction && !hideDemoKpis) {
    const d = DEMO_COMPACT_KPIS
    return (
      <section className="pd-kpi-strip" aria-label="Production KPIs">
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
  const shift = model.shiftKpi || {}
  const under = model.underProductionKpi || {}
  const day = deltaLabel(k.yesterdayVsToday)
  const dayCmp = model.comparisons?.day

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
  if (!yesterdayHint && out != null && k.yesterdayOutput != null) {
    yesterdayHint = `${formatGrams(out)} vs ${formatGrams(k.yesterdayOutput)}`
  }
  if (!yesterdayHint && out != null) {
    yesterdayHint = `${formatGrams(out)} vs prior`
  }

  return (
    <section className="pd-kpi-strip" aria-label="Production KPIs">
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
