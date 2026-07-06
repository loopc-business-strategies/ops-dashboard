import React, { useState } from 'react'

export function fmtDollar(val) {
  const n = Number(val || 0)
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtCompactCurrency(value) {
  const n = Number(value || 0)
  if (Math.abs(n) >= 1000000) return `$${(n / 1000000).toFixed(1)}m`
  if (Math.abs(n) >= 1000) return `$${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k`
  return `$${n.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}

function ExpenseDonut({ segments = [], total = 0, size = 152, stroke = 34, label = '', subLabel = '' }) {
  const [hovered, setHovered] = useState(null)
  const cx = size / 2
  const cy = size / 2
  const r = (size - stroke) / 2
  let cumAngle = -90
  const arcs = segments.map((seg, index) => {
    const pct = total > 0 ? Number(seg.value || 0) / total : 0
    const angle = pct * 360
    const startAngle = cumAngle
    cumAngle += angle
    const toRad = (deg) => (deg * Math.PI) / 180
    const x1 = cx + r * Math.cos(toRad(startAngle))
    const y1 = cy + r * Math.sin(toRad(startAngle))
    const x2 = cx + r * Math.cos(toRad(startAngle + angle))
    const y2 = cy + r * Math.sin(toRad(startAngle + angle))
    return { ...seg, index, angle, pct, x1, y1, x2, y2, large: angle > 180 ? 1 : 0 }
  })

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: 'block', flexShrink: 0 }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#EEF2F7" strokeWidth={stroke} />
      {arcs.map((arc) => arc.angle < 0.5 ? null : (
        <path
          key={arc.index}
          d={`M ${arc.x1} ${arc.y1} A ${r} ${r} 0 ${arc.large} 1 ${arc.x2} ${arc.y2}`}
          fill="none"
          stroke={arc.color}
          strokeWidth={hovered === arc.index ? stroke + 2 : stroke}
          onMouseEnter={() => setHovered(arc.index)}
          onMouseLeave={() => setHovered(null)}
          style={{ transition: 'stroke-width 0.15s ease', cursor: 'pointer' }}
        />
      ))}
      <text x={cx} y={cy - 2} textAnchor="middle" fontSize={size > 120 ? 19 : 13} fontWeight="800" fill="#111827">{label}</text>
      {subLabel && <text x={cx} y={cy + (size > 120 ? 19 : 14)} textAnchor="middle" fontSize={size > 120 ? 12 : 9} fontWeight="600" fill="#6B7280">{subLabel}</text>}
    </svg>
  )
}

export default function ExpenseChartsPanel({
  segments = [],
  displayTotal = 0,
  subLabel = 'Total',
  filteredTrend = [],
  maxTrend = 1,
  peakMonthIndex = -1,
  selectedMonthIndex = -1,
  trendRangeLabel = 'Monthly Expenses',
  compact = false,
  style = {},
}) {
  const donutSize = compact ? 108 : 158
  const donutStroke = compact ? 24 : 34
  const trendHeight = compact ? 110 : 190
  const barMaxHeight = compact ? 90 : 135
  const sectionPadding = compact ? '0.55rem' : '0.95rem'
  const titleSize = compact ? '0.75rem' : '0.88rem'
  const legendSize = compact ? '0.68rem' : '0.78rem'
  const legendCols = compact ? 'minmax(0, 1fr) 36px 72px' : 'minmax(0, 1fr) 48px 92px'
  const breakdownGrid = compact ? '96px minmax(0, 1fr)' : '170px minmax(0, 1fr)'

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: compact ? '1fr 1fr' : 'minmax(320px, 1.2fr) minmax(320px, 0.9fr)',
        gap: compact ? '0.5rem' : '1rem',
        height: compact ? '100%' : undefined,
        minHeight: 0,
        ...style,
      }}
    >
      <section style={{ border: compact ? 'none' : '1px solid #E5E7EB', borderRadius: '0.65rem', padding: sectionPadding, background: '#FFFFFF', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <h4 style={{ margin: '0 0 0.55rem', color: '#111827', fontSize: titleSize, fontWeight: '900' }}>Expense Breakdown</h4>
        <div style={{ display: 'grid', gridTemplateColumns: breakdownGrid, gap: compact ? '0.45rem' : '1rem', alignItems: 'center', flex: 1, minHeight: 0 }}>
          <ExpenseDonut
            segments={segments}
            total={displayTotal}
            size={donutSize}
            stroke={donutStroke}
            label={fmtDollar(displayTotal)}
            subLabel={subLabel}
          />
          <div style={{ display: 'grid', gap: compact ? '0.4rem' : '0.62rem', minWidth: 0, overflow: 'hidden' }}>
            {segments.length === 0
              ? <p style={{ margin: 0, fontSize: legendSize, color: '#9CA3AF' }}>No breakdown data for this period.</p>
              : segments.map((seg) => (
                <div key={seg.label} style={{ display: 'grid', gridTemplateColumns: legendCols, alignItems: 'center', gap: '0.5rem', fontSize: legendSize, color: '#374151' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', minWidth: 0 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: seg.color, flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{seg.label}</span>
                  </div>
                  <span style={{ textAlign: 'right', color: '#374151', fontWeight: '700' }}>{seg.pct.toFixed(0)}%</span>
                  <span style={{ textAlign: 'right', color: '#111827', fontWeight: '800' }}>{fmtDollar(seg.value)}</span>
                </div>
              ))}
          </div>
        </div>
      </section>
      <section style={{ border: compact ? 'none' : '1px solid #E5E7EB', borderRadius: '0.65rem', padding: sectionPadding, background: '#FFFFFF', minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.5rem', alignItems: 'center', marginBottom: compact ? '0.45rem' : '0.85rem' }}>
          <h4 style={{ margin: 0, color: '#111827', fontSize: titleSize, fontWeight: '900' }}>Monthly Trend</h4>
          {!compact && <span style={{ fontSize: '0.7rem', color: '#64748B', fontWeight: '700' }}>{trendRangeLabel}</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: compact ? '0.35rem' : '0.8rem', height: trendHeight, padding: '0.15rem 0.2rem 0.3rem', borderBottom: compact ? 'none' : '1px solid #E5E7EB', flex: 1, minHeight: 0 }}>
          {filteredTrend.length === 0
            ? <p style={{ margin: 0, fontSize: legendSize, color: '#9CA3AF' }}>No trend data for selected year.</p>
            : filteredTrend.map((row, index) => {
              const amount = Number(row.amount || 0)
              const height = Math.max((amount / maxTrend) * barMaxHeight, amount > 0 ? 8 : 3)
              const rowMonthIndex = row.monthIndex ?? -1
              const active = selectedMonthIndex >= 0
                ? rowMonthIndex === selectedMonthIndex
                : rowMonthIndex === peakMonthIndex
              return (
                <div key={row.key || `${row.label}-${index}`} style={{ flex: 1, minWidth: compact ? 28 : 42, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: '0.25rem' }}>
                  <span style={{ color: active ? '#111827' : '#334155', fontSize: compact ? '0.62rem' : '0.7rem', fontWeight: '900' }}>{fmtCompactCurrency(amount)}</span>
                  <div style={{ width: '42%', minWidth: 12, maxWidth: compact ? 20 : 28, height, borderRadius: '999px 999px 0 0', background: active ? '#059669' : '#C7F0DC' }} />
                  <span style={{ color: '#64748B', fontSize: compact ? '0.58rem' : '0.66rem', whiteSpace: 'nowrap' }}>{row.label || row.month}</span>
                </div>
              )
            })}
        </div>
      </section>
    </div>
  )
}
