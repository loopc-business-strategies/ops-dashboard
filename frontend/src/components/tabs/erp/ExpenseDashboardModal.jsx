import React, { useState } from 'react'
import ExpenseRegisterSection from './ExpenseRegisterSection'
import ExpenseChartsPanel from './ExpenseChartsPanel'
import ExpenseStatsFooter from './ExpenseStatsFooter'
import { useExpenseRegister } from './useExpenseRegister'
import {
  EXPENSE_MONTH_OPTIONS,
  buildYearOptions,
} from './expenseMonthFilterUtils'
import { useExpensePeriodFilter } from './useExpensePeriodFilter'
import { useExpenseRegisterExports } from './useExpenseRegisterExports'
import { useExpenseChartData } from './useExpenseChartData'
import { useExpenseFooterStats } from './useExpenseFooterStats'

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
  } = useExpensePeriodFilter({ defaultMonth: '' })

  const exp = dashboard?.expenses || {}
  const monthlyTrend = exp?.monthlyTrend || []
  const yearOptions = buildYearOptions(monthlyTrend, yearFilter)

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
    segments,
    displayTotal,
    filteredTrend,
    maxTrend,
    peakMonthIndex,
    selectedMonthIndex,
    subLabel,
    trendRangeLabel,
    registerReady,
  } = useExpenseChartData({
    dashboard,
    registerItems,
    registerLoading,
    token,
    yearFilter,
    monthFilter,
    trendRange,
  })

  const footerStats = useExpenseFooterStats({
    dashboard,
    registerItems,
    registerTotal,
    registerReady,
    filteredTrend,
    monthFilter,
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
  })

  const categoryOptions = registerCategories.length > 0
    ? registerCategories
    : [...new Set((exp.recent || []).map((row) => row.category).filter(Boolean))]

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
          <ExpenseChartsPanel
            segments={segments}
            displayTotal={displayTotal}
            subLabel={subLabel}
            filteredTrend={filteredTrend}
            maxTrend={maxTrend}
            peakMonthIndex={peakMonthIndex}
            selectedMonthIndex={selectedMonthIndex}
            trendRangeLabel={trendRangeLabel}
            style={{ marginBottom: '1rem' }}
          />

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

          <ExpenseStatsFooter {...footerStats} />
        </div>
      </div>
    </div>
  )
}
