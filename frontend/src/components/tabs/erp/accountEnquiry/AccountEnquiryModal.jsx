import { ERP_TAB_COLORS as C, ERP_MODAL_INPUT_STYLE } from '../erpTabPresentation'
import { isPrimaryNavClick } from '../../../../utils/dashboardNavigation'

const linkButtonStyle = {
  textDecoration: 'none',
  display: 'inline-block',
}

export default function AccountEnquiryModal({
  open,
  onClose,
  enquiryBackdropColor,
  enquiryModalOffset,
  enquiryModalDrag,
  beginEnquiryModalDrag,
  enquiryLoading,
  accountEnquiryCode,
  setAccountEnquiryCode,
  setShowEnquiryLookupMenu,
  showEnquiryLookupMenu,
  filteredGroupedSummaryAccounts,
  setEnquiryStatus,
  fetchAccountEnquiryByCode,
  enquiryStatus,
  accountEnquiryData,
  modalPositionRows,
  formatStatementValue,
  getSignedColor,
  formatDirectionalBalance,
  unfixedMetalEntries,
  formatStatementDate,
  fixedMetalSummary,
  unfixedMetalSummary,
  unknownFixMetalEntries,
  modalTotalFundsDisplay,
  modalRevaluationDisplay,
  modalNetEquityDisplay,
  modalMarginAmtDisplay,
  modalExcessDisplay,
  modalMarginPctDisplay,
  enquirySuppressMetalSpotMtm,
  enquiryLiveRecalcEnabled = false,
  hasMetalExposure = false,
  excessCurrency,
  setExcessCurrency,
  baseCurrencyCode,
  statementDisplayCurrencyOptions,
  filteredStatementEntries,
  recentPaymentReceiptEntry,
  resolveStatementReceiptNo,
  statementFilters,
  setStatementFilters,
  statementReferenceTypes,
  statementDepartments,
  setStatementMetalCommodityEnabled,
  statementMetalCommodityEnabled,
  statementFilterCurrencyOptions,
  statementMetalOptions,
  statementDisplayCurrency,
  showStatementAuditIds,
  setShowStatementAuditIds,
  statementTableRef,
  convertStatementDisplayAmount,
  resolveMetalCode,
  statementSelectedMetalCode,
  pureWeightRunningByEntryKey,
  formatStatementNullableValue,
  canExportAccountSummary,
  handleViewStatement,
  buildAccountEnquiryHref,
  handleExportEnquiryPdf,
  getAccountEnquirySignedMetricColor,
  formatAccountEnquiryExcessDisplay,
  resolveExposureDirection,
  isMetalStatementEntry,
}) {
  if (!open) return null
  return (
        <div
          onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
          style={{ position: 'fixed', inset: 0, background: enquiryBackdropColor, transition: 'background 120ms ease', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}
        >
          <div style={{ background: '#fff', borderRadius: '8px', width: 'min(1100px, 100%)', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 20px 42px rgba(0,0,0,0.35)', transform: `translate(${enquiryModalOffset.x}px, ${enquiryModalOffset.y}px)` }}>
            {/* Header - Dark Green Bar */}
            <div
              onMouseDown={beginEnquiryModalDrag}
              style={{ background: '#3F4B2E', color: '#FFFFFF', padding: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', cursor: enquiryModalDrag.active ? 'grabbing' : 'grab', userSelect: 'none' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontWeight: '700', fontSize: '1.1rem' }}>Account Details — Statement of Account</span>
                {enquiryLoading && <span style={{ fontSize: '0.9rem', opacity: 0.8 }}>(Loading…)</span>}
              </div>
              <button onClick={() => onClose()} style={{ background: 'transparent', border: 'none', color: '#FFFFFF', cursor: 'pointer', fontSize: '20px', padding: '0', lineHeight: 1 }}>✕</button>
            </div>
            {/* Scrollable Content Area */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.2rem 1.5rem' }}>
              {/* Account lookup row */}
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '1.2rem', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <label style={{ fontSize: '0.95rem', color: '#374151', fontWeight: '600' }}>Account Number</label>
                  <div style={{ position: 'relative', width: '340px' }}>
                    <input
                      value={accountEnquiryCode}
                      onChange={(e) => {
                        setAccountEnquiryCode(e.target.value)
                        setShowEnquiryLookupMenu(true)
                        setEnquiryStatus({ type: '', message: '' })
                      }}
                      onFocus={() => setShowEnquiryLookupMenu(true)}
                      onBlur={() => {
                        window.setTimeout(() => setShowEnquiryLookupMenu(false), 120)
                      }}
                      placeholder="Type account code or pick from dropdown"
                      autoComplete="off"
                      style={{ border: '1px solid #CBD5E0', padding: '0.6rem 0.8rem', fontSize: '0.95rem', width: '100%', borderRadius: '0.5rem', background: '#FFFFFF' }}
                    />
                    {showEnquiryLookupMenu && filteredGroupedSummaryAccounts.length > 0 && (
                      <div style={{ position: 'absolute', top: 'calc(100% + 0.35rem)', left: 0, right: 0, zIndex: 5, border: '1px solid #D6D3C4', borderRadius: '0.6rem', background: '#FFFFFF', maxHeight: '260px', overflowY: 'auto', boxShadow: '0 10px 24px rgba(15, 23, 42, 0.12)' }}>
                        {filteredGroupedSummaryAccounts.map((group) => (
                          <div key={group.type}>
                            <div style={{ position: 'sticky', top: 0, zIndex: 1, padding: '0.45rem 0.75rem', background: '#F5F7F0', borderBottom: '1px solid #E5E7EB', color: '#3F4B2E', fontSize: '0.76rem', fontWeight: '800', letterSpacing: '0.04em', textTransform: 'uppercase' }}>
                              {group.type}
                            </div>
                            {group.accounts.map((account) => (
                              <button
                                key={account._id}
                                type="button"
                                onMouseDown={(event) => {
                                  event.preventDefault()
                                  setShowEnquiryLookupMenu(false)
                                  setAccountEnquiryCode(account.accountCode)
                                  setEnquiryStatus({ type: '', message: '' })
                                  fetchAccountEnquiryByCode(account.accountCode)
                                }}
                                style={{ display: 'flex', width: '100%', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', padding: '0.65rem 0.75rem', border: 'none', borderBottom: '1px solid #F3F4F6', background: '#FFFFFF', color: C.ink, cursor: 'pointer', textAlign: 'left' }}
                              >
                                <span style={{ fontWeight: '800', minWidth: '56px', color: '#111827' }}>{account.accountCode}</span>
                                <span style={{ flex: 1, color: '#4B5563', fontSize: '0.86rem' }}>{account.accountName}</span>
                                <span style={{ color: '#6B7280', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>{account.accountType}</span>
                              </button>
                            ))}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <a
                    href={buildAccountEnquiryHref?.(accountEnquiryCode) || '#'}
                    onClick={(event) => {
                      if (!isPrimaryNavClick(event)) return
                      event.preventDefault()
                      setShowEnquiryLookupMenu(false)
                      fetchAccountEnquiryByCode(accountEnquiryCode)
                    }}
                    style={{
                      ...linkButtonStyle,
                      padding: '0.6rem 1.2rem',
                      background: 'var(--purple)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '0.5rem',
                      cursor: enquiryLoading ? 'not-allowed' : 'pointer',
                      fontWeight: '700',
                      fontSize: '0.95rem',
                      opacity: enquiryLoading ? 0.7 : 1,
                    }}
                  >
                    {enquiryLoading ? 'Loading…' : 'Load Summary'}
                  </a>
                </div>
              </div>
              {enquiryStatus.message && !enquiryLoading && (
                <p style={{ margin: '0 0 1rem', fontSize: '0.9rem', color: enquiryStatus.type === 'success' ? '#047857' : '#c0392b', fontWeight: '600' }}>{enquiryStatus.message}</p>
              )}
              {!accountEnquiryData ? (
                <div style={{ border: '1px solid #E5E7EB', borderRadius: '0.6rem', background: '#F9FAFB', padding: '1.5rem', color: '#6B7280', fontSize: '0.95rem', textAlign: 'center' }}>
                  {enquiryLoading ? '⟳ Loading account statement...' : '→ Enter account number and click Load Summary to view position'}
                </div>
              ) : (
                <>
                  {/* 2-Column Layout */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }}>
                    {/* LEFT COLUMN - Account Details Box with Position Table */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
                      {/* Account Details Panel */}
                      <div style={{ border: '2px solid #3F4B2E', borderRadius: '0.6rem', background: '#F5F7F0', padding: '1rem', position: 'relative' }}>
                        <div style={{ borderBottom: '1px solid #D1D5DB', paddingBottom: '0.8rem', marginBottom: '0.8rem' }}>
                          <h3 style={{ margin: '0 0 0.4rem', color: '#111827', fontWeight: '800', fontSize: '1.1rem' }}>{accountEnquiryData.account.accountName || 'Account'}</h3>
                          <p style={{ margin: 0, color: '#6B7280', fontSize: '0.9rem', lineHeight: '1.4' }}>{accountEnquiryData.account.description || accountEnquiryData.account.accountName}</p>
                          {accountEnquiryData.account.description && (
                            <p style={{ margin: '0.4rem 0 0', color: '#6B7280', fontSize: '0.85rem' }}>Code: {accountEnquiryData.account.accountCode}</p>
                          )}
                        </div>
                      </div>
                      {/* Metal position (grams) + unfixed activity */}
                      <div style={{ border: '1px solid #CBD5E0', borderRadius: '0.6rem', overflow: 'hidden', background: '#FFFFFF' }}>
                        <div style={{ background: '#3F4B2E', padding: '0.7rem 1rem', borderBottom: '1px solid #2D3620' }}>
                          <span style={{ color: '#FFFFFF', fontWeight: '700', fontSize: '0.95rem' }}>Position</span>
                          <span style={{ color: 'rgba(255,255,255,0.82)', fontSize: '0.78rem', marginLeft: '0.5rem', fontWeight: '600' }}>(pure weight, grams — includes unfixed trades, direct deals, and metal transfers)</span>
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                            <thead>
                              <tr style={{ background: '#E8EBE0', borderBottom: '2px solid #CBD5E0' }}>
                                <th style={{ padding: '0.7rem', textAlign: 'left', fontWeight: '700', color: '#374151' }}>Type</th>
                                <th style={{ padding: '0.7rem', textAlign: 'right', fontWeight: '700', color: '#374151' }}>Limits</th>
                                <th style={{ padding: '0.7rem', textAlign: 'right', fontWeight: '700', color: '#374151' }}>Balance</th>
                                <th style={{ padding: '0.7rem', textAlign: 'right', fontWeight: '700', color: '#374151' }}>Price</th>
                                <th style={{ padding: '0.7rem', textAlign: 'right', fontWeight: '700', color: '#374151' }}>Current Value</th>
                                <th style={{ padding: '0.7rem', textAlign: 'right', fontWeight: '700', color: '#374151' }}>Break Even</th>
                              </tr>
                            </thead>
                            <tbody>
                              {modalPositionRows.map((row, index) => (
                                <tr key={row.key} style={{ background: index % 2 === 0 ? '#FFFFFF' : '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                                  <td style={{ padding: '0.7rem', fontWeight: '700', color: '#111827' }}>{row.type}</td>
                                  <td style={{ padding: '0.7rem', textAlign: 'right', color: '#374151', fontSize: '0.85rem' }}>{formatStatementValue(row.limits, 0)}</td>
                                  <td style={{ padding: '0.7rem', textAlign: 'right', color: getSignedColor(row.balance), fontWeight: '600' }}>
                                    {formatDirectionalBalance(row.balance, { minDigits: 6, maxDigits: 6 })}
                                  </td>
                                  <td style={{ padding: '0.7rem', textAlign: 'right', color: '#374151', fontSize: '0.85rem' }}>{formatStatementValue(row.price, 4)}</td>
                                  <td style={{ padding: '0.7rem', textAlign: 'right', color: getSignedColor(row.currentValue), fontWeight: '700' }}>
                                    {formatDirectionalBalance(row.currentValue)}
                                  </td>
                                  <td style={{ padding: '0.7rem', textAlign: 'right', color: '#374151', fontSize: '0.85rem' }}>{formatStatementValue(row.breakEven, 4)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <div style={{ borderTop: '1px solid #CBD5E0', background: '#FAFBFC', padding: '0.55rem 0.75rem' }}>
                          <p style={{ margin: 0, color: '#374151', fontWeight: '800', fontSize: '0.82rem' }}>Unfixed metal sales & purchases</p>
                          <p style={{ margin: '0.2rem 0 0', color: '#64748B', fontSize: '0.72rem', lineHeight: 1.4 }}>Rows below reflect the same filters as the statement. Amounts are absolute signed cash effect.</p>
                        </div>
                        <div style={{ overflowX: 'auto' }}>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                            <thead>
                              <tr style={{ background: '#E8EBE0', borderBottom: '2px solid #CBD5E0' }}>
                                <th style={{ padding: '0.7rem', textAlign: 'left', fontWeight: '700', color: '#374151' }}>Date</th>
                                <th style={{ padding: '0.7rem', textAlign: 'left', fontWeight: '700', color: '#374151' }}>Deal</th>
                                <th style={{ padding: '0.7rem', textAlign: 'left', fontWeight: '700', color: '#374151' }}>Metal</th>
                                <th style={{ padding: '0.7rem', textAlign: 'right', fontWeight: '700', color: '#374151' }}>Amount</th>
                              </tr>
                            </thead>
                            <tbody>
                              {unfixedMetalEntries.length ? unfixedMetalEntries.slice(0, 8).map((row, index) => (
                                <tr key={row._id || `${row.date}-${index}`} style={{ background: index % 2 === 0 ? '#FFFFFF' : '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                                  <td style={{ padding: '0.7rem', color: '#111827' }}>{formatStatementDate(row.date)}</td>
                                  <td style={{ padding: '0.7rem', color: '#111827', fontWeight: '600', textTransform: 'capitalize' }}>{row.dealSide}</td>
                                  <td style={{ padding: '0.7rem', color: '#111827' }}>{row.metalCode}</td>
                                  <td style={{ padding: '0.7rem', textAlign: 'right', color: '#111827', fontWeight: '700' }}>{formatStatementValue(row.amount, 2)}</td>
                                </tr>
                              )) : (
                                <tr>
                                  <td colSpan={4} style={{ padding: '0.8rem', textAlign: 'center', color: '#6B7280', fontSize: '0.86rem' }}>
                                    No unfixed metal sale/purchase rows match the selected filters.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                      <div style={{ border: '1px solid #CBD5E0', borderRadius: '0.6rem', background: '#F8FAFC', padding: '0.85rem 0.95rem' }}>
                        <p style={{ margin: 0, color: '#111827', fontWeight: '800', fontSize: '0.92rem' }}>Fixing / Unfixing Metal Sales & Purchases</p>
                        <p style={{ margin: '0.3rem 0 0', color: '#475569', fontSize: '0.8rem', lineHeight: 1.45 }}>
                          Fixed means price locked and finalized. Unfixed means price is still pending; those flows are included in the Position balance and listed above under unfixed activity.
                        </p>
                        <div style={{ marginTop: '0.65rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.55rem' }}>
                          <div style={{ border: '1px solid #BBF7D0', background: '#ECFDF5', borderRadius: '0.45rem', padding: '0.55rem' }}>
                            <p style={{ margin: 0, color: '#166534', fontWeight: '800', fontSize: '0.8rem' }}>Fixed</p>
                            <p style={{ margin: '0.2rem 0 0', color: '#166534', fontSize: '0.76rem' }}>Sales: {fixedMetalSummary.saleCount} ({formatStatementValue(fixedMetalSummary.saleAmount, 2)})</p>
                            <p style={{ margin: '0.15rem 0 0', color: '#166534', fontSize: '0.76rem' }}>Purchases: {fixedMetalSummary.purchaseCount} ({formatStatementValue(fixedMetalSummary.purchaseAmount, 2)})</p>
                          </div>
                          <div style={{ border: '1px solid #FDE68A', background: '#FFFBEB', borderRadius: '0.45rem', padding: '0.55rem' }}>
                            <p style={{ margin: 0, color: '#92400E', fontWeight: '800', fontSize: '0.8rem' }}>Unfixed</p>
                            <p style={{ margin: '0.2rem 0 0', color: '#92400E', fontSize: '0.76rem' }}>Sales: {unfixedMetalSummary.saleCount} ({formatStatementValue(unfixedMetalSummary.saleAmount, 2)})</p>
                            <p style={{ margin: '0.15rem 0 0', color: '#92400E', fontSize: '0.76rem' }}>Purchases: {unfixedMetalSummary.purchaseCount} ({formatStatementValue(unfixedMetalSummary.purchaseAmount, 2)})</p>
                          </div>
                        </div>
                        {unknownFixMetalEntries.length > 0 && (
                          <p style={{ margin: '0.55rem 0 0', color: '#6B7280', fontSize: '0.75rem' }}>
                            {unknownFixMetalEntries.length} metal sale/purchase entries are missing explicit fixing keywords.
                          </p>
                        )}
                      </div>
                    </div>
                    {/* RIGHT COLUMN - Financial Metrics */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', padding: '1rem', background: '#F9FAFB', borderRadius: '0.6rem', border: '1px solid #E5E7EB' }}>
                      {enquiryLiveRecalcEnabled && hasMetalExposure && (
                        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.15rem' }}>
                          <span style={{ fontSize: '0.68rem', fontWeight: '700', color: '#059669', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Live MTM</span>
                        </div>
                      )}
                      {/* Total Funds */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.6rem', borderBottom: '1px solid #E5E7EB' }}>
                        <span style={{ color: '#374151', fontSize: '0.95rem', fontWeight: '600' }}>Total Funds</span>
                        <span style={{ color: '#111827', fontWeight: '700', fontSize: '1rem' }}>
                          {formatDirectionalBalance(modalTotalFundsDisplay, { preferredDirection: accountEnquiryData?.balances?.netDirection })}
                        </span>
                      </div>
                      {/* Revaluation */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.6rem', borderBottom: '1px solid #E5E7EB' }}>
                        <span style={{ color: '#374151', fontSize: '0.95rem', fontWeight: '600' }}>Revaluation</span>
                        <span style={{ color: getSignedColor(modalRevaluationDisplay), fontWeight: '700', fontSize: '1rem' }}>{formatStatementValue(modalRevaluationDisplay, 2)}</span>
                      </div>
                      {/* Net Equity */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.6rem', borderBottom: '1px solid #E5E7EB' }}>
                        <span style={{ color: '#374151', fontSize: '0.95rem', fontWeight: '600' }}>Net Equity</span>
                        <span style={{ color: getAccountEnquirySignedMetricColor(modalNetEquityDisplay, { marginAmount: modalMarginAmtDisplay, netDirection: accountEnquiryData?.balances?.netDirection }), fontWeight: '700', fontSize: '1rem' }}>
                          {formatDirectionalBalance(modalNetEquityDisplay, { preferredDirection: resolveExposureDirection(modalNetEquityDisplay) })}
                        </span>
                      </div>
                      {/* Margin Amt @ 2% */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.6rem', borderBottom: '1px solid #E5E7EB' }}>
                        <span style={{ color: '#374151', fontSize: '0.95rem', fontWeight: '600' }}>Margin Amt @ 2.0%</span>
                        <span style={{ color: getSignedColor(modalMarginAmtDisplay), fontWeight: '700', fontSize: '1rem' }}>{formatStatementValue(modalMarginAmtDisplay, 2)}</span>
                      </div>
                      {/* Excess with Currency Dropdown */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: '0.6rem', borderBottom: '1px solid #E5E7EB' }}>
                        <label style={{ color: '#374151', fontSize: '0.95rem', fontWeight: '600' }}>Excess</label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <select
                            value={excessCurrency || baseCurrencyCode}
                            onChange={(e) => setExcessCurrency(e.target.value)}
                            style={{ border: '1px solid #CBD5E0', borderRadius: '0.4rem', background: '#FFFFFF', fontSize: '0.85rem', padding: '0.3rem 0.5rem', fontWeight: '600' }}
                          >
                            {(statementDisplayCurrencyOptions.length ? statementDisplayCurrencyOptions : [baseCurrencyCode]).map((currencyCode) => (
                              <option key={currencyCode} value={currencyCode}>{currencyCode}</option>
                            ))}
                          </select>
                          <span style={{ color: getAccountEnquirySignedMetricColor(modalExcessDisplay, { marginAmount: modalMarginAmtDisplay, netDirection: accountEnquiryData?.balances?.netDirection }), fontWeight: '800', fontSize: '1.05rem', minWidth: '80px', textAlign: 'right' }}>
                            {formatAccountEnquiryExcessDisplay({
                              excess: modalExcessDisplay,
                              marginAmount: modalMarginAmtDisplay,
                              netDirection: accountEnquiryData?.balances?.netDirection,
                              formatValue: (value) => formatStatementValue(value, 2),
                            })}
                          </span>
                        </div>
                      </div>
                      {/* Margin % */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.4rem' }}>
                        <span style={{ color: '#374151', fontSize: '0.95rem', fontWeight: '600' }}>Margin %</span>
                        <span style={{ color: '#1565c0', fontWeight: '800', fontSize: '1.1rem' }}>{formatStatementValue(modalMarginPctDisplay, 2)}%</span>
                      </div>
                      <p style={{ margin: '0.45rem 0 0', color: '#6B7280', fontSize: '0.72rem', lineHeight: 1.45 }}>
                        Customer credit balances are treated as favorable in Customer Margin; supplier credit balances remain payable.
                        {enquirySuppressMetalSpotMtm && (
                          <span>
                            {' '}
                            For creditor/vendor payables, Total Funds uses the ledger payable balance; revaluation uses booked unfixed metal when posted, otherwise live spot on gram position.
                          </span>
                        )}
                        {!enquirySuppressMetalSpotMtm && enquiryLiveRecalcEnabled && hasMetalExposure && (
                          <span>
                            {' '}
                            Revaluation, Net Equity, Margin, and Excess update with live spot when the account has metal exposure (grams). Total Funds stays on the ledger balance.
                          </span>
                        )}
                        {!enquirySuppressMetalSpotMtm && enquiryLiveRecalcEnabled && !hasMetalExposure && (
                          <span>
                            {' '}
                            Cash-only account: Total Funds stays on the ledger balance; Revaluation and margin rows stay at 0 while Position Price still updates with live spot.
                          </span>
                        )}
                        {!enquirySuppressMetalSpotMtm && !enquiryLiveRecalcEnabled && (
                          <span>
                            {' '}
                            Revaluation and equity update with live spot when the account has metal exposure (grams). Cash-only accounts show Revaluation 0 while Price still moves.
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  {/* Full Statement Table */}
                  <div style={{ marginTop: '1.25rem', border: '1px solid #CBD5E0', borderRadius: '0.65rem', overflow: 'hidden', background: '#FFFFFF' }}>
                    <div style={{ padding: '0.85rem 1rem', background: '#F5F7F0', borderBottom: '1px solid #D1D5DB', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                      <div>
                        <p style={{ margin: 0, fontSize: '0.95rem', color: '#111827', fontWeight: '800' }}>Full Statement of Account</p>
                        <p style={{ margin: '0.2rem 0 0', fontSize: '0.8rem', color: '#6B7280' }}>{filteredStatementEntries.length} entries shown</p>
                      </div>
                      {recentPaymentReceiptEntry && (
                        <div style={{ background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: '0.45rem', padding: '0.45rem 0.6rem' }}>
                          <p style={{ margin: 0, fontSize: '0.73rem', color: '#065F46', fontWeight: '700' }}>Recent Payment/Receipt</p>
                          <p style={{ margin: '0.15rem 0 0', fontSize: '0.8rem', color: '#065F46', fontWeight: '700' }}>
                            {formatStatementDate(recentPaymentReceiptEntry.date)} · {String(recentPaymentReceiptEntry.referenceType || '').toUpperCase()} · #{resolveStatementReceiptNo(recentPaymentReceiptEntry)}
                          </p>
                        </div>
                      )}
                    </div>
                    <div style={{ padding: '0.75rem 1rem', borderBottom: '1px solid #E5E7EB', background: '#FAFBFC' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.55rem' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Filter</span>
                        <div style={{ flex: 1, height: '1px', background: '#E2E8F0' }} />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '0.6rem', marginBottom: '0.75rem' }}>
                        <label style={{ display: 'grid', gap: '0.28rem', color: '#64748B', fontSize: '0.78rem', fontWeight: '700' }}>
                          <span>Date From</span>
                          <input
                            type="date"
                            value={statementFilters.startDate}
                            onChange={(e) => setStatementFilters((prev) => ({ ...prev, startDate: e.target.value }))}
                            style={ERP_MODAL_INPUT_STYLE}
                          />
                        </label>
                        <label style={{ display: 'grid', gap: '0.28rem', color: '#64748B', fontSize: '0.78rem', fontWeight: '700' }}>
                          <span>Date To</span>
                          <input
                            type="date"
                            value={statementFilters.endDate}
                            onChange={(e) => setStatementFilters((prev) => ({ ...prev, endDate: e.target.value }))}
                            style={ERP_MODAL_INPUT_STYLE}
                          />
                        </label>
                        <label style={{ display: 'grid', gap: '0.28rem', color: '#64748B', fontSize: '0.78rem', fontWeight: '700' }}>
                          <span>All Types</span>
                          <select
                            value={statementFilters.referenceType}
                            onChange={(e) => setStatementFilters((prev) => ({ ...prev, referenceType: e.target.value }))}
                            style={ERP_MODAL_INPUT_STYLE}
                          >
                            <option value="">All Types</option>
                            {statementReferenceTypes.map((type) => (
                              <option key={type} value={type}>{type}</option>
                            ))}
                          </select>
                        </label>
                        <label style={{ display: 'grid', gap: '0.28rem', color: '#64748B', fontSize: '0.78rem', fontWeight: '700' }}>
                          <span>All Departments</span>
                          <select
                            value={statementFilters.department}
                            onChange={(e) => setStatementFilters((prev) => ({ ...prev, department: e.target.value }))}
                            style={ERP_MODAL_INPUT_STYLE}
                          >
                            <option value="">All Departments</option>
                            {statementDepartments.map((department) => (
                              <option key={department} value={department}>{department}</option>
                            ))}
                          </select>
                        </label>
                        <label style={{ display: 'grid', gap: '0.28rem', color: '#64748B', fontSize: '0.78rem', fontWeight: '700' }}>
                          <span>All Fixing Status</span>
                          <select
                            value={statementFilters.fixStatus}
                            onChange={(e) => setStatementFilters((prev) => ({ ...prev, fixStatus: e.target.value }))}
                            style={ERP_MODAL_INPUT_STYLE}
                          >
                            <option value="">All Fixing Status</option>
                            <option value="fixed">Fixed Only</option>
                            <option value="unfixed">Unfixed Only</option>
                            <option value="unknown">Unknown Only</option>
                          </select>
                        </label>
                        <button
                          type="button"
                          onClick={() => {
                            setStatementFilters({ startDate: '', endDate: '', referenceType: '', department: '', fixStatus: '', foreignCurrency: '', metalCommodity: '', showAmountIn: '' })
                            setStatementMetalCommodityEnabled(false)
                          }}
                          style={{ padding: '0.65rem 0.75rem', background: '#E5E7EB', color: C.ink, border: '1px solid #D1D5DB', borderRadius: '0.5rem', cursor: 'pointer', height: 'fit-content', alignSelf: 'end', fontWeight: '600', fontSize: '0.78rem' }}
                        >
                          Reset
                        </button>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', margin: '0.1rem 0 0.55rem' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: '800', color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Display</span>
                        <div style={{ flex: 1, height: '1px', background: '#E2E8F0' }} />
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '0.6rem', marginBottom: '0.75rem' }}>
                        <label style={{ display: 'grid', gap: '0.28rem', color: '#64748B', fontSize: '0.78rem', fontWeight: '700' }}>
                          <span>Foreign Currency</span>
                          <select
                            value={statementFilters.foreignCurrency}
                            onChange={(e) => setStatementFilters((prev) => ({ ...prev, foreignCurrency: e.target.value }))}
                            style={ERP_MODAL_INPUT_STYLE}
                          >
                            {statementFilterCurrencyOptions.map((currencyCode) => (
                              <option key={currencyCode} value={currencyCode === 'ALL' ? '' : currencyCode}>
                                {currencyCode === 'ALL' ? 'All' : currencyCode}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label style={{ display: 'grid', gap: '0.28rem', color: '#64748B', fontSize: '0.78rem', fontWeight: '700' }}>
                          <span>Metal/Commodities</span>
                          <div style={{ display: 'grid', gap: '0.45rem' }}>
                            <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', color: '#334155', fontSize: '0.78rem', fontWeight: '700' }}>
                              <input
                                type="checkbox"
                                checked={statementMetalCommodityEnabled}
                                onChange={(e) => {
                                  const enabled = e.target.checked
                                  setStatementMetalCommodityEnabled(enabled)
                                  if (!enabled) {
                                    setStatementFilters((prev) => ({ ...prev, metalCommodity: '' }))
                                  } else if (!statementFilters.metalCommodity) {
                                    setStatementFilters((prev) => ({ ...prev, metalCommodity: 'Gold' }))
                                  }
                                }}
                                style={{ cursor: 'pointer' }}
                              />
                              Enable metal filter
                            </label>
                            <select
                              value={statementFilters.metalCommodity || ''}
                              onChange={(e) => setStatementFilters((prev) => ({ ...prev, metalCommodity: e.target.value }))}
                              style={{ ...ERP_MODAL_INPUT_STYLE, marginBottom: 0, opacity: statementMetalCommodityEnabled ? 1 : 0.55 }}
                              disabled={!statementMetalCommodityEnabled}
                            >
                              <option value="">All Metals</option>
                              {statementMetalOptions.map((metalOption) => (
                                <option key={metalOption} value={metalOption}>{metalOption}</option>
                              ))}
                            </select>
                          </div>
                        </label>
                        <label style={{ display: 'grid', gap: '0.28rem', color: '#64748B', fontSize: '0.78rem', fontWeight: '700' }}>
                          <span>Show Amount In</span>
                          <select
                            value={statementFilters.showAmountIn || statementDisplayCurrency}
                            onChange={(e) => setStatementFilters((prev) => ({ ...prev, showAmountIn: e.target.value }))}
                            style={ERP_MODAL_INPUT_STYLE}
                          >
                            {statementDisplayCurrencyOptions.map((currencyCode) => (
                              <option key={currencyCode} value={currencyCode}>{currencyCode}</option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <label style={{ display: 'inline-flex', alignItems: 'center', gap: '0.45rem', color: '#334155', fontSize: '0.82rem', fontWeight: '600', background: '#F8FAFC', border: '1px solid #D1D5DB', borderRadius: '0.5rem', padding: '0.62rem 0.7rem', cursor: 'pointer' }}>
                        <input
                          type="checkbox"
                          checked={showStatementAuditIds}
                          onChange={(e) => setShowStatementAuditIds(e.target.checked)}
                          style={{ cursor: 'pointer' }}
                        />
                        Show Transaction ID
                      </label>
                    </div>
                    <div ref={statementTableRef} tabIndex={-1} style={{ overflowX: 'auto' }} data-statement-table="true">
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                        <thead>
                          <tr style={{ background: '#E8EBE0', borderBottom: '1px solid #CBD5E0' }}>
                            <th style={{ padding: '0.6rem', textAlign: 'left', color: '#374151', fontWeight: '700' }}>Date</th>
                            <th style={{ padding: '0.6rem', textAlign: 'left', color: '#374151', fontWeight: '700' }}>Receipt No</th>
                            {showStatementAuditIds && <th style={{ padding: '0.6rem', textAlign: 'left', color: '#374151', fontWeight: '700' }}>Transaction ID</th>}
                            <th style={{ padding: '0.6rem', textAlign: 'left', color: '#374151', fontWeight: '700' }}>Deal</th>
                            <th style={{ padding: '0.6rem', textAlign: 'left', color: '#374151', fontWeight: '700' }}>Fixing</th>
                            <th style={{ padding: '0.6rem', textAlign: 'left', color: '#374151', fontWeight: '700' }}>Offset Account</th>
                            <th colSpan={3} style={{ padding: '0.6rem', textAlign: 'center', color: '#111827', fontWeight: '800', borderLeft: '1px solid #CBD5E0' }}>Amount In {statementDisplayCurrency}</th>
                            <th colSpan={3} style={{ padding: '0.6rem', textAlign: 'center', color: '#111827', fontWeight: '800', borderLeft: '1px solid #CBD5E0' }}>Pure WT In Grams</th>
                          </tr>
                          <tr style={{ background: '#EEF1E8', borderBottom: '2px solid #CBD5E0' }}>
                            <th colSpan={showStatementAuditIds ? 6 : 5} style={{ padding: 0, border: 0 }} />
                            <th style={{ padding: '0.45rem 0.6rem', textAlign: 'right', color: '#374151', fontWeight: '700', borderLeft: '1px solid #CBD5E0' }}>Debit</th>
                            <th style={{ padding: '0.45rem 0.6rem', textAlign: 'right', color: '#374151', fontWeight: '700' }}>Credit</th>
                            <th style={{ padding: '0.45rem 0.6rem', textAlign: 'right', color: '#374151', fontWeight: '700' }}>Balance</th>
                            <th style={{ padding: '0.45rem 0.6rem', textAlign: 'right', color: '#374151', fontWeight: '700', borderLeft: '1px solid #CBD5E0' }}>Debit</th>
                            <th style={{ padding: '0.45rem 0.6rem', textAlign: 'right', color: '#374151', fontWeight: '700' }}>Credit</th>
                            <th style={{ padding: '0.45rem 0.6rem', textAlign: 'right', color: '#374151', fontWeight: '700' }}>Balance</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredStatementEntries.length === 0 ? (
                            <tr>
                              <td colSpan={showStatementAuditIds ? 13 : 12} style={{ padding: '1rem', textAlign: 'center', color: '#6B7280', fontStyle: 'italic' }}>
                                No statement entries found for selected filters.
                              </td>
                            </tr>
                          ) : (
                            filteredStatementEntries.map((entry, index) => {
                              const receiptNo = resolveStatementReceiptNo(entry)
                              // Account enquiry statement amounts are already in base currency from API.
                              const debitUsd = Number(entry.debitAmount || 0)
                              const creditUsd = Number(entry.creditAmount || 0)
                              const balanceUsd = Number(entry.runningBalance || 0)
                              const debitDisplay = convertStatementDisplayAmount(debitUsd)
                              const creditDisplay = convertStatementDisplayAmount(creditUsd)
                              const balanceDisplay = convertStatementDisplayAmount(balanceUsd)
                              const sourceType = String(entry.sourceTransactionType || entry.referenceType || '').toLowerCase()
                              const entryMetalCode = resolveMetalCode(entry)
                              const isMetalRow = isMetalStatementEntry(entry) && entryMetalCode === statementSelectedMetalCode
                              const signedPureWeight = Number(entry.metalSignedWeight || 0)
                              const debitPureWeight = isMetalRow && signedPureWeight > 0 ? signedPureWeight : (isMetalRow ? 0 : null)
                              const creditPureWeight = isMetalRow && signedPureWeight < 0 ? Math.abs(signedPureWeight) : (isMetalRow ? 0 : null)
                              const balancePureWeight = isMetalRow ? (pureWeightRunningByEntryKey.get(entry._id) ?? null) : null
                              return (
                                <tr key={entry._id || `${entry.date}-${index}`} style={{ background: index % 2 === 0 ? '#FFFFFF' : '#F9FAFB', borderBottom: '1px solid #E5E7EB' }}>
                                  <td style={{ padding: '0.6rem', color: '#374151' }}>{formatStatementDate(entry.date)}</td>
                                  <td style={{ padding: '0.6rem', color: '#111827', fontFamily: 'monospace', fontSize: '0.8rem' }}>{receiptNo}</td>
                                  {showStatementAuditIds && <td style={{ padding: '0.6rem', color: '#475569', fontFamily: 'monospace', fontSize: '0.78rem' }}>{entry.sourceTransactionId || '-'}</td>}
                                  <td style={{ padding: '0.6rem', color: '#374151', textTransform: 'capitalize' }}>{entry.metalDealType || '-'}</td>
                                  <td style={{ padding: '0.6rem' }}>
                                    {(sourceType === 'sale' || sourceType === 'purchase') && (entry.metalFixStatus === 'fixed' || entry.metalFixStatus === 'unfixed') ? (
                                      <span style={{ background: entry.metalFixStatus === 'fixed' ? '#DCFCE7' : '#FEF3C7', color: entry.metalFixStatus === 'fixed' ? '#166534' : '#92400E', borderRadius: '999px', padding: '0.12rem 0.45rem', fontSize: '0.72rem', fontWeight: '700', textTransform: 'capitalize' }}>
                                        {entry.metalFixStatus}
                                      </span>
                                    ) : '-'}
                                  </td>
                                  <td style={{ padding: '0.6rem', color: '#374151' }}>
                                    {entry.offsetAccountCode ? `${entry.offsetAccountCode}${entry.offsetAccountName ? ` - ${entry.offsetAccountName}` : ''}` : '-'}
                                  </td>
                                  <td style={{ padding: '0.6rem', textAlign: 'right', color: '#065F46', fontWeight: '600', borderLeft: '1px solid #E5E7EB' }}>{formatStatementValue(debitDisplay, 2)}</td>
                                  <td style={{ padding: '0.6rem', textAlign: 'right', color: '#B91C1C', fontWeight: '600' }}>{formatStatementValue(creditDisplay, 2)}</td>
                                  <td style={{ padding: '0.6rem', textAlign: 'right', color: getSignedColor(balanceDisplay), fontWeight: '700' }}>
                                    {formatDirectionalBalance(balanceDisplay)}
                                  </td>
                                  <td style={{ padding: '0.6rem', textAlign: 'right', color: '#065F46', fontWeight: '600', borderLeft: '1px solid #E5E7EB' }}>{formatStatementNullableValue(debitPureWeight, 2)}</td>
                                  <td style={{ padding: '0.6rem', textAlign: 'right', color: '#B91C1C', fontWeight: '600' }}>{formatStatementNullableValue(creditPureWeight, 2)}</td>
                                  <td style={{ padding: '0.6rem', textAlign: 'right', color: getSignedColor(balancePureWeight), fontWeight: '700' }}>
                                    {balancePureWeight === null ? '-' : formatDirectionalBalance(balancePureWeight)}
                                  </td>
                                </tr>
                              )
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}
            </div>
            {/* Footer */}
            <div style={{ background: '#F9FAFB', borderTop: '1px solid #E5E7EB', padding: '1rem 1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              {canExportAccountSummary && accountEnquiryData && (
                <>
                  <a
                    href={buildAccountEnquiryHref?.(accountEnquiryData?.account?.accountCode, 'statement') || '#'}
                    onClick={(event) => {
                      if (!isPrimaryNavClick(event)) return
                      event.preventDefault()
                      handleViewStatement()
                    }}
                    style={{
                      ...linkButtonStyle,
                      padding: '0.6rem 1.2rem',
                      background: '#3B82F6',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '0.5rem',
                      fontSize: '0.95rem',
                      cursor: 'pointer',
                      fontWeight: '700',
                    }}
                  >
                    👁 View Statement
                  </a>
                  <button onClick={handleExportEnquiryPdf} style={{ padding: '0.6rem 1.2rem', background: 'var(--purple)', color: '#fff', border: 'none', borderRadius: '0.5rem', fontSize: '0.95rem', cursor: 'pointer', fontWeight: '700' }}>Export PDF</button>
                </>
              )}
              <button onClick={() => onClose()} style={{ padding: '0.6rem 1.2rem', background: '#6B7280', color: '#fff', border: 'none', borderRadius: '0.5rem', fontSize: '0.95rem', cursor: 'pointer', fontWeight: '700' }}>Close</button>
            </div>
          </div>
        </div>
  )
}
