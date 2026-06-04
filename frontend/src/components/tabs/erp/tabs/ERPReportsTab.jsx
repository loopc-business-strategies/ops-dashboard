import { trialBalanceRowsForView } from '../trialBalanceReportRows'

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
  handlePrintCurrentReport,
  emptyCardStyle,
  reports,
  reportView,
  setReportView,
  getReportPeriodLabel,
  formatDirectionalBalance,
  handleTrialAccountDrilldown,
  formatMoney,
  handleReportAccountDrilldown,
  formatMoneyAbs,
  selectedReportAccountId,
  setSelectedReportAccountId,
  accounts,
  setSelectedReportAccountCode,
  loadLedgerReport,
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
}) {
  const TRIAL_BALANCE_UI_ROW_CAP = 500
  const DAY_BOOK_UI_ROW_CAP = 600

  const trialBalanceForView = trialBalanceRowsForView(reportView, reports.trialBalance?.trialBalance || [])
  const trialBalanceFiltered = trialBalanceForView.filter((row) => {
    const q = String(reportFilters.search || '').toLowerCase().trim()
    if (!q) return true
    return String(row.accountCode || '').toLowerCase().includes(q) || String(row.accountName || '').toLowerCase().includes(q)
  })
  const trialBalanceShown = trialBalanceFiltered.slice(0, TRIAL_BALANCE_UI_ROW_CAP)
  const dayBookEntries = reports.dayBook?.entries || []
  const dayBookShown = dayBookEntries.slice(0, DAY_BOOK_UI_ROW_CAP)

  return (
    <>
      {/* REPORTS TAB */}
      {activeTab === 'reports' && (
        <div>
          <h3 style={{ marginBottom: '1rem', color: C.ink, fontSize: '1.25rem', fontWeight: '700' }}>Reports (Advanced ERP)</h3>

          <div style={{ background: C.p1, border: `1px solid ${C.p2}`, borderRadius: '0.6rem', padding: '1rem', marginBottom: '1rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.6rem' }}>
              <select value={reportFilters.period} onChange={(e) => setReportFilters((prev) => ({ ...prev, period: e.target.value }))} style={modalInputStyle}>
                <option value="today">Today</option>
                <option value="month">This Month</option>
                <option value="ytd">Year To Date</option>
                <option value="custom">Custom Range</option>
              </select>
              <input type="date" value={reportFilters.startDate} onChange={(e) => setReportFilters((prev) => ({ ...prev, startDate: e.target.value, period: 'custom' }))} style={modalInputStyle} />
              <input type="date" value={reportFilters.endDate} onChange={(e) => setReportFilters((prev) => ({ ...prev, endDate: e.target.value, period: 'custom' }))} style={modalInputStyle} />
              <select value={reportFilters.accountType} onChange={(e) => setReportFilters((prev) => ({ ...prev, accountType: e.target.value }))} style={modalInputStyle}>
                <option value="">All Account Types</option>
                {ACCOUNT_TYPES.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              <select value={reportFilters.sortBy} onChange={(e) => setReportFilters((prev) => ({ ...prev, sortBy: e.target.value }))} style={modalInputStyle}>
                <option value="accountCode">Sort: Account Code</option>
                <option value="accountName">Sort: Account Name</option>
                <option value="debit">Sort: Debit</option>
                <option value="credit">Sort: Credit</option>
                <option value="net">Sort: Net</option>
              </select>
              <select value={reportFilters.sortDir} onChange={(e) => setReportFilters((prev) => ({ ...prev, sortDir: e.target.value }))} style={modalInputStyle}>
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
              </select>
              <select value={reportFilters.referenceType} onChange={(e) => setReportFilters((prev) => ({ ...prev, referenceType: e.target.value }))} style={modalInputStyle}>
                <option value="">All Day Book Types</option>
                {LEDGER_REFERENCE_TYPES.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              <input type="number" placeholder="Day Book Min Amount" value={reportFilters.minAmount} onChange={(e) => setReportFilters((prev) => ({ ...prev, minAmount: e.target.value }))} style={modalInputStyle} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.8rem', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                {reportView === 'trial' && (
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: C.ink, fontSize: '0.86rem', fontWeight: '600' }}>
                    <input type="checkbox" checked={reportFilters.includeZeroAccounts} onChange={(e) => setReportFilters((prev) => ({ ...prev, includeZeroAccounts: e.target.checked }))} />
                    Include zero-balance accounts
                  </label>
                )}
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: C.ink, fontSize: '0.86rem', fontWeight: '600' }}>
                  <input type="checkbox" checked={reportFilters.comparePrevious} onChange={(e) => setReportFilters((prev) => ({ ...prev, comparePrevious: e.target.checked }))} />
                  Compare with previous period
                </label>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                <button onClick={handleExportReportCsv} style={{ padding: '0.45rem 0.8rem', borderRadius: '0.35rem', border: '1px solid #10B981', background: '#ECFDF5', color: '#065F46', fontWeight: '700', cursor: 'pointer' }}>Export CSV</button>
                <button onClick={handleExportReportXlsx} style={{ padding: '0.45rem 0.8rem', borderRadius: '0.35rem', border: '1px solid #047857', background: '#ECFDF5', color: '#064E3B', fontWeight: '700', cursor: 'pointer' }}>Export XLSX</button>
                <button onClick={handleExportReportPdf} style={{ padding: '0.45rem 0.8rem', borderRadius: '0.35rem', border: '1px solid #EF4444', background: '#FEF2F2', color: '#991B1B', fontWeight: '700', cursor: 'pointer' }}>Export PDF</button>
                <button onClick={handlePrintCurrentReport} style={{ padding: '0.45rem 0.8rem', borderRadius: '0.35rem', border: '1px solid #60A5FA', background: '#EFF6FF', color: '#1E40AF', fontWeight: '700', cursor: 'pointer' }}>Print</button>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '0.8rem', marginBottom: '1rem' }}>
            <div style={{ ...emptyCardStyle, borderStyle: 'solid' }}>
              <p style={{ margin: 0, fontWeight: '700' }}>Trial Balance</p>
              <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem' }}>Debit: {Number(reports.trialBalance?.totalDebit || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem' }}>Credit: {Number(reports.trialBalance?.totalCredit || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              <p style={{ margin: '0.2rem 0 0', color: reports.trialBalance?.balanced ? C.s1 : C.danger, fontWeight: '700', fontSize: '0.82rem' }}>{reports.trialBalance?.balanced ? 'Balanced' : 'Difference Found'}</p>
              {!reports.trialBalance?.balanced && reports.trialBalance?.difference != null && (
                <p style={{ margin: '0.15rem 0 0', fontSize: '0.78rem', color: C.danger, fontWeight: '600' }}>
                  Difference: {Number(reports.trialBalance.difference).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
              <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem' }}>Income: {Number(reports.profitLoss?.totalIncome || 0).toLocaleString()}</p>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem' }}>Expense: {Number(reports.profitLoss?.totalExpense || 0).toLocaleString()}</p>
              <p style={{ margin: '0.2rem 0 0', fontWeight: '700', color: Number(reports.profitLoss?.netProfit || 0) >= 0 ? C.s1 : C.danger, fontSize: '0.82rem' }}>Net: {Number(reports.profitLoss?.netProfit || 0).toLocaleString()}</p>
            </div>
            <div style={{ ...emptyCardStyle, borderStyle: 'solid' }}>
              <p style={{ margin: 0, fontWeight: '700' }}>Balance Sheet</p>
              <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem' }}>Assets: {Math.abs(Number(reports.balanceSheet?.totalAssets || 0)).toLocaleString()}</p>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem' }}>L+E: {Math.abs(Number(reports.balanceSheet?.liabilitiesPlusEquity || 0)).toLocaleString()}</p>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.82rem' }}>Current Ratio: {reports.balanceSheet?.currentRatio ?? '-'}</p>
            </div>
            <div style={{ ...emptyCardStyle, borderStyle: 'solid' }}>
              <p style={{ margin: 0, fontWeight: '700' }}>Forex Impact</p>
              <p style={{ margin: '0.35rem 0 0', fontSize: '0.85rem' }}>Entries: {Number(reports.forex?.entriesCount || 0).toLocaleString()}</p>
              <p style={{ margin: '0.2rem 0 0', fontSize: '0.85rem' }}>Impact: {Number(reports.forex?.forexImpact || 0).toLocaleString()}</p>
            </div>
          </div>

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
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '999px', color: '#1E3A8A', fontWeight: '700', fontSize: '0.82rem', padding: '0.45rem 0.75rem', marginBottom: '0.7rem' }}>
                <span>Active Period</span>
                <span style={{ color: '#1D4ED8' }}>{getReportPeriodLabel()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.6rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                <div>
                  <p style={{ margin: 0, fontWeight: '700', color: C.ink }}>{reportView === 'summary' ? 'Summary' : 'Trial Balance'}</p>
                  {reportView === 'summary' && (
                    <p style={{ margin: '0.35rem 0 0', fontSize: '0.82rem', color: C.inkSoft, fontWeight: '600', maxWidth: '520px' }}>
                      Accounts with a non-zero balance or movement in this period. Use Trial Balance for the full chart including zero-balance lines.
                    </p>
                  )}
                </div>
                <input placeholder="Search account code/name" value={reportFilters.search} onChange={(e) => setReportFilters((prev) => ({ ...prev, search: e.target.value }))} style={{ ...modalInputStyle, marginBottom: 0, width: '260px' }} />
              </div>
              {trialBalanceFiltered.length > TRIAL_BALANCE_UI_ROW_CAP && (
                <p style={{ margin: '0 0 0.5rem', color: C.inkSoft, fontSize: '0.82rem' }}>
                  Showing first {TRIAL_BALANCE_UI_ROW_CAP} of {trialBalanceFiltered.length} matching rows (UI cap). Narrow search or export for the full set.
                </p>
              )}
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${C.p2}` }}>
                      <th style={{ padding: '0.6rem', textAlign: 'left' }}>Code</th>
                      <th style={{ padding: '0.6rem', textAlign: 'left' }}>Name</th>
                      <th style={{ padding: '0.6rem', textAlign: 'left' }}>Type</th>
                      <th style={{ padding: '0.6rem', textAlign: 'right' }}>Debit</th>
                      <th style={{ padding: '0.6rem', textAlign: 'right' }}>Credit</th>
                      <th style={{ padding: '0.6rem', textAlign: 'right' }}>Net</th>
                      <th style={{ padding: '0.6rem', textAlign: 'left' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {trialBalanceShown.map((row) => (
                        <tr key={`${row.accountCode}-${row.accountType}`} style={{ borderBottom: `1px solid ${C.p2}` }}>
                          <td style={{ padding: '0.6rem', fontWeight: '700' }}>{row.accountCode}</td>
                          <td style={{ padding: '0.6rem' }}>{row.accountName}</td>
                          <td style={{ padding: '0.6rem' }}>{row.accountType}</td>
                          <td style={{ padding: '0.6rem', textAlign: 'right' }}>{Number(row.debit || 0).toLocaleString()}</td>
                          <td style={{ padding: '0.6rem', textAlign: 'right' }}>{Number(row.credit || 0).toLocaleString()}</td>
                          <td style={{ padding: '0.6rem', textAlign: 'right', color: Number(row.net || 0) >= 0 ? C.s1 : C.danger, fontWeight: '700' }}>
                            {formatDirectionalBalance(row.net)}
                          </td>
                          <td style={{ padding: '0.6rem' }}>
                            <button onClick={() => handleTrialAccountDrilldown(row.accountCode)} style={{ padding: '0.3rem 0.5rem', borderRadius: '0.3rem', border: '1px solid #0EA5E9', color: '#0C4A6E', background: '#E0F2FE', cursor: 'pointer' }}>
                              Ledger
                            </button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {reportView === 'pnl' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div style={{ gridColumn: '1 / -1', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '999px', color: '#1E3A8A', fontWeight: '700', fontSize: '0.82rem', padding: '0.45rem 0.75rem' }}>
                <span>Active Period</span>
                <span style={{ color: '#1D4ED8' }}>{getReportPeriodLabel()}</span>
              </div>
              <div style={{ background: C.p1, border: `1px solid ${C.p2}`, borderRadius: '0.5rem', padding: '0.9rem' }}>
                <p style={{ margin: 0, fontWeight: '700', marginBottom: '0.5rem' }}>Income Breakdown</p>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                    <thead><tr style={{ borderBottom: `1px solid ${C.p2}` }}><th style={{ padding: '0.55rem', textAlign: 'left' }}>Code</th><th style={{ padding: '0.55rem', textAlign: 'left' }}>Account</th><th style={{ padding: '0.55rem', textAlign: 'right' }}>Amount</th><th style={{ padding: '0.55rem', textAlign: 'left' }}>Action</th></tr></thead>
                    <tbody>
                      {(reports.profitLoss?.incomeBreakdown || []).map((row) => (
                        <tr key={`inc-${row.accountCode}`} style={{ borderBottom: `1px solid ${C.p2}` }}><td style={{ padding: '0.55rem' }}>{row.accountCode}</td><td style={{ padding: '0.55rem' }}>{row.accountName}</td><td style={{ padding: '0.55rem', textAlign: 'right' }}>{Number(row.amount || 0).toLocaleString()}</td><td style={{ padding: '0.55rem' }}><button onClick={() => handleReportAccountDrilldown(row.accountId, row.accountCode)} style={{ padding: '0.28rem 0.48rem', borderRadius: '0.3rem', border: '1px solid #0EA5E9', background: '#EFF6FF', color: '#1E40AF', cursor: 'pointer' }}>Vouchers</button></td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
              <div style={{ background: C.p1, border: `1px solid ${C.p2}`, borderRadius: '0.5rem', padding: '0.9rem' }}>
                <p style={{ margin: 0, fontWeight: '700', marginBottom: '0.5rem' }}>Expense Breakdown</p>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                    <thead><tr style={{ borderBottom: `1px solid ${C.p2}` }}><th style={{ padding: '0.55rem', textAlign: 'left' }}>Code</th><th style={{ padding: '0.55rem', textAlign: 'left' }}>Account</th><th style={{ padding: '0.55rem', textAlign: 'right' }}>Amount</th><th style={{ padding: '0.55rem', textAlign: 'left' }}>Action</th></tr></thead>
                    <tbody>
                      {(reports.profitLoss?.expenseBreakdown || []).map((row) => (
                        <tr key={`exp-${row.accountCode}`} style={{ borderBottom: `1px solid ${C.p2}` }}><td style={{ padding: '0.55rem' }}>{row.accountCode}</td><td style={{ padding: '0.55rem' }}>{row.accountName}</td><td style={{ padding: '0.55rem', textAlign: 'right' }}>{Number(row.amount || 0).toLocaleString()}</td><td style={{ padding: '0.55rem' }}><button onClick={() => handleReportAccountDrilldown(row.accountId, row.accountCode)} style={{ padding: '0.28rem 0.48rem', borderRadius: '0.3rem', border: '1px solid #0EA5E9', background: '#EFF6FF', color: '#1E40AF', cursor: 'pointer' }}>Vouchers</button></td></tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div style={{ marginTop: '0.75rem', borderTop: `1px solid ${C.p2}`, paddingTop: '0.6rem' }}>
                  <p style={{ margin: '0.2rem 0', fontWeight: '700' }}>Total Income: {Number(reports.profitLoss?.totalIncome || 0).toLocaleString()}</p>
                  <p style={{ margin: '0.2rem 0', fontWeight: '700' }}>Total Expense: {Number(reports.profitLoss?.totalExpense || 0).toLocaleString()}</p>
                  <p style={{ margin: '0.2rem 0', fontWeight: '800', color: Number(reports.profitLoss?.netProfit || 0) >= 0 ? C.s1 : C.danger }}>Net Profit: {Number(reports.profitLoss?.netProfit || 0).toLocaleString()}</p>
                  {reports.profitLoss?.previousPeriod && <p style={{ margin: '0.2rem 0', fontWeight: '600', color: C.inkSoft }}>Variance vs previous: {Number(reports.profitLoss?.varianceVsPrevious || 0).toLocaleString()}</p>}
                </div>
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
              <div style={{ gridColumn: '1 / -1', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: '999px', color: '#1E3A8A', fontWeight: '700', fontSize: '0.82rem', padding: '0.45rem 0.75rem' }}>
                <span>Active Period</span>
                <span style={{ color: '#1D4ED8' }}>{getReportPeriodLabel()}</span>
              </div>
              {[['Assets', reports.balanceSheet?.assets || []], ['Liabilities', reports.balanceSheet?.liabilities || []], ['Equity', reports.balanceSheet?.equity || []]].map(([title, rows]) => (
                <div key={title} style={{ background: C.p1, border: `1px solid ${C.p2}`, borderRadius: '0.5rem', padding: '0.9rem' }}>
                  <p style={{ margin: 0, fontWeight: '700', marginBottom: '0.5rem' }}>{title}</p>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                      <thead><tr style={{ borderBottom: `1px solid ${C.p2}` }}><th style={{ padding: '0.5rem', textAlign: 'left' }}>Code</th><th style={{ padding: '0.5rem', textAlign: 'left' }}>Name</th><th style={{ padding: '0.5rem', textAlign: 'right' }}>Balance</th><th style={{ padding: '0.5rem', textAlign: 'left' }}>Action</th></tr></thead>
                      <tbody>
                        {rows.map((row) => (
                          <tr key={`${title}-${row.accountCode}`} style={{ borderBottom: `1px solid ${C.p2}` }}><td style={{ padding: '0.5rem' }}>{row.accountCode}</td><td style={{ padding: '0.5rem' }}>{row.accountName}{row.isReclassified ? <span style={{ marginLeft: '0.4rem', color: '#64748B', fontSize: '0.72rem', fontWeight: '700' }}>reclassified</span> : null}</td><td style={{ padding: '0.5rem', textAlign: 'right' }}>{formatDirectionalBalance(row.balance, { preferredDirection: row.direction || (title === 'Assets' ? 'debit' : 'credit') })}</td><td style={{ padding: '0.5rem' }}><button onClick={() => handleReportAccountDrilldown(row.accountId, row.accountCode)} style={{ padding: '0.28rem 0.48rem', borderRadius: '0.3rem', border: '1px solid #0EA5E9', background: '#EFF6FF', color: '#1E40AF', cursor: 'pointer' }}>Vouchers</button></td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
              <div style={{ gridColumn: '1 / -1', background: C.p1, border: `1px solid ${C.p2}`, borderRadius: '0.5rem', padding: '0.9rem' }}>
                <p style={{ margin: '0.15rem 0', fontWeight: '700' }}>Assets: {Math.abs(Number(reports.balanceSheet?.totalAssets || 0)).toLocaleString()}</p>
                <p style={{ margin: '0.15rem 0', fontWeight: '700' }}>Liabilities + Equity: {Math.abs(Number(reports.balanceSheet?.liabilitiesPlusEquity || 0)).toLocaleString()}</p>
                <p style={{ margin: '0.15rem 0', color: Math.abs(Number(reports.balanceSheet?.difference || 0)) < 0.01 ? C.s1 : C.danger, fontWeight: '800' }}>Difference: {Number(reports.balanceSheet?.difference || 0).toLocaleString()}</p>
                <p style={{ margin: '0.15rem 0' }}>Working Capital: {Number(reports.balanceSheet?.workingCapital || 0).toLocaleString()}</p>
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
              <p style={{ margin: 0, fontWeight: '700', marginBottom: '0.5rem' }}>Day Book Entries</p>
              <p style={{ margin: '0 0 0.5rem', color: C.inkSoft, fontSize: '0.84rem' }}>
                Total Entries: {reports.dayBook?.totals?.count || 0} | Debit: {Number(reports.dayBook?.totals?.debit || 0).toLocaleString()} | Credit: {Number(reports.dayBook?.totals?.credit || 0).toLocaleString()}
              </p>
              {dayBookEntries.length > DAY_BOOK_UI_ROW_CAP && (
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
                        <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '700' }}>{Number(entry.amount || 0).toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {reportView === 'outstanding' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1rem' }}>
              <div style={{ background: C.p1, border: `1px solid ${C.p2}`, borderRadius: '0.5rem', padding: '0.9rem' }}>
                <p style={{ margin: 0, fontWeight: '700', marginBottom: '0.45rem' }}>Customer Outstanding</p>
                <p style={{ margin: '0 0 0.45rem', color: C.inkSoft, fontSize: '0.84rem' }}>Total: {Number(reports.customerOutstanding?.totals?.outstanding || 0).toLocaleString()} | Limit Exceeded: {reports.customerOutstanding?.totals?.limitExceededCount || 0}</p>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead><tr style={{ borderBottom: `1px solid ${C.p2}` }}><th style={{ padding: '0.5rem', textAlign: 'left' }}>Customer</th><th style={{ padding: '0.5rem', textAlign: 'left' }}>Ledger</th><th style={{ padding: '0.5rem', textAlign: 'right' }}>Outstanding</th><th style={{ padding: '0.5rem', textAlign: 'right' }}>0-30</th><th style={{ padding: '0.5rem', textAlign: 'right' }}>31-60</th><th style={{ padding: '0.5rem', textAlign: 'right' }}>61-90</th><th style={{ padding: '0.5rem', textAlign: 'right' }}>90+</th><th style={{ padding: '0.5rem', textAlign: 'center' }}>Limit</th></tr></thead>
                    <tbody>
                      {(reports.customerOutstanding?.rows || []).map((row) => (
                        <tr key={row.customerId} style={{ borderBottom: `1px solid ${C.p2}` }}>
                          <td style={{ padding: '0.5rem' }}>{row.customerName}</td>
                          <td style={{ padding: '0.5rem' }}>{row.ledgerAccount?.accountCode || '-'}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '700' }}>{Number(row.outstanding || 0).toLocaleString()}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'right' }}>{Number(row.aging?.bucket0to30 || 0).toLocaleString()}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'right' }}>{Number(row.aging?.bucket31to60 || 0).toLocaleString()}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'right' }}>{Number(row.aging?.bucket61to90 || 0).toLocaleString()}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'right' }}>{Number(row.aging?.bucket90Plus || 0).toLocaleString()}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'center', color: row.limitExceeded ? C.danger : C.s1, fontWeight: '700' }}>{row.limitExceeded ? 'Exceeded' : 'OK'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div style={{ background: C.p1, border: `1px solid ${C.p2}`, borderRadius: '0.5rem', padding: '0.9rem' }}>
                <p style={{ margin: 0, fontWeight: '700', marginBottom: '0.45rem' }}>Vendor Outstanding</p>
                <p style={{ margin: '0 0 0.45rem', color: C.inkSoft, fontSize: '0.84rem' }}>Total: {Number(reports.vendorOutstanding?.totals?.outstanding || 0).toLocaleString()} | Credit: {Number(reports.vendorOutstanding?.totals?.credit || 0).toLocaleString()}</p>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead><tr style={{ borderBottom: `1px solid ${C.p2}` }}><th style={{ padding: '0.5rem', textAlign: 'left' }}>Vendor</th><th style={{ padding: '0.5rem', textAlign: 'left' }}>Ledger</th><th style={{ padding: '0.5rem', textAlign: 'right' }}>Outstanding</th><th style={{ padding: '0.5rem', textAlign: 'left' }}>Type</th></tr></thead>
                    <tbody>
                      {(reports.vendorOutstanding?.rows || []).map((row) => (
                        <tr key={row.vendorId} style={{ borderBottom: `1px solid ${C.p2}` }}>
                          <td style={{ padding: '0.5rem' }}>{row.vendorName}</td>
                          <td style={{ padding: '0.5rem' }}>{row.ledgerAccount?.accountCode || '-'}</td>
                          <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '700' }}>{Number(row.outstanding || 0).toLocaleString()}</td>
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
              <p style={{ margin: 0, fontWeight: '700', marginBottom: '0.5rem' }}>Forex Gain/Loss Analysis</p>
              <p style={{ margin: '0 0 0.6rem', color: C.inkSoft, fontSize: '0.84rem' }}>Entries: {reports.forex?.entriesCount || 0} | Total Impact: {Number(reports.forex?.forexImpact || 0).toLocaleString()}</p>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
                  <thead><tr style={{ borderBottom: `1px solid ${C.p2}` }}><th style={{ padding: '0.5rem', textAlign: 'left' }}>Currency</th><th style={{ padding: '0.5rem', textAlign: 'right' }}>Entries</th><th style={{ padding: '0.5rem', textAlign: 'right' }}>Impact</th></tr></thead>
                  <tbody>
                    {Object.entries(reports.forex?.byCurrency || {}).map(([currency, row]) => (
                      <tr key={currency} style={{ borderBottom: `1px solid ${C.p2}` }}><td style={{ padding: '0.5rem' }}>{currency}</td><td style={{ padding: '0.5rem', textAlign: 'right' }}>{Number(row.count || 0).toLocaleString()}</td><td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '700' }}>{Number(row.impact || 0).toLocaleString()}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {reportView === 'ledger' && (
            <div style={{ background: C.p1, border: `1px solid ${C.p2}`, borderRadius: '0.5rem', padding: '0.9rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: '0.6rem', alignItems: 'center', marginBottom: '0.5rem' }}>
                <select
                  value={selectedReportAccountId}
                  onChange={(e) => {
                    const account = accounts.find((acc) => acc._id === e.target.value)
                    setSelectedReportAccountId(e.target.value)
                    setSelectedReportAccountCode(account?.accountCode || '')
                    loadLedgerReport(e.target.value)
                  }}
                  style={{ ...modalInputStyle, marginBottom: 0 }}
                >
                  <option value="">Select Account For Ledger Drilldown</option>
                  {accounts.map((account) => (
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
                        <td style={{ padding: '0.5rem', textAlign: 'right' }}>{Number(row.amount || 0).toLocaleString()}</td>
                        <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: '700', color: Number(row.runningBalance || 0) >= 0 ? C.s1 : C.danger }}>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '0.4rem', flexWrap: 'wrap' }}>
                            <span>{Number(row.runningBalance || 0).toLocaleString()}</span>
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
                        <p style={{ margin: '0.2rem 0 0' }}>Amount: {formatMoney(voucherSource.sourceTransaction.amount)} {voucherSource.sourceTransaction.currency || 'USD'}</p>
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
    </>
  )
}
