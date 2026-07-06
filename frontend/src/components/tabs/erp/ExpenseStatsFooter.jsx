import React from 'react'
import { fmtDollar } from './ExpenseChartsPanel'

export default function ExpenseStatsFooter({
  periodTotal = 0,
  lastMonthAmount = 0,
  ytdTotal = 0,
  txCount = 0,
  avgExpense = 0,
  deltaColor = '#059669',
  deltaSubtext = '',
  compact = false,
  style = {},
}) {
  const padding = compact ? '0.45rem 0.5rem' : '0.95rem 1rem'
  const labelSize = compact ? '0.62rem' : '0.73rem'
  const valueSize = compact ? '0.78rem' : '1rem'
  const subSize = compact ? '0.58rem' : '0.7rem'
  const showDelta = !compact && deltaSubtext

  const cells = [
    ['Total Expenses', fmtDollar(periodTotal), showDelta ? deltaSubtext : (compact ? 'Filtered period' : deltaSubtext), deltaColor],
    ['Last Month', fmtDollar(lastMonthAmount), 'Previous period', '#111827'],
    ['This Year (YTD)', fmtDollar(ytdTotal), 'Year filter total', '#059669'],
    ['Total Transactions', txCount > 0 ? txCount.toLocaleString() : '0', `Avg ${fmtDollar(avgExpense)}`, '#111827'],
  ]

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
        border: '1px solid #E5E7EB',
        borderRadius: compact ? '0.45rem' : '0.65rem',
        overflow: 'hidden',
        background: '#FFFFFF',
        flexShrink: 0,
        ...style,
      }}
    >
      {cells.map(([label, value, sub, color], index) => (
        <div key={label} style={{ padding, borderLeft: index === 0 ? 'none' : '1px solid #E5E7EB', minWidth: 0 }}>
          <p style={{ margin: 0, color: '#64748B', fontSize: labelSize, fontWeight: '700', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</p>
          <p style={{ margin: compact ? '0.2rem 0 0' : '0.35rem 0 0', color, fontSize: valueSize, fontWeight: '900', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</p>
          <p style={{ margin: compact ? '0.12rem 0 0' : '0.28rem 0 0', color: '#64748B', fontSize: subSize, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</p>
        </div>
      ))}
    </div>
  )
}
