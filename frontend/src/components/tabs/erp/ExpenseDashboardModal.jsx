import React, { useMemo, useState } from 'react'
import ExpenseRegisterSection from './ExpenseRegisterSection'
import { useExpenseRegister } from './useExpenseRegister'
import {
  EXPENSE_MONTH_OPTIONS,
  aggregateRegisterItemsByCategory,
  buildYearOptions,
  expenseMonthLabel,
} from './expenseMonthFilterUtils'
import { useExpensePeriodFilter } from './useExpensePeriodFilter'
import { useExpenseRegisterExports } from './useExpenseRegisterExports'

const EXPENSE_CHART_COLORS = ['#176B4B', '#49B68D', '#A8D8C0', '#15A8E2', '#6366F1', '#D97706']

function fmtDollar(val) {
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
      {subLabel && <text x={cx} y={cy + 19} textAnchor="middle" fontSize={size > 120 ? 12 : 9} fontWeight="600" fill="#6B7280">{subLabel}</text>}
    </svg>
  )
}

const smallControl = {
  border: '1px solid #E5E7EB',
  borderRadius: '0.45rem',
  background: '#FFFFFF',
  color: '#374151',
  fontSize: '0.72rem',
  fontWeight: '600',
  padding: '0 0.55rem',
  height: 34,
  boxSizing: 'border-box',
  lineHeight: 1,
}

const modalCloseButtonStyle = {
  width: 34,
  height: 34,
  borderRadius: '0.45rem',
  border: '1px solid #E5E7EB',
  background: '#FFFFFF',
  color: '#64748B',
  cursor: 'pointer',
  fontSize: '1rem',
  fontWeight: '700',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  padding: 0,
}

export default function ExpenseDashboardModal({ dashboard, token, onClose, onOpenLedgerEntry }) {
  const [trendRange, setTrendRange] = useState('6m')
  const [paymentFilter, setPaymentFilter] = useState('all')
  const [categoryFilter, setCategoryFilter] = useState('')

  const {
    year: yearFilter,
    month: monthFilter,
    startDate: registerStartDate,
    endDate: registerEndDate,
    setYear: setYearFilter,
    setMonth: setMonthFilter,
    setStartDate: setRegisterStartDate,
    setEndDate: setRegisterEndDate,
  } = useExpensePeriodFilter({ defaultMonth: 'current' })

  const exp = dashboard?.expenses || {}
  const breakdown = exp?.breakdown || []
  const total = Number(exp?.total || 0)
  const monthlyTrend = exp?.monthlyTrend || []
  const yearOptions = buildYearOptions(monthlyTrend, yearFilter)

  const currentTotal = Number(exp.currentMonthTotal ?? total)
  const lastMonthTotal = Number(exp.lastMonthTotal || 0)
  const ytdTotal = Number(exp.ytdTotal || total)
  const txCount = Number(exp.transactionCount || 0)
  const avgExpense = txCount > 0 ? currentTotal / txCount : 0
  const deltaPct = lastMonthTotal > 0 ? ((currentTotal - lastMonthTotal) / lastMonthTotal) * 100 : 0
  const deltaColor = deltaPct <= 0 ? '#059669' : '#DC2626'
  const filteredTrend = monthlyTrend
    .filter((row) => String(row.year) === yearFilter)
    .slice(trendRange === '12m' ? -12 : -6)
  const maxTrend = Math.max(...filteredTrend.map((row) => Number(row.amount || 0)), 1)
  const selectedMonthIndex = monthFilter === '' ? -1 : Number(monthFilter)

  const {
    items: registerItems,
    categories: registerCategories,
    total: registerTotal,
    loading: registerLoading,
    error: registerError,
  } = useExpenseRegister({
    token,
    enabled: Boolean(token),
    startDate: registerStartDate,
    endDate: registerEndDate,
    category: categoryFilter,
    paymentSource: paymentFilter,
    limit: 200,
  })

  const {
    exportBusy,
    handleDownloadMonthlyReports,
  } = useExpenseRegisterExports({
    token,
    year: yearFilter,
    month: monthFilter,
    startDate: registerStartDate,
    endDate: registerEndDate,
    categoryFilter,
    paymentFilter,
    monthlyTrend,
  })

  const categoryBreakdown = monthFilter !== '' && registerItems.length > 0
    ? aggregateRegisterItemsByCategory(registerItems)
    : null

  const breakdownSource = categoryBreakdown
    || (total > 0 ? breakdown : monthlyTrend.filter((row) => Number(row.amount || 0) > 0))

  const displayTotal = categoryBreakdown
    ? categoryBreakdown.reduce((sum, row) => sum + Number(row.amount || 0), 0)
    : (total > 0 ? total : ytdTotal)

  const segments = useMemo(() => breakdownSource
    .slice(0, 6)
    .map((item, i) => ({
      label: item.name || item.label || item.month || 'Other',
      value: Number(item.amount || 0),
      color: EXPENSE_CHART_COLORS[i % EXPENSE_CHART_COLORS.length],
      pct: displayTotal > 0 ? (Number(item.amount || 0) / displayTotal) * 100 : 0,
    })), [breakdownSource, displayTotal])

  const categoryOptions = registerCategories.length > 0
    ? registerCategories
    : [...new Set((exp.recent || []).map((row) => row.category).filter(Boolean))]

  const registerAvg = registerItems.length > 0
    ? registerItems.reduce((s, r) => s + Number(r.amount || 0), 0) / registerItems.length
    : avgExpense

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 3200, background: 'rgba(15,23,42,0.24)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.25rem' }}
      onClick={onClose}
    >
      <div
        style={{ width: 'min(1120px, 96vw)', maxHeight: '88vh', overflow: 'hidden', background: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '0.8rem', boxShadow: '0 24px 70px rgba(15,23,42,0.28)', display: 'flex', flexDirection: 'column' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: '1rem 1.1rem', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'nowrap', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0 }}>
            <span style={{ width: 42, height: 42, borderRadius: '0.65rem', display: 'grid', placeItems: 'center', background: '#FEF9C3', fontSize: '1.2rem', flexShrink: 0 }}>📋</span>
            <div style={{ minWidth: 0 }}>
              <h3 style={{ margin: 0, color: '#111827', fontSize: '1rem', fontWeight: '900' }}>Expenses</h3>
              <p style={{ margin: '0.15rem 0 0', color: '#64748B', fontSize: '0.78rem' }}>Detailed overview of your expenses</p>
            </div>
          </div>
          <button type="button" onClick={onClose} style={modalCloseButtonStyle} aria-label="Close">×</button>
        </div>

        <div style={{ padding: '0.65rem 1.1rem', borderBottom: '1px solid #E5E7EB', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', background: '#F8FAFC', flexShrink: 0 }}>
          <select value={trendRange} onChange={(e) => setTrendRange(e.target.value)} style={{ ...smallControl, minWidth: 158 }} aria-label="Expense trend range">
            <option value="6m">Monthly Expenses</option>
            <option value="12m">Last 12 Months</option>
          </select>
          <select value={yearFilter} onChange={(e) => setYearFilter(e.target.value)} style={{ ...smallControl, width: 88 }} aria-label="Expense year">
            {yearOptions.sort().map((year) => <option key={year} value={year}>{year}</option>)}
          </select>
          <select value={monthFilter} onChange={(e) => setMonthFilter(e.target.value)} style={{ ...smallControl, minWidth: 128 }} aria-label="Expense month">
            {EXPENSE_MONTH_OPTIONS.map((opt) => (
              <option key={opt.value || 'all'} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div style={{ padding: '1rem', overflowY: 'auto', flex: 1, minHeight: 0 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1.2fr) minmax(320px, 0.9fr)', gap: '1rem', marginBottom: '1rem' }}>
            <section style={{ border: '1px solid #E5E7EB', borderRadius: '0.65rem', padding: '0.95rem', background: '#FFFFFF' }}>
              <h4 style={{ margin: '0 0 0.85rem', color: '#111827', fontSize: '0.88rem', fontWeight: '900' }}>Expense Breakdown</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '170px minmax(0, 1fr)', gap: '1rem', alignItems: 'center' }}>
                <ExpenseDonut segments={segments} total={displayTotal} size={158} stroke={34} label={fmtDollar(displayTotal)} subLabel={monthFilter !== '' ? expenseMonthLabel(monthFilter) : 'Total'} />
                <div style={{ display: 'grid', gap: '0.62rem' }}>
                  {segments.length === 0
                    ? <p style={{ margin: 0, fontSize: '0.78rem', color: '#9CA3AF' }}>No breakdown data for this period.</p>
                    : segments.map((seg) => (
                      <div key={seg.label} style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 48px 92px', alignItems: 'center', gap: '0.75rem', fontSize: '0.78rem', color: '#374151' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 0 }}>
                          <span style={{ width: 9, height: 9, borderRadius: '50%', background: seg.color, flexShrink: 0 }} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{seg.label}</span>
                        </div>
                        <span style={{ textAlign: 'right', color: '#374151', fontWeight: '700' }}>{seg.pct.toFixed(0)}%</span>
                        <span style={{ textAlign: 'right', color: '#111827', fontWeight: '800' }}>{fmtDollar(seg.value)}</span>
                      </div>
                    ))}
                </div>
              </div>
            </section>
            <section style={{ border: '1px solid #E5E7EB', borderRadius: '0.65rem', padding: '0.95rem', background: '#FFFFFF' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', marginBottom: '0.85rem' }}>
                <h4 style={{ margin: 0, color: '#111827', fontSize: '0.88rem', fontWeight: '900' }}>Monthly Trend</h4>
                <span style={{ fontSize: '0.7rem', color: '#64748B', fontWeight: '700' }}>{trendRange === '12m' ? 'Last 12 Months' : 'Monthly Expenses'}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.8rem', height: 190, padding: '0.25rem 0.35rem 0.4rem', borderBottom: '1px solid #E5E7EB' }}>
                {filteredTrend.length === 0
                  ? <p style={{ margin: 0, fontSize: '0.78rem', color: '#9CA3AF' }}>No trend data for selected year.</p>
                  : filteredTrend.map((row, index) => {
                    const amount = Number(row.amount || 0)
                    const height = Math.max((amount / maxTrend) * 135, amount > 0 ? 8 : 3)
                    const rowMonthIndex = row.monthIndex ?? -1
                    const active = selectedMonthIndex >= 0
                      ? rowMonthIndex === selectedMonthIndex
                      : index === filteredTrend.length - 1
                    return (
                      <div key={row.key || `${row.label}-${index}`} style={{ flex: 1, minWidth: 42, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', gap: '0.35rem' }}>
                        <span style={{ color: active ? '#111827' : '#334155', fontSize: '0.7rem', fontWeight: '900' }}>{fmtCompactCurrency(amount)}</span>
                        <div style={{ width: '42%', minWidth: 16, maxWidth: 28, height, borderRadius: '999px 999px 0 0', background: active ? '#059669' : '#C7F0DC' }} />
                        <span style={{ color: '#64748B', fontSize: '0.66rem', whiteSpace: 'nowrap' }}>{row.label || row.month}</span>
                      </div>
                    )
                  })}
              </div>
            </section>
          </div>

          {!token ? (
            <p style={{ fontSize: '0.85rem', color: '#9CA3AF', textAlign: 'center', padding: '1rem 0' }}>Sign in to load expense register.</p>
          ) : (
            <ExpenseRegisterSection
              items={registerItems}
              total={registerTotal}
              loading={registerLoading}
              error={registerError}
              paymentFilter={paymentFilter}
              onPaymentFilterChange={setPaymentFilter}
              categoryFilter={categoryFilter}
              onCategoryFilterChange={setCategoryFilter}
              categoryOptions={categoryOptions}
              startDate={registerStartDate}
              onStartDateChange={setRegisterStartDate}
              endDate={registerEndDate}
              onEndDateChange={setRegisterEndDate}
              yearFilter={yearFilter}
              monthFilter={monthFilter}
              yearOptions={yearOptions}
              onYearFilterChange={setYearFilter}
              onMonthFilterChange={setMonthFilter}
              showMonthFilter
              showExport={Boolean(token)}
              onDownloadMonthlyReports={handleDownloadMonthlyReports}
              exportBusy={exportBusy}
              onOpenLedgerEntry={onOpenLedgerEntry}
              scrollMaxHeight="50vh"
              onAfterLedgerOpen={onClose}
              style={{ marginBottom: '1rem' }}
            />
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(140px, 1fr))', border: '1px solid #E5E7EB', borderRadius: '0.65rem', overflow: 'hidden', background: '#FFFFFF' }}>
            {[
              ['Total Expenses', fmtDollar(currentTotal), `${deltaPct <= 0 ? 'down' : 'up'} ${Math.abs(deltaPct).toFixed(1)}% vs last month`, deltaColor],
              ['Last Month', fmtDollar(lastMonthTotal), 'Previous period', '#111827'],
              ['This Year (YTD)', fmtDollar(ytdTotal), 'Year filter total', '#059669'],
              ['Total Transactions', registerTotal > 0 ? registerTotal.toLocaleString() : txCount.toLocaleString(), `Avg ${fmtDollar(registerAvg)}`, '#111827'],
            ].map(([label, value, sub, color], index) => (
              <div key={label} style={{ padding: '0.95rem 1rem', borderLeft: index === 0 ? 'none' : '1px solid #E5E7EB' }}>
                <p style={{ margin: 0, color: '#64748B', fontSize: '0.73rem', fontWeight: '700' }}>{label}</p>
                <p style={{ margin: '0.35rem 0 0', color, fontSize: '1rem', fontWeight: '900' }}>{value}</p>
                <p style={{ margin: '0.28rem 0 0', color: '#64748B', fontSize: '0.7rem' }}>{sub}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
