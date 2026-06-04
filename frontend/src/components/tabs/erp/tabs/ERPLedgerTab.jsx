import { Fragment } from 'react'
import AccountCombobox from '../../../AccountCombobox'
import {
  groupJvLedgerEntries,
  inferLegacyJvBatchDisplayFc,
  normalizeJvCurrencyCode,
} from '../journalVoucherHelpers'

export default function ERPLedgerTab({
  activeTab,
  C,
  canManageAccounts,
  showLedgerForm,
  openJvModal,
  ledgerVoucherTab,
  setLedgerVoucherTab,
  JV_MODE_META,
  resolveJvModeMeta,
  jvMode,
  getJvValidation,
  jvLines,
  baseCurrencyCode,
  closeJvModal,
  jvModalSize,
  jvModalOffset,
  jvModalDrag,
  jvModalResize,
  beginJvModalDrag,
  switchJvMode,
  jvEditEntryIds,
  currencies,
  jvHeader,
  setJvHeader,
  bankJvComboGroups,
  jvComboGroups,
  resolveJvLineAccount,
  handleJvAccountKeyDown,
  updateJvLine,
  handleJvLineKeyDown,
  removeJvLine,
  addJvLine,
  handlePrintJvVoucher,
  handleSaveMultiLineJV,
  saving,
  beginJvModalResize,
  ledgerFilters,
  setLedgerFilters,
  modalInputStyle,
  LEDGER_DEPARTMENTS,
  LEDGER_REFERENCE_TYPES,
  accounts,
  sorting,
  setSorting,
  ledger,
  ledgerMeta,
  loadLedger,
  handleEditJv,
  handleEditLedger: _handleEditLedger,
  handleReverseLedger,
  isFinance,
  handleRepairJvFxPreview,
  handleRepairJvFxApply,
}) {
  const visibleJvLedgerEntries = activeTab === 'ledger'
    ? ledger.filter((entry) => String(entry.referenceType || '').toLowerCase() === ledgerVoucherTab)
    : []
  const groupedJvVouchers = groupJvLedgerEntries(visibleJvLedgerEntries, { baseCurrencyCode })

  return (
    <>
      {/* LEDGER TAB */}
      {activeTab === 'ledger' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', gap: '1rem', flexWrap: 'wrap' }}>
            <h3 style={{ marginBottom: 0, color: C.ink, fontSize: '1.25rem', fontWeight: '700' }}>Journal Voucher</h3>
            <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap' }}>
              {Object.entries(JV_MODE_META).map(([mode, meta]) => {
                const active = ledgerVoucherTab === mode
                return (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setLedgerVoucherTab(mode)}
                    style={{
                      padding: '0.45rem 0.8rem',
                      borderRadius: '0.45rem',
                      border: `1px solid ${active ? '#1E40AF' : '#CBD5E1'}`,
                      background: active ? '#DBEAFE' : '#F8FAFC',
                      color: active ? '#1E3A8A' : '#334155',
                      fontWeight: '700',
                      cursor: 'pointer',
                      fontSize: '0.8rem',
                    }}
                  >
                    {meta.label}
                  </button>
                )
              })}
            </div>
            {isFinance && (
              <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => { void handleRepairJvFxPreview() }}
                  title="Dry-run: how many legacy journal/bank_jv rows would get UZS + rate"
                  style={{
                    padding: '0.45rem 0.75rem',
                    borderRadius: '0.4rem',
                    border: '1px solid #94A3B8',
                    background: '#F1F5F9',
                    color: '#0F172A',
                    fontWeight: '700',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    fontSize: '0.78rem',
                    opacity: saving ? 0.65 : 1,
                  }}
                >
                  Preview JV FX repair
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => { void handleRepairJvFxApply() }}
                  title="Writes UZS + exchangeRate on legacy rows (needs maintenance token)"
                  style={{
                    padding: '0.45rem 0.75rem',
                    borderRadius: '0.4rem',
                    border: '1px solid #B45309',
                    background: '#FFFBEB',
                    color: '#92400E',
                    fontWeight: '700',
                    cursor: saving ? 'not-allowed' : 'pointer',
                    fontSize: '0.78rem',
                    opacity: saving ? 0.65 : 1,
                  }}
                >
                  Apply JV FX repair
                </button>
              </div>
            )}
            {canManageAccounts && (
              <button
                onClick={() => { if (!showLedgerForm) void openJvModal(ledgerVoucherTab) }}
                disabled={showLedgerForm}
                style={{
                  padding: '0.5rem 1rem',
                  background: showLedgerForm ? '#9CA3AF' : C.s1,
                  color: C.t1,
                  border: 'none',
                  borderRadius: '0.375rem',
                  cursor: showLedgerForm ? 'not-allowed' : 'pointer',
                  fontWeight: '600',
                }}
              >
                {ledgerVoucherTab === 'bank_jv' ? '+ New Bank JV' : '+ New Journal Voucher'}
              </button>
            )}
          </div>
          {showLedgerForm && (() => {
            const jvModeMeta = resolveJvModeMeta(jvMode)
            const jvValidation = getJvValidation(jvLines)
            const jvTotalDebit = jvValidation.totalDebit
            const jvTotalCredit = jvValidation.totalCredit
            const jvDisplayDebit = jvValidation.displayDebitTotal ?? jvValidation.totalDebit
            const jvDisplayCredit = jvValidation.displayCreditTotal ?? jvValidation.totalCredit
            const jvTotalCurrencyLabel = jvValidation.displayTotalCurrency || baseCurrencyCode
            const jvDifference = jvValidation.difference
            const jvIsBalanced = jvValidation.isBalanced
            const cellSt = { padding: '0.28rem 0.4rem', border: '1px solid #D1D5DB', background: '#fff', color: C.ink, borderRadius: '0.25rem', fontSize: '0.875rem', width: '100%', boxSizing: 'border-box' }
            const numCellSt = { ...cellSt, textAlign: 'right' }
            return (
            <div
              style={{ position: 'fixed', inset: 0, background: 'rgba(2, 6, 23, 0.62)', zIndex: 1700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}
              onClick={closeJvModal}
            >
              <div
                style={{ width: `min(${jvModalSize.width}px, 92vw)`, height: `min(${jvModalSize.height}px, 90vh)`, transform: `translate(${jvModalOffset.x}px, ${jvModalOffset.y}px)`, userSelect: (jvModalDrag.active || jvModalResize.active) ? 'none' : 'auto', boxShadow: '0 28px 55px rgba(2, 6, 23, 0.45)', borderRadius: '0.6rem', position: 'relative', display: 'flex', flexDirection: 'column' }}
                onClick={(e) => e.stopPropagation()}
              >
                <div
                  onMouseDown={beginJvModalDrag}
                  style={{ background: '#0F172A', color: '#fff', padding: '0.62rem 0.9rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderTopLeftRadius: '0.6rem', borderTopRightRadius: '0.6rem', cursor: jvModalDrag.active ? 'grabbing' : 'grab', userSelect: 'none' }}
                >
                  <span style={{ fontWeight: '700', fontSize: '0.88rem' }}>{jvModeMeta.label}</span>
                  <span style={{ color: '#94A3B8', fontSize: '0.72rem', marginLeft: '0.35rem' }}>drag window</span>
                  <button
                    type="button"
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={closeJvModal}
                    style={{ marginLeft: 'auto', background: '#F97316', border: 'none', color: '#111827', borderRadius: '0.35rem', padding: '0.34rem 0.65rem', cursor: 'pointer', fontWeight: '700', fontSize: '0.78rem' }}
                  >
                    X Close
                  </button>
                </div>
            <div style={{ background: '#F8FAFC', border: '1px solid #CBD5E1', borderTop: 'none', borderBottomLeftRadius: '0.6rem', borderBottomRightRadius: '0.6rem', marginBottom: 0, overflow: 'hidden auto', flex: 1, minHeight: 0 }}>
              {/* JV Header bar */}
              <div style={{ background: 'linear-gradient(135deg, #1E3A5F 0%, #2D5A8E 100%)', padding: '0.6rem 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: '#fff', fontWeight: '800', fontSize: '0.95rem', letterSpacing: '0.04em' }}>📒 {jvEditEntryIds.length > 0 ? `EDIT ${jvModeMeta.badge}` : jvModeMeta.badge}</span>
                <span style={{ marginLeft: 'auto', color: '#94A3B8', fontSize: '0.75rem' }}>Base: {baseCurrencyCode}</span>
              </div>

              <div style={{ display: 'flex', gap: '0.45rem', padding: '0.55rem 1rem', background: '#E2E8F0', borderBottom: '1px solid #CBD5E1' }}>
                {Object.entries(JV_MODE_META).map(([mode, meta]) => {
                  const active = jvMode === mode
                  return (
                    <button
                      key={`jv-mode-${mode}`}
                      type="button"
                      onClick={() => { void switchJvMode(mode) }}
                      disabled={jvEditEntryIds.length > 0}
                      style={{
                        padding: '0.35rem 0.7rem',
                        borderRadius: '0.35rem',
                        border: `1px solid ${active ? '#1D4ED8' : '#CBD5E1'}`,
                        background: active ? '#DBEAFE' : '#F8FAFC',
                        color: active ? '#1E3A8A' : '#334155',
                        fontWeight: '700',
                        cursor: jvEditEntryIds.length > 0 ? 'not-allowed' : 'pointer',
                        opacity: jvEditEntryIds.length > 0 ? 0.65 : 1,
                        fontSize: '0.78rem',
                      }}
                    >
                      {meta.label}
                    </button>
                  )
                })}
              </div>

              {/* Header fields */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.6rem', padding: '0.65rem 1rem 0.5rem', alignItems: 'end', background: '#F1F5F9', borderBottom: '1px solid #CBD5E1' }}>
                <div>
                  <div style={{ fontSize: '0.68rem', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', marginBottom: '2px' }}>Doc No</div>
                  <input value={jvHeader.docNo} onChange={(e) => setJvHeader((p) => ({ ...p, docNo: e.target.value }))} placeholder={jvMode === 'bank_jv' ? 'BnkJV/2026/0001' : 'Jv/2026/0001'} style={cellSt} />
                </div>
                <div>
                  <div style={{ fontSize: '0.68rem', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', marginBottom: '2px' }}>Date</div>
                  <input type="date" value={jvHeader.date} onChange={(e) => setJvHeader((p) => ({ ...p, date: e.target.value }))} style={cellSt} />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <div style={{ fontSize: '0.68rem', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', marginBottom: '2px' }}>Narration</div>
                  <input value={jvHeader.narration} onChange={(e) => setJvHeader((p) => ({ ...p, narration: e.target.value }))} placeholder="Narration / description..." style={cellSt} />
                </div>
                <div>
                  <div style={{ fontSize: '0.68rem', fontWeight: '700', color: '#64748B', textTransform: 'uppercase', marginBottom: '2px' }}>Currency</div>
                  <select value={jvHeader.currency || baseCurrencyCode} onChange={(e) => setJvHeader((p) => ({ ...p, currency: e.target.value }))} style={cellSt}>
                    {currencies.map((currency) => (
                      <option key={currency._id || currency.code} value={currency.code}>{currency.code} - {currency.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Lines table */}
              <div style={{ padding: '0 0 0 0', overflow: 'visible', position: 'relative', zIndex: 5 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
                  <thead>
                    <tr style={{ background: '#1E3A5F', color: '#fff' }}>
                      <th style={{ padding: '0.45rem 0.5rem', textAlign: 'center', width: '36px', fontWeight: '600', fontSize: '0.75rem' }}>#</th>
                      <th style={{ padding: '0.45rem 0.6rem', textAlign: 'left', minWidth: '240px', fontWeight: '600', fontSize: '0.75rem' }}>Account</th>
                      <th style={{ padding: '0.45rem 0.6rem', textAlign: 'left', fontWeight: '600', fontSize: '0.75rem' }}>Description (optional)</th>
                      <th style={{ padding: '0.45rem 0.6rem', textAlign: 'right', width: '160px', fontWeight: '600', fontSize: '0.75rem', color: '#93C5FD' }}>Debit (Line Curr)</th>
                      <th style={{ padding: '0.45rem 0.6rem', textAlign: 'right', width: '160px', fontWeight: '600', fontSize: '0.75rem', color: '#FCA5A5' }}>Credit (Line Curr)</th>
                      <th style={{ padding: '0.45rem 0.4rem', width: '36px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {jvLines.map((line, idx) => {
                      const lineIssue = jvValidation.lineIssuesById[line.id] || ''
                      return (
                        <Fragment key={`line-wrap-${line.id}`}>
                          <tr key={`line-${line.id}`} style={{ background: idx % 2 === 0 ? '#fff' : '#F8FAFC', borderBottom: lineIssue ? 'none' : '1px solid #E5E7EB' }}>
                            <td style={{ padding: '0.3rem 0.4rem', textAlign: 'center', color: '#9CA3AF', fontSize: '0.78rem', userSelect: 'none' }}>{idx + 1}</td>
                            <td style={{ padding: '0.25rem 0.4rem', position: 'relative', zIndex: 20 }}>
                              <AccountCombobox
                                groups={jvMode === 'bank_jv' ? bankJvComboGroups : jvComboGroups}
                                value={line.accountId || ''}
                                onChange={(val, lbl) => resolveJvLineAccount(line.id, val, lbl)}
                                onKeyDown={(e) => handleJvAccountKeyDown(e, idx)}
                                placeholder="Type account code or name..."
                                style={{ ...cellSt, minWidth: '220px', borderColor: lineIssue && !line.accountId ? '#FCA5A5' : '#D1D5DB' }}
                              />
                            </td>
                            <td style={{ padding: '0.25rem 0.4rem' }}>
                              <input
                                value={line.description}
                                onChange={(e) => updateJvLine(line.id, 'description', e.target.value)}
                                onKeyDown={(e) => handleJvLineKeyDown(e, idx)}
                                placeholder="Line description..."
                                style={{ ...cellSt, minWidth: '180px' }}
                              />
                            </td>
                            <td style={{ padding: '0.25rem 0.4rem' }}>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={line.debit}
                                onChange={(e) => updateJvLine(line.id, 'debit', e.target.value)}
                                onKeyDown={(e) => handleJvLineKeyDown(e, idx)}
                                placeholder="0.00"
                                style={{ ...numCellSt, color: '#1D4ED8', fontWeight: line.debit ? '700' : '400', borderColor: (lineIssue && Number(line.debit || 0) > 0 && Number(line.credit || 0) > 0) ? '#FCA5A5' : '#D1D5DB' }}
                              />
                            </td>
                            <td style={{ padding: '0.25rem 0.4rem' }}>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={line.credit}
                                onChange={(e) => updateJvLine(line.id, 'credit', e.target.value)}
                                onKeyDown={(e) => handleJvLineKeyDown(e, idx)}
                                placeholder="0.00"
                                style={{ ...numCellSt, color: '#DC2626', fontWeight: line.credit ? '700' : '400', borderColor: (lineIssue && Number(line.debit || 0) > 0 && Number(line.credit || 0) > 0) ? '#FCA5A5' : '#D1D5DB' }}
                              />
                            </td>
                            <td style={{ padding: '0.25rem 0.3rem', textAlign: 'center' }}>
                              {jvLines.length > 2 && (
                                <button type="button" onClick={() => removeJvLine(line.id)} title="Remove row" style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1, padding: '0 0.1rem' }}>×</button>
                              )}
                            </td>
                          </tr>
                          {lineIssue && (
                            <tr key={`line-issue-${line.id}`} style={{ background: '#FEF2F2', borderBottom: '1px solid #FECACA' }}>
                              <td></td>
                              <td colSpan={5} style={{ padding: '0.2rem 0.5rem 0.35rem', color: '#B91C1C', fontSize: '0.74rem', fontWeight: '600' }}>
                                {lineIssue}
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      )
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: '#F1F5F9', borderTop: '2px solid #CBD5E1' }}>
                      <td colSpan={3} style={{ padding: '0.5rem 0.6rem', textAlign: 'right', fontWeight: '700', fontSize: '0.82rem', color: C.ink }}>TOTAL</td>
                      <td style={{ padding: '0.5rem 0.6rem', textAlign: 'right', fontWeight: '800', fontSize: '0.92rem', color: '#1D4ED8' }}>{jvDisplayDebit > 0 ? jvDisplayDebit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}</td>
                      <td style={{ padding: '0.5rem 0.6rem', textAlign: 'right', fontWeight: '800', fontSize: '0.92rem', color: '#DC2626' }}>{jvDisplayCredit > 0 ? jvDisplayCredit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* Balance status */}
              {(jvTotalDebit > 0 || jvTotalCredit > 0 || jvValidation.hasLineIssues) && (
                <div style={{ margin: '0.5rem 1rem 0', padding: '0.4rem 0.75rem', borderRadius: '0.375rem', background: jvIsBalanced ? '#DCFCE7' : '#FEF2F2', border: `1px solid ${jvIsBalanced ? '#86EFAC' : '#FECACA'}`, color: jvIsBalanced ? '#166534' : '#991B1B', fontSize: '0.82rem', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  {jvValidation.hasLineIssues
                    ? Object.values(jvValidation.lineIssuesById)[0]
                    : jvIsBalanced
                    ? `✓ Balanced — Total = ${jvDisplayDebit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${jvTotalCurrencyLabel}`
                    : `⚠ Debit and Credit totals are not balanced (diff: ${Math.abs(jvDifference).toFixed(2)} ${baseCurrencyCode})`}
                </div>
              )}

              <div style={{ margin: '0.5rem 1rem 0', display: 'grid', gridTemplateColumns: 'repeat(3, minmax(140px, 1fr))', gap: '0.45rem' }}>
                <div style={{ border: '1px solid #BFDBFE', background: '#EFF6FF', borderRadius: '0.4rem', padding: '0.45rem 0.6rem' }}>
                  <div style={{ color: '#1D4ED8', fontSize: '0.72rem', fontWeight: '700' }}>Total Debit</div>
                  <div style={{ color: '#1E3A8A', fontWeight: '800' }}>{jvDisplayDebit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                </div>
                <div style={{ border: '1px solid #FECACA', background: '#FEF2F2', borderRadius: '0.4rem', padding: '0.45rem 0.6rem' }}>
                  <div style={{ color: '#DC2626', fontSize: '0.72rem', fontWeight: '700' }}>Total Credit</div>
                  <div style={{ color: '#991B1B', fontWeight: '800' }}>{jvDisplayCredit.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                </div>
                <div style={{ border: `1px solid ${jvIsBalanced ? '#86EFAC' : '#FDE68A'}`, background: jvIsBalanced ? '#ECFDF5' : '#FFFBEB', borderRadius: '0.4rem', padding: '0.45rem 0.6rem' }}>
                  <div style={{ color: jvIsBalanced ? '#166534' : '#92400E', fontSize: '0.72rem', fontWeight: '700' }}>Difference</div>
                  <div style={{ color: jvIsBalanced ? '#166534' : '#B45309', fontWeight: '800' }}>{Math.abs(jvDifference).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                </div>
              </div>

              {/* Action row */}
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', padding: '0.65rem 1rem', background: '#F8FAFC', borderTop: '1px solid #E2E8F0', flexWrap: 'wrap' }}>
                <button type="button" onClick={addJvLine} style={{ padding: '0.38rem 0.8rem', background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE', borderRadius: '0.375rem', cursor: 'pointer', fontWeight: '700', fontSize: '0.82rem' }}>+ Add Row</button>
                <button
                  type="button"
                  onClick={handleSaveMultiLineJV}
                  disabled={saving || !jvValidation.canSave}
                  style={{ padding: '0.38rem 1.2rem', background: jvValidation.canSave ? '#16A34A' : '#9CA3AF', color: '#fff', border: 'none', borderRadius: '0.375rem', cursor: jvValidation.canSave ? 'pointer' : 'not-allowed', fontWeight: '700', fontSize: '0.85rem' }}
                >
                  {saving ? 'Saving...' : jvEditEntryIds.length > 0 ? '💾 Update JV' : '💾 Save JV'}
                </button>
                <button type="button" onClick={handlePrintJvVoucher} style={{ padding: '0.38rem 0.8rem', background: '#FEF3C7', color: '#92400E', border: '1px solid #FDE68A', borderRadius: '0.375rem', cursor: 'pointer', fontWeight: '700', fontSize: '0.82rem' }}>Print JV</button>
                <button type="button" onClick={closeJvModal} style={{ padding: '0.38rem 0.8rem', background: '#fff', color: '#374151', border: '1px solid #D1D5DB', borderRadius: '0.375rem', cursor: 'pointer', fontSize: '0.82rem' }}>Cancel</button>
                <span style={{ marginLeft: 'auto', fontSize: '0.74rem', color: '#94A3B8' }}>Press <kbd style={{ background: '#E5E7EB', padding: '0 0.3rem', borderRadius: '0.2rem', fontSize: '0.72rem' }}>Enter</kbd> on last row to add a new line</span>
              </div>
            </div>
                <div
                  onMouseDown={beginJvModalResize}
                  title="Resize"
                  style={{ position: 'absolute', right: '6px', bottom: '6px', width: '16px', height: '16px', cursor: 'nwse-resize', background: 'linear-gradient(135deg, transparent 50%, #64748B 50%)', borderBottomRightRadius: '0.35rem' }}
                />
              </div>
            </div>
            )
          })()}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1rem' }}>
            <input
              type="date"
              value={ledgerFilters.startDate}
              onChange={(e) => setLedgerFilters((prev) => ({ ...prev, startDate: e.target.value }))}
              style={modalInputStyle}
            />
            <input
              type="date"
              value={ledgerFilters.endDate}
              onChange={(e) => setLedgerFilters((prev) => ({ ...prev, endDate: e.target.value }))}
              style={modalInputStyle}
            />
            <select
              value={ledgerFilters.department}
              onChange={(e) => setLedgerFilters((prev) => ({ ...prev, department: e.target.value }))}
              style={modalInputStyle}
            >
              <option value="">All Departments</option>
              {LEDGER_DEPARTMENTS.map((department) => (
                <option key={department} value={department}>{department}</option>
              ))}
            </select>
            <select
              value={ledgerFilters.referenceType}
              onChange={(e) => setLedgerFilters((prev) => ({ ...prev, referenceType: e.target.value }))}
              style={modalInputStyle}
            >
              <option value="">All Types</option>
              {LEDGER_REFERENCE_TYPES.map((referenceType) => (
                <option key={referenceType} value={referenceType}>{referenceType}</option>
              ))}
            </select>
            <select
              value={ledgerFilters.accountId}
              onChange={(e) => setLedgerFilters((prev) => ({ ...prev, accountId: e.target.value }))}
              style={modalInputStyle}
            >
              <option value="">All Accounts</option>
              {accounts.map((account) => (
                <option key={account._id} value={account._id}>{account.accountCode} - {account.accountName}</option>
              ))}
            </select>
            <button
              onClick={() => setLedgerFilters({ startDate: '', endDate: '', department: '', referenceType: '', accountId: '' })}
              style={{ padding: '0.65rem 0.75rem', background: '#E5E7EB', color: C.ink, border: '1px solid #D1D5DB', borderRadius: '0.5rem', cursor: 'pointer', height: 'fit-content' }}
            >
              Reset Filters
            </button>
          </div>
          <div style={{ overflowX: 'auto', background: C.p1, borderRadius: '0.5rem' }}>
            {(() => {
              const pagedLedgerEntries = [...groupedJvVouchers]
                .sort((a, b) => {
                  if (sorting.ledger.by === 'date') {
                    return sorting.ledger.asc ? new Date(a.date) - new Date(b.date) : new Date(b.date) - new Date(a.date)
                  } else if (sorting.ledger.by === 'amount') {
                    return sorting.ledger.asc ? a.totalBaseAmount - b.totalBaseAmount : b.totalBaseAmount - a.totalBaseAmount
                  }
                  return 0
                })

              return (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.p2}` }}>
                  <th onClick={() => setSorting({...sorting, ledger: {by: 'date', asc: !sorting.ledger.asc}})} style={{ padding: '0.75rem', textAlign: 'left', color: C.t1, fontWeight: '600', cursor: 'pointer', background: sorting.ledger.by === 'date' ? C.p2 : 'transparent' }}>Date {sorting.ledger.by === 'date' && (sorting.ledger.asc ? '▲' : '▼')}</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', color: C.t1, fontWeight: '600', minWidth: '110px' }}>Voucher No.</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', color: C.t1, fontWeight: '600', maxWidth: '220px' }}>Narration / detail</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', color: C.t1, fontWeight: '600' }}>Debit Account</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', color: C.t1, fontWeight: '600' }}>Credit Account</th>
                  <th onClick={() => setSorting({...sorting, ledger: {by: 'amount', asc: !sorting.ledger.asc}})} style={{ padding: '0.75rem', textAlign: 'right', color: C.t1, fontWeight: '600', cursor: 'pointer', background: sorting.ledger.by === 'amount' ? C.p2 : 'transparent' }}>Amount {sorting.ledger.by === 'amount' && (sorting.ledger.asc ? '▲' : '▼')}</th>
                  <th style={{ padding: '0.75rem', textAlign: 'left', color: C.t1, fontWeight: '600' }}>Type</th>
                  <th style={{ padding: '0.75rem', textAlign: 'center', color: C.t1, fontWeight: '600' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagedLedgerEntries
                  .map((voucher) => {
                    const entry = voucher.representative
                    const voucherNo = voucher.voucherNo
                    const narrDetail = voucher.narration
                    const isBankJv = String(voucher.referenceType || '').toLowerCase() === 'bank_jv'
                    return (
                    <tr key={voucher.key} style={{ borderBottom: `1px solid ${C.p2}`, background: isBankJv ? '#F0F9FF' : 'transparent' }}>
                      <td style={{ padding: '0.75rem', color: C.t2 }}>{new Date(voucher.date).toLocaleDateString()}</td>
                      <td style={{ padding: '0.75rem', color: C.t1, fontWeight: '700', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>{voucherNo}</td>
                      <td style={{ padding: '0.75rem', color: C.t2, fontSize: '0.78rem', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis' }} title={narrDetail}>{narrDetail}</td>
                      <td style={{ padding: '0.75rem', color: C.t2, fontSize: '0.82rem' }} title={voucher.debitAccounts}>{voucher.debitAccounts}</td>
                      <td style={{ padding: '0.75rem', color: C.t2, fontSize: '0.82rem' }} title={voucher.creditAccounts}>{voucher.creditAccounts}</td>
                      <td style={{ padding: '0.75rem', textAlign: 'right', color: C.t1, fontWeight: '600' }}>
                        {(() => {
                          const baseSym = String(baseCurrencyCode || '').trim().toUpperCase() || 'USD'
                          const baseEq = Number(voucher.totalBaseAmount || 0)
                          const legacyFc = inferLegacyJvBatchDisplayFc(voucher.entries, baseCurrencyCode)
                          const fxRow = legacyFc
                            ? (currencies || []).find((c) => normalizeJvCurrencyCode(c?.code) === normalizeJvCurrencyCode(legacyFc))
                            : null
                          const dispRate = fxRow ? Number(fxRow.exchangeRate || 0) : 0
                          const useLegacyFc = Boolean(legacyFc && dispRate > 0)
                          const isJournalJv = String(voucher.referenceType || '').toLowerCase() === 'journal'
                          const lineHint = voucher.lineCount > 1 ? `${voucher.lineCount} ledger lines` : ''

                          if (isJournalJv && voucher.documentFaceAmount != null && voucher.documentCurrencyCode) {
                            return (
                              <div title={lineHint || undefined}>
                                <span>{Number(voucher.documentFaceAmount).toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                                <span style={{ marginLeft: '0.25rem', fontSize: '0.72rem', color: C.inkSoft, fontWeight: '600' }}>{voucher.documentCurrencyCode}</span>
                                <div style={{ fontSize: '0.68rem', color: C.inkSoft, marginTop: '0.12rem', fontWeight: '600' }}>
                                  ≈ {baseEq.toLocaleString(undefined, { maximumFractionDigits: 2 })} {baseSym}
                                </div>
                                {lineHint ? (
                                  <div style={{ fontSize: '0.68rem', color: C.inkSoft, marginTop: '0.12rem', fontWeight: '600' }}>{lineHint}</div>
                                ) : null}
                              </div>
                            )
                          }

                          if (isJournalJv) {
                            return (
                              <div title={lineHint || undefined}>
                                <span>{baseEq.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                                <span style={{ marginLeft: '0.25rem', fontSize: '0.72rem', color: C.inkSoft, fontWeight: '600' }}>{baseSym}</span>
                                {lineHint ? (
                                  <div style={{ fontSize: '0.68rem', color: C.inkSoft, marginTop: '0.12rem', fontWeight: '600' }}>{lineHint}</div>
                                ) : null}
                              </div>
                            )
                          }

                          let displayAmt = baseEq
                          let displaySym = baseSym
                          if (useLegacyFc) {
                            displaySym = normalizeJvCurrencyCode(legacyFc)
                            const rawFc = baseEq / dispRate
                            displayAmt = dispRate < 0.001 ? Math.round(rawFc) : Number(rawFc.toFixed(2))
                          }

                          const isFc = displaySym && normalizeJvCurrencyCode(displaySym) !== baseSym
                          return (
                            <div title={lineHint || undefined}>
                              <span>{displayAmt.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                              {displaySym ? (
                                <span style={{ marginLeft: '0.25rem', fontSize: '0.72rem', color: C.inkSoft, fontWeight: '600' }}>{displaySym}</span>
                              ) : null}
                              {isFc ? (
                                <div style={{ fontSize: '0.68rem', color: C.inkSoft, marginTop: '0.12rem', fontWeight: '600' }}>
                                  ≈ {baseEq.toLocaleString(undefined, { maximumFractionDigits: 2 })} {baseSym}
                                </div>
                              ) : null}
                              {lineHint ? (
                                <div style={{ fontSize: '0.68rem', color: C.inkSoft, marginTop: '0.12rem', fontWeight: '600' }}>{lineHint}</div>
                              ) : null}
                            </div>
                          )
                        })()}
                      </td>
                      <td style={{ padding: '0.75rem', color: C.t2 }}>
                        {isBankJv ? (
                          <div>
                            <span style={{ background: '#DBEAFE', color: '#1E40AF', padding: '0.15rem 0.4rem', borderRadius: '0.25rem', fontSize: '0.75rem', fontWeight: '700' }}>🏦 Bank JV</span>
                            {voucher.lineCount > 1 && (
                              <div style={{ fontSize: '0.7rem', color: '#64748B', marginTop: '0.15rem' }}>{voucher.lineCount} lines</div>
                            )}
                            {voucher.autoTxNo && <div style={{ fontSize: '0.7rem', color: '#64748B', marginTop: '0.15rem' }}>{voucher.autoTxNo}</div>}
                            {voucher.chequeNo && <div style={{ fontSize: '0.7rem', color: '#64748B' }}>Chq: {voucher.chequeNo}</div>}
                          </div>
                        ) : (
                          <div>
                            <span>{voucher.referenceType}</span>
                            {voucher.lineCount > 1 && (
                              <div style={{ fontSize: '0.7rem', color: '#64748B', marginTop: '0.15rem' }}>{voucher.lineCount} lines</div>
                            )}
                          </div>
                        )}
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                        <div style={{ display: 'flex', gap: '0.35rem', justifyContent: 'center', flexWrap: 'wrap' }}>
                          <button
                            onClick={() => {
                              void handleEditJv(entry)
                            }}
                            title="Edit voucher"
                            style={{ padding: '0.35rem 0.5rem', background: '#0F766E', color: '#fff', border: 'none', borderRadius: '0.35rem', cursor: 'pointer', fontSize: '0.75rem' }}
                          >
                            Edit
                          </button>
                          {voucher.attachmentUrl && (
                            <a href={`${(import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL || '').replace(/\/$/, '')}${voucher.attachmentUrl}`} target="_blank" rel="noreferrer" style={{ padding: '0.35rem 0.5rem', background: '#1D4ED8', color: '#fff', border: 'none', borderRadius: '0.35rem', cursor: 'pointer', fontSize: '0.75rem', textDecoration: 'none' }}>Slip</a>
                          )}
                          <button onClick={() => handleReverseLedger(voucher)} title="Reverse voucher" style={{ padding: '0.35rem 0.5rem', background: C.danger, color: '#fff', border: 'none', borderRadius: '0.35rem', cursor: 'pointer', fontSize: '0.75rem' }}>Reverse</button>
                        </div>
                      </td>
                    </tr>
                    )
                  })}
              </tbody>
            </table>
              )
            })()}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.85rem' }}>
            <p style={{ margin: 0, color: C.inkSoft, fontSize: '0.84rem' }}>
              Showing {Number(groupedJvVouchers.length || 0).toLocaleString()} vouchers
              {visibleJvLedgerEntries.length > 0
                ? ` (${Number(visibleJvLedgerEntries.length).toLocaleString()} ledger lines loaded)`
                : ''}
            </p>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                disabled={!ledgerMeta.cursorHistory?.length}
                onClick={() => {
                  const history = Array.isArray(ledgerMeta.cursorHistory) ? [...ledgerMeta.cursorHistory] : []
                  const previousCursor = history.pop() || null
                  loadLedger({ cursor: previousCursor, cursorHistory: history })
                }}
                style={{ padding: '0.45rem 0.8rem', borderRadius: '0.35rem', border: '1px solid #D1D5DB', background: '#fff', color: C.ink, cursor: 'pointer' }}
              >
                Previous
              </button>
              <button
                type="button"
                disabled={!ledgerMeta.hasMore || !ledgerMeta.nextCursor}
                onClick={() => {
                  const history = [...(ledgerMeta.cursorHistory || []), ledgerMeta.cursor || null]
                  loadLedger({ cursor: ledgerMeta.nextCursor, cursorHistory: history })
                }}
                style={{ padding: '0.45rem 0.8rem', borderRadius: '0.35rem', border: '1px solid #D1D5DB', background: '#fff', color: C.ink, cursor: 'pointer' }}
              >
                Next
              </button>
            </div>
          </div>

          {groupedJvVouchers.length === 0 && <p style={{ color: C.inkSoft, marginTop: '1rem', textAlign: 'center' }}>No {ledgerVoucherTab === 'bank_jv' ? 'Bank JV' : 'Journal Voucher'} entries yet.</p>}
        </div>
      )}

    </>
  )
}
