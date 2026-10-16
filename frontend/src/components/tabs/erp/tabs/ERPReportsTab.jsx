import { useEffect, useState } from 'react'
import CurrencyStatementTable, { currencyRowMetaMap } from '../CurrencyStatementTable'
import { buildCurrencyBalanceSheetModel, buildCurrencyProfitLossModel, buildCurrencyTrialBalanceModel } from '../currencyTrialBalanceExport'
import { trialBalanceRowsForView } from '../trialBalanceReportRows'
import { filterActiveAccounts } from '../accountDropdownHelpers'
import {
  buildReportYearOptions,
  expenseMonthDateRange,
  REPORT_MONTH_OPTIONS,
} from '../expenseMonthFilterUtils'
import {
  convertReportUsd,
  defaultReportDisplayOptions,
  reportDisplayPerUsd,
  reportMoneyHeaderLabels,
  reportSelectableCurrencies,
  reportMoneyColumns,
  buildClosingStockTrialRow,
  filterTrialRowsByGroup,
  formatReportGrams,
  trialMoneyHeaders,
} from '../reportDisplayOptions'
import { currenciesApi } from '../../../../api/erp-accounting/currencies'
import { reportsApi } from '../../../../api/erp-accounting/reports'
import { buildErpReportDateRange } from '../useErpReportsController'

export default function ERPReportsTab({
  activeTab,
  C,
  modalInputStyle,
  reportFilters,
  setReportFilters,
  ACCOUNT_TYPES,
  LEDGER_REFERENCE_TYPES,
  handleExportReportCsv,
  handleExportReportXlsx,
  handleExportReportPdf,
  reportPdfDownloadEnabled = false,
  handlePrintCurrentReport,
  emptyCardStyle,
  reports,
  reportView,
  setReportView,
  getReportPeriodLabel,
  formatDirectionalBalance: formatDirectionalBalanceBase,
  handleTrialAccountDrilldown,
  formatMoney: formatMoneyBase,
  handleReportAccountDrilldown,
  formatMoneyAbs: formatMoneyAbsBase,
  selectedReportAccountId,
  setSelectedReportAccountId,
  accounts,
  setSelectedReportAccountCode,
  selectedReportAccountCode,
  ledgerReportRows,
  loading,
  voucherSource,
  setVoucherSource,
  modalBackdropStyle,
  modalCardStyle,
  voucherSourceLoading,
  handleOpenVoucherSource,
  handleJumpToTransaction,
  baseCurrencyCode = 'USD',
  currencies = [],
}) {
  const [reportOptionsOpen, setReportOptionsOpen] = useState(false)
  const [reportDisplay, setReportDisplay] = useState(() => defaultReportDisplayOptions(baseCurrencyCode))
  const [reportDisplayDraft, setReportDisplayDraft] = useState(() => defaultReportDisplayOptions(baseCurrencyCode))
  const [loadedCurrencies, setLoadedCurrencies] = useState(currencies)
  const [closingStockFallback, setClosingStockFallback] = useState(null)
  const {
    period: reportPeriod,
    startDate: reportStartDate,
    endDate: reportEndDate,
    reportYear,
    reportMonth,
  } = reportFilters || {}
  useEffect(() => {
    if (currencies?.length) {
      setLoadedCurrencies(currencies)
      return undefined
    }
    let cancelled = false
    currenciesApi.getCurrencies().then((data) => {
      if (cancelled) return
      const list = data?.currencies || (Array.isArray(data) ? data : [])
      if (list.length) setLoadedCurrencies(list)
    }).catch(() => {})
    return () => { cancelled = true }
  }, [currencies])
  useEffect(() => {
    const apiRow = (reports.trialBalance?.trialBalance || []).some((row) => row.unposted)
    if (!reportDisplay.calculateClosingStock || apiRow) {
      setClosingStockFallback(null)
      return undefined
    }
    let cancelled = false
    const { commonRange } = buildErpReportDateRange({
      period: reportPeriod,
      startDate: reportStartDate,
      endDate: reportEndDate,
      reportYear,
      reportMonth,
    })
    reportsApi.getProfitLossReport(null, {
      ...commonRange,
      includeZero: 'false',
      comparePrevious: 'false',
    }).then((data) => {
      if (cancelled) return
      setClosingStockFallback(data?.metalPositionRevaluation || { omitted: true, reason: data?.period ? 'past-period' : 'unavailable' })
    }).catch(() => {
      if (!cancelled) setClosingStockFallback({ omitted: true, reason: 'unavailable' })
    })
    return () => { cancelled = true }
  }, [
    reportDisplay.calculateClosingStock,
    reports.trialBalance,
    reportPeriod,
    reportStartDate,
    reportEndDate,
    reportYear,
    reportMonth,
  ])
  const requestedCurrency = String(reportDisplay.displayCurrency || baseCurrencyCode).toUpperCase()
  const currencyChoices = reportSelectableCurrencies(loadedCurrencies, baseCurrencyCode)
  const displayCurrency = currencyChoices.includes(requestedCurrency) ? requestedCurrency : (currencyChoices[0] || requestedCurrency)
  const convertAmount = (value) => convertReportUsd(value, displayCurrency, loadedCurrencies, baseCurrencyCode)
  const formatMoney = (value, currencyCode) => formatMoneyBase(convertAmount(value), currencyCode || displayCurrency)
  const formatMoneyAbs = (value, currencyCode) => formatMoneyAbsBase(Math.abs(Number(convertAmount(value) || 0)), currencyCode || displayCurrency)
  const formatDirectionalBalance = (value, options = {}) => formatDirectionalBalanceBase(convertAmount(value), {
    ...options,
    currencyCode: options.currencyCode || displayCurrency,
  })
  const moneyColumns = reportMoneyColumns(reportDisplay)
  const perUsd = reportDisplayPerUsd(displayCurrency, loadedCurrencies, baseCurrencyCode)
  const moneyHeaderLabels = reportMoneyHeaderLabels(displayCurrency)
  const apiHasClosingStock = (reports.trialBalance?.trialBalance || []).some((row) => row.unposted)
  const closingStockSource = apiHasClosingStock
    ? reports.trialBalance?.closingStock
    : closingStockFallback
  const closingStockRow = reportDisplay.calculateClosingStock && !apiHasClosingStock
    ? buildClosingStockTrialRow(closingStockSource)
    : null
  const trialSourceRows = filterTrialRowsByGroup(
    closingStockRow
      ? [...(reports.trialBalance?.trialBalance || []), closingStockRow]
      : (reports.trialBalance?.trialBalance || []),
    reportDisplay.selectedGroup,
  )
  const reportsForExport = (closingStockRow || reportDisplay.selectedGroup)
    ? {
      ...reports,
      trialBalance: {
        ...reports.trialBalance,
        trialBalance: trialSourceRows,
        closingStock: closingStockSource,
      },
    }
    : reports
  const reportExportDisplay = {
    formatMoney,
    formatMoneyAbs,
    formatReportDirectionalBalance: (row, fallbackDirection = '') => formatDirectionalBalance(row?.balance, {
      preferredDirection: row?.direction || fallbackDirection,
    }),
    columns: { ...moneyColumns, showMetal: reportDisplay.showMetal !== false },
    convertAmount,
    displayCurrency,
    suppressSummary: reportDisplay.suppressSummary,
    reports: reportsForExport,
    period: buildErpReportDateRange({
      period: reportPeriod,
      startDate: reportStartDate,
      endDate: reportEndDate,
      reportYear,
      reportMonth,
    }),
  }
  const activeAccounts = filterActiveAccounts(accounts)
  const INCLUDE_ZERO_REPORT_VIEWS = new Set(['trial', 'pnl', 'balanceSheet'])
  const TRIAL_BALANCE_UI_ROW_CAP = 500
  const DAY_BOOK_UI_ROW_CAP = 600
  const formatGrams = (value) => `${Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 3 })} g`
  const formatRateTime = (value) => (value ? new Date(value).toLocaleString('en-GB', { dateStyle: 'short', timeStyle: 'short' }) : '—')
  const formatValuationPriceSource = ({ priceSource, rateUpdatedAt, feedUpdatedAt } = {}) => {
    if (priceSource === 'market') return `Price: market price — MT4 feed offline since ${formatRateTime(feedUpdatedAt)}`
    if (priceSource === 'mt4-stale') return `Price: last MT4 rate from ${formatRateTime(rateUpdatedAt)} — MT4 offline and no market price available`
    if (priceSource === 'mt4') return `Price: MT4 live (${formatRateTime(rateUpdatedAt)})`
    return `Price: saved rate (${formatRateTime(rateUpdatedAt)})`
  }

  const trialBalanceForView = trialBalanceRowsForView(reportView, trialSourceRows)
  const trialBalanceFiltered = trialBalanceForView.filter((row) => {
    const q = String(reportFilters.search || '').toLowerCase().trim()
    if (!q) return true
    return String(row.accountCode || '').toLowerCase().includes(q) || String(row.accountName || '').toLowerCase().includes(q)
  })
  const trialBalanceShown = trialBalanceFiltered.slice(0, TRIAL_BALANCE_UI_ROW_CAP)
  const trialCurrencyModel = buildCurrencyTrialBalanceModel({
    rows: trialBalanceShown,
    convert: convertAmount,
    baseCurrency: baseCurrencyCode,
    displayCurrency,
  })
  const trialMetaByKey = currencyRowMetaMap(trialBalanceShown, formatReportGrams)
  const profitLossCurrencyModel = buildCurrencyProfitLossModel({
    income: reports.profitLoss?.incomeBreakdown || [],
    expenses: reports.profitLoss?.expenseBreakdown || [],
    convert: convertAmount,
    baseCurrency: baseCurrencyCode,
    displayCurrency,
  })
  const profitLossMetaByKey = currencyRowMetaMap([
    ...(reports.profitLoss?.incomeBreakdown || []),
    ...(reports.profitLoss?.expenseBreakdown || []),
  ])
  const balanceSheetCurrencyModel = buildCurrencyBalanceSheetModel({
    assets: reports.balanceSheet?.assets || [],
    liabilities: reports.balanceSheet?.liabilities || [],
    equity: reports.balanceSheet?.equity || [],
    convert: convertAmount,
    baseCurrency: baseCurrencyCode,
    displayCurrency,
  })
  const balanceSheetMetaByKey = currencyRowMetaMap([
    ...(reports.balanceSheet?.assets || []),
    ...(reports.balanceSheet?.liabilities || []),
    ...(reports.balanceSheet?.equity || []),
  ])
  const dayBookEntries = reports.dayBook?.entries || []
  const dayBookShown = dayBookEntries.slice(0, DAY_BOOK_UI_ROW_CAP)
  const reportYearOptions = buildReportYearOptions(reportFilters.reportYear)
  const activePeriodBadgeStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '0.5rem',
    background: 'var(--brand-soft)',
    border: '1px solid var(--brand-border)',
    borderRadius: '999px',
    color: 'var(--purple)',
    fontWeight: '700',
    fontSize: '0.82rem',
    padding: '0.45rem 0.75rem',
  }

  const applyReportMonthFilters = (updates) => {
    setReportFilters((prev) => {
      const next = { ...prev, ...updates, period: 'month' }
      const { startDate, endDate } = expenseMonthDateRange(next.reportYear, next.reportMonth)
      return { ...next, startDate, endDate }
    })
  }

  const activeReportRange = buildErpReportDateRange({
    period: reportPeriod,
    startDate: reportStartDate,
    endDate: reportEndDate,
    reportYear,
    reportMonth,
  })
  const reportFilterFieldStyle = {
    ...modalInputStyle,
    width: 'auto',
    minWidth: 0,
    maxWidth: 'none',
    marginBottom: 0,
    padding: '0.12rem 0.35rem',
    fontSize: '0.72rem',
    flex: '0 1 auto',
  }
  const reportDateFieldStyle = { ...reportFilterFieldStyle, width: '6.55rem', flex: '0 0 auto' }
  const reportActionButtonStyle = {
    padding: '0.12rem 0.4rem',
    borderRadius: '0.3rem',
    fontSize: '0.72rem',
    fontWeight: '700',
    lineHeight: 1.2,
    cursor: 'pointer',
  }

  const renderActivePeriodBadge = (marginBottom = '0.7rem') => (
    <div style={{ ...activePeriodBadgeStyle, marginBottom }}>
      <span>Active Period</span>
      <span style={{ color: '#1D4ED8' }}>{getReportPeriodLabel()}</span>
    </div>
  )

  return (
    <>
      {/* REPORTS TAB */}
      {activeTab === 'reports' && (
        <div>
          <h3 style={{ margin: '0 0 0.45rem', color: C.ink, fontSize: '1.25rem', fontWeight: '700' }}>Reports (Advanced ERP)</h3>
          {displayCurrency !== String(baseCurrencyCode || 'USD').toUpperCase() && perUsd ? (
            <p style={{ margin: '0 0 0.45rem', color: C.inkSoft, fontSize: '0.84rem', fontWeight: '600' }}>
              Shown in {displayCurrency}. Books stay in {String(baseCurrencyCode || 'USD').toUpperCase()}. 1 {String(baseCurrencyCode || 'USD').toUpperCase()} = {Number(perUsd).toLocaleString(undefined, { maximumFractionDigits: 6 })} {displayCurrency}.
            </p>
          ) : null}

          <div style={{ background: C.p1, border: `1px solid ${C.p2}`, borderRadius: '0.6rem', padding: '0.55rem 0.7rem', marginBottom: '0.7rem' }}>
            <div style={{ display: 'flex', flexWrap: 'nowrap', alignItems: 'center', gap: '0.28rem', width: '100%' }}>
              <select
                value={reportFilters.period}
                onChange={(e) => {
                  const period = e.target.value
                  setReportFilters((prev) => {
                    if (period !== 'month') return { ...prev, period }
                    const { startDate, endDate } = expenseMonthDateRange(prev.reportYear, prev.reportMonth)
                    return { ...prev, period, startDate, endDate }
                  })
                }}
                style={reportFilterFieldStyle}
              >
                <option value="today">Today</option>
                <option value="month">Month</option>
                <option value="ytd">Year To Date</option>
                <option value="custom">Custom Range</option>
              </select>
              <select
                aria-label="Report currency"
                value={displayCurrency}
                onChange={(event) => {
                  const nextCurrency = event.target.value
                  setReportDisplay((prev) => ({ ...prev, displayCurrency: nextCurrency }))
                  setReportDisplayDraft((prev) => ({ ...prev, displayCurrency: nextCurrency }))
                }}
                style={reportFilterFieldStyle}
              >
                {currencyChoices.map((code) => (
                  <option key={code} value={code}>{code}</option>
                ))}
              </select>
              {reportFilters.period === 'month' && (
                <>
                  <select
                    value={reportFilters.reportYear}
                    onChange={(e) => applyReportMonthFilters({ reportYear: e.target.value })}
                    style={reportFilterFieldStyle}
                    aria-label="Report year"
                  >
                    {reportYearOptions.map((year) => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                  <select
                    value={reportFilters.reportMonth}
                    onChange={(e) => applyReportMonthFilters({ reportMonth: e.target.value })}
                    style={reportFilterFieldStyle}
                    aria-label="Report month"
                  >
                    {REPORT_MONTH_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </>
              )}
              <input type="date" aria-label="From date" value={reportFilters.period === 'custom' ? reportFilters.startDate : (activeReportRange.startDate || '')} onChange={(e) => setReportFilters((prev) => ({ ...prev, startDate: e.target.value, period: 'custom' }))} style={reportDateFieldStyle} />
              <input type="date" aria-label="To date" value={reportFilters.period === 'custom' ? reportFilters.endDate : (activeReportRange.endDate || '')} onChange={(e) => setReportFilters((prev) => ({ ...prev, endDate: e.target.value, period: 'custom' }))} style={reportDateFieldStyle} />
              <select value={reportFilters.accountType} onChange={(e) => setReportFilters((prev) => ({ ...prev, accountType: e.target.value }))} style={reportFilterFieldStyle}>
                <option value="">All types</option>
                {ACCOUNT_TYPES.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              <select value={reportFilters.sortBy} onChange={(e) => setReportFilters((prev) => ({ ...prev, sortBy: e.target.value }))} style={reportFilterFieldStyle}>
                <option value="accountCode">Code</option>
                <option value="accountName">Name</option>
                <option value="debit">Debit</option>
                <option value="credit">Credit</option>
                <option value="net">Net</option>
              </select>
              <select value={reportFilters.sortDir} onChange={(e) => setReportFilters((prev) => ({ ...prev, sortDir: e.target.value }))} style={reportFilterFieldStyle}>
                <option value="asc">Asc</option>
                <option value="desc">Desc</option>
              </select>
              {reportView === 'dayBook' && (
                <>
                  <select value={reportFilters.referenceType} onChange={(e) => setReportFilters((prev) => ({ ...prev, referenceType: e.target.value }))} style={reportFilterFieldStyle}>
                    <option value="">All Day Book Types</option>
                    {LEDGER_REFERENCE_TYPES.map((type) => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                  <input type="number" placeholder="Day Book Min Amount" value={reportFilters.minAmount} onChange={(e) => setReportFilters((prev) => ({ ...prev, minAmount: e.target.value }))} style={reportFilterFieldStyle} />
                </>
              )}
              {INCLUDE_ZERO_REPORT_VIEWS.has(reportView) && (
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.22rem', color: C.ink, fontSize: '0.72rem', fontWeight: '600', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  <input type="checkbox" checked={reportFilters.includeZeroAccounts} onChange={(e) => setReportFilters((prev) => ({ ...prev, includeZeroAccounts: e.target.checked }))} />
                  Zero balances
                </label>
              )}
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.22rem', color: C.ink, fontSize: '0.72rem', fontWeight: '600', whiteSpace: 'nowrap', flexShrink: 0 }}>
                <input type="checkbox" checked={reportFilters.comparePrevious} onChange={(e) => setReportFilters((prev) => ({ ...prev, comparePrevious: e.target.checked }))} />
                Compare previous
              </label>
              <div style={{ display: 'flex', gap: '0.35rem', flexShrink: 0, marginLeft: 'auto' }}>
                <button onClick={() => handleExportReportCsv(reportExportDisplay)} style={{ ...reportActionButtonStyle, border: '1px solid #10B981', background: '#ECFDF5', color: '#065F46' }}>CSV</button>
                <button onClick={() => handleExportReportXlsx(reportExportDisplay)} style={{ ...reportActionButtonStyle, border: '1px solid #047857', background: '#ECFDF5', color: '#064E3B' }}>XLSX</button>
                {reportPdfDownloadEnabled && (
                  <button onClick={() => handleExportReportPdf(reportExportDisplay)} style={{ ...reportActionButtonStyle, border: '1px solid #047857', background: '#ECFDF5', color: '#064E3B' }}>Download PDF</button>
                )}
                <button onClick={() => handlePrintCurrentReport(reportExportDisplay)} style={{ ...reportActionButtonStyle, border: '1px solid var(--brand-border)', background: 'var(--brand-soft)', color: 'var(--purple)' }}>Print</button>
                <button
                  type="button"
                  onClick={() => {
                    setReportDisplayDraft(reportDisplay)
                    setReportOptionsOpen(true)
                  }}
                  style={{ ...reportActionButtonStyle, border: '1px solid #D1D5DB', background: '#FFFFFF', color: C.ink }}
                >
                  Options
                </button>
              </div>
            </div>
          </div>

          {!reportDisplay.suppressSummary && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.8rem', marginBottom: '1rem' }}>
            <div style={{ ...emptyCardStyle, borderStyle: 'solid' }}>
              <p style={{ margin: 0, fontWeight: '700' }}>Trial Balance</p>
              <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem' }}>Debit: {formatMoney(reports.trialBalance?.totalDebit || 0)}</p>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem' }}>Credit: {formatMoney(reports.trialBalance?.totalCredit || 0)}</p>
              <p style={{ margin: '0.2rem 0 0', color: reports.trialBalance?.balanced ? C.s1 : C.danger, fontWeight: '700', fontSize: '0.82rem' }}>{reports.trialBalance?.balanced ? 'Balanced' : 'Difference Found'}</p>
              {!reports.trialBalance?.balanced && reports.trialBalance?.difference != null && (
                <p style={{ margin: '0.15rem 0 0', fontSize: '0.78rem', color: C.danger, fontWeight: '600' }}>
                  Difference: {formatMoney(reports.trialBalance.difference)}
                </p>
              )}
              {String(reportFilters.search || '').trim() ? (
                <p style={{ margin: '0.45rem 0 0', fontSize: '0.76rem', color: C.inkSoft, fontWeight: '600', lineHeight: 1.35 }}>
                  Table below is filtered by search; debit/credit totals above are for the full report (same period and filters as the API).
                </p>
              ) : null}
            </div>
            <div style={{ ...emptyCardStyle, borderStyle: 'solid' }}>
              <p style={{ margin: 0, fontWeight: '700' }}>Profit & Loss</p>
              <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem' }}>Income: {formatMoney(reports.profitLoss?.totalIncome || 0)}</p>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem' }}>Expense: {formatMoney(reports.profitLoss?.totalExpense || 0)}</p>
              <p style={{ margin: '0.2rem 0 0', fontWeight: '700', color: Number(reports.profitLoss?.netProfit || 0) >= 0 ? C.s1 : C.danger, fontSize: '0.82rem' }}>Net: {formatMoney(reports.profitLoss?.netProfit || 0)}</p>
              {reports.profitLoss?.metalPositionRevaluation && (
                <p style={{ margin: '0.2rem 0 0', fontSize: '0.78rem', color: C.inkSoft }}>Incl. open metal at live price: {formatMoney(reports.profitLoss.netProfitWithMetalRevaluation)}</p>
              )}
            </div>
            <div style={{ ...emptyCardStyle, borderStyle: 'solid' }}>
              <p style={{ margin: 0, fontWeight: '700' }}>Balance Sheet</p>
              <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem' }}>Assets: {formatMoneyAbs(reports.balanceSheet?.totalAssets || 0)}</p>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem' }}>L+E: {formatMoneyAbs(reports.balanceSheet?.liabilitiesPlusEquity || 0)}</p>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem' }}>Current Ratio: {reports.balanceSheet?.currentRatio ?? '-'}</p>
            </div>
            <div style={{ ...emptyCardStyle, borderStyle: 'solid' }}>
              <p style={{ margin: 0, fontWeight: '700' }}>Forex Impact</p>
              <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem' }}>Entries: {Number(reports.forex?.entriesCount || 0).toLocaleString()}</p>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem' }}>Impact: {formatMoney(reports.forex?.forexImpact || 0)}</p>
            </div>
          </div>
          )}

          <div style={{ overflowX: 'auto', marginBottom: '1rem', WebkitOverflowScrolling: 'touch' }}>
            <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'nowrap', minWidth: 'min-content', paddingBottom: '2px' }}>
            {[
              ['summary', 'Summary'],
              ['trial', 'Trial Balance'],
              ['pnl', 'Profit & Loss'],
              ['balanceSheet', 'Balance Sheet'],
              ['dayBook', 'Day Book'],
              ['outstanding', 'Outstanding'],
              ['forex', 'Forex'],
              ['ledger', 'Ledger Drilldown'],
            ].map(([id, label]) => (
              <button
                key={id}
                onClick={() => setReportView(id)}
                style={{
                  padding: '0.45rem 0.75rem',
                  borderRadius: '0.35rem',
                  border: reportView === id ? 'none' : '1px solid #D1D5DB',
                  background: reportView === id ? C.s1 : '#FFFFFF',
                  color: reportView === id ? '#fff' : C.ink,
                  fontWeight: '600',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                {label}
              </button>
            ))}
            </div>
          </div>

          {(reportView === 'summary' || reportView === 'trial') && (
            <div style={{ background: C.p1, border: `1px solid ${C.p2}`, borderRadius: '0.5rem', padding: '0.9rem', marginBottom: '1rem' }}>
              {renderActivePeriodBadge()}
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                <div>
                  <p style={{ margin: 0, fontWeight: '700', color: C.ink }}>{reportView === 'summary' ? 'Summary' : 'Trial Balance'}</p>
                  {reportView === 'summary' && (
                    <p style={{ margin: '0.35rem 0 0', fontSize: '0.82rem', color: C.inkSoft, fontWeight: '600', maxWidth: '520px' }}>
                      Accounts with a non-zero balance or movement in this period. Use Trial Balance for the full chart including zero-balance lines.
                    </p>
                  )}
                  {reportDisplay.selectedGroup ? (
                    <p style={{ margin: '0.35rem 0 0', fontSize: '0.82rem', color: C.inkSoft }}>
                      Showing {reportDisplay.selectedGroup} accounts only.
                    </p>
                  ) : null}
                </div>
                <input placeholder="Search account code/name" value={reportFilters.search} onChange={(e) => setReportFilters((prev) => ({ ...prev, search: e.target.value }))} style={{ ...modalInputStyle, marginBottom: 0, width: '260px' }} />
              </div>
              {trialBalanceFiltered.length > TRIAL_BALANCE_UI_ROW_CAP && (
                <p style={{ margin: '0 0 0.5rem', color: C.inkSoft, fontSize: '0.82rem' }}>
                  Showing first {TRIAL_BALANCE_UI_ROW_CAP} of {trialBalanceFiltered.length} matching rows (UI cap). Narrow search or export for the full set.
                </p>
              )}
              <div className="erp-table-wrap" style={{ overflowX: 'auto', borderRadius: '0.45rem' }}>
                {reportView === 'trial' ? (
                  <CurrencyStatementTable
                    model={trialCurrencyModel}
                    moneyColumns={moneyColumns}
                    showMetal={reportDisplay.showMetal !== false}
                    metaByKey={trialMetaByKey}
                    onOpenAccount={(row) => handleTrialAccountDrilldown(row.accountCode)}
                  />
                ) : (
                <table className="erp-table">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Name</th>
                      <th>Type</th>
                      {trialMoneyHeaders(moneyColumns, moneyHeaderLabels).map((label) => (
                        <th key={label} className="num">{label}</th>
                      ))}
                      {reportDisplay.showMetal !== false && (
                        <>
                          <th className="num">Gold g</th>
                          <th className="num">Silver g</th>
                        </>
                      )}
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trialBalanceShown.map((row) => (
                        <tr key={row.unposted ? 'closing-stock' : `${row.accountCode}-${row.accountType}`} style={{ borderBottom: `1px solid ${C.p2}` }}>
                          <td style={{ padding: '0.6rem', fontWeight: '700' }}>{row.accountCode}</td>
                          <td style={{ padding: '0.6rem' }}>
                            {row.accountName}
                            {row.isActive === false ? <span style={{ marginLeft: '0.35rem', color: C.inkSoft, fontSize: '0.75rem' }}>Closed</span> : null}
                          </td>
                          <td style={{ padding: '0.6rem' }}>{row.accountType}</td>
                          {moneyColumns.debit && <td style={{ padding: '0.6rem', textAlign: 'right' }}>{row.unposted ? '' : formatMoney(row.debit || 0)}</td>}
                          {moneyColumns.credit && <td style={{ padding: '0.6rem', textAlign: 'right' }}>{row.unposted ? '' : formatMoney(row.credit || 0)}</td>}
                          {moneyColumns.net && (
                            <td style={{ padding: '0.6rem', textAlign: 'right', color: Number(row.net || 0) >= 0 ? C.s1 : C.danger, fontWeight: '700' }}>
                              {formatDirectionalBalance(row.net)}
                            </td>
                          )}
                          {reportDisplay.showMetal !== false && (
                            <>
                              <td style={{ padding: '0.6rem', textAlign: 'right' }}>{formatReportGrams(row.goldNet)}</td>
                              <td style={{ padding: '0.6rem', textAlign: 'right' }}>{formatReportGrams(row.silverNet)}</td>
                            </>
                          )}
                          <td style={{ padding: '0.6rem' }}>
                            {row.unposted ? (
                              <span style={{ color: C.inkSoft, fontSize: '0.78rem' }}>Not posted</span>
                            ) : (
                              <button onClick={() => handleTrialAccountDrilldown(row.accountCode)} style={{ padding: '0.3rem 0.5rem', borderRadius: '0.3rem', border: '1px solid #0EA5E9', color: '#0C4A6E', background: '#E0F2FE', cursor: 'pointer' }}>
                                Ledger
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                )}
              </div>
              {reportDisplay.calculateClosingStock && (
                <p style={{ margin: '0.55rem 0 0', fontSize: '0.78rem', color: C.inkSoft, lineHeight: 1.35 }}>
                  {closingStockSource?.omitted
                    ? 'Closing stock uses today\'s live price, so a period that has already ended stays on the posted books.'
                    : `Closing stock is the open metal position at today's live price. Book value already in the trial: ${formatMoney(closingStockSource?.inventoryBookValue || 0)}. Revaluation ${formatMoney(closingStockSource?.adjustment || 0)} is not posted and is left out of the trial debit and credit totals.`}
                  {closingStockSource && !closingStockSource.omitted ? ` ${formatValuationPriceSource(closingStockSource)}` : ''}
                </p>
              )}
            </div>
          )}

          {reportView === 'pnl' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div style={{ gridColumn: '1 / -1' }}>
                {renderActivePeriodBadge('0')}
              </div>
              <div style={{ gridColumn: '1 / -1', background: C.p1, border: `1px solid ${C.p2}`, borderRadius: '0.5rem', padding: '0.9rem' }}>
                <p style={{ margin: '0 0 0.5rem', fontWeight: '700' }}>Profit & Loss</p>
                <div style={{ overflowX: 'auto' }}>
                  <CurrencyStatementTable
                    model={profitLossCurrencyModel}
                    moneyColumns={moneyColumns}
                    metaByKey={profitLossMetaByKey}
                    actionLabel="Vouchers"
                    onOpenAccount={(row) => handleReportAccountDrilldown(row.accountId, row.accountCode)}
                  />
                </div>
                {reports.profitLoss?.previousPeriod ? (
                  <p style={{ margin: '0.75rem 0 0', fontWeight: '600', color: C.inkSoft }}>Variance vs previous: {formatMoney(reports.profitLoss?.varianceVsPrevious || 0)}</p>
                ) : null}
                {reports.profitLoss?.metalPositionRevaluation && (
                  <div style={{ marginTop: '0.75rem', borderTop: `1px solid ${C.p2}`, paddingTop: '0.6rem', fontSize: '0.84rem' }}>
                    <p style={{ margin: '0 0 0.3rem', fontWeight: '700' }}>Open metal position at live price (not posted)</p>
                    <p style={{ margin: '0 0 0.3rem', fontSize: '0.78rem', color: ['market', 'mt4-stale'].includes(reports.profitLoss.metalPositionRevaluation.priceSource) ? C.danger : C.inkSoft }}>
                      {formatValuationPriceSource(reports.profitLoss.metalPositionRevaluation)}
                    </p>
                    {reports.profitLoss.metalPositionRevaluation.metals
                      .filter((row) => row.stockGrams || row.owedGrams)
                      .map((row) => (
                        <p key={row.metal} style={{ margin: '0.15rem 0', color: C.inkSoft }}>
                          {row.metal === 'gold' ? 'Gold' : 'Silver'}: stock {formatGrams(row.stockGrams)} − owed to parties {formatGrams(row.owedGrams)} = {formatGrams(row.netGrams)} at {formatMoney(row.pricePerGram)}/g = {formatMoney(row.marketValue)}
                        </p>
                      ))}
                    <p style={{ margin: '0.15rem 0', color: C.inkSoft }}>Less metal inventory at book value: {formatMoney(reports.profitLoss.metalPositionRevaluation.inventoryBookValue)}</p>
                    <p style={{ margin: '0.2rem 0', fontWeight: '700' }}>Revaluation: {formatMoney(reports.profitLoss.metalPositionRevaluation.adjustment)}</p>
                    <p style={{ margin: '0.2rem 0', fontWeight: '800', color: Number(reports.profitLoss.netProfitWithMetalRevaluation || 0) >= 0 ? C.s1 : C.danger }}>
                      Net Profit incl. open metal position: {formatMoney(reports.profitLoss.netProfitWithMetalRevaluation)}
                    </p>
                    <p style={{ margin: '0.3rem 0 0', fontSize: '0.76rem', color: C.inkSoft, lineHeight: 1.35 }}>
                      Covers all open metal to date, not just this period. Fixing deals book their full value as income/expense, so this values the metal still owed or held at today&apos;s price.
                    </p>
                  </div>
                )}
              </div>
              <div style={{ gridColumn: '1 / -1', background: C.p1, border: `1px solid ${C.p2}`, borderRadius: '0.5rem', padding: '0.9rem' }}>
                <p style={{ margin: 0, fontWeight: '700', marginBottom: '0.35rem' }}>Purchases and sales</p>
                <p style={{ margin: '0 0 0.6rem', fontSize: '0.76rem', color: C.inkSoft, lineHeight: 1.35 }}>
                  Every posted purchase and sale in this period. Sales are included in Sales Revenue. Purchases are included in Cost Of Goods Sold.
                </p>
                <div style={{ overflowX: 'auto', maxHeight: '320px', overflowY: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${C.p2}` }}>
                        <th style={{ padding: '0.55rem', textAlign: 'left' }}>Type</th>
                        <th style={{ padding: '0.55rem', textAlign: 'left' }}>Doc No</th>
                        <th style={{ padding: '0.55rem', textAlign: 'left' }}>Date</th>
                        <th style={{ padding: '0.55rem', textAlign: 'left' }}>Party</th>
                        <th style={{ padding: '0.55rem', textAlign: 'right' }}>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(reports.profitLoss?.metalVouchers?.vouchers || []).map((row) => (
                        <tr key={row.id} style={{ borderBottom: `1px solid ${C.p2}` }}>
                          <td style={{ padding: '0.55rem' }}>{row.type === 'sale' ? 'Sale' : 'Purchase'}</td>
                          <td style={{ padding: '0.55rem' }}>{row.vocNo}</td>
                          <td style={{ padding: '0.55rem' }}>{row.date ? String(row.date).slice(0, 10) : ''}</td>
                          <td style={{ padding: '0.55rem' }}>{[row.partyCode, row.partyName].filter(Boolean).join(' ')}</td>
                          <td style={{ padding: '0.55rem', textAlign: 'right' }}>{formatMoney(row.amount || 0)}</td>
                        </tr>
                      ))}
                      {(reports.profitLoss?.metalVouchers?.vouchers || []).length === 0 && (
                        <tr><td colSpan={5} style={{ padding: '0.7rem', color: C.inkSoft }}>No posted purchases or sales in this period.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <p style={{ margin: '0.6rem 0 0.15rem', fontWeight: '700' }}>Total sales: {formatMoney(reports.profitLoss?.metalVouchers?.totalSales || 0)}</p>
                <p style={{ margin: '0.15rem 0 0', fontWeight: '700' }}>Total purchases: {formatMoney(reports.profitLoss?.metalVouchers?.totalPurchases || 0)}</p>
              </div>
              <div style={{ gridColumn: '1 / -1', background: C.p1, border: `1px solid ${C.p2}`, borderRadius: '0.5rem', padding: '0.9rem' }}>
                <p style={{ margin: 0, fontWeight: '700', marginBottom: '0.6rem' }}>Monthly Comparison</p>
                <div style={{ overflowX: 'auto', marginBottom: '0.9rem' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead><tr style={{ borderBottom: `1px solid ${C.p2}` }}><th style={{ padding: '0.5rem', textAlign: 'left' }}>Month</th><th style={{ padding: '0.5rem', textAlign: 'right' }}>Income</th><th style={{ padding: '0.5rem', textAlign: 'right' }}>Expense</th><th style={{ padding: '0.5rem', textAlign: 'right' }}>Net Profit</th></tr></thead>
                    <tbody>{(reports.profitLoss?.monthlyComparison || []).map((row) => <tr key={row.label} style={{ borderBottom: `1px solid ${C.p2}` }}><td style={{ padding: '0.5rem' }}>{row.label}</td><td style={{ padding: '0.5rem', textAlign: 'right' }}>{formatMoney(row.totalIncome)}</td><td style={{ padding: '0.5rem', textAlign: 'right' }}>{formatMoney(row.totalExpense)}</td><td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '700' }}>{formatMoney(row.netProfit)}</td></tr>)}</tbody>
                  </table>
                </div>
                <p style={{ margin: 0, fontWeight: '700', marginBottom: '0.6rem' }}>Quarterly Comparison</p>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead><tr style={{ borderBottom: `1px solid ${C.p2}` }}><th style={{ padding: '0.5rem', textAlign: 'left' }}>Quarter</th><th style={{ padding: '0.5rem', textAlign: 'right' }}>Income</th><th style={{ padding: '0.5rem', textAlign: 'right' }}>Expense</th><th style={{ padding: '0.5rem', textAlign: 'right' }}>Net Profit</th></tr></thead>
                    <tbody>{(reports.profitLoss?.quarterlyComparison || []).map((row) => <tr key={row.label} style={{ borderBottom: `1px solid ${C.p2}` }}><td style={{ padding: '0.5rem' }}>{row.label}</td><td style={{ padding: '0.5rem', textAlign: 'right' }}>{formatMoney(row.totalIncome)}</td><td style={{ padding: '0.5rem', textAlign: 'right' }}>{formatMoney(row.totalExpense)}</td><td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '700' }}>{formatMoney(row.netProfit)}</td></tr>)}</tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {reportView === 'balanceSheet' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '1rem' }}>
              <div style={{ gridColumn: '1 / -1' }}>
                {renderActivePeriodBadge('0')}
              </div>
              <div style={{ gridColumn: '1 / -1', background: C.p1, border: `1px solid ${C.p2}`, borderRadius: '0.5rem', padding: '0.9rem' }}>
                <div style={{ overflowX: 'auto' }}>
                  <CurrencyStatementTable
                    model={balanceSheetCurrencyModel}
                    moneyColumns={moneyColumns}
                    metaByKey={balanceSheetMetaByKey}
                    actionLabel="Vouchers"
                    onOpenAccount={(row) => handleReportAccountDrilldown(row.accountId, row.accountCode)}
                  />
                </div>
              </div>
              <div style={{ gridColumn: '1 / -1', background: C.p1, border: `1px solid ${C.p2}`, borderRadius: '0.5rem', padding: '0.9rem' }}>
                <p style={{ margin: '0.15rem 0', fontWeight: '700' }}>Assets: {formatMoneyAbs(reports.balanceSheet?.totalAssets || 0)}</p>
                <p style={{ margin: '0.15rem 0', fontWeight: '700' }}>Liabilities + Equity: {formatMoneyAbs(reports.balanceSheet?.liabilitiesPlusEquity || 0)}</p>
                <p style={{ margin: '0.15rem 0', color: Math.abs(Number(reports.balanceSheet?.difference || 0)) < 0.01 ? C.s1 : C.danger, fontWeight: '800' }}>Difference: {formatMoney(reports.balanceSheet?.difference || 0)}</p>
                <p style={{ margin: '0.15rem 0' }}>Working Capital: {formatMoney(reports.balanceSheet?.workingCapital || 0)}</p>
                <p style={{ margin: '0.15rem 0' }}>Current Ratio: {reports.balanceSheet?.currentRatio ?? '-'}</p>
              </div>
              <div style={{ gridColumn: '1 / -1', background: C.p1, border: `1px solid ${C.p2}`, borderRadius: '0.5rem', padding: '0.9rem' }}>
                <p style={{ margin: 0, fontWeight: '700', marginBottom: '0.6rem' }}>Monthly Comparison</p>
                <div style={{ overflowX: 'auto', marginBottom: '0.9rem' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead><tr style={{ borderBottom: `1px solid ${C.p2}` }}><th style={{ padding: '0.5rem', textAlign: 'left' }}>Month</th><th style={{ padding: '0.5rem', textAlign: 'right' }}>Assets</th><th style={{ padding: '0.5rem', textAlign: 'right' }}>Liabilities</th><th style={{ padding: '0.5rem', textAlign: 'right' }}>Equity</th><th style={{ padding: '0.5rem', textAlign: 'right' }}>Working Capital</th></tr></thead>
                    <tbody>{(reports.balanceSheet?.monthlyComparison || []).map((row) => <tr key={row.label} style={{ borderBottom: `1px solid ${C.p2}` }}><td style={{ padding: '0.5rem' }}>{row.label}</td><td style={{ padding: '0.5rem', textAlign: 'right' }}>{formatMoneyAbs(row.totalAssets)}</td><td style={{ padding: '0.5rem', textAlign: 'right' }}>{formatMoneyAbs(row.totalLiabilities)}</td><td style={{ padding: '0.5rem', textAlign: 'right' }}>{formatMoneyAbs(row.totalEquity)}</td><td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '700' }}>{formatMoney(row.workingCapital)}</td></tr>)}</tbody>
                  </table>
                </div>
                <p style={{ margin: 0, fontWeight: '700', marginBottom: '0.6rem' }}>Quarterly Comparison</p>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead><tr style={{ borderBottom: `1px solid ${C.p2}` }}><th style={{ padding: '0.5rem', textAlign: 'left' }}>Quarter</th><th style={{ padding: '0.5rem', textAlign: 'right' }}>Assets</th><th style={{ padding: '0.5rem', textAlign: 'right' }}>Liabilities</th><th style={{ padding: '0.5rem', textAlign: 'right' }}>Equity</th><th style={{ padding: '0.5rem', textAlign: 'right' }}>Working Capital</th></tr></thead>
                    <tbody>{(reports.balanceSheet?.quarterlyComparison || []).map((row) => <tr key={row.label} style={{ borderBottom: `1px solid ${C.p2}` }}><td style={{ padding: '0.5rem' }}>{row.label}</td><td style={{ padding: '0.5rem', textAlign: 'right' }}>{formatMoneyAbs(row.totalAssets)}</td><td style={{ padding: '0.5rem', textAlign: 'right' }}>{formatMoneyAbs(row.totalLiabilities)}</td><td style={{ padding: '0.5rem', textAlign: 'right' }}>{formatMoneyAbs(row.totalEquity)}</td><td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '700' }}>{formatMoney(row.workingCapital)}</td></tr>)}</tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {reportView === 'dayBook' && (
            <div style={{ background: C.p1, border: `1px solid ${C.p2}`, borderRadius: '0.5rem', padding: '0.9rem' }}>
              {renderActivePeriodBadge('0.5rem')}
              <p style={{ margin: 0, fontWeight: '700', marginBottom: '0.5rem' }}>Day Book Entries</p>
              <p style={{ margin: '0 0 0.5rem', color: C.inkSoft, fontSize: '0.84rem' }}>
                Total Entries: {reports.dayBook?.totals?.count || 0} | Debit: {formatMoney(reports.dayBook?.totals?.debit || 0)} | Credit: {formatMoney(reports.dayBook?.totals?.credit || 0)}
              </p>
              {reports.dayBook?.truncated && (
                <p style={{ margin: '0 0 0.5rem', color: '#B45309', fontSize: '0.82rem', fontWeight: 600 }}>
                  Row list truncated at {reports.dayBook?.limit || dayBookEntries.length} of {reports.dayBook?.totals?.count || dayBookEntries.length} entries.
                  Totals above are for the full set. Narrow the period or raise limit (max 5000) before treating export as complete.
                </p>
              )}
              {!reports.dayBook?.truncated && dayBookEntries.length > DAY_BOOK_UI_ROW_CAP && (
                <p style={{ margin: '0 0 0.5rem', color: C.inkSoft, fontSize: '0.82rem' }}>
                  Showing first {DAY_BOOK_UI_ROW_CAP} of {dayBookEntries.length} rows (UI cap). Export or narrow the report period for the full list.
                </p>
              )}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${C.p2}` }}>
                      <th style={{ padding: '0.5rem', textAlign: 'left' }}>Date</th>
                      <th style={{ padding: '0.5rem', textAlign: 'left' }}>Type</th>
                      <th style={{ padding: '0.5rem', textAlign: 'left' }}>Description</th>
                      <th style={{ padding: '0.5rem', textAlign: 'left' }}>Debit A/C</th>
                      <th style={{ padding: '0.5rem', textAlign: 'left' }}>Credit A/C</th>
                      <th style={{ padding: '0.5rem', textAlign: 'right' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dayBookShown.map((entry) => (
                      <tr key={entry._id} style={{ borderBottom: `1px solid ${C.p2}` }}>
                        <td style={{ padding: '0.5rem' }}>{new Date(entry.date).toLocaleString()}</td>
                        <td style={{ padding: '0.5rem', textTransform: 'capitalize' }}>{entry.referenceType}</td>
                        <td style={{ padding: '0.5rem' }}>{entry.description || '-'}</td>
                        <td style={{ padding: '0.5rem' }}>{entry.debitAccountId?.accountCode} - {entry.debitAccountId?.accountName}</td>
                        <td style={{ padding: '0.5rem' }}>{entry.creditAccountId?.accountCode} - {entry.creditAccountId?.accountName}</td>
                        <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '700' }}>{formatMoney(entry.amount || 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {reportView === 'outstanding' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
              <p style={{ margin: 0, color: C.inkSoft, fontSize: '0.84rem', fontWeight: '600' }}>
                Outstanding balances are shown as of today. Month filter applies to other reports only.
              </p>
              <div style={{ background: C.p1, border: `1px solid ${C.p2}`, borderRadius: '0.5rem', padding: '0.9rem' }}>
                <p style={{ margin: 0, fontWeight: '700', marginBottom: '0.45rem' }}>Customer Outstanding</p>
                <p style={{ margin: '0 0 0.45rem', color: C.inkSoft, fontSize: '0.84rem' }}>Total: {formatMoney(reports.customerOutstanding?.totals?.outstanding || 0)} | Limit Exceeded: {reports.customerOutstanding?.totals?.limitExceededCount || 0}</p>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead><tr style={{ borderBottom: `1px solid ${C.p2}` }}><th style={{ padding: '0.5rem', textAlign: 'left' }}>Customer</th><th style={{ padding: '0.5rem', textAlign: 'left' }}>Ledger</th><th style={{ padding: '0.5rem', textAlign: 'right' }}>Outstanding</th><th style={{ padding: '0.5rem', textAlign: 'right' }}>0-30</th><th style={{ padding: '0.5rem', textAlign: 'right' }}>31-60</th><th style={{ padding: '0.5rem', textAlign: 'right' }}>61-90</th><th style={{ padding: '0.5rem', textAlign: 'right' }}>90+</th><th style={{ padding: '0.5rem', textAlign: 'center' }}>Limit</th></tr></thead>
                    <tbody>
                      {(reports.customerOutstanding?.rows || []).map((row) => (
                        <tr key={row.customerId} style={{ borderBottom: `1px solid ${C.p2}` }}>
                          <td style={{ padding: '0.5rem' }}>{row.customerName}</td>
                          <td style={{ padding: '0.5rem' }}>{row.ledgerAccount?.accountCode || '-'}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '700' }}>{formatMoney(row.outstanding || 0)}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'right' }}>{formatMoney(row.aging?.bucket0to30 || 0)}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'right' }}>{formatMoney(row.aging?.bucket31to60 || 0)}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'right' }}>{formatMoney(row.aging?.bucket61to90 || 0)}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'right' }}>{formatMoney(row.aging?.bucket90Plus || 0)}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'center', color: row.limitExceeded ? C.danger : C.s1, fontWeight: '700' }}>{row.limitExceeded ? 'Exceeded' : 'OK'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div style={{ background: C.p1, border: `1px solid ${C.p2}`, borderRadius: '0.5rem', padding: '0.9rem' }}>
                <p style={{ margin: 0, fontWeight: '700', marginBottom: '0.45rem' }}>Vendor Outstanding</p>
                <p style={{ margin: '0 0 0.45rem', color: C.inkSoft, fontSize: '0.84rem' }}>Total: {formatMoney(reports.vendorOutstanding?.totals?.outstanding || 0)} | Credit: {formatMoney(reports.vendorOutstanding?.totals?.credit || 0)}</p>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead><tr style={{ borderBottom: `1px solid ${C.p2}` }}><th style={{ padding: '0.5rem', textAlign: 'left' }}>Vendor</th><th style={{ padding: '0.5rem', textAlign: 'left' }}>Ledger</th><th style={{ padding: '0.5rem', textAlign: 'right' }}>Outstanding</th><th style={{ padding: '0.5rem', textAlign: 'left' }}>Type</th></tr></thead>
                    <tbody>
                      {(reports.vendorOutstanding?.rows || []).map((row) => (
                        <tr key={row.vendorId} style={{ borderBottom: `1px solid ${C.p2}` }}>
                          <td style={{ padding: '0.5rem' }}>{row.vendorName}</td>
                          <td style={{ padding: '0.5rem' }}>{row.ledgerAccount?.accountCode || '-'}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '700' }}>{formatMoney(row.outstanding || 0)}</td>
                          <td style={{ padding: '0.5rem' }}>{row.outstandingType || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {reportView === 'forex' && (
            <div style={{ background: C.p1, border: `1px solid ${C.p2}`, borderRadius: '0.5rem', padding: '0.9rem' }}>
              {renderActivePeriodBadge('0.5rem')}
              <p style={{ margin: 0, fontWeight: '700', marginBottom: '0.5rem' }}>Forex Gain/Loss Analysis</p>
              <p style={{ margin: '0 0 0.6rem', color: C.inkSoft, fontSize: '0.84rem' }}>Entries: {reports.forex?.entriesCount || 0} | Total Impact: {formatMoney(reports.forex?.forexImpact || 0)}</p>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
                  <thead><tr style={{ borderBottom: `1px solid ${C.p2}` }}><th style={{ padding: '0.5rem', textAlign: 'left' }}>Currency</th><th style={{ padding: '0.5rem', textAlign: 'right' }}>Entries</th><th style={{ padding: '0.5rem', textAlign: 'right' }}>Impact</th></tr></thead>
                  <tbody>
                    {Object.entries(reports.forex?.byCurrency || {}).map(([currency, row]) => (
                      <tr key={currency} style={{ borderBottom: `1px solid ${C.p2}` }}><td style={{ padding: '0.5rem' }}>{currency}</td><td style={{ padding: '0.5rem', textAlign: 'right' }}>{Number(row.count || 0).toLocaleString()}</td><td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '700' }}>{formatMoney(row.impact || 0)}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {reportView === 'ledger' && (
            <div style={{ background: C.p1, border: `1px solid ${C.p2}`, borderRadius: '0.5rem', padding: '0.9rem' }}>
              {renderActivePeriodBadge('0.5rem')}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.6rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                <select
                  value={selectedReportAccountId}
                  onChange={(e) => {
                    const account = activeAccounts.find((acc) => acc._id === e.target.value)
                    setSelectedReportAccountId(e.target.value)
                    setSelectedReportAccountCode(account?.accountCode || '')
                  }}
                  style={{ ...modalInputStyle, marginBottom: 0 }}
                >
                  <option value="">Select Account For Ledger Drilldown</option>
                  {activeAccounts.map((account) => (
                    <option key={account._id} value={account._id}>{account.accountCode} - {account.accountName}</option>
                  ))}
                </select>
                {selectedReportAccountCode && <span style={{ color: C.inkSoft, fontWeight: '700', fontSize: '0.84rem' }}>Account: {selectedReportAccountCode}</span>}
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                  <thead><tr style={{ borderBottom: `1px solid ${C.p2}` }}><th style={{ padding: '0.5rem', textAlign: 'left' }}>Voucher</th><th style={{ padding: '0.5rem', textAlign: 'left' }}>Date</th><th style={{ padding: '0.5rem', textAlign: 'left' }}>Type</th><th style={{ padding: '0.5rem', textAlign: 'left' }}>Description</th><th style={{ padding: '0.5rem', textAlign: 'left' }}>Debit A/C</th><th style={{ padding: '0.5rem', textAlign: 'left' }}>Credit A/C</th><th style={{ padding: '0.5rem', textAlign: 'right' }}>Amount</th><th style={{ padding: '0.5rem', textAlign: 'right' }}>Running</th></tr></thead>
                  <tbody>
                    {!selectedReportAccountId && (
                      <tr>
                        <td colSpan={8} style={{ padding: '0.75rem', textAlign: 'center', color: C.inkSoft }}>
                          Select an account to view drilldown.
                        </td>
                      </tr>
                    )}
                    {ledgerReportRows.map((row, i) => (
                      <tr key={`${row.date}-${i}`} style={{ borderBottom: `1px solid ${C.p2}` }}>
                        <td style={{ padding: '0.5rem', fontWeight: '700' }}>{String(row.entryId || '').slice(-6).toUpperCase()}</td>
                        <td style={{ padding: '0.5rem' }}>{new Date(row.date).toLocaleString()}</td>
                        <td style={{ padding: '0.5rem', textTransform: 'capitalize' }}>{row.referenceType}</td>
                        <td style={{ padding: '0.5rem' }}>{row.description || '-'}</td>
                        <td style={{ padding: '0.5rem' }}>{row.debitAccount?.accountCode || '-'}</td>
                        <td style={{ padding: '0.5rem' }}>{row.creditAccount?.accountCode || '-'}</td>
                        <td style={{ padding: '0.5rem', textAlign: 'right' }}>{formatMoney(row.amount || 0)}</td>
                        <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '700', color: Number(row.runningBalance || 0) >= 0 ? C.s1 : C.danger }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.4rem', flexWrap: 'wrap' }}>
                            <span>{formatMoney(row.runningBalance || 0)}</span>
                            <button onClick={() => handleOpenVoucherSource(row.entryId)} style={{ padding: '0.25rem 0.45rem', borderRadius: '0.3rem', border: '1px solid #D1D5DB', background: '#F9FAFB', color: C.ink, cursor: 'pointer', fontSize: '0.74rem', fontWeight: '700' }}>Source</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {selectedReportAccountId && ledgerReportRows.length === 0 && (
                      <tr>
                        <td colSpan={8} style={{ padding: '0.75rem', textAlign: 'center', color: C.inkSoft }}>
                          No entries for selected account/date range.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {loading && <p style={{ color: C.inkSoft, marginTop: '0.8rem' }}>Loading report data...</p>}

          {voucherSource && (
            <div style={modalBackdropStyle} onClick={() => !voucherSourceLoading && setVoucherSource(null)}>
              <div style={{ ...modalCardStyle, width: 'min(760px, 100%)' }} onClick={(e) => e.stopPropagation()}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', alignItems: 'center', marginBottom: '1rem' }}>
                  <div>
                    <h4 style={{ margin: 0, color: C.ink }}>Voucher Source Drilldown</h4>
                    <p style={{ margin: '0.25rem 0 0', color: C.inkSoft, fontSize: '0.85rem' }}>Trace journal entry back to source transaction or manual voucher.</p>
                  </div>
                  <button onClick={() => setVoucherSource(null)} style={{ padding: '0.45rem 0.75rem', border: '1px solid #D1D5DB', background: '#fff', borderRadius: '0.35rem', cursor: 'pointer' }}>Close</button>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
                  <div style={emptyCardStyle}>
                    <p style={{ margin: 0, fontWeight: '700', color: C.ink }}>Ledger Voucher</p>
                    <p style={{ margin: '0.35rem 0 0' }}>Type: {voucherSource.ledgerEntry?.referenceType || '-'}</p>
                    <p style={{ margin: '0.2rem 0 0' }}>Date: {voucherSource.ledgerEntry?.date ? new Date(voucherSource.ledgerEntry.date).toLocaleString() : '-'}</p>
                    <p style={{ margin: '0.2rem 0 0' }}>Debit: {voucherSource.ledgerEntry?.debitAccountId?.accountCode || '-'} - {voucherSource.ledgerEntry?.debitAccountId?.accountName || ''}</p>
                    <p style={{ margin: '0.2rem 0 0' }}>Credit: {voucherSource.ledgerEntry?.creditAccountId?.accountCode || '-'} - {voucherSource.ledgerEntry?.creditAccountId?.accountName || ''}</p>
                    <p style={{ margin: '0.2rem 0 0', fontWeight: '700' }}>Amount: {formatMoney(voucherSource.ledgerEntry?.amount)}</p>
                  </div>

                  <div style={emptyCardStyle}>
                    <p style={{ margin: 0, fontWeight: '700', color: C.ink }}>Source Record</p>
                    {voucherSource.sourceTransaction ? (
                      <>
                        <p style={{ margin: '0.35rem 0 0' }}>Status: {voucherSource.sourceTransaction.status}</p>
                        <p style={{ margin: '0.2rem 0 0' }}>Type: {voucherSource.sourceTransaction.type}</p>
                        <p style={{ margin: '0.2rem 0 0' }}>Amount: {formatMoneyBase(voucherSource.sourceTransaction.amount, voucherSource.sourceTransaction.currency || baseCurrencyCode)} {voucherSource.sourceTransaction.currency || baseCurrencyCode}</p>
                        <p style={{ margin: '0.2rem 0 0' }}>Customer: {voucherSource.sourceTransaction.customerId?.name || '-'}</p>
                        <p style={{ margin: '0.2rem 0 0' }}>Vendor: {voucherSource.sourceTransaction.vendorId?.name || '-'}</p>
                        <p style={{ margin: '0.2rem 0 0' }}>Inventory: {voucherSource.sourceTransaction.inventoryItemId?.sku || voucherSource.sourceTransaction.inventoryItemId?.name || '-'}</p>
                        <p style={{ margin: '0.2rem 0 0' }}>Mapping: {voucherSource.sourceTransaction.mappingId?.mappingType || '-'}</p>
                      </>
                    ) : (
                      <p style={{ margin: '0.35rem 0 0' }}>No transaction record linked. This appears to be a manual journal or system-only voucher.</p>
                    )}
                  </div>
                </div>

                {voucherSource.sourceTransaction && (
                  <div style={{ background: '#F9FAFB', border: '1px solid #E5E7EB', borderRadius: '0.5rem', padding: '0.85rem' }}>
                    <p style={{ margin: 0, fontWeight: '700', color: C.ink, marginBottom: '0.45rem' }}>Narration</p>
                    <p style={{ margin: 0, color: C.inkSoft }}>{voucherSource.sourceTransaction.description || 'No description available.'}</p>
                  </div>
                )}

                {voucherSource.sourceTransaction && (
                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1rem', flexWrap: 'wrap' }}>
                    <button onClick={() => handleJumpToTransaction(voucherSource.sourceTransaction._id)} style={{ padding: '0.5rem 0.85rem', border: 'none', background: C.s1, color: '#fff', borderRadius: '0.35rem', cursor: 'pointer', fontWeight: '700' }}>Open In Transactions</button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
      {reportOptionsOpen && (
        <div style={modalBackdropStyle} onClick={() => setReportOptionsOpen(false)}>
          <div
            style={{ ...modalCardStyle, width: 'min(420px, 100%)', background: '#F3F7F4' }}
            onClick={(event) => event.stopPropagation()}
          >
            <p style={{ margin: '0 0 0.8rem', fontWeight: '700', color: C.ink }}>Report Options</p>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', marginBottom: '0.3rem' }}>Display In</label>
            <select
              aria-label="Display In"
              value={currencyChoices.includes(reportDisplayDraft.displayCurrency) ? reportDisplayDraft.displayCurrency : displayCurrency}
              onChange={(event) => setReportDisplayDraft((prev) => ({ ...prev, displayCurrency: event.target.value }))}
              style={modalInputStyle}
            >
              {currencyChoices.map((code) => (
                <option key={code} value={code}>{code}</option>
              ))}
            </select>
            {reportDisplayDraft.displayCurrency !== String(baseCurrencyCode || 'USD').toUpperCase() && (
              <p style={{ margin: '-0.2rem 0 0.7rem', fontSize: '0.78rem', color: C.inkSoft }}>
                {(() => {
                  const rate = reportDisplayPerUsd(reportDisplayDraft.displayCurrency, loadedCurrencies, baseCurrencyCode)
                  return rate
                    ? `1 ${String(baseCurrencyCode || 'USD').toUpperCase()} = ${Number(rate).toLocaleString(undefined, { maximumFractionDigits: 6 })} ${reportDisplayDraft.displayCurrency}. One rate for the whole report.`
                    : 'Currency Master has no rate for this currency.'
                })()}
              </p>
            )}
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', margin: '0.35rem 0', fontWeight: '600' }}>
              <input
                type="checkbox"
                checked={reportDisplayDraft.showNetOnly}
                onChange={(event) => setReportDisplayDraft((prev) => ({ ...prev, showNetOnly: event.target.checked }))}
              />
              Show Net Only
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', margin: '0.35rem 0', fontWeight: '600' }}>
              <input
                type="checkbox"
                checked={reportDisplayDraft.hideNet}
                onChange={(event) => setReportDisplayDraft((prev) => ({ ...prev, hideNet: event.target.checked }))}
              />
              Hide Net
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', margin: '0.35rem 0', fontWeight: '600' }}>
              <input
                type="checkbox"
                checked={reportDisplayDraft.suppressSummary}
                onChange={(event) => setReportDisplayDraft((prev) => ({ ...prev, suppressSummary: event.target.checked }))}
              />
              Suppress Summary
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', margin: '0.35rem 0 0.8rem', fontWeight: '600' }}>
              <input
                type="checkbox"
                checked={reportDisplayDraft.showMetal !== false}
                onChange={(event) => setReportDisplayDraft((prev) => ({ ...prev, showMetal: event.target.checked }))}
              />
              Show Metal
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', margin: '0.35rem 0 0.8rem', fontWeight: '600' }}>
              <input
                type="checkbox"
                checked={Boolean(reportDisplayDraft.calculateClosingStock)}
                onChange={(event) => setReportDisplayDraft((prev) => ({ ...prev, calculateClosingStock: event.target.checked }))}
              />
              Calculate Closing Stock
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', margin: '0.35rem 0 0.8rem', fontWeight: '600' }}>
              <input
                type="checkbox"
                checked={Boolean(reportDisplayDraft.showClosedAccounts)}
                onChange={(event) => setReportDisplayDraft((prev) => ({ ...prev, showClosedAccounts: event.target.checked }))}
              />
              Show Closed Accounts
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', margin: '0.35rem 0 0.8rem', fontWeight: '600' }}>
              <input
                type="checkbox"
                checked={Boolean(reportDisplayDraft.excludeHedging)}
                onChange={(event) => setReportDisplayDraft((prev) => ({ ...prev, excludeHedging: event.target.checked }))}
              />
              Exclude Hedging
            </label>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', margin: '0.45rem 0 0.3rem' }}>Show Selected Group</label>
            <select
              aria-label="Show Selected Group"
              value={reportDisplayDraft.selectedGroup || ''}
              onChange={(event) => setReportDisplayDraft((prev) => ({ ...prev, selectedGroup: event.target.value }))}
              style={modalInputStyle}
            >
              <option value="">All</option>
              <option value="debtor">Debtor</option>
              <option value="creditor">Creditor</option>
              <option value="cash">Cash</option>
              <option value="bank">Bank</option>
            </select>
            <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: '700', marginBottom: '0.3rem' }}>Report To</label>
            <select
              aria-label="Report To"
              value={reportDisplayDraft.reportTo}
              onChange={(event) => setReportDisplayDraft((prev) => ({ ...prev, reportTo: event.target.value }))}
              style={modalInputStyle}
            >
              <option value="screen">Screen</option>
              <option value="pdf">PDF</option>
            </select>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={() => setReportOptionsOpen(false)}
                style={{ padding: '0.45rem 0.9rem', borderRadius: '0.35rem', border: '1px solid #D1D5DB', background: '#FFFFFF', fontWeight: '700', cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  const next = {
                    ...reportDisplayDraft,
                    displayCurrency: currencyChoices.includes(reportDisplayDraft.displayCurrency)
                      ? reportDisplayDraft.displayCurrency
                      : displayCurrency,
                  }
                  setReportDisplay(next)
                  setReportFilters((prev) => ({
                    ...prev,
                    calculateClosingStock: Boolean(next.calculateClosingStock),
                    showClosedAccounts: Boolean(next.showClosedAccounts),
                    excludeHedging: Boolean(next.excludeHedging),
                  }))
                  setReportOptionsOpen(false)
                  if (next.reportTo !== 'pdf') return
                  const columns = { ...reportMoneyColumns(next), showMetal: next.showMetal !== false }
                  const convert = (value) => convertReportUsd(value, next.displayCurrency, loadedCurrencies, baseCurrencyCode)
                  const money = (value, currencyCode) => formatMoneyBase(convert(value), currencyCode || next.displayCurrency)
                  const moneyAbs = (value, currencyCode) => formatMoneyAbsBase(Math.abs(Number(convert(value) || 0)), currencyCode || next.displayCurrency)
                  const directional = (value, options = {}) => formatDirectionalBalanceBase(convert(value), {
                    ...options,
                    currencyCode: next.displayCurrency,
                  })
                  handleExportReportPdf({
                    formatMoney: money,
                    formatMoneyAbs: moneyAbs,
                    formatReportDirectionalBalance: (row, fallbackDirection = '') => directional(row?.balance, {
                      preferredDirection: row?.direction || fallbackDirection,
                    }),
                    columns,
                    convertAmount: convert,
                    displayCurrency: next.displayCurrency,
                    suppressSummary: next.suppressSummary,
                    period: buildErpReportDateRange({
                      period: reportPeriod,
                      startDate: reportStartDate,
                      endDate: reportEndDate,
                      reportYear,
                      reportMonth,
                    }),
                  })
                }}
                style={{ padding: '0.45rem 0.9rem', borderRadius: '0.35rem', border: 'none', background: '#4B5563', color: '#FFFFFF', fontWeight: '700', cursor: 'pointer' }}
              >
                Go
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
